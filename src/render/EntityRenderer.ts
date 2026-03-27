import * as THREE from 'three';
import type { GameContext } from '#/common/GameContext';
import { ENTITY_DEFS, NPC_TYPES } from '#/entity/EntityDefs';
import type { Vec3 } from '#/common/types';
import { animateEntity, createEntityModel, type EntityModel } from './EntityModels';

const LERP_SPEED = 8;

interface EntityRenderState {
  id: number;
  type: string;
  model: EntityModel;
  targetPos: Vec3;
  prevPos: Vec3;
  targetYaw: number;
  currentAction: string;
  nameSprite: THREE.Sprite | null;
  nameToken: string;
}

function createNametagSprite(text: string): THREE.Sprite {
  const dpr = 4;
  const canvas = document.createElement('canvas');
  const ctx2d = canvas.getContext('2d')!;
  const baseFont = 'bold 32px Monocraft, monospace';
  ctx2d.font = baseFont;
  const metrics = ctx2d.measureText(text);
  const w = Math.max(256, Math.ceil(metrics.width) + 40);
  const h = 56;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx2d.scale(dpr, dpr);

  ctx2d.fillStyle = 'rgba(0,0,0,0.65)';
  const r = 4;
  ctx2d.beginPath();
  ctx2d.roundRect(2, 2, w - 4, h - 4, r);
  ctx2d.fill();
  ctx2d.fillStyle = '#fff';
  ctx2d.font = baseFont;
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'middle';
  ctx2d.imageSmoothingEnabled = false;
  ctx2d.fillText(text, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.8, 0.45, 1);
  return sprite;
}

function getNametagText(type: string, attributes: Record<string, string | number | boolean>) {
  const name = ENTITY_DEFS[type]?.name ?? type;
  const profession = typeof attributes.profession === 'string' && attributes.profession !== 'none'
    ? attributes.profession
    : '';
  return profession ? `${name} (${profession})` : name;
}

export class EntityRenderer {
  private scene: THREE.Scene;
  private ctx: GameContext;
  private states = new Map<number, EntityRenderState>();
  private readonly tmpTarget = new THREE.Vector3();
  private readonly activeIds = new Set<number>();

  constructor(scene: THREE.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
  }

  tick(dt: number) {
    const entities = this.ctx.state.entities;
    this.activeIds.clear();

    for (const key in entities) {
      if (!Object.hasOwn(entities, key)) continue;
      const id = +key;
      this.activeIds.add(id);
      const snap = entities[id];
      if (!snap) continue;

      let state = this.states.get(id);
      if (!state) {
        const model = createEntityModel(snap.type);
        this.scene.add(model.group);
        model.group.userData.minewebEntityId = id;
        model.group.userData.minewebEntityType = snap.type;
        model.group.traverse((child) => {
          child.userData.minewebEntityId = id;
          child.userData.minewebEntityType = snap.type;
        });
        model.group.position.set(snap.position.x, snap.position.y, snap.position.z);
        model.group.rotation.y = snap.yaw;

        let nameSprite: THREE.Sprite | null = null;
        let nameToken = '';
        if (NPC_TYPES.includes(snap.type)) {
          nameToken = getNametagText(snap.type, snap.attributes);
          nameSprite = createNametagSprite(nameToken);
          const def = ENTITY_DEFS[snap.type];
          nameSprite.position.y = (def?.height ?? 1) + 0.3;
          model.group.add(nameSprite);
        }

        state = {
          id,
          type: snap.type,
          model,
          targetPos: { ...snap.position },
          prevPos: { ...snap.position },
          targetYaw: snap.yaw,
          currentAction: typeof snap.state.currentAction === 'string' ? snap.state.currentAction : 'idle',
          nameSprite,
          nameToken,
        };
        this.states.set(id, state);
        this.raycastTargetsDirty = true;
      }

      state.prevPos.x = state.targetPos.x;
      state.prevPos.y = state.targetPos.y;
      state.prevPos.z = state.targetPos.z;
      state.targetPos.x = snap.position.x;
      state.targetPos.y = snap.position.y;
      state.targetPos.z = snap.position.z;
      state.targetYaw = snap.yaw;
      state.currentAction = typeof snap.state.currentAction === 'string' ? snap.state.currentAction : 'idle';
      state.model.applySnapshot?.(snap);
      if (state.nameSprite) {
        const nextToken = getNametagText(snap.type, snap.attributes);
        if (nextToken !== state.nameToken) {
          state.model.group.remove(state.nameSprite);
          (state.nameSprite.material as THREE.SpriteMaterial).map?.dispose();
          state.nameSprite.material.dispose();
          state.nameToken = nextToken;
          state.nameSprite = createNametagSprite(nextToken);
          const def = ENTITY_DEFS[snap.type];
          state.nameSprite.position.y = (def?.height ?? 1) + 0.3;
          state.model.group.add(state.nameSprite);
        }
      }
    }

    for (const [id, state] of this.states) {
      if (!this.activeIds.has(id)) {
        this.removeState(state);
        this.states.delete(id);
        this.raycastTargetsDirty = true;
        continue;
      }
      const g = state.model.group;
      this.tmpTarget.set(state.targetPos.x, state.targetPos.y, state.targetPos.z);
      g.position.lerp(this.tmpTarget, Math.min(1, LERP_SPEED * dt));

      const dyaw = state.targetYaw - g.rotation.y;
      let normalized = ((dyaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (normalized > Math.PI) normalized -= Math.PI * 2;
      g.rotation.y += normalized * Math.min(1, LERP_SPEED * dt);

      const dx = state.targetPos.x - state.prevPos.x;
      const dz = state.targetPos.z - state.prevPos.z;
      const isMoving = dx * dx + dz * dz > 0.0001;
      animateEntity(state.model, dt, isMoving, state.currentAction);
    }
  }

  private raycastTargetCache: THREE.Object3D[] = [];
  private raycastTargetsDirty = true;

  markRaycastTargetsDirty() {
    this.raycastTargetsDirty = true;
  }

  getRaycastTargets() {
    if (this.raycastTargetsDirty) {
      this.raycastTargetCache.length = 0;
      for (const state of this.states.values()) {
        this.raycastTargetCache.push(state.model.group);
      }
      this.raycastTargetsDirty = false;
    }
    return this.raycastTargetCache;
  }

  private removeState(state: EntityRenderState) {
    this.scene.remove(state.model.group);
    state.model.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
      if (child instanceof THREE.Sprite) {
        (child.material as THREE.SpriteMaterial).map?.dispose();
        child.material.dispose();
      }
    });
  }

  dispose() {
    for (const state of this.states.values()) this.removeState(state);
    this.states.clear();
  }
}
