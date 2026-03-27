import { BLOCK_DEFS, BlockTypes } from '#/block/BlockRegistry';
import { selectBiome, type BiomeDef } from '#/common/BiomeRegistry';
import {
  defaultNoiseParams,
  fractalNoise2d,
  hash2d,
  noise3d,
  type NoiseParams,
} from '#/common/Noise';
import {
  CHUNK_SIZE,
  type ChunkData,
  WATER_LEVEL,
  WORLD_HEIGHT,
} from '#/common/types';

const B = BlockTypes;

export const TERRAIN_PARAMS: NoiseParams = defaultNoiseParams({
  offset: 32,
  scale: 20,
  spreadX: 50,
  spreadZ: 50,
  seed: 0,
  octaves: 5,
  persistence: 0.5,
  lacunarity: 2,
});
export const MOUNTAIN_PARAMS: NoiseParams = defaultNoiseParams({
  offset: 0,
  scale: 25,
  spreadX: 200,
  spreadZ: 200,
  seed: 500,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2,
});
export const HEAT_PARAMS: NoiseParams = defaultNoiseParams({
  offset: 50,
  scale: 30,
  spreadX: 300,
  spreadZ: 300,
  seed: 1000,
  octaves: 3,
  persistence: 0.5,
  lacunarity: 2,
});
export const HUMIDITY_PARAMS: NoiseParams = defaultNoiseParams({
  offset: 50,
  scale: 30,
  spreadX: 250,
  spreadZ: 250,
  seed: 2000,
  octaves: 3,
  persistence: 0.5,
  lacunarity: 2,
});
export const CAVE_PARAMS: NoiseParams = defaultNoiseParams({
  offset: 0,
  scale: 1,
  spreadX: 30,
  spreadZ: 30,
  seed: 3000,
  octaves: 3,
  persistence: 0.5,
  lacunarity: 2,
});

const CAVE_THRESHOLD = 0.35;
const CAVE_SCALE = 0.05;
/** y range for granite/diorite/andesite pockets (overworld stone only, not deepslate). */
const STONE_VARIETY_Y_MIN = 5;
const STONE_VARIETY_Y_MAX = 60;
/** ~8% of positions: max of 3 independent hash2d layers exceeds this (1 - t^3 ≈ 0.08 for t ≈ 0.973). */
const STONE_VARIETY_THRESHOLD = 0.973;
const VILLAGE_ANCHOR_REGION_SIZE = 24;
const VILLAGE_ANCHOR_JITTER = 5;
const VILLAGE_RANDOM_THRESHOLD = 0.978;
export const TERRAIN_SURFACE_MIN_Y = 4;
export const TERRAIN_SURFACE_MAX_Y = WORLD_HEIGHT - 12;
export type BlockState = Record<string, string | number | boolean>;

export function getSurfacePoolChancesByBiome(biomeId: string) {
  switch (biomeId) {
    case 'swamp':
      return { poolChance: 0.2, lavaChance: 0.01 };
    case 'desert':
      return { poolChance: 0.14, lavaChance: 0.62 };
    case 'mountains':
      return { poolChance: 0.12, lavaChance: 0.38 };
    case 'taiga':
      return { poolChance: 0.1, lavaChance: 0.1 };
    case 'tundra':
      return { poolChance: 0.08, lavaChance: 0.02 };
    case 'ocean':
    case 'beach':
      return { poolChance: 0.05, lavaChance: 0.06 };
    default:
      return { poolChance: 0.1, lavaChance: 0.18 };
  }
}

export const VILLAGE_STRUCTURE_TARGETS = Object.freeze({
  village: { label: 'village', offsetX: 8, offsetZ: 8 },
  plaza: { label: 'plaza', offsetX: 13, offsetZ: 6 },
  house: { label: 'house', offsetX: 4, offsetZ: 4 },
  hut: { label: 'hut', offsetX: 2, offsetZ: 8 },
  farm: { label: 'farm', offsetX: 11, offsetZ: 4 },
  well: { label: 'well', offsetX: 4, offsetZ: 11 },
  smithy: { label: 'smithy', offsetX: 11, offsetZ: 10 },
  storage: { label: 'storage', offsetX: 13, offsetZ: 13 },
  lamp_post: { label: 'lamp_post', offsetX: 7, offsetZ: 12 },
} as const);

export const VILLAGE_CHEST_POSITIONS = Object.freeze([
  { localX: 10, localZ: 11, structureOriginX: 9, structureOriginZ: 8, lootTable: 'village_smithy' as const },
  { localX: 14, localZ: 14, structureOriginX: 13, structureOriginZ: 13, lootTable: 'village_storage' as const },
]);

export const VILLAGE_ENTITY_SPAWNS = Object.freeze([
  { type: 'villager', x: 5.5, z: 5.5, profession: 'librarian' },
  { type: 'farmer', x: 11.5, z: 10.5 },
  { type: 'villager', x: 11.5, z: 9.5, profession: 'armorer' },
  { type: 'villager', x: 4.5, z: 11.5, profession: 'toolsmith' },
  { type: 'villager', x: 8.5, z: 3.5, profession: 'weaponsmith' },
  { type: 'chicken', x: 10.5, z: 4.5 },
  { type: 'sheep', x: 12.5, z: 5.5 },
  { type: 'cow', x: 9.5, z: 12.5 },
] as const);

export class Chunk {
  blocks: Uint8Array;
  cx: number;
  cz: number;
  dirty = true;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
  }

  getBlock(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) return B.AIR;
    return this.blocks[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x];
  }

  setBlock(x: number, y: number, z: number, id: number) {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) return;
    this.blocks[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] = id;
    this.dirty = true;
  }

  toData(): ChunkData {
    return { cx: this.cx, cz: this.cz, blocks: this.blocks };
  }
}

function generateTree(world: World, wx: number, wy: number, wz: number, logType: number, leafType: number, seed: number) {
  const trunkH = 4 + Math.floor(hash2d(wx, wz, seed) * 3);
  for (let h = 0; h < trunkH; h++) world.setBlock(wx, wy + h, wz, logType);
  const leafStart = wy + trunkH - 1;
  for (let dy = 0; dy < 4; dy++) {
    const r = dy === 0 ? 2 : dy === 3 ? 1 : 2;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx === 0 && dz === 0 && dy < 3) continue;
        if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
        const bx = wx + dx;
        const bz = wz + dz;
        const ly = leafStart + dy;
        if (ly >= 0 && ly < WORLD_HEIGHT && world.getBlock(bx, ly, bz) === B.AIR) {
          world.setBlock(bx, ly, bz, leafType);
        }
      }
    }
  }
}

function isCarvedByCave(wx: number, wy: number, wz: number, seed: number): boolean {
  const n = noise3d(wx * CAVE_SCALE, wy * CAVE_SCALE, wz * CAVE_SCALE, seed);
  return n < CAVE_THRESHOLD;
}

const DUNGEON_Y_MIN = 5;
const DUNGEON_Y_MAX = 18;
const DUNGEON_SIZE = 5;
const DUNGEON_HEIGHT = 4;
const DUNGEON_CHANCE_THRESHOLD = 0.97;

export type DungeonPlacement = { wx: number; wy: number; wz: number };

export function getDungeonPlacement(cx: number, cz: number, seed: number): DungeonPlacement | null {
  const h = hash2d(cx * 7.13, cz * 11.17, seed + 8888);
  if (h < DUNGEON_CHANCE_THRESHOLD) return null;
  const localX = 2 + Math.floor(hash2d(cx * 3.7, cz * 5.3, seed + 8900) * (CHUNK_SIZE - DUNGEON_SIZE - 4));
  const localZ = 2 + Math.floor(hash2d(cx * 5.1, cz * 3.9, seed + 8901) * (CHUNK_SIZE - DUNGEON_SIZE - 4));
  const y = DUNGEON_Y_MIN + Math.floor(hash2d(cx * 2.3, cz * 4.7, seed + 8902) * (DUNGEON_Y_MAX - DUNGEON_Y_MIN));
  return { wx: cx * CHUNK_SIZE + localX, wy: y, wz: cz * CHUNK_SIZE + localZ };
}

export function buildDungeon(world: World, placement: DungeonPlacement) {
  const { wx, wy, wz } = placement;
  for (let dx = 0; dx < DUNGEON_SIZE; dx++) {
    for (let dz = 0; dz < DUNGEON_SIZE; dz++) {
      for (let dy = 0; dy < DUNGEON_HEIGHT; dy++) {
        const isWall = dx === 0 || dx === DUNGEON_SIZE - 1 || dz === 0 || dz === DUNGEON_SIZE - 1;
        const isFloor = dy === 0;
        const isCeiling = dy === DUNGEON_HEIGHT - 1;
        if (isWall || isFloor || isCeiling) {
          const mossy = hash2d((wx + dx) * 0.3, (wz + dz) * 0.3 + dy * 0.7, 9999) > 0.6;
          world.setBlock(wx + dx, wy + dy, wz + dz, mossy ? B.MOSSY_STONE_BRICKS : B.COBBLESTONE);
        } else {
          world.setBlock(wx + dx, wy + dy, wz + dz, B.AIR);
        }
      }
    }
  }
  const chestX = wx + Math.floor(DUNGEON_SIZE / 2);
  const chestZ = wz + Math.floor(DUNGEON_SIZE / 2);
  world.setBlock(chestX, wy + 1, chestZ, B.CHEST);
}

/** Multi-scale deterministic stone-pocket value in [0, 1] for variety placement. */
function stoneVarietyMaxNoise(wx: number, wy: number, wz: number, seed: number, salt: number): number {
  return Math.max(
    hash2d(wx * 0.057 + wy * 0.02, wz * 0.057, seed + salt),
    hash2d(wx * 0.019, wz * 0.019 + wy * 0.027, seed + salt + 11),
    hash2d(wx * 0.118, wz * 0.096 + wy * 0.034, seed + salt + 22),
  );
}

function findSurfaceY(chunk: Chunk, lx: number, lz: number): number {
  for (let y = WORLD_HEIGHT - 1; y > 0; y--) {
    const id = chunk.getBlock(lx, y, lz);
    if (id === B.AIR || id === B.WATER || id === B.LAVA || id === B.OAK_LEAVES || id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES) {
      continue;
    }
    return y;
  }
  return 1;
}

function clearBox(chunk: Chunk, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        chunk.setBlock(x, y, z, B.AIR);
      }
    }
  }
}

function buildVillageHouse(chunk: Chunk, originX: number, originZ: number, seed: number) {
  const centerX = originX + 2;
  const centerZ = originZ + 2;
  const baseY = findSurfaceY(chunk, centerX, centerZ) + 1;
  if (baseY <= WATER_LEVEL + 1 || baseY >= WORLD_HEIGHT - 6) return false;

  const minX = originX - 1;
  const maxX = originX + 5;
  const minZ = originZ - 1;
  const maxZ = originZ + 5;
  if (minX < 1 || minZ < 1 || maxX >= CHUNK_SIZE - 1 || maxZ >= CHUNK_SIZE - 1) return false;

  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      chunk.setBlock(x, baseY - 1, z, B.COBBLESTONE);
    }
  }

  clearBox(chunk, originX, baseY, originZ, originX + 4, baseY + 4, originZ + 4);

  for (let y = baseY; y <= baseY + 3; y++) {
    for (let x = originX; x <= originX + 4; x++) {
      chunk.setBlock(x, y, originZ, B.OAK_PLANKS);
      chunk.setBlock(x, y, originZ + 4, B.OAK_PLANKS);
    }
    for (let z = originZ; z <= originZ + 4; z++) {
      chunk.setBlock(originX, y, z, B.OAK_PLANKS);
      chunk.setBlock(originX + 4, y, z, B.OAK_PLANKS);
    }
  }

  for (let x = originX - 1; x <= originX + 5; x++) {
    for (let z = originZ - 1; z <= originZ + 5; z++) {
      chunk.setBlock(x, baseY + 4, z, B.OAK_PLANKS);
    }
  }

  chunk.setBlock(originX + 2, baseY, originZ, B.AIR);
  chunk.setBlock(originX + 2, baseY + 1, originZ, B.AIR);
  chunk.setBlock(originX + 1, baseY + 2, originZ, B.GLASS);
  chunk.setBlock(originX + 3, baseY + 2, originZ, B.GLASS);
  chunk.setBlock(originX, baseY + 2, originZ + 2, B.GLASS);
  chunk.setBlock(originX + 4, baseY + 2, originZ + 2, B.GLASS);
  chunk.setBlock(originX + 2, baseY - 1, originZ - 1, B.DIRT_PATH);
  chunk.setBlock(originX + 2, baseY - 1, originZ - 2, B.DIRT_PATH);

  const torchChance = hash2d(originX * 13.3, originZ * 17.7, seed + 9300);
  if (torchChance > 0.4) {
    chunk.setBlock(originX + 1, baseY + 1, originZ + 1, B.TORCH);
  }
  return true;
}

function buildVillageFarm(chunk: Chunk, originX: number, originZ: number, seed: number) {
  const centerX = originX + 2;
  const centerZ = originZ + 2;
  const baseY = findSurfaceY(chunk, centerX, centerZ);
  if (baseY <= WATER_LEVEL || baseY >= WORLD_HEIGHT - 6) return false;
  const minX = originX - 1;
  const maxX = originX + 5;
  const minZ = originZ - 1;
  const maxZ = originZ + 5;
  if (minX < 1 || minZ < 1 || maxX >= CHUNK_SIZE - 1 || maxZ >= CHUNK_SIZE - 1) return false;

  for (let x = originX; x <= originX + 4; x++) {
    for (let z = originZ; z <= originZ + 4; z++) {
      chunk.setBlock(x, baseY, z, B.FARMLAND);
      chunk.setBlock(x, baseY + 1, z, B.AIR);
    }
  }

  for (let x = originX - 1; x <= originX + 5; x++) {
    chunk.setBlock(x, baseY, originZ - 1, B.OAK_LOG);
    chunk.setBlock(x, baseY, originZ + 5, B.OAK_LOG);
  }
  for (let z = originZ - 1; z <= originZ + 5; z++) {
    chunk.setBlock(originX - 1, baseY, z, B.OAK_LOG);
    chunk.setBlock(originX + 5, baseY, z, B.OAK_LOG);
  }

  const waterZ = originZ + (hash2d(originX * 2.3, originZ * 2.1, seed + 9001) > 0.5 ? 1 : 3);
  for (let x = originX; x <= originX + 4; x++) {
    chunk.setBlock(x, baseY, waterZ, B.WATER);
    chunk.setBlock(x, baseY + 1, waterZ, B.AIR);
  }
  return true;
}

function buildVillageWell(chunk: Chunk, originX: number, originZ: number) {
  const centerX = originX + 1;
  const centerZ = originZ + 1;
  const baseY = findSurfaceY(chunk, centerX, centerZ);
  if (baseY <= WATER_LEVEL || baseY >= WORLD_HEIGHT - 8) return false;
  if (originX < 1 || originZ < 1 || originX + 3 >= CHUNK_SIZE - 1 || originZ + 3 >= CHUNK_SIZE - 1) return false;

  for (let x = originX; x <= originX + 3; x++) {
    for (let z = originZ; z <= originZ + 3; z++) {
      chunk.setBlock(x, baseY, z, B.COBBLESTONE);
      chunk.setBlock(x, baseY + 1, z, B.AIR);
      chunk.setBlock(x, baseY + 2, z, B.AIR);
    }
  }
  chunk.setBlock(originX + 1, baseY, originZ + 1, B.WATER);
  chunk.setBlock(originX + 2, baseY, originZ + 1, B.WATER);
  chunk.setBlock(originX + 1, baseY, originZ + 2, B.WATER);
  chunk.setBlock(originX + 2, baseY, originZ + 2, B.WATER);

  const posts: Array<[number, number]> = [
    [originX, originZ],
    [originX + 3, originZ],
    [originX, originZ + 3],
    [originX + 3, originZ + 3],
  ];
  for (const [x, z] of posts) {
    chunk.setBlock(x, baseY + 1, z, B.OAK_LOG);
    chunk.setBlock(x, baseY + 2, z, B.OAK_LOG);
  }
  for (let x = originX; x <= originX + 3; x++) {
    for (let z = originZ; z <= originZ + 3; z++) {
      chunk.setBlock(x, baseY + 3, z, B.OAK_PLANKS);
    }
  }
  return true;
}

function buildVillageHut(chunk: Chunk, originX: number, originZ: number, seed: number) {
  const centerX = originX + 1;
  const centerZ = originZ + 1;
  const baseY = findSurfaceY(chunk, centerX, centerZ) + 1;
  if (baseY <= WATER_LEVEL + 1 || baseY >= WORLD_HEIGHT - 6) return false;
  const minX = originX - 1;
  const maxX = originX + 3;
  const minZ = originZ - 1;
  const maxZ = originZ + 3;
  if (minX < 1 || minZ < 1 || maxX >= CHUNK_SIZE - 1 || maxZ >= CHUNK_SIZE - 1) return false;

  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      chunk.setBlock(x, baseY - 1, z, B.COBBLESTONE);
    }
  }

  clearBox(chunk, originX, baseY, originZ, originX + 2, baseY + 3, originZ + 2);

  for (let y = baseY; y <= baseY + 2; y++) {
    for (let x = originX; x <= originX + 2; x++) {
      chunk.setBlock(x, y, originZ, B.OAK_PLANKS);
      chunk.setBlock(x, y, originZ + 2, B.OAK_PLANKS);
    }
    for (let z = originZ; z <= originZ + 2; z++) {
      chunk.setBlock(originX, y, z, B.OAK_PLANKS);
      chunk.setBlock(originX + 2, y, z, B.OAK_PLANKS);
    }
  }

  for (let x = originX - 1; x <= originX + 3; x++) {
    for (let z = originZ - 1; z <= originZ + 3; z++) {
      chunk.setBlock(x, baseY + 3, z, B.OAK_PLANKS);
    }
  }

  chunk.setBlock(originX + 1, baseY, originZ, B.AIR);
  chunk.setBlock(originX + 1, baseY + 1, originZ, B.AIR);
  chunk.setBlock(originX + 2, baseY + 1, originZ + 1, B.GLASS);
  chunk.setBlock(originX + 1, baseY - 1, originZ - 1, B.DIRT_PATH);
  if (hash2d(originX * 12.1, originZ * 9.3, seed + 9350) > 0.45) {
    chunk.setBlock(originX + 1, baseY + 1, originZ + 1, B.TORCH);
  }
  return true;
}

function buildVillageStorage(chunk: Chunk, originX: number, originZ: number, seed: number) {
  const centerX = originX;
  const centerZ = originZ;
  const baseY = findSurfaceY(chunk, centerX, centerZ) + 1;
  if (baseY <= WATER_LEVEL + 1 || baseY >= WORLD_HEIGHT - 6) return false;
  if (originX < 1 || originZ < 1 || originX + 1 >= CHUNK_SIZE - 1 || originZ + 1 >= CHUNK_SIZE - 1) return false;

  for (let x = originX; x <= originX + 1; x++) {
    for (let z = originZ; z <= originZ + 1; z++) {
      chunk.setBlock(x, baseY - 1, z, B.COBBLESTONE);
      chunk.setBlock(x, baseY + 2, z, B.OAK_PLANKS);
    }
  }

  chunk.setBlock(originX, baseY, originZ, B.BRICKS);
  chunk.setBlock(originX + 1, baseY, originZ, B.BRICKS);
  chunk.setBlock(originX, baseY, originZ + 1, B.BRICKS);
  chunk.setBlock(originX + 1, baseY, originZ + 1, B.BRICKS);
  chunk.setBlock(originX, baseY + 1, originZ, B.OAK_LOG);
  chunk.setBlock(originX + 1, baseY + 1, originZ, B.OAK_LOG);
  chunk.setBlock(originX, baseY + 1, originZ + 1, B.AIR);
  chunk.setBlock(originX + 1, baseY + 1, originZ + 1, B.AIR);

  chunk.setBlock(originX + 1, baseY + 1, originZ + 1, B.CHEST);
  if (hash2d(originX * 7.7, originZ * 13.1, seed + 9360) > 0.4) {
    chunk.setBlock(originX, baseY + 1, originZ + 1, B.TORCH);
  }
  chunk.setBlock(originX, baseY - 1, originZ - 1, B.DIRT_PATH);
  return true;
}

function buildVillageSmithy(chunk: Chunk, originX: number, originZ: number, seed: number) {
  const centerX = originX + 2;
  const centerZ = originZ + 2;
  const baseY = findSurfaceY(chunk, centerX, centerZ) + 1;
  if (baseY <= WATER_LEVEL + 1 || baseY >= WORLD_HEIGHT - 7) return false;
  const minX = originX - 1;
  const maxX = originX + 5;
  const minZ = originZ - 1;
  const maxZ = originZ + 5;
  if (minX < 1 || minZ < 1 || maxX >= CHUNK_SIZE - 1 || maxZ >= CHUNK_SIZE - 1) return false;

  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      chunk.setBlock(x, baseY - 1, z, B.COBBLESTONE);
    }
  }

  clearBox(chunk, originX, baseY, originZ, originX + 4, baseY + 4, originZ + 4);

  for (let y = baseY; y <= baseY + 3; y++) {
    for (let x = originX; x <= originX + 4; x++) {
      const edge = x === originX || x === originX + 4;
      chunk.setBlock(x, y, originZ, edge ? B.COBBLESTONE : B.OAK_PLANKS);
      chunk.setBlock(x, y, originZ + 4, edge ? B.COBBLESTONE : B.OAK_PLANKS);
    }
    for (let z = originZ; z <= originZ + 4; z++) {
      const edge = z === originZ || z === originZ + 4;
      chunk.setBlock(originX, y, z, edge ? B.COBBLESTONE : B.OAK_PLANKS);
      chunk.setBlock(originX + 4, y, z, edge ? B.COBBLESTONE : B.OAK_PLANKS);
    }
  }

  const roofUsesStone = hash2d(originX * 11.3, originZ * 9.7, seed + 9400) > 0.5;
  const roofBlock = roofUsesStone ? B.COBBLESTONE : B.OAK_PLANKS;
  for (let x = originX - 1; x <= originX + 5; x++) {
    for (let z = originZ - 1; z <= originZ + 5; z++) {
      chunk.setBlock(x, baseY + 4, z, roofBlock);
    }
  }

  chunk.setBlock(originX + 2, baseY, originZ, B.AIR);
  chunk.setBlock(originX + 2, baseY + 1, originZ, B.AIR);
  chunk.setBlock(originX + 1, baseY + 2, originZ + 4, B.GLASS);
  chunk.setBlock(originX + 3, baseY + 2, originZ + 4, B.GLASS);
  chunk.setBlock(originX + 3, baseY, originZ + 2, B.FURNACE);
  chunk.setBlock(originX + 1, baseY, originZ + 2, B.CRAFTING_TABLE);
  chunk.setBlock(originX + 1, baseY, originZ + 3, B.CHEST);
  chunk.setBlock(originX + 2, baseY - 1, originZ - 1, B.DIRT_PATH);
  return true;
}

function buildVillageLampPost(chunk: Chunk, originX: number, originZ: number) {
  const baseY = Math.max(WATER_LEVEL + 1, findSurfaceY(chunk, originX, originZ));
  if (baseY >= WORLD_HEIGHT - 6) return false;
  if (originX < 1 || originZ < 1 || originX >= CHUNK_SIZE - 1 || originZ >= CHUNK_SIZE - 1) return false;

  chunk.setBlock(originX, baseY, originZ, B.COBBLESTONE);
  chunk.setBlock(originX, baseY + 1, originZ, B.OAK_LOG);
  chunk.setBlock(originX, baseY + 2, originZ, B.OAK_LOG);
  chunk.setBlock(originX, baseY + 3, originZ, B.TORCH);
  chunk.setBlock(originX, baseY - 1, originZ, B.DIRT_PATH);
  return true;
}

function buildVillagePlaza(chunk: Chunk, originX: number, originZ: number) {
  const centerX = originX + 1;
  const centerZ = originZ + 1;
  const baseY = Math.max(WATER_LEVEL + 1, findSurfaceY(chunk, centerX, centerZ));
  if (baseY >= WORLD_HEIGHT - 6) return false;
  if (originX < 1 || originZ < 1 || originX + 2 >= CHUNK_SIZE - 1 || originZ + 2 >= CHUNK_SIZE - 1) return false;

  for (let x = originX; x <= originX + 2; x++) {
    for (let z = originZ; z <= originZ + 2; z++) {
      chunk.setBlock(x, baseY, z, B.BRICKS);
    }
  }
  chunk.setBlock(originX + 1, baseY + 1, originZ + 1, B.COBBLESTONE);
  chunk.setBlock(originX + 1, baseY + 2, originZ + 1, B.TORCH);
  chunk.setBlock(originX + 1, baseY - 1, originZ - 1, B.DIRT_PATH);
  return true;
}

function carveVillagePath(chunk: Chunk, x0: number, z0: number, x1: number, z1: number) {
  const canConvertToPath = (blockId: number) => (
    blockId === B.GRASS
    || blockId === B.DIRT
    || blockId === B.SAND
    || blockId === B.SNOW
    || blockId === B.MOSS
    || blockId === B.FARMLAND
    || blockId === B.DIRT_PATH
  );
  const carvePathCell = (x: number, z: number) => {
    if (x <= 0 || z <= 0 || x >= CHUNK_SIZE - 1 || z >= CHUNK_SIZE - 1) return;
    const y = findSurfaceY(chunk, x, z);
    const current = chunk.getBlock(x, y, z);
    if (y > WATER_LEVEL && y < WORLD_HEIGHT - 2 && canConvertToPath(current)) {
      chunk.setBlock(x, y, z, B.DIRT_PATH);
    }
  };

  const stepX = Math.sign(x1 - x0);
  const stepZ = Math.sign(z1 - z0);
  let x = x0;
  let z = z0;
  for (let guard = 0; guard < 64; guard++) {
    carvePathCell(x, z);
    carvePathCell(x + 1, z);
    carvePathCell(x - 1, z);
    carvePathCell(x, z + 1);
    carvePathCell(x, z - 1);
    if (x === x1 && z === z1) break;
    if (x !== x1) x += stepX;
    if (z !== z1) z += stepZ;
  }
}

function carveSurfacePool(chunk: Chunk, cx: number, cz: number, blockId: number, depth: number, freezeWaterSurface = false) {
  const surface = findSurfaceY(chunk, cx, cz);
  if (surface <= WATER_LEVEL || surface >= WORLD_HEIGHT - 6) return false;
  const radius = 2;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const dist = Math.abs(dx) + Math.abs(dz);
      if (dist > radius + 1) continue;
      const x = cx + dx;
      const z = cz + dz;
      if (x < 1 || z < 1 || x >= CHUNK_SIZE - 1 || z >= CHUNK_SIZE - 1) continue;
      const y = findSurfaceY(chunk, x, z);
      for (let d = 0; d < depth; d++) {
        chunk.setBlock(x, y - d, z, B.AIR);
      }
      const fillId = freezeWaterSurface && blockId === B.WATER ? B.ICE : blockId;
      chunk.setBlock(x, y - depth, z, fillId);
    }
  }
  return true;
}

export function isVillageChunk(cx: number, cz: number, seed: number): boolean {
  const regionX = Math.floor(cx / VILLAGE_ANCHOR_REGION_SIZE);
  const regionZ = Math.floor(cz / VILLAGE_ANCHOR_REGION_SIZE);
  const baseCx = regionX * VILLAGE_ANCHOR_REGION_SIZE;
  const baseCz = regionZ * VILLAGE_ANCHOR_REGION_SIZE;
  const span = VILLAGE_ANCHOR_JITTER * 2 + 1;
  const jitterX = Math.floor(hash2d(regionX * 11.3, regionZ * 13.7, seed + 7705) * span) - VILLAGE_ANCHOR_JITTER;
  const jitterZ = Math.floor(hash2d(regionX * 17.1, regionZ * 7.9, seed + 7706) * span) - VILLAGE_ANCHOR_JITTER;
  const anchorCx = baseCx + jitterX;
  const anchorCz = baseCz + jitterZ;
  if (cx === anchorCx && cz === anchorCz) return true;

  const n = hash2d(cx * 0.37, cz * 0.61, seed + 7700);
  return n > VILLAGE_RANDOM_THRESHOLD;
}

export function clampTerrainSurfaceY(height: number): number {
  return Math.max(TERRAIN_SURFACE_MIN_Y, Math.min(TERRAIN_SURFACE_MAX_Y, height));
}

export function generateChunkTerrain(world: World, chunk: Chunk, seed: number) {
  const wx0 = chunk.cx * CHUNK_SIZE;
  const wz0 = chunk.cz * CHUNK_SIZE;

  const terrainP = { ...TERRAIN_PARAMS, seed: TERRAIN_PARAMS.seed + seed };
  const mountainP = { ...MOUNTAIN_PARAMS, seed: MOUNTAIN_PARAMS.seed + seed };
  const heatP = { ...HEAT_PARAMS, seed: HEAT_PARAMS.seed + seed };
  const humidityP = { ...HUMIDITY_PARAMS, seed: HUMIDITY_PARAMS.seed + seed };
  const caveSeed = CAVE_PARAMS.seed + seed;

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = wx0 + lx;
      const wz = wz0 + lz;

      const base = terrainP.offset + fractalNoise2d(wx, wz, terrainP) * terrainP.scale;
      const mountains = fractalNoise2d(wx, wz, mountainP) * mountainP.scale;
      const height = Math.floor(clampTerrainSurfaceY(base + mountains));

      const heat = fractalNoise2d(wx, wz, heatP);
      const humidity = fractalNoise2d(wx, wz, humidityP);
      const biome = selectBiome(heat, humidity, height);

      chunk.setBlock(lx, 0, lz, B.BEDROCK);

      for (let y = 1; y < height - 3; y++) {
        const wy = y;
        if (isCarvedByCave(wx, wy, wz, caveSeed)) continue;

        const oreN = hash2d(wx * 0.5 + y * 0.3, wz * 0.5, seed + 200);
        const baseStone = y < 16 ? B.DEEPSLATE : biome.stoneBlock;
        if (y < 12 && oreN > 0.96) chunk.setBlock(lx, y, lz, B.DIAMOND_ORE);
        else if (y < 16 && oreN > 0.94) chunk.setBlock(lx, y, lz, B.EMERALD_ORE);
        else if (y < 20 && oreN > 0.93) chunk.setBlock(lx, y, lz, B.GOLD_ORE);
        else if (y < 30 && oreN > 0.91) chunk.setBlock(lx, y, lz, B.LAPIS_ORE);
        else if (y < 35 && oreN > 0.90) chunk.setBlock(lx, y, lz, B.IRON_ORE);
        else if (y < 50 && oreN > 0.88) chunk.setBlock(lx, y, lz, B.COPPER_ORE);
        else if (y < 40 && oreN > 0.87) chunk.setBlock(lx, y, lz, B.REDSTONE_ORE);
        else if (oreN > 0.85) chunk.setBlock(lx, y, lz, B.COAL_ORE);
        else {
          let block = baseStone;
          if (
            block === B.STONE
            && y >= STONE_VARIETY_Y_MIN
            && y <= STONE_VARIETY_Y_MAX
          ) {
            const nGranite = stoneVarietyMaxNoise(wx, wy, wz, seed, 6000);
            const nDiorite = stoneVarietyMaxNoise(wx, wy, wz, seed, 6100);
            const nAndesite = stoneVarietyMaxNoise(wx, wy, wz, seed, 6200);
            const t = STONE_VARIETY_THRESHOLD;
            const gOk = nGranite > t;
            const dOk = nDiorite > t;
            const aOk = nAndesite > t;
            if (gOk || dOk || aOk) {
              let best = B.GRANITE;
              let bestN = -1;
              if (gOk && nGranite > bestN) {
                bestN = nGranite;
                best = B.GRANITE;
              }
              if (dOk && nDiorite > bestN) {
                bestN = nDiorite;
                best = B.DIORITE;
              }
              if (aOk && nAndesite > bestN) {
                best = B.ANDESITE;
              }
              block = best;
            }
          }
          chunk.setBlock(lx, y, lz, block);
        }
      }

      for (let y = Math.max(1, height - 3); y < height; y++) {
        const wy = y;
        if (isCarvedByCave(wx, wy, wz, caveSeed)) continue;
        chunk.setBlock(lx, y, lz, biome.fillerBlock);
      }

      if (height < WATER_LEVEL) {
        if (!isCarvedByCave(wx, height, wz, caveSeed)) chunk.setBlock(lx, height, lz, B.SAND);
        let topWaterY = -1;
        for (let y = height + 1; y <= WATER_LEVEL; y++) {
          if (!isCarvedByCave(wx, y, wz, caveSeed)) {
            chunk.setBlock(lx, y, lz, B.WATER);
            topWaterY = y;
          }
        }
        if (biome.id === 'tundra' && topWaterY >= 0) {
          chunk.setBlock(lx, topWaterY, lz, B.ICE);
        }
      } else if (height === WATER_LEVEL) {
        if (!isCarvedByCave(wx, height, wz, caveSeed)) chunk.setBlock(lx, height, lz, B.SAND);
        if (!isCarvedByCave(wx, height + 1, wz, caveSeed)) {
          chunk.setBlock(lx, height + 1, lz, biome.id === 'tundra' ? B.ICE : B.WATER);
        }
      } else {
        if (!isCarvedByCave(wx, height, wz, caveSeed)) {
          chunk.setBlock(lx, height, lz, biome.topBlock);
        }

        if (biome.trees && lx > 2 && lx < CHUNK_SIZE - 3 && lz > 2 && lz < CHUNK_SIZE - 3) {
          for (const t of biome.trees) {
            const treeN = hash2d(wx * 1.7, wz * 1.7, seed + 300 + t.log);
            if (treeN < t.density && chunk.getBlock(lx, height, lz) !== B.AIR) {
              generateTree(world, wx, height + 1, wz, t.log, t.leaves, seed + 999);
              break;
            }
          }
        }

        if (biome.flowers && chunk.getBlock(lx, height, lz) !== B.AIR) {
          for (const f of biome.flowers) {
            const flowerN = hash2d(wx * 3, wz * 3, seed + 400 + f.blockId);
            if (flowerN < f.density) {
              chunk.setBlock(lx, height + 1, lz, f.blockId);
              break;
            }
          }
        }

        if (height <= WATER_LEVEL + 2 && biome.id === 'swamp') {
          const clayN = hash2d(wx * 2, wz * 2, seed + 600);
          if (clayN > 0.9) {
            for (let y = Math.max(1, height - 2); y < height; y++) chunk.setBlock(lx, y, lz, B.CLAY);
          }
        }
      }
    }
  }

  const chunkCenterX = wx0 + Math.floor(CHUNK_SIZE / 2);
  const chunkCenterZ = wz0 + Math.floor(CHUNK_SIZE / 2);
  const centerBiome = selectBiome(
    fractalNoise2d(chunkCenterX, chunkCenterZ, heatP),
    fractalNoise2d(chunkCenterX, chunkCenterZ, humidityP),
    findSurfaceY(chunk, Math.floor(CHUNK_SIZE / 2), Math.floor(CHUNK_SIZE / 2)),
  );

  const poolRoll = hash2d(chunk.cx * 1.91, chunk.cz * 2.17, seed + 8100);
  const poolChances = getSurfacePoolChancesByBiome(centerBiome.id);
  if (poolRoll >= 1 - poolChances.poolChance) {
    const px = 3 + Math.floor(hash2d(chunk.cx * 4.1, chunk.cz * 2.3, seed + 8101) * (CHUNK_SIZE - 6));
    const pz = 3 + Math.floor(hash2d(chunk.cx * 2.9, chunk.cz * 4.7, seed + 8102) * (CHUNK_SIZE - 6));
    const lavaRoll = hash2d(chunk.cx * 7.3, chunk.cz * 5.1, seed + 8103);
    const blockId = lavaRoll < poolChances.lavaChance ? B.LAVA : B.WATER;
    const freezePoolWater = centerBiome.id === 'tundra' && blockId === B.WATER;
    carveSurfacePool(chunk, px, pz, blockId, blockId === B.LAVA ? 2 : 1, freezePoolWater);
  }

  const villageBiomeAllowed = centerBiome.id === 'grassland' || centerBiome.id === 'forest';
  if (villageBiomeAllowed && isVillageChunk(chunk.cx, chunk.cz, seed)) {
    const builtA = buildVillageHouse(chunk, 2, 2, seed);
    const builtB = buildVillageSmithy(chunk, 9, 8, seed + 1);
    const builtFarm = buildVillageFarm(chunk, 9, 2, seed + 2);
    const builtWell = buildVillageWell(chunk, 3, 10);
    const builtHut = buildVillageHut(chunk, 1, 7, seed + 3);
    const builtStorage = buildVillageStorage(chunk, 13, 13, seed + 4);
    const builtLamp = buildVillageLampPost(chunk, 7, 12);
    const builtPlaza = buildVillagePlaza(chunk, 12, 5);

    if (builtA && builtB) carveVillagePath(chunk, 4, 4, 11, 10);
    if (builtA && builtFarm) carveVillagePath(chunk, 4, 4, 11, 4);
    if (builtA && builtWell) carveVillagePath(chunk, 4, 4, 4, 11);
    if (builtB && builtWell) carveVillagePath(chunk, 11, 10, 4, 11);
    if (builtFarm && builtWell) carveVillagePath(chunk, 11, 4, 4, 11);
    if (builtA && builtHut) carveVillagePath(chunk, 4, 4, 2, 8);
    if (builtHut && builtWell) carveVillagePath(chunk, 2, 8, 4, 11);
    if (builtHut && builtFarm) carveVillagePath(chunk, 2, 8, 11, 4);
    if (builtHut && builtB) carveVillagePath(chunk, 2, 8, 11, 10);
    if (builtStorage && builtB) carveVillagePath(chunk, 13, 13, 11, 10);
    if (builtStorage && builtWell) carveVillagePath(chunk, 13, 13, 4, 11);
    if (builtStorage && builtHut) carveVillagePath(chunk, 13, 13, 2, 8);
    if (builtLamp && builtWell) carveVillagePath(chunk, 7, 12, 4, 11);
    if (builtLamp && builtStorage) carveVillagePath(chunk, 7, 12, 13, 13);
    if (builtPlaza && builtA) carveVillagePath(chunk, 13, 6, 4, 4);
    if (builtPlaza && builtB) carveVillagePath(chunk, 13, 6, 11, 10);
    if (builtPlaza && builtWell) carveVillagePath(chunk, 13, 6, 4, 11);
    if (builtPlaza && builtFarm) carveVillagePath(chunk, 13, 6, 11, 4);
    if (builtPlaza && builtStorage) carveVillagePath(chunk, 13, 6, 13, 13);
    if (builtPlaza && builtLamp) carveVillagePath(chunk, 13, 6, 7, 12);
  } else {
    const dungeon = getDungeonPlacement(chunk.cx, chunk.cz, seed);
    if (dungeon) {
      buildDungeon(world, dungeon);
    }
  }
}

export class World {
  chunks = new Map<string, Chunk>();
  blockStates = new Map<string, BlockState>();
  blockStateDirty = false;
  seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 100000);
  }

  private key(cx: number, cz: number) { return `${cx},${cz}`; }
  private blockStateKey(x: number, y: number, z: number) { return `${x},${y},${z}`; }

  loadSavedChunks(saved: Map<string, Uint8Array>) {
    for (const [key, blocks] of saved) {
      const [cxStr, czStr] = key.split(',');
      const cx = Number(cxStr), cz = Number(czStr);
      if (Number.isNaN(cx) || Number.isNaN(cz)) continue;
      const chunk = new Chunk(cx, cz);
      chunk.blocks.set(blocks);
      chunk.dirty = false;
      this.chunks.set(key, chunk);
    }
  }

  getChunk(cx: number, cz: number): Chunk {
    const key = this.key(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.chunks.set(key, chunk);
      generateChunkTerrain(this, chunk, this.seed);
    }
    return chunk;
  }

  getBlock(x: number, y: number, z: number): number {
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return this.getChunk(cx, cz).getBlock(lx, y, lz);
  }

  setBlock(x: number, y: number, z: number, id: number) {
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    this.getChunk(cx, cz).setBlock(lx, y, lz, id);
    const key = this.blockStateKey(x, y, z);
    if (this.blockStates.delete(key)) {
      this.blockStateDirty = true;
    }
  }

  getBlockState(x: number, y: number, z: number): BlockState | undefined {
    const state = this.blockStates.get(this.blockStateKey(x, y, z));
    return state ? { ...state } : undefined;
  }

  getResolvedBlockState(x: number, y: number, z: number): BlockState | undefined {
    const explicit = this.getBlockState(x, y, z);
    if (explicit) return explicit;
    const blockId = this.getBlock(x, y, z);
    const blockDef = BLOCK_DEFS[blockId];
    const placementState = blockDef?.placementState;
    if (placementState === 'axis') {
      return { axis: blockDef.placementStateDefault?.axis ?? 'y' };
    }
    if (placementState === 'facing') {
      return { facing: blockDef.placementStateDefault?.facing ?? 'north' };
    }
    return undefined;
  }

  setBlockState(x: number, y: number, z: number, state: BlockState | null | undefined) {
    const key = this.blockStateKey(x, y, z);
    if (!state || Object.keys(state).length === 0) {
      if (this.blockStates.delete(key)) {
        this.blockStateDirty = true;
      }
      return;
    }
    this.blockStates.set(key, { ...state });
    this.blockStateDirty = true;
  }

  toChunkDataWithFacings(chunk: Chunk): ChunkData {
    const data = chunk.toData();
    const facings: Record<string, string> = {};
    const wx0 = chunk.cx * CHUNK_SIZE;
    const wz0 = chunk.cz * CHUNK_SIZE;
    for (let ly = 0; ly < WORLD_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const blockId = chunk.getBlock(lx, ly, lz);
          if (blockId === 0) continue;
          const def = BLOCK_DEFS[blockId];
          if (!def?.placementState) continue;
          const state = this.getResolvedBlockState(wx0 + lx, ly, wz0 + lz);
          if (state?.facing) {
            facings[`${lx},${ly},${lz}`] = state.facing as string;
          }
        }
      }
    }
    if (Object.keys(facings).length > 0) data.facings = facings;
    return data;
  }

  getBlockStateEntries(): Array<[string, BlockState]> {
    return Array.from(this.blockStates.entries()).map(([key, state]) => [key, { ...state }]);
  }

  loadSavedBlockStates(saved: Map<string, BlockState>) {
    this.blockStates.clear();
    for (const [key, state] of saved) {
      if (!state || typeof state !== 'object') continue;
      this.blockStates.set(key, { ...state });
    }
    this.blockStateDirty = false;
  }

  isSolid(x: number, y: number, z: number): boolean {
    return BLOCK_DEFS[this.getBlock(x, y, z)]?.solid ?? false;
  }

  findSpawnY(x: number, z: number): number {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      if (this.isSolid(x, y, z)) return y + 1;
    }
    return 40;
  }

  findLocalSupportY(x: number, z: number, fromY: number, toY = 0): number | null {
    const upper = Math.min(WORLD_HEIGHT - 1, Math.max(0, Math.floor(fromY)));
    const lower = Math.max(0, Math.min(upper, Math.floor(toY)));
    for (let y = upper; y >= lower; y--) {
      if (this.isSolid(x, y, z)) return y + 1;
    }
    return null;
  }

  getBiomeAt(wx: number, wz: number): BiomeDef {
    const terrainP = { ...TERRAIN_PARAMS, seed: TERRAIN_PARAMS.seed + this.seed };
    const heatP = { ...HEAT_PARAMS, seed: HEAT_PARAMS.seed + this.seed };
    const humidP = { ...HUMIDITY_PARAMS, seed: HUMIDITY_PARAMS.seed + this.seed };
    const mountainP = { ...MOUNTAIN_PARAMS, seed: MOUNTAIN_PARAMS.seed + this.seed };

    const base = terrainP.offset + fractalNoise2d(wx, wz, terrainP) * terrainP.scale;
    const mountain = fractalNoise2d(wx, wz, mountainP) * mountainP.scale;
    const height = Math.floor(clampTerrainSurfaceY(base + mountain));
    const heat = fractalNoise2d(wx, wz, heatP);
    const humidity = fractalNoise2d(wx, wz, humidP);

    return selectBiome(heat, humidity, height);
  }
}
