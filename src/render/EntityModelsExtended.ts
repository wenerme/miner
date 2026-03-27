import * as THREE from 'three';
import { MC_TEXTURES } from '#/common/types';
import { PX, boxUVs, createPivot, makeBox } from './EntityModelUtils';

export interface ModelDef {
  texPath: string;
  texSize: [number, number];
  fallbackColor: number;
  build(meshes: THREE.Mesh[]): {
    group: THREE.Group;
    legs: THREE.Group[];
    head?: THREE.Group;
  };
}

export const extendedModels: Record<string, ModelDef> = {
  horse: {
    texPath: `${MC_TEXTURES}/entity/horse/horse_brown.png`,
    texSize: [256, 256],
    fallbackColor: 0x8b4513,
    build(meshes) {
      const ts: [number, number] = [256, 256];
      const group = new THREE.Group();
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 28 * PX, -12 * PX);
      const head = makeBox(10, 10, 10, boxUVs([0, 0], [10, 10, 10], ts), 0x8b4513);
      headPivot.add(head);
      meshes.push(head);
      group.add(headPivot);
      const body = makeBox(14, 12, 10, boxUVs([0, 64], [14, 12, 10], ts), 0x8b4513);
      body.position.set(0, 22 * PX, 0);
      body.rotation.x = Math.PI / 2;
      meshes.push(body);
      group.add(body);
      const tail = makeBox(2, 12, 2, boxUVs([0, 96], [2, 12, 2], ts), 0x8b4513);
      tail.position.set(0, 24 * PX, 10 * PX);
      tail.rotation.x = 0.5;
      meshes.push(tail);
      group.add(tail);
      const legs: THREE.Group[] = [];
      for (const [lx, lz] of [
        [-4, -8],
        [4, -8],
        [-4, 10],
        [4, 10],
      ]) {
        const lm = makeBox(4, 16, 4, boxUVs([0, 80], [4, 16, 4], ts), 0x8b4513);
        const lp = createPivot(lm, -8 * PX);
        lp.position.set(lx * PX, 20 * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }
      return { group, legs, head: headPivot };
    },
  },

  donkey: {
    texPath: `${MC_TEXTURES}/entity/horse/donkey.png`,
    texSize: [256, 256],
    fallbackColor: 0x8b7355,
    build(meshes) {
      const ts: [number, number] = [256, 256];
      const group = new THREE.Group();
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 24 * PX, -10 * PX);
      const head = makeBox(8, 8, 8, boxUVs([0, 0], [8, 8, 8], ts), 0x8b7355);
      headPivot.add(head);
      meshes.push(head);
      group.add(headPivot);
      const body = makeBox(12, 10, 8, boxUVs([0, 64], [12, 10, 8], ts), 0x8b7355);
      body.position.set(0, 18 * PX, 0);
      body.rotation.x = Math.PI / 2;
      meshes.push(body);
      const legs: THREE.Group[] = [];
      for (const [lx, lz] of [
        [-3, -6],
        [3, -6],
        [-3, 8],
        [3, 8],
      ]) {
        const lm = makeBox(3, 12, 3, boxUVs([0, 80], [3, 12, 3], ts), 0x8b7355);
        const lp = createPivot(lm, -6 * PX);
        lp.position.set(lx * PX, 16 * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }
      return { group, legs, head: headPivot };
    },
  },

  fox: {
    texPath: `${MC_TEXTURES}/entity/fox/fox.png`,
    texSize: [64, 32],
    fallbackColor: 0xd4782a,
    build(meshes) {
      const ts: [number, number] = [64, 32];
      const group = new THREE.Group();
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 10 * PX, -6 * PX);
      const head = makeBox(6, 6, 5, boxUVs([0, 0], [6, 6, 5], ts), 0xd4782a);
      headPivot.add(head);
      meshes.push(head);
      group.add(headPivot);
      const body = makeBox(6, 8, 5, boxUVs([24, 0], [6, 8, 5], ts), 0xd4782a);
      body.position.set(0, 8 * PX, 0);
      body.rotation.x = Math.PI / 2;
      meshes.push(body);
      group.add(body);
      const tail = makeBox(3, 10, 3, boxUVs([0, 24], [3, 10, 3], ts), 0xd4782a);
      tail.position.set(0, 10 * PX, 7 * PX);
      tail.rotation.x = 0.8;
      meshes.push(tail);
      group.add(tail);
      const legs: THREE.Group[] = [];
      for (const [lx, lz] of [
        [-1.5, -4],
        [1.5, -4],
        [-1.5, 5],
        [1.5, 5],
      ]) {
        const lm = makeBox(2, 6, 2, boxUVs([8, 16], [2, 6, 2], ts), 0xd4782a);
        const lp = createPivot(lm, -3 * PX);
        lp.position.set(lx * PX, 6 * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }
      return { group, legs, head: headPivot };
    },
  },

  bee: {
    texPath: `${MC_TEXTURES}/entity/bee/bee.png`,
    texSize: [64, 64],
    fallbackColor: 0x2a2a2a,
    build(meshes) {
      const ts: [number, number] = [64, 64];
      const group = new THREE.Group();
      const body = makeBox(6, 5, 6, boxUVs([0, 0], [6, 5, 6], ts), 0x2a2a2a);
      body.position.y = 4 * PX;
      meshes.push(body);
      group.add(body);
      return { group, legs: [] };
    },
  },

  panda: {
    texPath: `${MC_TEXTURES}/entity/panda/panda.png`,
    texSize: [64, 64],
    fallbackColor: 0xffffff,
    build(meshes) {
      const ts: [number, number] = [64, 64];
      const group = new THREE.Group();
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 18 * PX, -6 * PX);
      const head = makeBox(10, 10, 8, boxUVs([0, 0], [10, 10, 8], ts), 0xffffff);
      headPivot.add(head);
      meshes.push(head);
      group.add(headPivot);
      const body = makeBox(12, 14, 8, boxUVs([28, 8], [12, 14, 8], ts), 0xffffff);
      body.position.set(0, 14 * PX, 0);
      body.rotation.x = Math.PI / 2;
      meshes.push(body);
      group.add(body);
      const legs: THREE.Group[] = [];
      for (const [lx, lz] of [
        [-3, -6],
        [3, -6],
        [-3, 8],
        [3, 8],
      ]) {
        const lm = makeBox(4, 10, 4, boxUVs([0, 16], [4, 10, 4], ts), 0xffffff);
        const lp = createPivot(lm, -5 * PX);
        lp.position.set(lx * PX, 12 * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }
      return { group, legs, head: headPivot };
    },
  },

  parrot: {
    texPath: `${MC_TEXTURES}/entity/parrot/parrot_blue.png`,
    texSize: [64, 64],
    fallbackColor: 0x4080ff,
    build(meshes) {
      const ts: [number, number] = [64, 64];
      const group = new THREE.Group();
      const body = makeBox(5, 8, 5, boxUVs([0, 0], [5, 8, 5], ts), 0x4080ff);
      body.position.y = 8 * PX;
      meshes.push(body);
      group.add(body);
      return { group, legs: [] };
    },
  },

  goat: {
    texPath: `${MC_TEXTURES}/entity/goat/goat.png`,
    texSize: [64, 64],
    fallbackColor: 0xe8e8e8,
    build(meshes) {
      const ts: [number, number] = [64, 64];
      const group = new THREE.Group();
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 16 * PX, -6 * PX);
      const head = makeBox(8, 8, 8, boxUVs([0, 0], [8, 8, 8], ts), 0xe8e8e8);
      headPivot.add(head);
      meshes.push(head);
      group.add(headPivot);
      const body = makeBox(10, 14, 6, boxUVs([28, 8], [10, 14, 6], ts), 0xe8e8e8);
      body.position.set(0, 12 * PX, 0);
      body.rotation.x = Math.PI / 2;
      meshes.push(body);
      group.add(body);
      const legs: THREE.Group[] = [];
      for (const [lx, lz] of [
        [-3, -5],
        [3, -5],
        [-3, 7],
        [3, 7],
      ]) {
        const lm = makeBox(4, 10, 4, boxUVs([0, 16], [4, 10, 4], ts), 0xe8e8e8);
        const lp = createPivot(lm, -5 * PX);
        lp.position.set(lx * PX, 10 * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }
      return { group, legs, head: headPivot };
    },
  },

  llama: {
    texPath: `${MC_TEXTURES}/entity/llama/llama_white.png`,
    texSize: [128, 64],
    fallbackColor: 0xf5f5dc,
    build(meshes) {
      const ts: [number, number] = [128, 64];
      const group = new THREE.Group();
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 22 * PX, -8 * PX);
      const head = makeBox(8, 8, 8, boxUVs([0, 0], [8, 8, 8], ts), 0xf5f5dc);
      headPivot.add(head);
      meshes.push(head);
      group.add(headPivot);
      const body = makeBox(10, 16, 6, boxUVs([0, 32], [10, 16, 6], ts), 0xf5f5dc);
      body.position.set(0, 16 * PX, 0);
      body.rotation.x = Math.PI / 2;
      meshes.push(body);
      group.add(body);
      const legs: THREE.Group[] = [];
      for (const [lx, lz] of [
        [-3, -6],
        [3, -6],
        [-3, 8],
        [3, 8],
      ]) {
        const lm = makeBox(4, 12, 4, boxUVs([0, 48], [4, 12, 4], ts), 0xf5f5dc);
        const lp = createPivot(lm, -6 * PX);
        lp.position.set(lx * PX, 14 * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }
      return { group, legs, head: headPivot };
    },
  },

  iron_golem: {
    texPath: `${MC_TEXTURES}/entity/iron_golem/iron_golem.png`,
    texSize: [128, 128],
    fallbackColor: 0xc0c0c0,
    build(meshes) {
      const ts: [number, number] = [128, 128];
      const group = new THREE.Group();
      const legs: THREE.Group[] = [];

      const headPivot = new THREE.Group();
      const head = makeBox(8, 10, 8, boxUVs([0, 0], [8, 10, 8], ts), 0xc0c0c0);
      headPivot.position.set(0, 37 * PX, 0);
      headPivot.add(head);
      meshes.push(head);
      group.add(headPivot);

      const body = makeBox(18, 12, 11, boxUVs([0, 40], [18, 12, 11], ts), 0xc0c0c0);
      body.position.set(0, 25 * PX, 0);
      meshes.push(body);
      group.add(body);

      const rArm = makeBox(4, 30, 6, boxUVs([60, 21], [4, 30, 6], ts), 0xb0b0b0);
      const rArmPivot = createPivot(rArm, -15 * PX);
      rArmPivot.position.set(13 * PX, 31 * PX, 0);
      meshes.push(rArm);
      group.add(rArmPivot);

      const lArm = makeBox(4, 30, 6, boxUVs([60, 58], [4, 30, 6], ts), 0xb0b0b0);
      const lArmPivot = createPivot(lArm, -15 * PX);
      lArmPivot.position.set(-13 * PX, 31 * PX, 0);
      meshes.push(lArm);
      group.add(lArmPivot);

      const rLeg = makeBox(6, 16, 5, boxUVs([37, 0], [6, 16, 5], ts), 0xa0a0a0);
      const rLegPivot = createPivot(rLeg, -8 * PX);
      rLegPivot.position.set(5 * PX, 19 * PX, 0);
      meshes.push(rLeg);
      legs.push(rLegPivot);
      group.add(rLegPivot);

      const lLeg = makeBox(6, 16, 5, boxUVs([60, 0], [6, 16, 5], ts), 0xa0a0a0);
      const lLegPivot = createPivot(lLeg, -8 * PX);
      lLegPivot.position.set(-5 * PX, 19 * PX, 0);
      meshes.push(lLeg);
      legs.push(lLegPivot);
      group.add(lLegPivot);

      legs.push(lArmPivot, rArmPivot);
      return { group, legs, head: headPivot };
    },
  },

  snow_golem: {
    texPath: `${MC_TEXTURES}/entity/snow_golem/snow_golem.png`,
    texSize: [64, 64],
    fallbackColor: 0xf0f8ff,
    build(meshes) {
      const ts: [number, number] = [64, 64];
      const group = new THREE.Group();
      const body = makeBox(10, 18, 10, boxUVs([0, 0], [10, 18, 10], ts), 0xf0f8ff);
      body.position.y = 14 * PX;
      meshes.push(body);
      group.add(body);
      return { group, legs: [] };
    },
  },

  bat: {
    texPath: `${MC_TEXTURES}/entity/bat/bat.png`,
    texSize: [64, 64],
    fallbackColor: 0x4c3e30,
    build(meshes) {
      const ts: [number, number] = [64, 64];
      const group = new THREE.Group();
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 6 * PX, 0);
      const head = makeBox(6, 6, 6, boxUVs([0, 0], [6, 6, 6], ts), 0x4c3e30);
      headPivot.add(head);
      meshes.push(head);
      group.add(headPivot);
      const body = makeBox(4, 6, 4, boxUVs([0, 16], [4, 6, 4], ts), 0x4c3e30);
      body.position.set(0, 3 * PX, 0);
      meshes.push(body);
      group.add(body);
      return { group, legs: [], head: headPivot };
    },
  },

  slime: {
    texPath: `${MC_TEXTURES}/entity/slime/slime.png`,
    texSize: [64, 64],
    fallbackColor: 0x7ebf6e,
    build(meshes) {
      const ts: [number, number] = [64, 64];
      const group = new THREE.Group();
      const body = makeBox(8, 8, 8, boxUVs([0, 0], [8, 8, 8], ts), 0x7ebf6e);
      body.position.y = 4 * PX;
      meshes.push(body);
      group.add(body);
      return { group, legs: [] };
    },
  },

  enderman: {
    texPath: `${MC_TEXTURES}/entity/enderman/enderman.png`,
    texSize: [64, 32],
    fallbackColor: 0x161616,
    build(meshes) {
      const ts: [number, number] = [64, 32];
      const group = new THREE.Group();
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 38 * PX, 0);
      const head = makeBox(8, 8, 8, boxUVs([0, 0], [8, 8, 8], ts), 0x161616);
      headPivot.add(head);
      meshes.push(head);
      group.add(headPivot);
      const body = makeBox(8, 12, 4, boxUVs([32, 16], [8, 12, 4], ts), 0x161616);
      body.position.set(0, 32 * PX, 0);
      meshes.push(body);
      group.add(body);
      const legs: THREE.Group[] = [];
      for (const [lx, lz] of [
        [2, 0],
        [-2, 0],
      ]) {
        const lm = makeBox(4, 30, 4, boxUVs([0, 16], [4, 30, 4], ts), 0x161616);
        const lp = createPivot(lm, -15 * PX);
        lp.position.set(lx * PX, 26 * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }
      return { group, legs, head: headPivot };
    },
  },

  blaze: {
    texPath: `${MC_TEXTURES}/entity/blaze/blaze.png`,
    texSize: [64, 64],
    fallbackColor: 0xf5c842,
    build(meshes) {
      const ts: [number, number] = [64, 64];
      const group = new THREE.Group();
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 20 * PX, 0);
      const head = makeBox(8, 8, 8, boxUVs([0, 0], [8, 8, 8], ts), 0xf5c842);
      headPivot.add(head);
      meshes.push(head);
      group.add(headPivot);
      for (const [rx, rz] of [
        [3, 3],
        [-3, 3],
        [3, -3],
        [-3, -3],
      ]) {
        const rod = makeBox(2, 8, 2, boxUVs([0, 16], [2, 8, 2], ts), 0xf5c842);
        rod.position.set(rx * PX, 8 * PX, rz * PX);
        meshes.push(rod);
        group.add(rod);
      }
      return { group, legs: [], head: headPivot };
    },
  },

  ghast: {
    texPath: `${MC_TEXTURES}/entity/ghast/ghast.png`,
    texSize: [64, 64],
    fallbackColor: 0xf0f0f0,
    build(meshes) {
      const ts: [number, number] = [64, 64];
      const group = new THREE.Group();
      const body = makeBox(16, 16, 16, boxUVs([0, 0], [16, 16, 16], ts), 0xf0f0f0);
      body.position.y = 24 * PX;
      meshes.push(body);
      group.add(body);
      for (let i = -1; i <= 1; i++) {
        const tentacle = makeBox(2, 12, 2, boxUVs([0, 0], [2, 12, 2], ts), 0xd0d0d0);
        tentacle.position.set(i * 5 * PX, 6 * PX, 0);
        meshes.push(tentacle);
        group.add(tentacle);
      }
      return { group, legs: [] };
    },
  },

  witch: {
    texPath: `${MC_TEXTURES}/entity/witch/witch.png`,
    texSize: [64, 128],
    fallbackColor: 0x340d27,
    build(meshes) {
      const ts: [number, number] = [64, 128];
      const group = new THREE.Group();
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 24 * PX, 0);
      const head = makeBox(8, 10, 8, boxUVs([0, 0], [8, 10, 8], ts), 0x340d27);
      headPivot.add(head);
      meshes.push(head);
      group.add(headPivot);
      const body = makeBox(8, 12, 4, boxUVs([16, 20], [8, 12, 4], ts), 0x340d27);
      body.position.set(0, 18 * PX, 0);
      meshes.push(body);
      group.add(body);
      const legs: THREE.Group[] = [];
      for (const [lx, lz] of [
        [2, 0],
        [-2, 0],
      ]) {
        const lm = makeBox(4, 12, 4, boxUVs([0, 22], [4, 12, 4], ts), 0x340d27);
        const lp = createPivot(lm, -6 * PX);
        lp.position.set(lx * PX, 12 * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }
      return { group, legs, head: headPivot };
    },
  },
};
