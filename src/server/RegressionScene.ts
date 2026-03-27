import { BLOCK_DEFS, BlockTypes } from '#/block/BlockRegistry';
import { CHUNK_SIZE } from '#/common/types';
import { RENDERABLE_ENTITY_TYPES } from '#/entity/EntityDefs';
import type { Vec3 } from '#/common/types';
import type { GameServer } from './GameServer';

const B = BlockTypes;

/**
 * Counts of fluid blocks placed by `buildLiquidPads` (legacy strip + phase-2 pools).
 * Keep in sync when editing that function — `MineWebEngine` fluid phase-2 tests assert these.
 */
export const REGRESSION_FLUID_BLOCK_TOTALS = Object.freeze({
  water: 25,
  lava: 7,
});

const REGRESSION_ENTITY_TYPES = [
  'pig',
  'cow',
  'sheep',
  'chicken',
  'wolf',
  'cat',
  'rabbit',
  'farmer',
  'miner',
  'guard',
  'villager',
  'zombie',
] as const;

export type RegressionSceneLayout = 'full' | 'entities' | 'portraits' | 'cross' | 'village';

export interface RegressionEntitySpawn {
  type: string;
  position: Vec3;
}

export interface RegressionSceneResult {
  layout: RegressionSceneLayout;
  origin: Vec3;
  chunkRadius: number;
  entityTypes: string[];
  entitySpawns: RegressionEntitySpawn[];
  blockIds: number[];
  recommendedCamera: {
    position: Vec3;
    yaw: number;
    pitch: number;
  };
}

function clearGround(server: GameServer, originX: number, originZ: number, baseY: number, radius: number, floorBlock = B.GRASS) {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      server.world.setBlock(originX + dx, baseY - 1, originZ + dz, floorBlock);
      for (let dy = 0; dy < 16; dy++) {
        server.world.setBlock(originX + dx, baseY + dy, originZ + dz, B.AIR);
      }
    }
  }
}

function spawnEntityLineup(server: GameServer, originX: number, originZ: number, baseY: number, options?: {
  entityTypes?: readonly string[];
  columns?: number;
  spacingX?: number;
  spacingZ?: number;
  startX?: number;
  startZ?: number;
}) {
  const entityTypes = [...(options?.entityTypes ?? REGRESSION_ENTITY_TYPES)];
  const columns = options?.columns ?? entityTypes.length;
  const spacingX = options?.spacingX ?? 3;
  const spacingZ = options?.spacingZ ?? 3;
  const startX = options?.startX ?? originX - 16;
  const startZ = options?.startZ ?? originZ - 8;
  const entitySpawns: RegressionEntitySpawn[] = [];

  for (let i = 0; i < entityTypes.length; i++) {
    const type = entityTypes[i];
    const col = i % columns;
    const row = Math.floor(i / columns);
    const ex = startX + col * spacingX;
    const ez = startZ + row * spacingZ;
    const spawnPos = {
      x: ex + 0.5,
      y: server.world.findSpawnY(ex, ez) + 0.1,
      z: ez + 0.5,
    };
    const entity = server.entityManager.spawn(type, spawnPos);
    if (entity) {
      entity.yaw = Math.PI;
      const snap = server.ctx.state.entities[entity.id];
      if (snap) snap.yaw = entity.yaw;
      entitySpawns.push({ type, position: spawnPos });
    }
  }

  return { entityTypes, entitySpawns };
}

function buildBlockShowcase(server: GameServer, originX: number, originZ: number, baseY: number) {
  const blockIds = Object.keys(BLOCK_DEFS)
    .map(Number)
    .filter((id) => id !== B.AIR && id !== B.BEDROCK)
    .sort((a, b) => a - b);

  for (let i = 0; i < blockIds.length; i++) {
    const bx = originX - 18 + (i % 18) * 2;
    const bz = originZ + 7 + Math.floor(i / 18) * 2;
    server.world.setBlock(bx, baseY, bz, blockIds[i]);
  }

  return blockIds;
}

function buildMiniHouse(server: GameServer, originX: number, originZ: number, baseY: number) {
  const hx = originX + 11;
  const hz = originZ - 12;
  const hy = baseY;
  for (let dx = 0; dx < 5; dx++) {
    for (let dz = 0; dz < 5; dz++) {
      for (let dy = 0; dy < 4; dy++) {
        if (dy < 3 && dx > 0 && dx < 4 && dz > 0 && dz < 4) continue;
        if (dy === 0 || dy === 3) {
          server.world.setBlock(hx + dx, hy + dy, hz + dz, B.OAK_PLANKS);
          continue;
        }
        server.world.setBlock(
          hx + dx,
          hy + dy,
          hz + dz,
          dx === 2 && dz === 0 && dy < 3 ? B.AIR : B.COBBLESTONE,
        );
      }
    }
  }
  server.world.setBlock(hx + 1, hy + 2, hz, B.GLASS);
  server.world.setBlock(hx + 3, hy + 2, hz, B.GLASS);
}

function buildLiquidPads(server: GameServer, originX: number, originZ: number, baseY: number) {
  // Legacy pads (exact coords asserted by older regression tests)
  server.world.setBlock(originX + 13, baseY, originZ + 1, B.WATER);
  server.world.setBlock(originX + 14, baseY, originZ + 1, B.WATER);
  server.world.setBlock(originX + 15, baseY, originZ + 1, B.WATER);
  server.world.setBlock(originX + 13, baseY, originZ + 3, B.LAVA);
  server.world.setBlock(originX + 14, baseY, originZ + 3, B.LAVA);
  server.world.setBlock(originX + 15, baseY, originZ + 3, B.LAVA);

  const chunkOriginX = Math.floor(originX / CHUNK_SIZE) * CHUNK_SIZE;
  const boundaryZ = originZ - 16;
  server.world.setBlock(chunkOriginX + CHUNK_SIZE - 1, baseY, boundaryZ, B.WATER);
  server.world.setBlock(chunkOriginX + CHUNK_SIZE, baseY, boundaryZ, B.WATER);

  // 1-deep 2×2 pool + glass above surface (transparent stacking)
  for (let dx = 0; dx < 2; dx++) {
    for (let dz = 0; dz < 2; dz++) {
      server.world.setBlock(originX - 8 + dx, baseY, originZ - 16 + dz, B.WATER);
    }
  }
  server.world.setBlock(originX - 8, baseY + 1, originZ - 16, B.GLASS);

  // 3-deep 2×2 column (stacked water / interior face culling)
  for (let dx = 0; dx < 2; dx++) {
    for (let dz = 0; dz < 2; dz++) {
      for (let dy = 0; dy < 3; dy++) {
        server.world.setBlock(originX - 4 + dx, baseY - 2 + dy, originZ - 16 + dz, B.WATER);
      }
    }
  }
  // Glass above deep-pool surface (second transparent-stacking probe vs shallow pool glass)
  server.world.setBlock(originX - 4, baseY + 1, originZ - 16, B.GLASS);

  // Second water pool, 1-block stone gap, then lava (no fluid adjacency)
  for (let dx = 0; dx < 2; dx++) {
    for (let dz = 0; dz < 2; dz++) {
      server.world.setBlock(originX - 8 + dx, baseY, originZ - 6 + dz, B.WATER);
    }
  }
  for (let dx = 0; dx < 2; dx++) {
    server.world.setBlock(originX - 8 + dx, baseY, originZ - 4, B.STONE);
  }
  for (let dx = 0; dx < 2; dx++) {
    for (let dz = 0; dz < 2; dz++) {
      server.world.setBlock(originX - 8 + dx, baseY, originZ - 3 + dz, B.LAVA);
    }
  }
}

function buildCrossShapeShowcase(server: GameServer, originX: number, originZ: number, baseY: number) {
  const entries: Array<{ blockId: number; x: number; z: number }> = [
    { blockId: B.TORCH, x: originX + 9, z: originZ + 9 },
    { blockId: B.POPPY, x: originX + 11, z: originZ + 9 },
    { blockId: B.DANDELION, x: originX + 13, z: originZ + 9 },
  ];
  for (const entry of entries) {
    server.world.setBlock(entry.x, baseY - 1, entry.z, B.GRASS);
    server.world.setBlock(entry.x, baseY, entry.z, entry.blockId);
  }
}

function buildEntityShowcase(server: GameServer, originX: number, originZ: number, baseY: number) {
  const world = server.world;
  clearGround(server, originX, originZ, baseY, 20, B.OAK_PLANKS);

  for (let dx = -16; dx <= 16; dx++) {
    world.setBlock(originX + dx, baseY + 5, originZ - 10, B.COBBLESTONE);
    world.setBlock(originX + dx, baseY + 6, originZ - 10, B.COBBLESTONE);
    if (dx % 4 !== 0) {
      world.setBlock(originX + dx, baseY + 2, originZ - 8, B.GLASS);
      world.setBlock(originX + dx, baseY + 3, originZ - 8, B.GLASS);
    }
  }

  for (let i = 0; i < 6; i++) {
    const px = originX - 12 + i * 5;
    for (let dx = 0; dx < 3; dx++) {
      for (let dz = 0; dz < 3; dz++) {
        world.setBlock(px + dx, baseY - 1, originZ - 2, i % 2 === 0 ? B.COBBLESTONE : B.SANDSTONE);
        world.setBlock(px + dx, baseY - 1, originZ - 7, i % 2 === 0 ? B.SANDSTONE : B.COBBLESTONE);
      }
    }
  }

  return spawnEntityLineup(server, originX, originZ, baseY, {
    columns: 6,
    spacingX: 5,
    spacingZ: 5,
    startX: originX - 12,
    startZ: originZ - 7,
  });
}

function buildPortraitShowcase(server: GameServer, originX: number, originZ: number, baseY: number) {
  const world = server.world;
  clearGround(server, originX, originZ, baseY, 28, B.SMOOTH_STONE);

  for (let dx = -26; dx <= 26; dx++) {
    world.setBlock(originX + dx, baseY + 10, originZ - 12, B.COBBLESTONE);
    world.setBlock(originX + dx, baseY + 11, originZ - 12, B.COBBLESTONE);
  }

  return spawnEntityLineup(server, originX, originZ, baseY, {
    entityTypes: RENDERABLE_ENTITY_TYPES,
    columns: 5,
    spacingX: 10,
    spacingZ: 9,
    startX: originX - 20,
    startZ: originZ - 6,
  });
}

function buildCrossShowcase(server: GameServer, originX: number, originZ: number, baseY: number) {
  clearGround(server, originX, originZ, baseY, 14, B.GRASS);
  buildCrossShapeShowcase(server, originX, originZ, baseY);

  const pillars: Array<{ x: number; z: number; top: number }> = [
    { x: originX + 8, z: originZ + 8, top: B.TORCH },
    { x: originX + 10, z: originZ + 8, top: B.POPPY },
    { x: originX + 12, z: originZ + 8, top: B.DANDELION },
  ];
  for (const p of pillars) {
    server.world.setBlock(p.x, baseY - 1, p.z, B.COBBLESTONE);
    server.world.setBlock(p.x, baseY, p.z, B.COBBLESTONE);
    server.world.setBlock(p.x, baseY + 1, p.z, B.COBBLESTONE);
    server.world.setBlock(p.x, baseY + 2, p.z, p.top);
  }
}

function buildVillageQaShowcase(server: GameServer, originX: number, originZ: number, baseY: number) {
  clearGround(server, originX, originZ, baseY, 18, B.GRASS);

  // House (west)
  buildMiniHouse(server, originX - 8, originZ + 2, baseY);

  // Farm (north-east)
  for (let dx = 0; dx < 5; dx++) {
    for (let dz = 0; dz < 5; dz++) {
      const x = originX + 6 + dx;
      const z = originZ - 10 + dz;
      server.world.setBlock(x, baseY - 1, z, B.OAK_LOG);
      server.world.setBlock(x, baseY, z, B.FARMLAND);
    }
  }
  for (let dx = 0; dx < 5; dx++) {
    const x = originX + 6 + dx;
    const z = originZ - 8;
    server.world.setBlock(x, baseY, z, B.WATER);
  }

  // Well (center-east)
  for (let dx = 0; dx < 4; dx++) {
    for (let dz = 0; dz < 4; dz++) {
      const x = originX + 8 + dx;
      const z = originZ + 4 + dz;
      server.world.setBlock(x, baseY - 1, z, B.COBBLESTONE);
      server.world.setBlock(x, baseY, z, B.AIR);
    }
  }
  server.world.setBlock(originX + 9, baseY - 1, originZ + 5, B.WATER);
  server.world.setBlock(originX + 10, baseY - 1, originZ + 5, B.WATER);
  server.world.setBlock(originX + 9, baseY - 1, originZ + 6, B.WATER);
  server.world.setBlock(originX + 10, baseY - 1, originZ + 6, B.WATER);

  // Smithy workstation (south-east)
  server.world.setBlock(originX + 10, baseY, originZ + 12, B.CRAFTING_TABLE);
  server.world.setBlock(originX + 11, baseY, originZ + 12, B.FURNACE);
  server.world.setBlock(originX + 10, baseY - 1, originZ + 12, B.COBBLESTONE);
  server.world.setBlock(originX + 11, baseY - 1, originZ + 12, B.COBBLESTONE);

  // Storage marker (far south-east)
  server.world.setBlock(originX + 13, baseY - 1, originZ + 14, B.COBBLESTONE);
  server.world.setBlock(originX + 14, baseY - 1, originZ + 14, B.COBBLESTONE);
  server.world.setBlock(originX + 13, baseY, originZ + 14, B.BRICKS);
  server.world.setBlock(originX + 14, baseY, originZ + 14, B.BRICKS);
  server.world.setBlock(originX + 13, baseY + 1, originZ + 14, B.TORCH);

  // Hut (south-west)
  for (let dx = 0; dx < 3; dx++) {
    for (let dz = 0; dz < 3; dz++) {
      const x = originX - 4 + dx;
      const z = originZ + 9 + dz;
      server.world.setBlock(x, baseY - 1, z, B.COBBLESTONE);
      server.world.setBlock(x, baseY, z, B.AIR);
      server.world.setBlock(x, baseY + 1, z, B.AIR);
      server.world.setBlock(x, baseY + 2, z, B.AIR);
    }
  }
  for (let dx = 0; dx < 3; dx++) {
    server.world.setBlock(originX - 4 + dx, baseY, originZ + 9, B.OAK_PLANKS);
    server.world.setBlock(originX - 4 + dx, baseY + 1, originZ + 9, B.OAK_PLANKS);
    server.world.setBlock(originX - 4 + dx, baseY, originZ + 11, B.OAK_PLANKS);
    server.world.setBlock(originX - 4 + dx, baseY + 1, originZ + 11, B.OAK_PLANKS);
  }
  for (let dz = 0; dz < 3; dz++) {
    server.world.setBlock(originX - 4, baseY, originZ + 9 + dz, B.OAK_PLANKS);
    server.world.setBlock(originX - 4, baseY + 1, originZ + 9 + dz, B.OAK_PLANKS);
    server.world.setBlock(originX - 2, baseY, originZ + 9 + dz, B.OAK_PLANKS);
    server.world.setBlock(originX - 2, baseY + 1, originZ + 9 + dz, B.OAK_PLANKS);
  }
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      server.world.setBlock(originX - 3 + dx, baseY + 2, originZ + 10 + dz, B.OAK_PLANKS);
    }
  }
  server.world.setBlock(originX - 3, baseY, originZ + 9, B.AIR);
  server.world.setBlock(originX - 3, baseY + 1, originZ + 9, B.AIR);
  server.world.setBlock(originX - 2, baseY + 1, originZ + 10, B.GLASS);

  // Paths
  for (let x = originX - 6; x <= originX + 12; x++) {
    server.world.setBlock(x, baseY - 1, originZ + 1, B.DIRT_PATH);
    server.world.setBlock(x, baseY - 1, originZ + 2, B.DIRT_PATH);
  }
  for (let z = originZ + 2; z <= originZ + 10; z++) {
    server.world.setBlock(originX - 3, baseY - 1, z, B.DIRT_PATH);
  }
  for (let z = originZ - 10; z <= originZ + 12; z++) {
    server.world.setBlock(originX + 9, baseY - 1, z, B.DIRT_PATH);
    server.world.setBlock(originX + 10, baseY - 1, z, B.DIRT_PATH);
  }
  for (let z = originZ + 12; z <= originZ + 14; z++) {
    server.world.setBlock(originX + 13, baseY - 1, z, B.DIRT_PATH);
    server.world.setBlock(originX + 14, baseY - 1, z, B.DIRT_PATH);
  }

  const villagers = [
    { type: 'villager', x: originX - 3.5, z: originZ + 3.5, profession: 'librarian' },
    { type: 'farmer', x: originX + 8.5, z: originZ - 6.5 },
    { type: 'villager', x: originX + 10.5, z: originZ + 11.5, profession: 'armorer' },
    { type: 'villager', x: originX + 9.5, z: originZ + 6.5, profession: 'fisherman' },
  ] as const;
  const entitySpawns: RegressionEntitySpawn[] = [];
  const entityTypes: string[] = [];
  for (const spawn of villagers) {
    const y = server.world.findSpawnY(Math.floor(spawn.x), Math.floor(spawn.z)) + 0.1;
    const entity = server.entityManager.spawn(spawn.type, { x: spawn.x, y, z: spawn.z });
    if (!entity) continue;
    if ('profession' in spawn && spawn.profession) {
      server.entityManager.setEntityAttribute(entity.id, 'profession', spawn.profession);
    }
    entityTypes.push(spawn.type);
    entitySpawns.push({ type: spawn.type, position: { x: spawn.x, y, z: spawn.z } });
  }
  return { entityTypes, entitySpawns };
}

export function buildRegressionScene(
  server: GameServer,
  options?: {
    originX?: number;
    originZ?: number;
    chunkRadius?: number;
    layout?: RegressionSceneLayout;
  },
): RegressionSceneResult {
  const pos = server.ctx.state.player.position;
  const originX = options?.originX ?? Math.floor(pos.x);
  const originZ = options?.originZ ?? Math.floor(pos.z);
  const baseY = Math.max(
    server.world.findSpawnY(originX, originZ),
    Math.floor(pos.y),
  );
  const layout = options?.layout ?? 'full';
  const chunkRadius = options?.chunkRadius ?? (layout === 'entities' ? 2 : 3);

  if (layout === 'full') {
    clearGround(server, originX, originZ, baseY, 18);
  }

  let blockIds: number[] = [];
  let entityTypes: string[] = [];
  let entitySpawns: RegressionEntitySpawn[] = [];
  let recommendedCamera = {
    position: { x: originX + 2.5, y: baseY + 5.5, z: originZ + 18.5 },
    yaw: Math.PI,
    pitch: -0.22,
  };

  if (layout === 'entities') {
    const lineup = buildEntityShowcase(server, originX, originZ, baseY);
    entityTypes = lineup.entityTypes;
    entitySpawns = lineup.entitySpawns;
    recommendedCamera = {
      position: { x: originX + 2.5, y: baseY + 6.4, z: originZ + 9.5 },
      yaw: Math.PI,
      pitch: -0.3,
    };
  } else if (layout === 'portraits') {
    const lineup = buildPortraitShowcase(server, originX, originZ, baseY);
    entityTypes = lineup.entityTypes;
    entitySpawns = lineup.entitySpawns;
    recommendedCamera = {
      position: { x: originX + 0.5, y: baseY + 6.6, z: originZ + 11.5 },
      yaw: Math.PI,
      pitch: -0.24,
    };
  } else if (layout === 'cross') {
    buildCrossShowcase(server, originX, originZ, baseY);
    blockIds = [B.TORCH, B.POPPY, B.DANDELION];
    recommendedCamera = {
      position: { x: originX + 10.5, y: baseY + 4.2, z: originZ + 15.5 },
      yaw: Math.PI,
      pitch: -0.2,
    };
  } else if (layout === 'village') {
    const village = buildVillageQaShowcase(server, originX, originZ, baseY);
    entityTypes = village.entityTypes;
    entitySpawns = village.entitySpawns;
    blockIds = [B.OAK_PLANKS, B.FARMLAND, B.WATER, B.CRAFTING_TABLE, B.FURNACE, B.BRICKS, B.DIRT_PATH];
    recommendedCamera = {
      position: { x: originX + 2.5, y: baseY + 6.5, z: originZ + 20.5 },
      yaw: Math.PI,
      pitch: -0.24,
    };
  } else {
    blockIds = buildBlockShowcase(server, originX, originZ, baseY);
    const lineup = spawnEntityLineup(server, originX, originZ, baseY);
    entityTypes = lineup.entityTypes;
    entitySpawns = lineup.entitySpawns;
    buildMiniHouse(server, originX, originZ, baseY);
    buildLiquidPads(server, originX, originZ, baseY);
    buildCrossShapeShowcase(server, originX, originZ, baseY);
  }

  server.syncChunksAroundWorldPos(originX, originZ, chunkRadius);

  return {
    layout,
    origin: { x: originX, y: baseY, z: originZ },
    chunkRadius,
    entityTypes,
    entitySpawns,
    blockIds,
    recommendedCamera,
  };
}
