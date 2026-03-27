import * as THREE from 'three';
import { assetManager } from '#/common/AssetManager';
import { MC_TEXTURES } from '#/common/types';
import { PX, boxUVs, createPivot, makeBox } from './EntityModelUtils';

const SKIN_URL = `${MC_TEXTURES}/entity/player/wide/steve.png`;
const TEX_SIZE: [number, number] = [64, 64];
const HEAD_DIMS: [number, number, number] = [8, 8, 8];
const BODY_DIMS: [number, number, number] = [8, 12, 4];
const LIMB_DIMS: [number, number, number] = [4, 12, 4];

export class PlayerModel {
  group = new THREE.Group();
  private head: THREE.Mesh;
  private body: THREE.Mesh;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private walkPhase = 0;
  private allMeshes: THREE.Mesh[] = [];
  isMoving = false;

  constructor() {
    this.group.name = 'player-model';

    this.head = this.createPart('player-head', [0, 0], HEAD_DIMS, 0xd4a373);
    this.head.position.y = 28 * PX;
    this.group.add(this.head);

    this.body = this.createPart('player-body', [16, 16], BODY_DIMS, 0x4a90d9);
    this.body.position.y = 18 * PX;
    this.group.add(this.body);

    this.rightArm = this.createLimb(
      'player-right-arm',
      'player-right-arm-pivot',
      [40, 16],
      0xd4a373,
      6 * PX,
      24 * PX,
    );
    this.group.add(this.rightArm);

    this.leftArm = this.createLimb(
      'player-left-arm',
      'player-left-arm-pivot',
      [32, 48],
      0xd4a373,
      -6 * PX,
      24 * PX,
    );
    this.group.add(this.leftArm);

    this.rightLeg = this.createLimb(
      'player-right-leg',
      'player-right-leg-pivot',
      [0, 16],
      0x3d3d8f,
      2 * PX,
      12 * PX,
    );
    this.group.add(this.rightLeg);

    this.leftLeg = this.createLimb(
      'player-left-leg',
      'player-left-leg-pivot',
      [16, 48],
      0x3d3d8f,
      -2 * PX,
      12 * PX,
    );
    this.group.add(this.leftLeg);

    void this.loadSkin();
  }

  private createPart(
    name: string,
    texOff: [number, number],
    dims: [number, number, number],
    fallbackColor: number,
  ) {
    const mesh = makeBox(dims[0], dims[1], dims[2], boxUVs(texOff, dims, TEX_SIZE), fallbackColor);
    mesh.name = name;
    this.allMeshes.push(mesh);
    return mesh;
  }

  private createLimb(
    meshName: string,
    pivotName: string,
    texOff: [number, number],
    fallbackColor: number,
    x: number,
    y: number,
  ) {
    const mesh = this.createPart(meshName, texOff, LIMB_DIMS, fallbackColor);
    const pivot = createPivot(mesh, -(LIMB_DIMS[1] * PX) / 2);
    pivot.name = pivotName;
    pivot.position.set(x, y, 0);
    return pivot;
  }

  private async loadSkin() {
    const img = await assetManager.loadImage(SKIN_URL);
    if (!img) return;
    const tex = new THREE.Texture(img);
    tex.needsUpdate = true;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;

    for (const mesh of this.allMeshes) {
      const material = mesh.material as THREE.MeshLambertMaterial;
      material.map = tex;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    }
  }

  update(dt: number) {
    if (this.isMoving) {
      this.walkPhase += dt * 8;
      const swing = Math.sin(this.walkPhase) * 0.6;
      this.leftArm.rotation.x = swing;
      this.rightArm.rotation.x = -swing;
      this.leftLeg.rotation.x = -swing;
      this.rightLeg.rotation.x = swing;
    } else {
      this.walkPhase = 0;
      this.leftArm.rotation.x *= 0.8;
      this.rightArm.rotation.x *= 0.8;
      this.leftLeg.rotation.x *= 0.8;
      this.rightLeg.rotation.x *= 0.8;
    }
  }

  setPosition(x: number, y: number, z: number) {
    this.group.position.set(x, y, z);
  }

  setRotation(yaw: number) {
    this.group.rotation.y = yaw;
  }

  dispose() {
    const textures = new Set<THREE.Texture>();
    this.group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const material = child.material;
      if (material instanceof THREE.Material) {
        if ('map' in material && material.map instanceof THREE.Texture) {
          textures.add(material.map);
        }
        material.dispose();
      }
    });
    for (const texture of textures) texture.dispose();
  }
}
