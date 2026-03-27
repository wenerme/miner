import * as THREE from 'three';
import type { GameContext } from '#/common/GameContext';
import { Player } from '#/common/Player';
import { buildHudModel, shouldBuildNativeHudModel } from '#/common/HudModel';
import {
  clampGameSettings,
  CHUNK_SIZE,
  PLAYER_SPEED,
  RENDER_DIST,
  WORLD_HEIGHT,
  type GameSettings,
} from '#/common/types';
import { createBlockMaterial, createGlassMaterial, createLavaMaterial, createWaterMaterial } from '#/render/BlockShader';
import {
  CHUNK_RENDER_ORDER_GLASS,
  CHUNK_RENDER_ORDER_LAVA,
  CHUNK_RENDER_ORDER_OPAQUE,
  CHUNK_RENDER_ORDER_WATER,
} from '#/render/chunkRenderOrder';
import { buildChunkGeometry } from '#/render/ChunkMesher';
import { EntityRenderer } from '#/render/EntityRenderer';
import { ItemDropRenderer } from '#/render/ItemDropRenderer';
import { Renderer } from '#/render/Renderer';
import { WeatherRenderer } from '#/render/WeatherRenderer';
import { TextureAtlas } from '#/render/TextureAtlas';
import { SoundEngine } from '#/audio/SoundEngine';
import { InputManager } from './InputManager';
import { OnboardingSystem } from './OnboardingSystem';

const MESH_BUDGET_PER_FRAME = 3;
const MAX_MESH_QUEUE = 4096;

export interface ServerBridge {
  applyMovement(dx: number, dz: number): void;
  getSpeedMultiplier(): number;
  handleJump(): void;
  readonly isFlying: boolean;
}

export interface GameClientOptions {
  preserveDrawingBuffer?: boolean;
}

export class GameClient {
  renderer: Renderer;
  input: InputManager;
  atlas: TextureAtlas;
  player: Player;
  server: ServerBridge | null = null;
  ctx: GameContext;

  chunkMeshes = new Map<string, THREE.Mesh>();
  private chunkWaterMeshes = new Map<string, THREE.Mesh>();
  private chunkLavaMeshes = new Map<string, THREE.Mesh>();
  private chunkGlassMeshes = new Map<string, THREE.Mesh>();
  private chunkBlocks = new Map<string, Uint8Array>();
  private chunkFacings = new Map<string, Record<string, string>>();
  private meshBuildQueue: [number, number][] = [];
  private meshQueueSet = new Set<string>();
  private material: THREE.ShaderMaterial | null = null;
  private waterMaterial: THREE.ShaderMaterial | null = null;
  private lavaMaterial: THREE.ShaderMaterial | null = null;
  private glassMaterial: THREE.ShaderMaterial | null = null;
  private entityRenderer: EntityRenderer;
  private itemDropRenderer: ItemDropRenderer;
  private weather: WeatherRenderer;
  private animFrame = 0;
  private lastTime = 0;
  
  private chunkMeshArray: THREE.Mesh[] = [];
  private chunkMeshArrayDirty = true;
  private unsubs: (() => void)[] = [];
  private stepTimer = 0;
  private prevDropCount = 0;
  private running = false;
  private lastWeather: GameContext['state']['weather'] = 'clear';
  private lastChunkX = NaN;
  private lastChunkZ = NaN;
  private prevEntityAction = new Map<number, string>();
  private prevPlayerHp: number | null = null;
  private prevAirMs: number | null = null;
  private listenerDir = new THREE.Vector3();
  /** Ray target while holding LMB; used to cancel mining when crosshair leaves the block. */
  private lastMiningRayTargetKey: string | null = null;
  private onboarding: OnboardingSystem;

  sound = new SoundEngine();

  onLockChange: ((locked: boolean) => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    ctx: GameContext,
    options?: GameClientOptions,
  ) {
    this.ctx = ctx;
    this.player = new Player(ctx);
    this.renderer = new Renderer(canvas, {
      preserveDrawingBuffer: options?.preserveDrawingBuffer,
    });
    this.input = new InputManager(canvas, this.player);
    this.atlas = new TextureAtlas();

    this.input.onBreakPress = () => {
      this.renderer.triggerHeldItemSwing(0.9);
      this.player.startBreak();
      const t = this.ctx.state.player.targetBlock;
      this.lastMiningRayTargetKey = t ? `${t.x},${t.y},${t.z}` : null;
    };
    this.input.onBreakRelease = () => {
      this.player.cancelBreak();
      this.lastMiningRayTargetKey = null;
    };
    this.input.onPlace = () => {
      this.renderer.triggerHeldItemSwing(0.7);
      this.player.placeBlock();
    };
    this.input.onToggleFly = () => {
      if (this.server?.isFlying) return;
      this.ctx.c2s.emit('c2s:command', { command: 'fly' });
    };
    this.input.onLockChange = (locked) => {
      if (locked) this.sound.unlock();
      ctx.state.ui.isLocked = locked;
      if (locked) ctx.state.ui.everLocked = true;
      this.onLockChange?.(locked);
    };
    this.input.onViewChange = (mode) => { this.renderer.viewMode = mode; };

    this.entityRenderer = new EntityRenderer(this.renderer.scene, ctx);
    this.itemDropRenderer = new ItemDropRenderer(this.renderer.scene, ctx, this.atlas);
    this.weather = new WeatherRenderer(this.renderer.scene);
    this.onboarding = new OnboardingSystem(this.ctx);
    this.listen();
  }

  private listen() {
    const s = this.ctx.s2c;
    this.unsubs.push(
      s.on('s2c:chunk', ({ cx, cz, blocks, facings }) => {
        const key = `${cx},${cz}`;
        this.chunkBlocks.set(key, blocks);
        if (facings) this.chunkFacings.set(key, facings); else this.chunkFacings.delete(key);
        this.queueChunkMesh(cx, cz);
      }),
      s.on('s2c:blockChange', ({ x, y, z, blockId }) => {
        const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const key = `${cx},${cz}`;
        const data = this.chunkBlocks.get(key);
        if (data) {
          data[y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx] = blockId;
          this.queueChunkMesh(cx, cz);
          const neighbors: [number, number][] = [];
          if (lx === 0) neighbors.push([cx - 1, cz]);
          if (lx === CHUNK_SIZE - 1) neighbors.push([cx + 1, cz]);
          if (lz === 0) neighbors.push([cx, cz - 1]);
          if (lz === CHUNK_SIZE - 1) neighbors.push([cx, cz + 1]);
          for (const [ncx, ncz] of neighbors) {
            this.queueChunkMesh(ncx, ncz);
          }
        }
        const sx = x + 0.5;
        const sy = y + 0.5;
        const sz = z + 0.5;
        if (blockId === 0) this.sound.playBreakAt(sx, sy, sz);
        else this.sound.playPlaceAt(sx, sy, sz);
      }),
      s.on('s2c:blockChange', () => {
        this.ctx.state.player.targetEntity = null;
      }),
      s.on('s2c:openCraftTable', () => {
        this.ctx.state.ui.craftTableOpenSignal += 1;
      }),
    );
  }

  private getChunkMeshesView() {
    if (this.chunkMeshArrayDirty) {
      this.chunkMeshArray = Array.from(this.chunkMeshes.values());
      this.chunkMeshArrayDirty = false;
    }
    return this.chunkMeshArray;
  }

  private countEntities() {
    return Object.keys(this.ctx.state.entities).length;
  }

  async init() {
    await document.fonts.load('16px Monocraft').catch(() => {});
    await this.atlas.load();
    this.material = createBlockMaterial(this.atlas.texture);
    this.waterMaterial = createWaterMaterial(this.atlas.texture);
    this.lavaMaterial = createLavaMaterial(this.atlas.texture);
    this.glassMaterial = createGlassMaterial(this.atlas.texture);
    this.renderer.setBlockMaterial(this.material);
    this.renderer.setAtlas(this.atlas);
    await this.renderer.initHud();
    this.sound.setVolume(this.ctx.state.settings.volume);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (time: number) => {
      if (!this.running) return;
      const dt = Math.min((time - this.lastTime) / 1000, 0.1);
      this.lastTime = time;
      this.stepFrame(dt);
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this.animFrame);
    this.animFrame = 0;
  }

  stop() {
    this.pause();
    for (const unsub of this.unsubs) unsub();
    this.unsubs.length = 0;
    this.prevEntityAction.clear();
    this.prevPlayerHp = null;
    this.prevAirMs = null;
  }

  stepFrame(dt: number) {
    const s = this.ctx.state;
    const move = this.input.getMovementVector(dt, PLAYER_SPEED);

    if (this.server) {
      s.player.jumping = this.input.spaceHeld;
      s.player.sneaking = this.input.shiftHeld;
      const movingHz = move.x !== 0 || move.z !== 0;
      s.player.sprinting = !s.abilities.fly && !s.player.sneaking && this.input.sprintHeld && movingHz;
      if (this.input.spaceHeld && s.player.onGround && !s.abilities.fly) {
        this.server.handleJump();
      }
      if (move.x !== 0 || move.z !== 0) this.server.applyMovement(move.x, move.z);
    } else {
      s.player.sprinting = false;
    }

    {
      const baseFov = s.settings.fov;
      const targetFov = s.player.sprinting ? baseFov + 5 : baseFov;
      const cur = this.renderer.camera.fov;
      const lerped = cur + (targetFov - cur) * Math.min(1, dt * 8);
      if (Math.abs(lerped - cur) > 0.05) {
        this.renderer.setFov(lerped);
      }
    }

    if (move.x !== 0 || move.z !== 0) {
      this.stepTimer += dt;
      const stepEvery = s.player.sneaking ? 0.5 : s.player.sprinting ? 0.28 : 0.38;
      if (s.player.onGround && this.stepTimer > stepEvery) {
        const { x, y, z } = s.player.position;
        this.sound.playFootstepAt(x, y, z);
        this.stepTimer = 0;
      }
    } else {
      this.stepTimer = 0;
    }

    this.renderer.playerModel.isMoving = move.x !== 0 || move.z !== 0;
    this.renderer.playerModel.update(dt);
    s.player.yaw = this.input.yaw;
    s.player.pitch = this.input.pitch;
    this.renderer.updateCamera(
      s.player.position.x, s.player.position.y, s.player.position.z,
      this.input.yaw, this.input.pitch,
      s.player.viewMode,
    );
    this.renderer.camera.getWorldDirection(this.listenerDir);
    this.sound.updateListener(
      this.renderer.camera.position.x,
      this.renderer.camera.position.y,
      this.renderer.camera.position.z,
      this.listenerDir.x,
      this.listenerDir.y,
      this.listenerDir.z,
    );

    const hpNow = s.player.hp;
    if (this.prevPlayerHp != null && hpNow < this.prevPlayerHp) {
      this.sound.playHurt();
    }
    this.prevPlayerHp = hpNow;

    const airNow = s.player.airMs;
    if (this.prevAirMs != null && this.prevAirMs >= 10_000 && airNow < 10_000) {
      const { x, y, z } = s.player.position;
      this.sound.playWaterSplashAt(x, y + 0.9, z);
    }
    this.prevAirMs = airNow;

    const entityIds = new Set<number>();
    for (const [idStr, ent] of Object.entries(s.entities)) {
      const id = Number(idStr);
      entityIds.add(id);
      const action = typeof ent.state.currentAction === 'string' ? ent.state.currentAction : 'idle';
      const prev = this.prevEntityAction.get(id) ?? 'idle';
      if (action === 'hurt' && prev !== 'hurt') {
        this.sound.playHitAt(ent.position.x, ent.position.y + 0.5, ent.position.z);
      }
      this.prevEntityAction.set(id, action);
    }
    for (const id of this.prevEntityAction.keys()) {
      if (!entityIds.has(id)) this.prevEntityAction.delete(id);
    }

    this.entityRenderer.tick(dt);
    this.itemDropRenderer.tick(dt, this.renderer.camera);
    if (this.lastWeather !== this.ctx.state.weather) {
      this.lastWeather = this.ctx.state.weather;
      this.weather.setWeather(this.lastWeather);
    }
    this.weather.tick(dt, this.renderer.camera.position);
    this.renderer.timeOfDay = this.ctx.state.timeOfDay;
    this.renderer.weather = this.ctx.state.weather;
    this.renderer.renderDistance = s.settings.renderDistance;
    this.renderer.setHeldItem(s.inventory.slots[s.inventory.selectedIndex]?.itemId);
    const dropCount = s.itemDrops.length;
    if (dropCount < this.prevDropCount) {
      this.sound.playPickup();
    }
    this.prevDropCount = dropCount;
    this.processMeshBuildQueue();
    {
      const pcx = Math.floor(this.ctx.state.player.position.x / CHUNK_SIZE);
      const pcz = Math.floor(this.ctx.state.player.position.z / CHUNK_SIZE);
      if (pcx !== this.lastChunkX || pcz !== this.lastChunkZ) {
        this.lastChunkX = pcx;
        this.lastChunkZ = pcz;
        this.requestChunks();
      }
    }

    const now = performance.now() / 1000;
    if (this.material?.uniforms?.uTime) {
      this.material.uniforms.uTime.value = now;
    }
    if (this.waterMaterial?.uniforms?.uTime) {
      this.waterMaterial.uniforms.uTime.value = now;
    }
    if (this.lavaMaterial?.uniforms?.uTime) {
      this.lavaMaterial.uniforms.uTime.value = now;
    }
    if (this.waterMaterial?.uniforms) {
      const fogColor = this.material?.uniforms?.uFogColor?.value;
      const fogNear = this.material?.uniforms?.uFogNear?.value;
      const fogFar = this.material?.uniforms?.uFogFar?.value;
      const sunIntensity = this.material?.uniforms?.uSunIntensity?.value;
      if (fogColor) this.waterMaterial.uniforms.uFogColor.value.copy(fogColor);
      if (fogNear != null) this.waterMaterial.uniforms.uFogNear.value = fogNear;
      if (fogFar != null) this.waterMaterial.uniforms.uFogFar.value = fogFar;
      if (sunIntensity != null) this.waterMaterial.uniforms.uSunIntensity.value = sunIntensity;
      if (this.waterMaterial.uniforms.uCameraPos) {
        this.waterMaterial.uniforms.uCameraPos.value.copy(this.renderer.camera.position);
      }
    }
    if (this.lavaMaterial?.uniforms) {
      const fogColor = this.material?.uniforms?.uFogColor?.value;
      const fogNear = this.material?.uniforms?.uFogNear?.value;
      const fogFar = this.material?.uniforms?.uFogFar?.value;
      const sunIntensity = this.material?.uniforms?.uSunIntensity?.value;
      if (fogColor) this.lavaMaterial.uniforms.uFogColor.value.copy(fogColor);
      if (fogNear != null) this.lavaMaterial.uniforms.uFogNear.value = fogNear;
      if (fogFar != null) this.lavaMaterial.uniforms.uFogFar.value = fogFar;
      if (sunIntensity != null) this.lavaMaterial.uniforms.uSunIntensity.value = sunIntensity;
    }
    if (this.glassMaterial?.uniforms) {
      const fogColor = this.material?.uniforms?.uFogColor?.value;
      const fogNear = this.material?.uniforms?.uFogNear?.value;
      const fogFar = this.material?.uniforms?.uFogFar?.value;
      const sunIntensity = this.material?.uniforms?.uSunIntensity?.value;
      if (fogColor) this.glassMaterial.uniforms.uFogColor.value.copy(fogColor);
      if (fogNear != null) this.glassMaterial.uniforms.uFogNear.value = fogNear;
      if (fogFar != null) this.glassMaterial.uniforms.uFogFar.value = fogFar;
      if (sunIntensity != null) this.glassMaterial.uniforms.uSunIntensity.value = sunIntensity;
    }
    const meshes = this.getChunkMeshesView();
    const target = this.renderer.updateTarget(meshes);
    const targetEntity = this.renderer.updateTargetEntity(this.entityRenderer.getRaycastTargets());
    this.player.setTargetBlock(
      target ? { x: target.block.x, y: target.block.y, z: target.block.z, nx: target.normal.x, ny: target.normal.y, nz: target.normal.z } : null,
    );
    this.player.setTargetEntity(targetEntity);
    if (this.input.leftBreakHeld && this.lastMiningRayTargetKey !== null) {
      const newKey = target ? `${target.block.x},${target.block.y},${target.block.z}` : null;
      if (newKey !== this.lastMiningRayTargetKey) {
        this.player.cancelBreak();
        if (newKey) {
          this.player.startBreak();
        }
        this.lastMiningRayTargetKey = newKey;
      }
    }
    const useNativeHud = shouldBuildNativeHudModel({
      nativeHudEnabledInSettings: s.settings.nativeHud,
      pointerLocked: s.ui.isLocked,
    });
    this.onboarding.setWorldSeed(s.seed);
    this.onboarding.tick(dt, s);
    this.renderer.render(
      meshes,
      useNativeHud
        ? buildHudModel({
            viewport: {
              width: this.renderer.canvas.clientWidth || this.renderer.canvas.width || 1,
              height: this.renderer.canvas.clientHeight || this.renderer.canvas.height || 1,
            },
            isLocked: s.ui.isLocked,
            useNativeHud: s.settings.nativeHud,
            hotbarSlots: s.inventory.slots,
            offhandSlot: s.inventory.offhand,
            selectedIndex: s.inventory.selectedIndex,
            showChat: s.ui.showChat,
            showDebug: s.ui.showDebug,
            showFps: s.settings.showFps,
            fps: s.stats.fps,
            biome: s.stats.biome,
            weather: s.weather,
            timeOfDay: s.timeOfDay,
            playerPos: s.player.position,
            hp: s.player.hp,
            maxHp: s.player.maxHp,
            hunger: s.player.hunger,
            maxHunger: s.player.maxHunger,
            airMs: s.player.airMs,
            maxAirMs: 10_000,
            viewMode: s.player.viewMode,
            yaw: s.player.yaw,
            targetBlock: s.player.targetBlock,
            chunkCount: this.chunkMeshes.size,
            entityCount: this.countEntities(),
            renderDistance: s.settings.renderDistance,
            fov: s.settings.fov,
            chatMessages: s.chat.messages,
            activeHint: this.onboarding.getHudHint(),
          })
        : undefined,
    );
    
  }

  private queueChunkMesh(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    if (this.meshQueueSet.has(key)) return;
    this.meshQueueSet.add(key);
    this.meshBuildQueue.push([cx, cz]);
    this.meshQueueDirty = true;
    if (this.meshBuildQueue.length > MAX_MESH_QUEUE) {
      const removed = this.meshBuildQueue.splice(0, this.meshBuildQueue.length - MAX_MESH_QUEUE);
      for (const [rx, rz] of removed) {
        const rkey = `${rx},${rz}`;
        this.meshQueueSet.delete(rkey);
      }
    }
  }

  private meshQueueDirty = true;
  private lastSortChunkX = -999;
  private lastSortChunkZ = -999;

  private processMeshBuildQueue() {
    if (this.meshBuildQueue.length === 0) return;
    const s = this.ctx.state;
    const pcx = Math.floor(s.player.position.x / CHUNK_SIZE);
    const pcz = Math.floor(s.player.position.z / CHUNK_SIZE);
    if (this.meshQueueDirty || pcx !== this.lastSortChunkX || pcz !== this.lastSortChunkZ) {
      this.meshBuildQueue.sort((a, b) => {
        const da = (a[0] - pcx) * (a[0] - pcx) + (a[1] - pcz) * (a[1] - pcz);
        const db = (b[0] - pcx) * (b[0] - pcx) + (b[1] - pcz) * (b[1] - pcz);
        return db - da;
      });
      this.meshQueueDirty = false;
      this.lastSortChunkX = pcx;
      this.lastSortChunkZ = pcz;
    }
    let built = 0;
    while (built < MESH_BUDGET_PER_FRAME && this.meshBuildQueue.length > 0) {
      const entry = this.meshBuildQueue.pop()!;
      this.meshQueueSet.delete(`${entry[0]},${entry[1]}`);
      this.rebuildChunkMesh(entry[0], entry[1]);
      built++;
    }
  }

  private requestChunks() {
    const s = this.ctx.state;
    const pcx = Math.floor(s.player.position.x / CHUNK_SIZE);
    const pcz = Math.floor(s.player.position.z / CHUNK_SIZE);
    const rd = this.renderDist;
    this.ctx.c2s.emit('c2s:requestChunks', { cx: pcx, cz: pcz, radius: rd });
    const removeDist = rd + 2;
    for (const [key, mesh] of this.chunkMeshes) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.abs(cx - pcx) > removeDist || Math.abs(cz - pcz) > removeDist) {
        this.renderer.scene.remove(mesh);
        mesh.geometry.dispose();
        this.chunkMeshes.delete(key);
        this.chunkMeshArrayDirty = true;
        this.chunkBlocks.delete(key);
        this.chunkFacings.delete(key);
        const wm = this.chunkWaterMeshes.get(key);
        if (wm) {
          this.renderer.scene.remove(wm);
          wm.geometry.dispose();
          this.chunkWaterMeshes.delete(key);
        }
        const lm = this.chunkLavaMeshes.get(key);
        if (lm) {
          this.renderer.scene.remove(lm);
          lm.geometry.dispose();
          this.chunkLavaMeshes.delete(key);
        }
        const gm = this.chunkGlassMeshes.get(key);
        if (gm) {
          this.renderer.scene.remove(gm);
          gm.geometry.dispose();
          this.chunkGlassMeshes.delete(key);
        }
      }
    }
  }

  private getNeighborBlock = (wx: number, wy: number, wz: number): number => {
    if (wy < 0 || wy >= WORLD_HEIGHT) return 0;
    const cx = Math.floor(wx / CHUNK_SIZE), cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const data = this.chunkBlocks.get(`${cx},${cz}`);
    return data ? data[wy * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx] : 0;
  };

  private rebuildChunkMesh(cx: number, cz: number) {
    if (!this.material) return;
    const key = `${cx},${cz}`;
    const old = this.chunkMeshes.get(key);
    if (old) {
      this.renderer.scene.remove(old);
      old.geometry.dispose();
      this.chunkMeshes.delete(key);
      this.chunkMeshArrayDirty = true;
    }
    const oldWater = this.chunkWaterMeshes.get(key);
    if (oldWater) {
      this.renderer.scene.remove(oldWater);
      oldWater.geometry.dispose();
      this.chunkWaterMeshes.delete(key);
    }
    const oldLava = this.chunkLavaMeshes.get(key);
    if (oldLava) {
      this.renderer.scene.remove(oldLava);
      oldLava.geometry.dispose();
      this.chunkLavaMeshes.delete(key);
    }
    const oldGlass = this.chunkGlassMeshes.get(key);
    if (oldGlass) {
      this.renderer.scene.remove(oldGlass);
      oldGlass.geometry.dispose();
      this.chunkGlassMeshes.delete(key);
    }
    const blocks = this.chunkBlocks.get(key);
    if (!blocks) return;
    const facings = this.chunkFacings.get(key);
    const result = buildChunkGeometry(blocks, cx, cz, this.getNeighborBlock, this.atlas, facings);
    const shadowsEnabled = this.ctx.state.settings.shadows;
    if (result.opaque) {
      const mesh = new THREE.Mesh(result.opaque, this.material);
      mesh.castShadow = shadowsEnabled;
      mesh.receiveShadow = shadowsEnabled;
      this.renderer.scene.add(mesh);
      this.chunkMeshes.set(key, mesh);
      this.chunkMeshArrayDirty = true;
    }
    if (result.transparent && this.waterMaterial) {
      const waterMesh = new THREE.Mesh(result.transparent, this.waterMaterial);
      waterMesh.renderOrder = CHUNK_RENDER_ORDER_WATER;
      this.renderer.scene.add(waterMesh);
      this.chunkWaterMeshes.set(key, waterMesh);
    }
    if (result.lava && this.lavaMaterial) {
      const lavaMesh = new THREE.Mesh(result.lava, this.lavaMaterial);
      lavaMesh.renderOrder = CHUNK_RENDER_ORDER_LAVA;
      this.renderer.scene.add(lavaMesh);
      this.chunkLavaMeshes.set(key, lavaMesh);
    }
    if (result.glass && this.glassMaterial) {
      const glassMesh = new THREE.Mesh(result.glass, this.glassMaterial);
      glassMesh.renderOrder = CHUNK_RENDER_ORDER_GLASS;
      this.renderer.scene.add(glassMesh);
      this.chunkGlassMeshes.set(key, glassMesh);
    }
  }

  applySettings(settings: GameSettings) {
    const clamped = clampGameSettings(settings);
    const distChanged = clamped.renderDistance !== this.ctx.state.settings.renderDistance;
    this.ctx.state.settings = { ...clamped };
    this.renderer.setFov(clamped.fov);
    this.renderer.renderDistance = clamped.renderDistance;
    this.input.sensitivity = clamped.mouseSensitivity;
    this.sound.setVolume(clamped.volume);
    const shadowChanged = this.renderer.setShadowSettings(
      clamped.shadows,
      clamped.shadowQuality,
      clamped.renderDistance,
    );
    if (shadowChanged) {
      for (const mesh of this.chunkMeshes.values()) {
        mesh.castShadow = clamped.shadows;
        mesh.receiveShadow = clamped.shadows;
      }
    }
    if (distChanged) {
      this.lastChunkX = NaN;
      this.lastChunkZ = NaN;
    }
  }

  getWaterMeshes(): THREE.Mesh[] {
    return Array.from(this.chunkWaterMeshes.values());
  }

  private get renderDist(): number {
    return this.ctx.state.settings.renderDistance ?? RENDER_DIST;
  }

  resize(w: number, h: number) { this.renderer.resize(w, h); }

  dispose() {
    this.stop();
    for (const off of this.unsubs) off();
    this.unsubs.length = 0;
    this.sound.dispose();
    this.entityRenderer.dispose();
    this.itemDropRenderer.dispose();
    this.weather.dispose();
    this.input.dispose();
    for (const [, mesh] of this.chunkMeshes) { this.renderer.scene.remove(mesh); mesh.geometry.dispose(); }
    for (const [, mesh] of this.chunkWaterMeshes) { this.renderer.scene.remove(mesh); mesh.geometry.dispose(); }
    for (const [, mesh] of this.chunkLavaMeshes) { this.renderer.scene.remove(mesh); mesh.geometry.dispose(); }
    for (const [, mesh] of this.chunkGlassMeshes) { this.renderer.scene.remove(mesh); mesh.geometry.dispose(); }
    this.chunkMeshes.clear();
    this.chunkWaterMeshes.clear();
    this.chunkLavaMeshes.clear();
    this.chunkGlassMeshes.clear();
    this.chunkMeshArray.length = 0;
    this.chunkMeshArrayDirty = true;
    this.chunkBlocks.clear();
    this.chunkFacings.clear();
    this.meshQueueSet.clear();
    this.material?.dispose();
    this.waterMaterial?.dispose();
    this.lavaMaterial?.dispose();
    this.glassMaterial?.dispose();
    this.renderer.dispose();
    this.onboarding.dispose();
  }
}
