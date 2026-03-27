import * as THREE from 'three';
import { assetManager } from '#/common/AssetManager';
import { BLOCK_DEFS } from '#/common/BlockRegistry';
import { computeEnvironmentSnapshot, type MineWebWeather } from '#/common/EnvironmentModel';
import type { HudModel } from '#/common/HudModel';
import { getItemDef } from '#/common/ItemRegistry';
import { PLAYER_EYE_HEIGHT, RENDER_DIST, type ViewMode } from '#/common/types';
import { HudRenderer } from './HudRenderer';
import { PlayerModel } from './PlayerModel';
import type { TextureAtlas } from './TextureAtlas';

export class Renderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  playerModel: PlayerModel;
  hud: HudRenderer;

  private raycaster = new THREE.Raycaster();
  private readonly raycastCenter = new THREE.Vector2(0, 0);
  private frustum = new THREE.Frustum();
  private projScreenMatrix = new THREE.Matrix4();
  private readonly tmpHitBlock = new THREE.Vector3();
  private readonly tmpHitNormal = new THREE.Vector3();
  private readonly tmpRight = new THREE.Vector3();
  private readonly tmpUp = new THREE.Vector3();
  private readonly tmpForward = new THREE.Vector3();
  private targetHighlight: THREE.LineSegments;
  private breakCrackOverlay: THREE.LineSegments;
  private clouds: THREE.Mesh | null = null;
  private sunSprite: THREE.Sprite;
  private moonSprite: THREE.Sprite;
  private stars: THREE.Points;
  private hemisphereLight: THREE.HemisphereLight;
  private readonly tmpColorGround = new THREE.Color();
  private readonly tmpGroundNight = new THREE.Color(0x100c12);
  private heldItemMesh: THREE.Mesh;
  private heldItemMaterial: THREE.MeshLambertMaterial;
  private heldItemId: number | null = null;
  private heldItemLoadToken = 0;
  private heldItemSwing = 0;
  private heldItemIsBlock = true;
  private readonly heldItemBlockGeo: THREE.BoxGeometry;
  private readonly heldItemFlatGeo: THREE.PlaneGeometry;
  private atlas: TextureAtlas | null = null;
  private readonly tmpCelestialSun = new THREE.Vector3();
  private readonly tmpCelestialMoon = new THREE.Vector3();
  viewMode: ViewMode = 'first-person';
  weather: MineWebWeather = 'clear';
  private _renderDistance = RENDER_DIST;

  get renderDistance() { return this._renderDistance; }
  set renderDistance(value: number) {
    this._renderDistance = value;
    this.camera.far = Math.max(400, value * 16 * 1.3);
    this.camera.updateProjectionMatrix();
  }
  private blockMaterial: THREE.ShaderMaterial | null = null;

  timeOfDay = 0;
  private sunLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private shadowsEnabled = false;
  private shadowQuality = 1;

  constructor(
    canvas: HTMLCanvasElement,
    options?: { preserveDrawingBuffer?: boolean },
  ) {
    this.canvas = canvas;

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: options?.preserveDrawingBuffer ?? false,
        logarithmicDepthBuffer: true,
      });
    } catch {
      throw new Error('WebGL not supported');
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(this.ambientLight);
    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.6);
    this.sunLight.position.set(50, 100, 30);
    this.sunLight.castShadow = false;
    this.sunLight.shadow.bias = -0.00025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x362a14, 0.4);
    this.scene.add(this.hemisphereLight);

    const wireGeo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
    const edges = new THREE.EdgesGeometry(wireGeo);
    wireGeo.dispose();
    this.targetHighlight = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }),
    );
    this.targetHighlight.visible = false;
    this.scene.add(this.targetHighlight);

    const crackGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    const crackEdges = new THREE.EdgesGeometry(crackGeo);
    crackGeo.dispose();
    this.breakCrackOverlay = new THREE.LineSegments(
      crackEdges,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.breakCrackOverlay.visible = false;
    this.scene.add(this.breakCrackOverlay);

    this.playerModel = new PlayerModel();
    this.playerModel.group.visible = false;
    this.scene.add(this.playerModel.group);

    this.heldItemMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.2,
      side: THREE.DoubleSide,
    });
    this.heldItemBlockGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    this.heldItemFlatGeo = new THREE.PlaneGeometry(0.22, 0.22);
    this.heldItemMesh = new THREE.Mesh(
      this.heldItemBlockGeo,
      this.heldItemMaterial,
    );
    this.heldItemMesh.visible = false;
    this.scene.add(this.heldItemMesh);

    this.sunSprite = this.createCelestialSprite('sun');
    this.scene.add(this.sunSprite);
    this.moonSprite = this.createCelestialSprite('moon');
    this.scene.add(this.moonSprite);

    this.stars = this.createStarField();

    this.hud = new HudRenderer();

    this.createClouds();
  }

  async initHud() {
    await this.hud.init();
  }

  setBlockMaterial(material: THREE.ShaderMaterial | null) {
    this.blockMaterial = material;
  }

  setAtlas(atlas: TextureAtlas) {
    this.atlas = atlas;
  }

  setShadowSettings(enabled: boolean, quality: number, renderDistance = this.renderDistance) {
    const nextQuality = Math.max(0, Math.min(2, Math.round(quality)));
    const changed = this.shadowsEnabled !== enabled || this.shadowQuality !== nextQuality;
    this.shadowsEnabled = enabled;
    this.shadowQuality = nextQuality;
    this.renderer.shadowMap.enabled = enabled;
    this.sunLight.castShadow = enabled;
    if (!enabled) return changed;

    const mapSizes = [512, 1024, 2048] as const;
    const mapSize = mapSizes[nextQuality] ?? 1024;
    this.sunLight.shadow.mapSize.set(mapSize, mapSize);
    const cameraRadius = Math.max(24, Math.min(96, renderDistance * 8));
    const shadowCamera = this.sunLight.shadow.camera as THREE.OrthographicCamera;
    shadowCamera.left = -cameraRadius;
    shadowCamera.right = cameraRadius;
    shadowCamera.top = cameraRadius;
    shadowCamera.bottom = -cameraRadius;
    shadowCamera.near = 1;
    shadowCamera.far = Math.max(140, cameraRadius * 3);
    shadowCamera.updateProjectionMatrix();
    return changed;
  }

  private createClouds() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const c = canvas.getContext('2d')!;
    c.clearRect(0, 0, canvas.width, canvas.height);

    const cell = 8;
    const stampCloud = (gx: number, gy: number, rows: readonly string[]) => {
      for (let row = 0; row < rows.length; row++) {
        const pattern = rows[row]!;
        for (let col = 0; col < pattern.length; col++) {
          if (pattern[col] !== '#') continue;
          c.fillRect((gx + col) * cell, (gy + row) * cell, cell, cell);
        }
      }
    };

    c.fillStyle = 'rgba(255,255,255,0.92)';

    // Deterministic chunky cloud stamps for MC-like flat clouds and stable regression output.
    stampCloud(2, 1, [
      '..####....',
      '.######...',
      '########..',
      '.######...',
    ]);
    stampCloud(18, 2, [
      '...#####...',
      '.########..',
      '##########.',
      '..######...',
    ]);
    stampCloud(8, 9, [
      '..###...',
      '.#####..',
      '#######.',
      '.#####..',
    ]);
    stampCloud(22, 11, [
      '..####..',
      '.######.',
      '########',
      '.######.',
    ]);
    stampCloud(4, 20, [
      '...####....',
      '.########..',
      '##########.',
      '..######...',
    ]);
    stampCloud(17, 21, [
      '..#####...',
      '.#######..',
      '#########.',
      '..#####...',
    ]);
    stampCloud(26, 26, [
      '.####..',
      '######.',
      '######.',
      '.####..',
    ]);

    // Add a few smaller fragments so the layer does not look too tiled.
    c.fillStyle = 'rgba(255,255,255,0.78)';
    for (const [gx, gy, w, h] of [
      [14, 5, 3, 1],
      [28, 6, 2, 1],
      [1, 13, 2, 1],
      [13, 16, 3, 1],
      [30, 18, 2, 1],
      [10, 28, 2, 1],
    ] as const) {
      c.fillRect(gx * cell, gy * cell, w * cell, h * cell);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.repeat.set(4, 4);

    const geo = new THREE.PlaneGeometry(800, 800);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.clouds = new THREE.Mesh(geo, mat);
    this.clouds.rotation.x = Math.PI / 2;
    this.clouds.position.y = 128; // High above
    this.scene.add(this.clouds);
  }

  private createCelestialSprite(kind: 'sun' | 'moon') {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    const px = 4;
    const drawPixel = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x * px, y * px, px, px);
    };

    if (kind === 'sun') {
      for (let y = 2; y < 14; y++) {
        for (let x = 2; x < 14; x++) {
          const edge = x === 2 || x === 13 || y === 2 || y === 13;
          drawPixel(x, y, edge ? '#f59e0b' : '#fde047');
        }
      }
    } else {
      for (let y = 2; y < 14; y++) {
        for (let x = 2; x < 14; x++) {
          const edge = x === 2 || x === 13 || y === 2 || y === 13;
          drawPixel(x, y, edge ? '#cbd5e1' : '#f8fafc');
        }
      }
      for (const [x, y, size] of [
        [5, 5, 2],
        [9, 4, 1],
        [10, 9, 2],
        [6, 10, 1],
      ] as const) {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x * px, y * px, size * px, size * px);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = -10;
    sprite.scale.set(20, 20, 1);
    return sprite;
  }

  /** MC-style arc: rotate around X (YZ plane), φ=0 sunrise, φ=π/2 noon, φ=π sunset. */
  private createStarField() {
    const count = 480;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const cosPhi = 0.04 + Math.random() * 0.82;
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
      const r = 340;
      positions[i * 3] = r * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = r * cosPhi;
      positions[i * 3 + 2] = r * sinPhi * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xe8f0ff,
      size: 2.4,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.renderOrder = -12;
    this.scene.add(points);
    return points;
  }

  private updateCelestialBodies() {
    const phi = this.timeOfDay * Math.PI * 2;
    const R = 210;
    const center = this.camera.position;
    const sunVec = this.tmpCelestialSun.set(0, R * Math.sin(phi), -R * Math.cos(phi));
    const moonVec = this.tmpCelestialMoon.copy(sunVec).multiplyScalar(-1);

    this.sunSprite.position.copy(center).add(sunVec);
    this.moonSprite.position.copy(center).add(moonVec);

    const sunElevation = Math.sin(phi);
    const moonElevation = -sunElevation;
    const sunMaterial = this.sunSprite.material as THREE.SpriteMaterial;
    const moonMaterial = this.moonSprite.material as THREE.SpriteMaterial;
    sunMaterial.opacity = 0.1 + Math.max(0, sunElevation) * 0.9;
    moonMaterial.opacity = 0.08 + Math.max(0, moonElevation) * 0.85;
    this.sunSprite.visible = sunMaterial.opacity > 0.12;
    this.moonSprite.visible = moonMaterial.opacity > 0.1;
  }

  updateCamera(px: number, py: number, pz: number, yaw: number, pitch: number, viewMode?: ViewMode) {
    const mode = viewMode ?? this.viewMode;
    const eyeY = py + PLAYER_EYE_HEIGHT;

    if (mode === 'first-person') {
      this.camera.position.set(px, eyeY, pz);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = yaw;
      this.camera.rotation.x = pitch;
      this.playerModel.group.visible = false;
    } else {
      const dist = 4;
      const sign = mode === 'third-back' ? 1 : -1;
      const camX = px + Math.sin(yaw) * dist * sign;
      const camZ = pz + Math.cos(yaw) * dist * sign;
      const camY = eyeY + 1.5;
      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(px, eyeY, pz);

      this.playerModel.setPosition(px, py, pz);
      this.playerModel.setRotation(yaw);
      this.playerModel.group.visible = true;
    }
  }

  /** Dispose multi-face held-block geometry only; never dispose shared box/plane primitives. */
  private disposeHeldItemGeometryIfCustom() {
    const g = this.heldItemMesh.geometry;
    if (g !== this.heldItemBlockGeo && g !== this.heldItemFlatGeo) {
      g.dispose();
    }
  }

  setHeldItem(itemId: number | null | undefined) {
    const resolved = typeof itemId === 'number' ? itemId : null;
    if (resolved === this.heldItemId) return;
    this.heldItemId = resolved;
    this.heldItemLoadToken += 1;
    const token = this.heldItemLoadToken;

    const def = getItemDef(resolved);
    if (!def) {
      this.disposeHeldItemGeometryIfCustom();
      this.heldItemMaterial.map = null;
      this.heldItemMaterial.color.setHex(0xffffff);
      this.heldItemMaterial.needsUpdate = true;
      this.heldItemMesh.visible = false;
      return;
    }

    const isBlock = def.kind === 'block';
    this.heldItemIsBlock = isBlock;

    if (isBlock && this.atlas && def.blockId != null) {
      const blockDef = BLOCK_DEFS[def.blockId];
      if (blockDef) {
        const geo = buildHeldBlockGeometry(blockDef.textures, this.atlas, 0.22);
        this.disposeHeldItemGeometryIfCustom();
        this.heldItemMesh.geometry = geo;
        this.heldItemMaterial.map = this.atlas.texture;
        this.heldItemMaterial.color.setHex(0xffffff);
        this.heldItemMaterial.needsUpdate = true;
        this.heldItemMesh.visible = true;
        return;
      }
    }

    this.disposeHeldItemGeometryIfCustom();
    this.heldItemMesh.geometry = isBlock ? this.heldItemBlockGeo : this.heldItemFlatGeo;

    const primary = isBlock
      ? assetManager.loadBlockTexture(def.texture)
      : assetManager.loadItemTexture(def.texture);
    void primary.then(async (img) => {
      if (token !== this.heldItemLoadToken) return;
      if (!img) {
        const fallback = isBlock
          ? await assetManager.loadItemTexture(def.texture)
          : await assetManager.loadBlockTexture(def.texture);
        if (token !== this.heldItemLoadToken) return;
        if (!fallback) {
          this.heldItemMaterial.map = null;
          this.heldItemMaterial.color.setHex(0x808080);
          this.heldItemMaterial.needsUpdate = true;
          this.heldItemMesh.visible = true;
          return;
        }
        img = fallback;
      }
      const tex = new THREE.CanvasTexture(img);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;

      const oldMap = this.heldItemMaterial.map;
      if (oldMap && oldMap !== this.atlas?.texture) {
        oldMap.dispose();
      }
      this.heldItemMaterial.map = tex;
      this.heldItemMaterial.color.setHex(0xffffff);
      this.heldItemMaterial.needsUpdate = true;
      this.heldItemMesh.visible = true;
    });
  }

  triggerHeldItemSwing(strength = 1) {
    this.heldItemSwing = Math.min(1, this.heldItemSwing + Math.max(0.2, strength));
  }

  private tmpHitResult = { block: null as unknown as THREE.Vector3, normal: null as unknown as THREE.Vector3 };

  setBreakCrackProgress(x: number, y: number, z: number, progress: number) {
    const p = Math.min(1, Math.max(0, progress));
    this.breakCrackOverlay.position.set(x + 0.5, y + 0.5, z + 0.5);
    const mat = this.breakCrackOverlay.material as THREE.LineBasicMaterial;
    mat.opacity = 0.1 + p * 0.82;
    mat.needsUpdate = true;
    this.breakCrackOverlay.visible = true;
  }

  clearBreakCrackOverlay() {
    this.breakCrackOverlay.visible = false;
  }

  updateTarget(chunkMeshes: THREE.Mesh[]): { block: THREE.Vector3; normal: THREE.Vector3 } | null {
    this.raycaster.setFromCamera(this.raycastCenter, this.camera);
    this.raycaster.far = 6;
    const hits = this.raycaster.intersectObjects(chunkMeshes, false);

    if (hits.length > 0 && hits[0].face) {
      const hit = hits[0];
      const n = hit.face!.normal;
      const bp = this.tmpHitBlock.set(
        Math.floor(hit.point.x - n.x * 0.01),
        Math.floor(hit.point.y - n.y * 0.01),
        Math.floor(hit.point.z - n.z * 0.01),
      );
      this.targetHighlight.position.set(bp.x + 0.5, bp.y + 0.5, bp.z + 0.5);
      this.targetHighlight.visible = true;
      this.tmpHitNormal.copy(n);
      this.tmpHitResult.block = bp;
      this.tmpHitResult.normal = this.tmpHitNormal;
      return this.tmpHitResult;
    }
    this.targetHighlight.visible = false;
    return null;
  }

  private tmpEntityHitResult = { id: 0, type: '' };

  updateTargetEntity(objects: THREE.Object3D[]): { id: number; type: string } | null {
    this.raycaster.setFromCamera(this.raycastCenter, this.camera);
    this.raycaster.far = 6;
    const hits = this.raycaster.intersectObjects(objects, true);
    for (const hit of hits) {
      const id = hit.object.userData.minewebEntityId;
      const type = hit.object.userData.minewebEntityType;
      if (typeof id === 'number' && typeof type === 'string') {
        this.tmpEntityHitResult.id = id;
        this.tmpEntityHitResult.type = type;
        return this.tmpEntityHitResult;
      }
    }
    return null;
  }

  cullChunks(chunkMeshes: THREE.Mesh[]) {
    this.projScreenMatrix.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    for (const mesh of chunkMeshes) {
      mesh.visible = this.frustum.intersectsObject(mesh);
    }
  }

  render(chunkMeshes?: THREE.Mesh[], hudModel?: HudModel) {
    const environment = computeEnvironmentSnapshot({
      timeOfDay: this.timeOfDay,
      weather: this.weather,
      renderDistance: this.renderDistance,
    });

    const phi = this.timeOfDay * Math.PI * 2;
    this.tmpCelestialSun.set(0, Math.sin(phi), -Math.cos(phi)).normalize();
    this.sunLight.position.copy(this.tmpCelestialSun).multiplyScalar(220);
    this.sunLight.intensity = environment.sunIntensity;
    (this.scene.background as THREE.Color).setHex(environment.skyColor);
    this.ambientLight.intensity = environment.ambientIntensity;

    this.hemisphereLight.color.setHex(environment.skyColor);
    this.tmpColorGround.setHex(0x3a2a18);
    this.tmpColorGround.lerp(
      this.tmpGroundNight,
      environment.starVisibility * 0.75 + (1 - environment.dayBrightness) * 0.2,
    );
    this.hemisphereLight.groundColor.copy(this.tmpColorGround);
    this.hemisphereLight.intensity = 0.1 + environment.dayBrightness * 0.38;

    this.updateCelestialBodies();

    const starMat = this.stars.material as THREE.PointsMaterial;
    starMat.opacity = environment.starVisibility * 0.92;
    this.stars.visible = starMat.opacity > 0.015;
    this.stars.position.copy(this.camera.position);

    if (this.blockMaterial?.uniforms) {
      this.blockMaterial.uniforms.uFogColor.value.setHex(environment.fogColor);
      this.blockMaterial.uniforms.uFogNear.value = environment.fogNear;
      this.blockMaterial.uniforms.uFogFar.value = environment.fogFar;
      this.blockMaterial.uniforms.uSunIntensity.value = environment.sunIntensity;
    }

    if (this.clouds) {
      const mat = this.clouds.material as THREE.MeshBasicMaterial;
      if (mat.map) {
        mat.map.offset.x += 0.00005;
        mat.map.offset.y += 0.00002;
      }
      mat.opacity = environment.cloudOpacity;
      mat.color.setHex(environment.cloudColor);
      this.clouds.position.x = this.camera.position.x;
      this.clouds.position.z = this.camera.position.z;
    }
    if (chunkMeshes?.length) this.cullChunks(chunkMeshes);
    if (hudModel) this.hud.update(hudModel);
    if (this.viewMode === 'first-person' && this.heldItemId != null) {
      this.heldItemSwing *= 0.86;
      const swing = this.heldItemSwing;
      const right = this.tmpRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const up = this.tmpUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
      const forward = this.tmpForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this.heldItemMesh.position
        .copy(this.camera.position)
        .add(right.multiplyScalar(0.32 + swing * 0.12))
        .add(up.multiplyScalar(-0.26 - swing * 0.08))
        .add(forward.multiplyScalar(0.55 - swing * 0.1));
      this.heldItemMesh.quaternion.copy(this.camera.quaternion);
      if (this.heldItemIsBlock) {
        this.heldItemMesh.rotateY(-0.65 - swing * 0.8);
        this.heldItemMesh.rotateX(-0.35 - swing * 0.4);
      } else {
        this.heldItemMesh.rotateY(-0.4 - swing * 0.6);
        this.heldItemMesh.rotateX(-0.1 - swing * 0.3);
        this.heldItemMesh.rotateZ(-0.25);
      }
      this.heldItemMesh.visible = true;
    } else {
      this.heldItemSwing = 0;
      this.heldItemMesh.visible = false;
    }
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (hudModel) this.hud.render(this.renderer);
  }

  setFov(fov: number) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.hud.resize(w, h);
  }

  dispose() {
    this.playerModel.dispose();
    if (this.heldItemMaterial.map && this.heldItemMaterial.map !== this.atlas?.texture) {
      this.heldItemMaterial.map.dispose();
    }
    this.disposeHeldItemGeometryIfCustom();
    this.heldItemBlockGeo.dispose();
    this.heldItemFlatGeo.dispose();
    this.heldItemMaterial.dispose();
    this.targetHighlight.geometry.dispose();
    (this.targetHighlight.material as THREE.Material).dispose();
    this.breakCrackOverlay.geometry.dispose();
    (this.breakCrackOverlay.material as THREE.Material).dispose();
    if (this.clouds) {
      this.clouds.geometry.dispose();
      (this.clouds.material as THREE.Material).dispose();
      if ((this.clouds.material as THREE.MeshBasicMaterial).map) {
        (this.clouds.material as THREE.MeshBasicMaterial).map!.dispose();
      }
    }
    this.stars.geometry.dispose();
    (this.stars.material as THREE.PointsMaterial).dispose();
    for (const sprite of [this.sunSprite, this.moonSprite]) {
      const material = sprite.material as THREE.SpriteMaterial;
      material.map?.dispose();
      material.dispose();
    }
    this.hud.dispose();
    this.renderer.dispose();
  }
}

type FaceUVQuad = { corners: number[][]; normal: number[]; uvs: [number, number, number, number] };

export function buildHeldBlockGeometry(
  textures: { top: string; bottom: string; north: string; south: string; east: string; west: string },
  atlas: TextureAtlas,
  size: number,
): THREE.BufferGeometry {
  const h = size / 2;
  const faces: FaceUVQuad[] = [
    { corners: [[-h,h,h],[h,h,h],[h,h,-h],[-h,h,-h]], normal: [0,1,0], uvs: atlas.getUV(textures.top) },
    { corners: [[-h,-h,-h],[h,-h,-h],[h,-h,h],[-h,-h,h]], normal: [0,-1,0], uvs: atlas.getUV(textures.bottom) },
    { corners: [[-h,-h,h],[h,-h,h],[h,h,h],[-h,h,h]], normal: [0,0,1], uvs: atlas.getUV(textures.north) },
    { corners: [[h,-h,-h],[-h,-h,-h],[-h,h,-h],[h,h,-h]], normal: [0,0,-1], uvs: atlas.getUV(textures.south) },
    { corners: [[h,-h,h],[h,-h,-h],[h,h,-h],[h,h,h]], normal: [1,0,0], uvs: atlas.getUV(textures.east) },
    { corners: [[-h,-h,-h],[-h,-h,h],[-h,h,h],[-h,h,-h]], normal: [-1,0,0], uvs: atlas.getUV(textures.west) },
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vc = 0;

  for (const face of faces) {
    const [u0, v0, u1, v1] = face.uvs;
    for (const c of face.corners) {
      positions.push(c[0], c[1], c[2]);
      normals.push(face.normal[0], face.normal[1], face.normal[2]);
    }
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
    indices.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
    vc += 4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}
