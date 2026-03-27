import * as THREE from 'three';
import { assetManager } from '#/common/AssetManager';
import type { EntitySnapshot } from '#/common/GameContext';
import { MC_TEXTURES } from '#/common/types';
import { PX, boxUVs, createPivot, makeBox } from './EntityModelUtils';
import { extendedModels } from './EntityModelsExtended';
import { humanoidModels } from './EntityModelsHumanoid';

export interface EntityModel {
  group: THREE.Group;
  legs: THREE.Group[];
  limbBaseX?: number[];
  animationProfile?: 'zombie';
  head?: THREE.Group;
  walkPhase: number;
  meshes: THREE.Mesh[];
  applySnapshot?(snapshot: EntitySnapshot): void;
  loadTexture(): void;
}

interface ModelDef {
  texPath: string;
  texSize: [number, number];
  fallbackColor: number;
  build(meshes: THREE.Mesh[]): { group: THREE.Group; legs: THREE.Group[]; head?: THREE.Group };
}

const MODELS: Record<string, ModelDef> = {
  pig: {
    texPath: `${MC_TEXTURES}/entity/pig/pig_temperate.png`,
    texSize: [64, 64],
    fallbackColor: 0xf0a0a0,
    build(meshes) {
      const ts: [number, number] = [64, 64];
      const group = new THREE.Group();

      const headPivot = new THREE.Group();
      headPivot.position.set(0, 9 * PX, -6 * PX);
      const headMesh = makeBox(8, 8, 8, boxUVs([0, 0], [8, 8, 8], ts), 0xf0a0a0);
      headPivot.add(headMesh);
      const snout = makeBox(4, 3, 1, boxUVs([16, 16], [4, 3, 1], ts), 0xf0a0a0);
      snout.position.set(0, -1.5 * PX, -4.5 * PX);
      headPivot.add(snout);
      meshes.push(headMesh, snout);
      group.add(headPivot);

      const body = makeBox(10, 16, 8, boxUVs([28, 8], [10, 16, 8], ts), 0xf0a0a0);
      body.position.set(0, 8 * PX, 0);
      body.rotation.x = Math.PI / 2;
      meshes.push(body);
      group.add(body);

      const legs: THREE.Group[] = [];
      const legPositions = [
        [-3, 6, -5], [3, 6, -5],
        [-3, 6, 7], [3, 6, 7],
      ];
      for (const [lx, ly, lz] of legPositions) {
        const lm = makeBox(4, 6, 4, boxUVs([0, 16], [4, 6, 4], ts), 0xf0a0a0);
        const lp = createPivot(lm, -3 * PX);
        lp.position.set(lx * PX, ly * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }

      return { group, legs, head: headPivot };
    },
  },

  cow: {
    texPath: `${MC_TEXTURES}/entity/cow/cow_temperate.png`,
    texSize: [64, 64],
    fallbackColor: 0x6b4226,
    build(meshes) {
      const ts: [number, number] = [64, 64];
      const group = new THREE.Group();

      const headPivot = new THREE.Group();
      headPivot.position.set(0, 14 * PX, -6 * PX);
      const headMesh = makeBox(8, 8, 6, boxUVs([0, 0], [8, 8, 6], ts), 0x6b4226);
      headPivot.add(headMesh);
      const hornR = makeBox(1, 3, 1, boxUVs([22, 0], [1, 3, 1], ts), 0xd0d0b0);
      hornR.position.set(-5 * PX, -3 * PX, -1 * PX);
      headPivot.add(hornR);
      const hornL = makeBox(1, 3, 1, boxUVs([22, 0], [1, 3, 1], ts), 0xd0d0b0);
      hornL.position.set(5 * PX, -3 * PX, -1 * PX);
      headPivot.add(hornL);
      meshes.push(headMesh, hornR, hornL);
      group.add(headPivot);

      const body = makeBox(10, 16, 8, boxUVs([18, 4], [10, 16, 8], ts), 0x6b4226);
      body.position.set(0, 13 * PX, 0);
      body.rotation.x = Math.PI / 2;
      meshes.push(body);
      group.add(body);

      const legs: THREE.Group[] = [];
      const legPositions = [
        [-4, 12, -6], [4, 12, -6],
        [-4, 12, 8], [4, 12, 8],
      ];
      for (const [lx, ly, lz] of legPositions) {
        const lm = makeBox(4, 12, 4, boxUVs([0, 16], [4, 12, 4], ts), 0x6b4226);
        const lp = createPivot(lm, -6 * PX);
        lp.position.set(lx * PX, ly * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }

      return { group, legs, head: headPivot };
    },
  },

  chicken: {
    texPath: `${MC_TEXTURES}/entity/chicken/chicken_temperate.png`,
    texSize: [64, 32],
    fallbackColor: 0xf0f0f0,
    build(meshes) {
      const ts: [number, number] = [64, 32];
      const group = new THREE.Group();

      const headPivot = new THREE.Group();
      headPivot.position.set(0, 9 * PX, -4 * PX);
      const headMesh = makeBox(4, 6, 3, boxUVs([0, 0], [4, 6, 3], ts), 0xf0f0f0);
      headPivot.add(headMesh);
      const beak = makeBox(4, 2, 2, boxUVs([14, 0], [4, 2, 2], ts), 0xff6600);
      beak.position.set(0, -1 * PX, -2.5 * PX);
      headPivot.add(beak);
      const wattle = makeBox(2, 2, 2, boxUVs([14, 4], [2, 2, 2], ts), 0xff0000);
      wattle.position.set(0, -3 * PX, -2 * PX);
      headPivot.add(wattle);
      meshes.push(headMesh, beak, wattle);
      group.add(headPivot);

      const body = makeBox(6, 8, 6, boxUVs([0, 9], [6, 8, 6], ts), 0xf0f0f0);
      body.position.set(0, 7 * PX, 0);
      body.rotation.x = Math.PI / 2;
      meshes.push(body);
      group.add(body);

      const legs: THREE.Group[] = [];
      const legPositions = [[-1, 5, 1], [1, 5, 1]];
      for (const [lx, ly, lz] of legPositions) {
        const lm = makeBox(2, 5, 2, boxUVs([26, 0], [2, 5, 2], ts), 0xffaa00);
        const lp = createPivot(lm, -2.5 * PX);
        lp.position.set(lx * PX, ly * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }

      return { group, legs, head: headPivot };
    },
  },

  sheep: {
    texPath: `${MC_TEXTURES}/entity/sheep/sheep.png`,
    texSize: [64, 32],
    fallbackColor: 0xf0f0f0,
    build(meshes) {
      const ts: [number, number] = [64, 32];
      const group = new THREE.Group();

      const headPivot = new THREE.Group();
      headPivot.position.set(0, 12 * PX, -5 * PX);
      const headMesh = makeBox(6, 6, 8, boxUVs([0, 0], [6, 6, 8], ts), 0xa0a0a0);
      headPivot.add(headMesh);
      meshes.push(headMesh);
      group.add(headPivot);

      const body = makeBox(8, 16, 6, boxUVs([28, 8], [8, 16, 6], ts), 0xf0f0f0);
      body.position.set(0, 12 * PX, 2 * PX);
      body.rotation.x = Math.PI / 2;
      meshes.push(body);
      group.add(body);

      const legs: THREE.Group[] = [];
      const legPositions = [
        [-3, 12, -5], [3, 12, -5],
        [-3, 12, 8], [3, 12, 8],
      ];
      for (const [lx, ly, lz] of legPositions) {
        const lm = makeBox(4, 12, 4, boxUVs([0, 16], [4, 12, 4], ts), 0xf0f0f0);
        const lp = createPivot(lm, -6 * PX);
        lp.position.set(lx * PX, ly * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }

      return { group, legs, head: headPivot };
    },
  },

  wolf: {
    texPath: `${MC_TEXTURES}/entity/wolf/wolf.png`,
    texSize: [64, 32],
    fallbackColor: 0x808080,
    build(meshes) {
      const ts: [number, number] = [64, 32];
      const group = new THREE.Group();

      const headPivot = new THREE.Group();
      headPivot.position.set(0, 11 * PX, -7 * PX);
      const headMesh = makeBox(6, 6, 4, boxUVs([0, 0], [6, 6, 4], ts), 0x909090);
      headPivot.add(headMesh);
      const nose = makeBox(3, 3, 4, boxUVs([0, 10], [3, 3, 4], ts), 0x404040);
      nose.position.set(0, -0.5 * PX, -4 * PX);
      headPivot.add(nose);
      meshes.push(headMesh, nose);
      group.add(headPivot);

      const body = makeBox(6, 9, 6, boxUVs([18, 14], [6, 9, 6], ts), 0x808080);
      body.position.set(0, 10 * PX, 2 * PX);
      body.rotation.x = Math.PI / 2;
      meshes.push(body);
      group.add(body);

      const tail = makeBox(2, 8, 2, boxUVs([9, 18], [2, 8, 2], ts), 0x808080);
      tail.position.set(0, 11 * PX, 8 * PX);
      tail.rotation.x = 0.8;
      meshes.push(tail);
      group.add(tail);

      const legs: THREE.Group[] = [];
      const legPositions = [
        [-2.5, 8, -4], [0.5, 8, -4],
        [-2.5, 8, 7], [0.5, 8, 7],
      ];
      for (const [lx, ly, lz] of legPositions) {
        const lm = makeBox(2, 8, 2, boxUVs([0, 18], [2, 8, 2], ts), 0x808080);
        const lp = createPivot(lm, -4 * PX);
        lp.position.set(lx * PX, ly * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }

      return { group, legs, head: headPivot };
    },
  },

  rabbit: {
    texPath: `${MC_TEXTURES}/entity/rabbit/rabbit_brown.png`,
    texSize: [64, 64],
    fallbackColor: 0xc4a070,
    build(meshes) {
      const ts: [number, number] = [64, 64];
      const group = new THREE.Group();

      const headPivot = new THREE.Group();
      headPivot.position.set(0, 5 * PX, -4 * PX);
      const headMesh = makeBox(5, 4, 5, boxUVs([32, 0], [5, 4, 5], ts), 0xc4a070);
      headPivot.add(headMesh);
      meshes.push(headMesh);
      group.add(headPivot);

      const body = makeBox(5, 6, 5, boxUVs([0, 0], [5, 6, 5], ts), 0xc4a070);
      body.position.set(0, 4 * PX, 1 * PX);
      body.rotation.x = Math.PI / 2;
      meshes.push(body);
      group.add(body);

      const legs: THREE.Group[] = [];
      const legPositions = [[-1.5, 4, -2], [1.5, 4, -2], [-1.5, 4, 4], [1.5, 4, 4]];
      for (const [lx, ly, lz] of legPositions) {
        const lm = makeBox(2, 4, 2, boxUVs([8, 16], [2, 4, 2], ts), 0xc4a070);
        const lp = createPivot(lm, -2 * PX);
        lp.position.set(lx * PX, ly * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }

      return { group, legs, head: headPivot };
    },
  },

  ...extendedModels,

  cat: {
    texPath: `${MC_TEXTURES}/entity/cat/cat_tabby.png`,
    texSize: [64, 32],
    fallbackColor: 0xf0c060,
    build(meshes) {
      const ts: [number, number] = [64, 32];
      const group = new THREE.Group();

      const headPivot = new THREE.Group();
      headPivot.position.set(0, 8 * PX, -6 * PX);
      const headMesh = makeBox(5, 4, 5, boxUVs([0, 0], [5, 4, 5], ts), 0xf0c060);
      headPivot.add(headMesh);
      meshes.push(headMesh);
      group.add(headPivot);

      const body = makeBox(6, 10, 4, boxUVs([20, 0], [6, 10, 4], ts), 0xf0c060);
      body.position.set(0, 7 * PX, 0);
      body.rotation.x = Math.PI / 2;
      meshes.push(body);
      group.add(body);

      const tail = makeBox(1, 8, 1, boxUVs([0, 15], [1, 8, 1], ts), 0xf0c060);
      tail.position.set(0, 8 * PX, 6 * PX);
      tail.rotation.x = 1.2;
      meshes.push(tail);
      group.add(tail);

      const legs: THREE.Group[] = [];
      const legPositions = [[-1.5, 6, -4], [1.5, 6, -4], [-1.5, 6, 4], [1.5, 6, 4]];
      for (const [lx, ly, lz] of legPositions) {
        const lm = makeBox(2, 6, 2, boxUVs([8, 13], [2, 6, 2], ts), 0xf0c060);
        const lp = createPivot(lm, -3 * PX);
        lp.position.set(lx * PX, ly * PX, lz * PX);
        meshes.push(lm);
        legs.push(lp);
        group.add(lp);
      }

      return { group, legs, head: headPivot };
    },
  },

  ...humanoidModels,

  fish: {
    texPath: '',
    texSize: [64, 32],
    fallbackColor: 0x70a0ff,
    build(meshes) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.2, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x70a0ff }),
      );
      body.position.y = 0.1;
      meshes.push(body);
      group.add(body);
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.15, 0.15),
        new THREE.MeshLambertMaterial({ color: 0x5080dd }),
      );
      tail.position.set(0, 0.1, 0.3);
      meshes.push(tail);
      group.add(tail);
      return { group, legs: [] };
    },
  },
};

export function createEntityModel(type: string): EntityModel {
  const def = MODELS[type];
  const meshes: THREE.Mesh[] = [];

  if (def) {
    const result = def.build(meshes);
    const model: EntityModel = {
      ...result,
      walkPhase: 0,
      meshes,
      applySnapshot(snapshot) {
        if (type === 'sheep') {
          const sheared = snapshot.state.sheared === true;
          const woolColor = snapshot.state.woolColor === 'black'
            ? 0x2c2c2c
            : snapshot.state.woolColor === 'gray'
              ? 0x8b8b8b
              : 0xf0f0f0;
          const bodyMesh = meshes[1];
          if (bodyMesh?.material instanceof THREE.MeshLambertMaterial) {
            bodyMesh.material.color.setHex(sheared ? 0xb8b0a0 : woolColor);
          }
          bodyMesh.scale.set(sheared ? 0.88 : 1, 1, sheared ? 0.88 : 1);
          const headMesh = meshes[0];
          if (headMesh?.material instanceof THREE.MeshLambertMaterial) {
            headMesh.material.color.setHex(sheared ? 0x9a9a9a : 0xa0a0a0);
          }
        }
      },
      loadTexture() {
        if (!def.texPath) return;
        assetManager.loadImage(def.texPath).then((img) => {
          if (!img) return;
          const tex = new THREE.CanvasTexture(img);
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
          tex.colorSpace = THREE.SRGBColorSpace;
          for (const m of meshes) {
            (m.material as THREE.MeshLambertMaterial).map = tex;
            (m.material as THREE.MeshLambertMaterial).color.set(0xffffff);
            (m.material as THREE.MeshLambertMaterial).needsUpdate = true;
          }
        });
      },
    };
    model.applySnapshot?.({
      type,
      position: { x: 0, y: 0, z: 0 },
      yaw: 0,
      hp: 0,
      maxHp: 0,
      state: {},
      attributes: {},
    });
    if (type === 'zombie' && model.legs.length >= 4) {
      // Keep zombie arms naturally raised forward (MC-like) while still allowing swing animation.
      model.limbBaseX = [0, 0, -Math.PI / 2, -Math.PI / 2];
      model.animationProfile = 'zombie';
    }
    model.loadTexture();
    return model;
  }

  // Fallback: simple colored box
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x808080 }),
  );
  body.position.y = 0.25;
  meshes.push(body);
  group.add(body);
  return { group, legs: [], walkPhase: 0, meshes, loadTexture() {} };
}

export function animateEntity(model: EntityModel, dt: number, isMoving: boolean, currentAction = 'idle') {
  const base = (index: number) => model.limbBaseX?.[index] ?? 0;
  if (currentAction === 'attack') {
    model.walkPhase += dt * 12;
    const strike = Math.sin(model.walkPhase) * 0.8;
    if (model.animationProfile === 'zombie' && model.legs.length >= 4) {
      // Zombies attack with both arms thrusting forward together.
      model.legs[0].rotation.x = strike * 0.35 + base(0);
      model.legs[1].rotation.x = -strike * 0.35 + base(1);
      const armSwing = Math.max(0, strike);
      model.legs[2].rotation.x = armSwing + base(2);
      model.legs[3].rotation.x = armSwing + base(3);
    } else {
      for (let i = 0; i < model.legs.length; i++) {
        model.legs[i].rotation.x = (i % 2 === 0 ? strike : -strike * 0.6) + base(i);
      }
    }
    if (model.head) {
      model.head.rotation.x = -0.25 + Math.max(0, Math.sin(model.walkPhase)) * 0.5;
    }
    return;
  }

  if (currentAction === 'chase') {
    model.walkPhase += dt * 9;
    const swing = Math.sin(model.walkPhase) * 0.8;
    for (let i = 0; i < model.legs.length; i++) {
      model.legs[i].rotation.x = (i % 2 === 0 ? swing : -swing) + base(i);
    }
    if (model.head) {
      model.head.rotation.x *= 0.8;
    }
    return;
  }

  if (isMoving) {
    model.walkPhase += dt * 6;
    const swing = Math.sin(model.walkPhase) * 0.5;
    for (let i = 0; i < model.legs.length; i++) {
      model.legs[i].rotation.x = (i % 2 === 0 ? swing : -swing) + base(i);
    }
  } else {
    model.walkPhase = 0;
    for (let i = 0; i < model.legs.length; i++) {
      const b = base(i);
      model.legs[i].rotation.x = model.legs[i].rotation.x * 0.85 + b * 0.15;
    }
  }
  if (model.head) {
    model.head.rotation.x *= 0.85;
  }
}
