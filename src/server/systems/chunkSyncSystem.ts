import { CHUNK_SIZE, WATER_LEVEL, WORLD_HEIGHT } from '#/common/types';
import { isVillageChunk, VILLAGE_ENTITY_SPAWNS } from '../World';

export interface ChunkCoord {
  cx: number;
  cz: number;
}

export interface VillageEntitySpawnPlan {
  type: string;
  x: number;
  y: number;
  z: number;
  profession?: string;
}

export function getChunkCoordsInRadius(cx: number, cz: number, radius: number): ChunkCoord[] {
  const out: ChunkCoord[] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      out.push({ cx: cx + dx, cz: cz + dz });
    }
  }
  return out;
}

export function getChunkCoordsInRadiusSorted(cx: number, cz: number, radius: number): ChunkCoord[] {
  const out = getChunkCoordsInRadius(cx, cz, radius);
  out.sort((a, b) => {
    const da = (a.cx - cx) * (a.cx - cx) + (a.cz - cz) * (a.cz - cz);
    const db = (b.cx - cx) * (b.cx - cx) + (b.cz - cz) * (b.cz - cz);
    return da - db;
  });
  return out;
}

export function planVillageEntitySpawnsForChunk(input: {
  cx: number;
  cz: number;
  seed: number;
  getBiomeAt: (x: number, z: number) => { id: string };
  findSpawnY: (x: number, z: number) => number;
}): VillageEntitySpawnPlan[] {
  const { cx, cz, seed, getBiomeAt, findSpawnY } = input;
  if (!isVillageChunk(cx, cz, seed)) return [];

  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;
  const biome = getBiomeAt(originX + 8, originZ + 8);
  if (biome.id !== 'grassland' && biome.id !== 'forest') return [];

  const plans: VillageEntitySpawnPlan[] = [];
  for (const spawn of VILLAGE_ENTITY_SPAWNS) {
    const worldX = originX + spawn.x;
    const worldZ = originZ + spawn.z;
    const supportY = findSpawnY(Math.floor(worldX), Math.floor(worldZ));
    if (supportY <= WATER_LEVEL + 1 || supportY >= WORLD_HEIGHT - 2) continue;
    plans.push({
      type: spawn.type,
      x: worldX,
      y: supportY + 0.1,
      z: worldZ,
      profession: 'profession' in spawn ? spawn.profession : undefined,
    });
  }
  return plans;
}
