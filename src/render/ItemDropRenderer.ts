import * as THREE from 'three';
import type { GameContext } from '#/common/GameContext';
import { FALLBACK_COLORS } from '#/block/blockColors';
import { BLOCK_DEFS } from '#/block/BlockRegistry';
import { getItemDef } from '#/common/ItemRegistry';
import { resolveItemId } from '#/common/types';
import type { TextureAtlas } from './TextureAtlas';

export function resolveItemDropTexture(itemId: number): string {
  const itemDef = getItemDef(itemId);
  if (itemDef?.texture) return itemDef.texture;
  const blockDef = BLOCK_DEFS[itemId];
  return blockDef?.itemTexture ?? blockDef?.textures?.top ?? '';
}

const DROP_SIZE = 0.25;
const ROTATE_SPEED = Math.PI * 0.4;

export function isBlockItem(itemId: number): boolean {
  const def = getItemDef(itemId);
  return def?.kind === 'block';
}

function createFlatItemGeometry(u0: number, v0: number, u1: number, v1: number): THREE.BufferGeometry {
  const s = DROP_SIZE;
  const h = s / 2;
  const positions = new Float32Array([
    -h, 0, 0,  h, 0, 0,  h, s, 0,  -h, s, 0,
    h, 0, 0,  -h, 0, 0,  -h, s, 0,  h, s, 0,
  ]);
  const uvs = new Float32Array([
    u0, v0,  u1, v0,  u1, v1,  u0, v1,
    u1, v0,  u0, v0,  u0, v1,  u1, v1,
  ]);
  const normals = new Float32Array([
    0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,
    0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,
  ]);
  const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

export function createMiniBlockGeometryPerFace(
  faceUVs: { top: [number, number, number, number]; bottom: [number, number, number, number]; north: [number, number, number, number]; south: [number, number, number, number]; east: [number, number, number, number]; west: [number, number, number, number] },
): THREE.BufferGeometry {
  const s = DROP_SIZE;
  const h = s / 2;
  const positions = new Float32Array([
    -h, s, h,   h, s, h,   h, s, -h,  -h, s, -h,
    -h, 0, -h,  h, 0, -h,  h, 0, h,   -h, 0, h,
    -h, 0, h,   h, 0, h,   h, s, h,   -h, s, h,
    h, 0, -h,  -h, 0, -h,  -h, s, -h,  h, s, -h,
    h, 0, h,   h, 0, -h,  h, s, -h,   h, s, h,
    -h, 0, -h,  -h, 0, h,  -h, s, h,  -h, s, -h,
  ]);
  const order: (keyof typeof faceUVs)[] = ['top', 'bottom', 'north', 'south', 'east', 'west'];
  const uvs = new Float32Array(24 * 2);
  for (let f = 0; f < 6; f++) {
    const [u0, v0, u1, v1] = faceUVs[order[f]];
    const o = f * 8;
    uvs[o] = u0;     uvs[o + 1] = v0;
    uvs[o + 2] = u1; uvs[o + 3] = v0;
    uvs[o + 4] = u1; uvs[o + 5] = v1;
    uvs[o + 6] = u0; uvs[o + 7] = v1;
  }
  const normals = new Float32Array([
    0,1,0, 0,1,0, 0,1,0, 0,1,0,
    0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
    0,0,1, 0,0,1, 0,0,1, 0,0,1,
    0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
    1,0,0, 1,0,0, 1,0,0, 1,0,0,
    -1,0,0, -1,0,0, -1,0,0, -1,0,0,
  ]);
  const indices: number[] = [];
  for (let f = 0; f < 6; f++) {
    const b = f * 4;
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

export class ItemDropRenderer {
  private scene: THREE.Scene;
  private ctx: GameContext;
  private atlas: TextureAtlas;
  private meshes = new Map<number, THREE.Mesh>();
  private wasAtlasReady = false;

  constructor(scene: THREE.Scene, ctx: GameContext, atlas: TextureAtlas) {
    this.scene = scene;
    this.ctx = ctx;
    this.atlas = atlas;
  }

  tick(dt: number, _camera?: THREE.Camera) {
    if (!this.wasAtlasReady && this.atlas.ready) {
      this.wasAtlasReady = true;
      for (const [, mesh] of this.meshes) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      this.meshes.clear();
    }

    const drops = this.ctx.state.itemDrops;
    const activeIds = new Set<number>();

    for (const drop of drops) {
      activeIds.add(drop.id);
      let mesh = this.meshes.get(drop.id);
      const itemId = resolveItemId(drop);
      if (itemId == null) continue;

      if (!mesh) {
        const texName = resolveItemDropTexture(itemId);
        let geo: THREE.BufferGeometry;
        if (isBlockItem(itemId) && this.atlas.ready) {
          const itemDef = getItemDef(itemId);
          const blockDef = BLOCK_DEFS[itemId] ?? (itemDef?.blockId != null ? BLOCK_DEFS[itemDef.blockId] : null);
          if (blockDef) {
            geo = createMiniBlockGeometryPerFace({
              top: this.atlas.getUV(blockDef.textures.top),
              bottom: this.atlas.getUV(blockDef.textures.bottom),
              north: this.atlas.getUV(blockDef.textures.north),
              south: this.atlas.getUV(blockDef.textures.south),
              east: this.atlas.getUV(blockDef.textures.east),
              west: this.atlas.getUV(blockDef.textures.west),
            });
          } else {
            const [u0, v0, u1, v1] = this.atlas.getUV(texName);
            geo = createMiniBlockGeometryPerFace({
              top: [u0, v0, u1, v1], bottom: [u0, v0, u1, v1],
              north: [u0, v0, u1, v1], south: [u0, v0, u1, v1],
              east: [u0, v0, u1, v1], west: [u0, v0, u1, v1],
            });
          }
        } else {
          const [u0, v0, u1, v1] = this.atlas.ready && texName
            ? this.atlas.getUV(texName)
            : [0, 0, 0, 0];
          geo = createFlatItemGeometry(u0, v0, u1, v1);
        }
        const color = FALLBACK_COLORS[texName] ?? '#808080';

        const mat = new THREE.MeshLambertMaterial({
          transparent: true,
          alphaTest: 0.3,
          side: isBlockItem(itemId) ? THREE.FrontSide : THREE.DoubleSide,
        });
        if (this.atlas.ready && texName) {
          mat.map = this.atlas.texture;
          mat.color.set(0xffffff);
        } else {
          mat.color.set(color);
        }

        mesh = new THREE.Mesh(geo, mat);
        this.scene.add(mesh);
        this.meshes.set(drop.id, mesh);
      }

      mesh.position.set(drop.position.x, drop.position.y + 0.15, drop.position.z);
      mesh.position.y += Math.sin(drop.age * 2.5) * 0.06;
      mesh.rotation.y += ROTATE_SPEED * dt;
    }

    for (const [id, mesh] of this.meshes) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.meshes.delete(id);
      }
    }
  }

  dispose() {
    for (const [, mesh] of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.meshes.clear();
  }
}
