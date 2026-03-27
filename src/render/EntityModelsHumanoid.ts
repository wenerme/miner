import * as THREE from 'three';
import { MC_TEXTURES } from '#/common/types';
import { PX, boxUVs, createPivot, makeBox } from './EntityModelUtils';

function buildHumanoid(
  meshes: THREE.Mesh[],
  fallbackColor: number,
  limbWidth = 4,
  options?: { legacyMirroredLimbs?: boolean },
): { group: THREE.Group; legs: THREE.Group[]; head: THREE.Group } {
  const ts: [number, number] = [64, 64];
  const group = new THREE.Group();
  const pivotY = -6 * PX;

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 28 * PX, 0);
  const headMesh = makeBox(8, 8, 8, boxUVs([0, 0], [8, 8, 8], ts), fallbackColor);
  headPivot.add(headMesh);
  meshes.push(headMesh);
  group.add(headPivot);

  const body = makeBox(8, 12, 4, boxUVs([16, 16], [8, 12, 4], ts), 0x4a90d9);
  body.position.set(0, 18 * PX, 0);
  meshes.push(body);
  group.add(body);

  const legs: THREE.Group[] = [];

  const leftArmUv: [number, number] = options?.legacyMirroredLimbs
    ? [40, 16]
    : [32, 48];
  const leftLegUv: [number, number] = options?.legacyMirroredLimbs
    ? [0, 16]
    : [16, 48];

  const rArm = makeBox(
    limbWidth,
    12,
    limbWidth,
    boxUVs([40, 16], [limbWidth, 12, limbWidth], ts),
    fallbackColor,
  );
  const rArmPivot = createPivot(rArm, pivotY);
  rArmPivot.position.set(6 * PX, 24 * PX, 0);
  meshes.push(rArm);
  group.add(rArmPivot);

  const lArm = makeBox(
    limbWidth,
    12,
    limbWidth,
    boxUVs(leftArmUv, [limbWidth, 12, limbWidth], ts),
    fallbackColor,
  );
  const lArmPivot = createPivot(lArm, pivotY);
  lArmPivot.position.set(-6 * PX, 24 * PX, 0);
  meshes.push(lArm);
  group.add(lArmPivot);

  const rLeg = makeBox(
    limbWidth,
    12,
    limbWidth,
    boxUVs([0, 16], [limbWidth, 12, limbWidth], ts),
    0x3d3d8f,
  );
  const rLegPivot = createPivot(rLeg, pivotY);
  rLegPivot.position.set(2 * PX, 12 * PX, 0);
  meshes.push(rLeg);
  legs.push(rLegPivot);
  group.add(rLegPivot);

  const lLeg = makeBox(
    limbWidth,
    12,
    limbWidth,
    boxUVs(leftLegUv, [limbWidth, 12, limbWidth], ts),
    0x3d3d8f,
  );
  const lLegPivot = createPivot(lLeg, pivotY);
  lLegPivot.position.set(-2 * PX, 12 * PX, 0);
  meshes.push(lLeg);
  legs.push(lLegPivot);
  group.add(lLegPivot);

  // Keep arm swing phase mirrored to legs (left arm with right leg) for natural gait.
  legs.push(lArmPivot, rArmPivot);

  return { group, legs, head: headPivot };
}

const SKELETON_BONE = 0xe0e0d4;
const CREEPER_GREEN = 0x5aad5a;

/** Head-dominated silhouette, narrow body, four short legs — no arms. */
export function buildCreeper(
  meshes: THREE.Mesh[],
  fallbackColor = CREEPER_GREEN,
): { group: THREE.Group; legs: THREE.Group[]; head: THREE.Group } {
  const ts: [number, number] = [64, 64];
  const group = new THREE.Group();
  const legPivotY = -3 * PX;

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 26 * PX, 0);
  const headMesh = makeBox(8, 8, 8, boxUVs([0, 0], [8, 8, 8], ts), fallbackColor);
  headPivot.add(headMesh);
  meshes.push(headMesh);
  group.add(headPivot);

  const body = makeBox(4, 12, 4, boxUVs([16, 16], [4, 12, 4], ts), fallbackColor);
  body.position.set(0, 18 * PX, 0);
  meshes.push(body);
  group.add(body);

  const legs: THREE.Group[] = [];
  for (const [lx, lz] of [
    [2, 2],
    [-2, 2],
    [2, -2],
    [-2, -2],
  ] as const) {
    const lm = makeBox(4, 6, 4, boxUVs([0, 16], [4, 6, 4], ts), fallbackColor);
    const lp = createPivot(lm, legPivotY);
    lp.position.set(lx * PX, 6 * PX, lz * PX);
    meshes.push(lm);
    legs.push(lp);
    group.add(lp);
  }

  return { group, legs, head: headPivot };
}

/** Low, wide cephalothorax + abdomen and eight thin legs (2×10×2 px). */
export function buildSpider(
  meshes: THREE.Mesh[],
  fallbackColor = 0x2a2520,
): { group: THREE.Group; legs: THREE.Group[]; head: THREE.Group } {
  const ts: [number, number] = [64, 32];
  const group = new THREE.Group();
  const legPivotY = -5 * PX;

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 5 * PX, -7 * PX);
  const headMesh = makeBox(8, 8, 6, boxUVs([32, 0], [8, 8, 6], ts), fallbackColor);
  headPivot.add(headMesh);
  meshes.push(headMesh);
  group.add(headPivot);

  const body = makeBox(12, 8, 10, boxUVs([0, 0], [12, 8, 10], ts), fallbackColor);
  body.position.set(0, 5 * PX, 3 * PX);
  meshes.push(body);
  group.add(body);

  const legs: THREE.Group[] = [];
  const zRows = [-5, -1.5, 2, 5.5] as const;
  for (const lz of zRows) {
    for (const side of [-1, 1] as const) {
      const lx = side * 7;
      const lm = makeBox(2, 10, 2, boxUVs([18, 0], [2, 10, 2], ts), fallbackColor);
      const lp = createPivot(lm, legPivotY);
      lp.position.set(lx * PX, 5 * PX, lz * PX);
      lp.rotation.y = side * 0.4;
      lp.rotation.z = side * 0.2;
      meshes.push(lm);
      legs.push(lp);
      group.add(lp);
    }
  }

  return { group, legs, head: headPivot };
}

/** Same layout contract as buildHumanoid (legs then arms in `legs` array) but thinner torso and limbs. */
export function buildSkeleton(
  meshes: THREE.Mesh[],
  fallbackColor = SKELETON_BONE,
): { group: THREE.Group; legs: THREE.Group[]; head: THREE.Group } {
  const ts: [number, number] = [64, 64];
  const group = new THREE.Group();
  const pivotY = -6 * PX;

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 28 * PX, 0);
  const headMesh = makeBox(8, 8, 8, boxUVs([0, 0], [8, 8, 8], ts), fallbackColor);
  headPivot.add(headMesh);
  meshes.push(headMesh);
  group.add(headPivot);

  const body = makeBox(4, 12, 2, boxUVs([16, 16], [4, 12, 2], ts), fallbackColor);
  body.position.set(0, 18 * PX, 0);
  meshes.push(body);
  group.add(body);

  const legs: THREE.Group[] = [];

  const rArm = makeBox(2, 12, 2, boxUVs([40, 16], [2, 12, 2], ts), fallbackColor);
  const rArmPivot = createPivot(rArm, pivotY);
  rArmPivot.position.set(6 * PX, 24 * PX, 0);
  meshes.push(rArm);
  group.add(rArmPivot);

  const lArm = makeBox(2, 12, 2, boxUVs([32, 48], [2, 12, 2], ts), fallbackColor);
  const lArmPivot = createPivot(lArm, pivotY);
  lArmPivot.position.set(-6 * PX, 24 * PX, 0);
  meshes.push(lArm);
  group.add(lArmPivot);

  const rLeg = makeBox(2, 12, 2, boxUVs([0, 16], [2, 12, 2], ts), fallbackColor);
  const rLegPivot = createPivot(rLeg, pivotY);
  rLegPivot.position.set(2 * PX, 12 * PX, 0);
  meshes.push(rLeg);
  legs.push(rLegPivot);
  group.add(rLegPivot);

  const lLeg = makeBox(2, 12, 2, boxUVs([16, 48], [2, 12, 2], ts), fallbackColor);
  const lLegPivot = createPivot(lLeg, pivotY);
  lLegPivot.position.set(-2 * PX, 12 * PX, 0);
  meshes.push(lLeg);
  legs.push(lLegPivot);
  group.add(lLegPivot);

  legs.push(lArmPivot, rArmPivot);

  return { group, legs, head: headPivot };
}

export interface ModelDef {
  texPath: string;
  texSize: [number, number];
  fallbackColor: number;
  build(meshes: THREE.Mesh[]): { group: THREE.Group; legs: THREE.Group[]; head?: THREE.Group };
}

const VILLAGER_TEX = `${MC_TEXTURES}/entity/villager/villager.png`;

function buildVillager(
  meshes: THREE.Mesh[],
  fallbackColor: number,
): { group: THREE.Group; legs: THREE.Group[]; head: THREE.Group } {
  const ts: [number, number] = [64, 64];
  const group = new THREE.Group();
  const pivotY = -6 * PX;

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 28 * PX, 0);
  const headMesh = makeBox(8, 10, 8, boxUVs([0, 0], [8, 10, 8], ts), fallbackColor);
  headMesh.position.set(0, 1 * PX, 0);
  headPivot.add(headMesh);
  meshes.push(headMesh);

  const nose = makeBox(2, 4, 2, boxUVs([24, 0], [2, 4, 2], ts), 0xb89070);
  nose.position.set(0, -2 * PX, -5 * PX);
  headPivot.add(nose);
  meshes.push(nose);
  group.add(headPivot);

  const body = makeBox(8, 12, 4, boxUVs([16, 20], [8, 12, 4], ts), 0x6b4f3f);
  body.position.set(0, 18 * PX, 0);
  meshes.push(body);
  group.add(body);

  const robe = makeBox(8, 20, 6, boxUVs([0, 38], [8, 20, 6], ts), 0x5e3d28);
  robe.position.set(0, 10 * PX, 0);
  meshes.push(robe);
  group.add(robe);

  const arms = makeBox(8, 4, 4, boxUVs([40, 38], [8, 4, 4], ts), 0x7b5e3f);
  arms.position.set(0, 21 * PX, -2 * PX);
  meshes.push(arms);
  group.add(arms);

  const legs: THREE.Group[] = [];

  const rLeg = makeBox(4, 12, 4, boxUVs([0, 22], [4, 12, 4], ts), 0x3d3d3d);
  const rLegPivot = createPivot(rLeg, pivotY);
  rLegPivot.position.set(2 * PX, 12 * PX, 0);
  meshes.push(rLeg);
  legs.push(rLegPivot);
  group.add(rLegPivot);

  const lLeg = makeBox(4, 12, 4, boxUVs([0, 22], [4, 12, 4], ts), 0x3d3d3d);
  const lLegPivot = createPivot(lLeg, pivotY);
  lLegPivot.position.set(-2 * PX, 12 * PX, 0);
  meshes.push(lLeg);
  legs.push(lLegPivot);
  group.add(lLegPivot);

  return { group, legs, head: headPivot };
}

export const humanoidModels: Record<string, ModelDef> = {
  farmer: {
    texPath: VILLAGER_TEX,
    texSize: [64, 64],
    fallbackColor: 0xd4a373,
    build: (meshes) => buildVillager(meshes, 0xd4a373),
  },
  miner: {
    texPath: VILLAGER_TEX,
    texSize: [64, 64],
    fallbackColor: 0x8b7355,
    build: (meshes) => buildVillager(meshes, 0x8b7355),
  },
  guard: {
    texPath: VILLAGER_TEX,
    texSize: [64, 64],
    fallbackColor: 0x808080,
    build: (meshes) => buildVillager(meshes, 0x808080),
  },
  zombie: {
    texPath: `${MC_TEXTURES}/entity/zombie/zombie.png`,
    texSize: [64, 64],
    fallbackColor: 0x4a7c59,
    build: (meshes) => buildHumanoid(meshes, 0x4a7c59, 4, { legacyMirroredLimbs: true }),
  },
  skeleton: {
    texPath: `${MC_TEXTURES}/entity/skeleton/skeleton.png`,
    texSize: [64, 64],
    fallbackColor: SKELETON_BONE,
    build: (meshes) => buildSkeleton(meshes, SKELETON_BONE),
  },
  creeper: {
    texPath: `${MC_TEXTURES}/entity/creeper/creeper.png`,
    texSize: [64, 64],
    fallbackColor: CREEPER_GREEN,
    build: (meshes) => buildCreeper(meshes, CREEPER_GREEN),
  },
  spider: {
    texPath: `${MC_TEXTURES}/entity/spider/spider.png`,
    texSize: [64, 32],
    fallbackColor: 0x2a2520,
    build: (meshes) => buildSpider(meshes, 0x2a2520),
  },
  villager: {
    texPath: `${MC_TEXTURES}/entity/villager/villager.png`,
    texSize: [64, 64],
    fallbackColor: 0x9a7b5a,
    build: (meshes) => buildVillager(meshes, 0x9a7b5a),
  },
};
