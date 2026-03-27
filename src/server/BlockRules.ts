import { BLOCK_DEFS, BlockTypes, hasBlockBehavior } from '#/block/BlockRegistry';
import { CHUNK_SIZE } from '#/common/types';
import type { BlockToolTransform, TargetBlock, ToolType } from '#/common/types';
import { ItemTypes } from '#/common/ItemRegistry';
import type { GameServer } from './GameServer';
import type { BlockState, Chunk } from './World';

const B = BlockTypes;
const FARMLAND_UPDATE_INTERVAL = 4;
const GRAVITY_BLOCK_UPDATE_INTERVAL = 1;
const FLUID_UPDATE_INTERVAL = 4;
const WATER_MAX_FLOW_DISTANCE = 4;
const LAVA_MAX_FLOW_DISTANCE = 2;
const BLOCK_RULE_RADIUS = 2;
const BLOCK_SCAN_Y_MIN = 1;
const BLOCK_SCAN_Y_MAX = 100;

function getPlayerChunk(server: GameServer): { pcx: number; pcz: number } {
  const pos = server.ctx.state.player.position;
  return {
    pcx: Math.floor(pos.x / CHUNK_SIZE),
    pcz: Math.floor(pos.z / CHUNK_SIZE),
  };
}

function* nearbyChunks(server: GameServer): Generator<{ cx: number; cz: number; chunk: Chunk }> {
  const { pcx, pcz } = getPlayerChunk(server);
  for (const [key, chunk] of server.world.chunks) {
    const sep = key.indexOf(',');
    const cx = Number(key.slice(0, sep));
    const cz = Number(key.slice(sep + 1));
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) continue;
    if (Math.abs(cx - pcx) > BLOCK_RULE_RADIUS || Math.abs(cz - pcz) > BLOCK_RULE_RADIUS) continue;
    yield { cx, cz, chunk };
  }
}

type BlockInteractEvent = {
  x: number;
  y: number;
  z: number;
  blockId: number;
  selectedItemId: number | null;
  activeTool: ToolType;
};

type BlockPlaceEvent = {
  x: number;
  y: number;
  z: number;
  blockId: number;
  targetBlock: TargetBlock | null;
  selectedItemId: number | null;
  placingViaContainer: boolean;
};

type BlockBreakEvent = { x: number; y: number; z: number; blockId: number };

type BlockRule = {
  id: string;
  onInteract?: (server: GameServer, event: BlockInteractEvent) => boolean;
  onPlace?: (server: GameServer, event: BlockPlaceEvent) => void;
  onPlaceConsume?: (server: GameServer, event: BlockPlaceEvent) => boolean;
  onBreak?: (server: GameServer, event: BlockBreakEvent) => void;
  onTick?: (server: GameServer, dt: number) => void;
};

function normalToAxis(nx: number, ny: number, nz: number): 'x' | 'y' | 'z' | null {
  if (Math.abs(ny) === 1 && nx === 0 && nz === 0) return 'y';
  if (Math.abs(nx) === 1 && ny === 0 && nz === 0) return 'x';
  if (Math.abs(nz) === 1 && nx === 0 && ny === 0) return 'z';
  return null;
}

function normalToHorizontalFacing(nx: number, ny: number, nz: number): 'north' | 'south' | 'east' | 'west' | null {
  if (ny !== 0) return null;
  if (nx === 1 && nz === 0) return 'east';
  if (nx === -1 && nz === 0) return 'west';
  if (nz === 1 && nx === 0) return 'south';
  if (nz === -1 && nx === 0) return 'north';
  return null;
}

function hasWaterNearby(server: GameServer, x: number, y: number, z: number, range = 4): boolean {
  for (let dx = -range; dx <= range; dx++) {
    for (let dz = -range; dz <= range; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        const id = server.world.getBlock(x + dx, y + dy, z + dz);
        if (hasBlockBehavior(id, 'irrigation_water')) return true;
      }
    }
  }
  return false;
}

const farmlandTickAccum = new WeakMap<GameServer, number>();
const gravityBlockTickAccum = new WeakMap<GameServer, number>();
const fluidTickAccum = new WeakMap<GameServer, number>();

type FluidMeta = {
  isSource: boolean;
  distance: number;
};

type FluidSpreadOp = {
  x: number;
  y: number;
  z: number;
  blockId: number;
  distance: number;
};
type FluidSpreadCollisionOp = {
  x: number;
  y: number;
  z: number;
  collision: true;
};

function isFluidPair(a: number, b: number): boolean {
  return (a === B.WATER && b === B.LAVA) || (a === B.LAVA && b === B.WATER);
}

function isFluidSourceCell(server: GameServer, x: number, y: number, z: number): boolean {
  const blockId = server.world.getBlock(x, y, z);
  if (blockId !== B.WATER && blockId !== B.LAVA) return false;
  const state = server.world.getBlockState(x, y, z);
  return state?.fluidSource !== false;
}

function getFluidMaxDistance(blockId: number): number {
  const dataDistance = BLOCK_DEFS[blockId]?.fluidFlowDistance;
  if (typeof dataDistance === 'number' && Number.isFinite(dataDistance) && dataDistance > 0) {
    return Math.floor(dataDistance);
  }
  if (blockId === B.WATER) return WATER_MAX_FLOW_DISTANCE;
  if (blockId === B.LAVA) return LAVA_MAX_FLOW_DISTANCE;
  return 0;
}

function getFluidMeta(server: GameServer, x: number, y: number, z: number): FluidMeta {
  const state = server.world.getBlockState(x, y, z);
  if (state?.fluidSource === false) {
    const rawDistance = typeof state.fluidDistance === 'number' ? Math.floor(state.fluidDistance) : 1;
    return { isSource: false, distance: Math.max(1, rawDistance) };
  }
  return { isSource: true, distance: 0 };
}

function setFlowingFluidState(server: GameServer, x: number, y: number, z: number, distance: number) {
  server.world.setBlockState(x, y, z, { fluidSource: false, fluidDistance: Math.max(1, Math.floor(distance)) });
}

const ruleBucketPickup: BlockRule = {
  id: 'bucket-pickup',
  onInteract(server, event) {
    if (event.selectedItemId !== ItemTypes.BUCKET) return false;
    if (!hasBlockBehavior(event.blockId, 'fluid_source')) return false;
    const state = server.world.getBlockState(event.x, event.y, event.z);
    if (state?.fluidSource === false) return false;
    const bucketResultItemId = BLOCK_DEFS[event.blockId]?.fluidPickupItemId ?? null;
    if (bucketResultItemId == null) return false;
    server.world.setBlock(event.x, event.y, event.z, B.AIR);
    server.inventory.setSelectedSlot({
      itemId: bucketResultItemId,
      count: 1,
    });
    server.ctx.s2c.emit('s2c:blockChange', { x: event.x, y: event.y, z: event.z, blockId: B.AIR });
    server.syncInventory();
    server.addChatMessage(
      '§7[Server]',
      event.blockId === B.WATER ? '§aFilled bucket with water' : '§aFilled bucket with lava',
    );
    return true;
  },
};

const ruleFluidContainerPlaceConsume: BlockRule = {
  id: 'fluid-container-place-consume',
  onPlaceConsume(server, event) {
    if (!event.placingViaContainer) return false;
    if (event.selectedItemId !== ItemTypes.WATER_BUCKET && event.selectedItemId !== ItemTypes.LAVA_BUCKET) {
      return false;
    }
    server.inventory.setSelectedSlot({ itemId: ItemTypes.BUCKET, count: 1 });
    return true;
  },
};

export type PlacementStateSpec = {
  id: string;
  matches: (blockId: number) => boolean;
  stateFromPlacement: (event: BlockPlaceEvent) => BlockState | null | undefined;
};

const PLACEMENT_STATE_SPECS: PlacementStateSpec[] = [
  {
    id: 'block-def-placement-state',
    matches(blockId) {
      return BLOCK_DEFS[blockId]?.placementState != null;
    },
    stateFromPlacement(event) {
      const placementState = BLOCK_DEFS[event.blockId]?.placementState;
      if (!placementState) return undefined;
      if (placementState === 'axis') {
        let axis: 'x' | 'y' | 'z' = BLOCK_DEFS[event.blockId]?.placementStateDefault?.axis ?? 'y';
        const target = event.targetBlock;
        if (target) {
          const tx = Math.floor(target.x + target.nx);
          const ty = Math.floor(target.y + target.ny);
          const tz = Math.floor(target.z + target.nz);
          if (tx === event.x && ty === event.y && tz === event.z) {
            axis = normalToAxis(target.nx, target.ny, target.nz) ?? 'y';
          }
        }
        return { axis };
      }

      if (placementState !== 'facing') return undefined;
      const defaultFacing = BLOCK_DEFS[event.blockId]?.placementStateDefault?.facing ?? 'north';
      const target = event.targetBlock;
      if (target) {
        const tx = Math.floor(target.x + target.nx);
        const ty = Math.floor(target.y + target.ny);
        const tz = Math.floor(target.z + target.nz);
        if (tx === event.x && ty === event.y && tz === event.z) {
          const facing = normalToHorizontalFacing(target.nx, target.ny, target.nz);
          if (facing) return { facing } as BlockState;
        }
      }
      return { facing: defaultFacing } as BlockState;
    },
  },
];

export function registerPlacementStateSpec(spec: PlacementStateSpec, options?: { prepend?: boolean }) {
  const prepend = options?.prepend === true;
  if (prepend) PLACEMENT_STATE_SPECS.unshift(spec);
  else PLACEMENT_STATE_SPECS.push(spec);
  return () => {
    const index = PLACEMENT_STATE_SPECS.findIndex((entry) => entry.id === spec.id);
    if (index >= 0) PLACEMENT_STATE_SPECS.splice(index, 1);
  };
}

const rulePlacementStates: BlockRule = {
  id: 'placement-state-specs',
  onPlace(server, event) {
    for (const spec of PLACEMENT_STATE_SPECS) {
      if (!spec.matches(event.blockId)) continue;
      const nextState = spec.stateFromPlacement(event);
      if (!nextState || Object.keys(nextState).length === 0) continue;
      server.world.setBlockState(event.x, event.y, event.z, nextState);
      return;
    }
  },
};

export type ToolTransformSpec = {
  id: string;
  tool: ToolType;
  canApply: (server: GameServer, event: BlockInteractEvent) => boolean;
  targetBlockId: (event: BlockInteractEvent) => number;
  preserveResolvedState?: boolean;
  onAfterTransform?: (server: GameServer, event: BlockInteractEvent, transformedBlockId: number) => void;
  message?: (event: BlockInteractEvent, transformedBlockId: number) => string;
};

const TOOL_TRANSFORMS: ToolTransformSpec[] = [];

export function registerToolTransform(spec: ToolTransformSpec, options?: { prepend?: boolean }) {
  const prepend = options?.prepend === true;
  if (prepend) TOOL_TRANSFORMS.unshift(spec);
  else TOOL_TRANSFORMS.push(spec);
  return () => {
    const index = TOOL_TRANSFORMS.findIndex((t) => t.id === spec.id);
    if (index >= 0) TOOL_TRANSFORMS.splice(index, 1);
  };
}

const ruleToolTransforms: BlockRule = {
  id: 'tool-transforms',
  onInteract(server, event) {
    const applyTransform = (spec: {
      tool: ToolType;
      canApply: (server: GameServer, event: BlockInteractEvent) => boolean;
      targetBlockId: (event: BlockInteractEvent) => number;
      preserveResolvedState?: boolean;
      onAfterTransform?: (server: GameServer, event: BlockInteractEvent, transformedBlockId: number) => void;
      message?: (event: BlockInteractEvent, transformedBlockId: number) => string | undefined;
    }) => {
      if (event.activeTool !== spec.tool) return false;
      if (!spec.canApply(server, event)) return false;
      const nextBlockId = spec.targetBlockId(event);
      const prevState = spec.preserveResolvedState
        ? server.world.getResolvedBlockState(event.x, event.y, event.z)
        : undefined;
      server.world.setBlock(event.x, event.y, event.z, nextBlockId);
      if (prevState) {
        server.world.setBlockState(event.x, event.y, event.z, prevState);
      }
      spec.onAfterTransform?.(server, event, nextBlockId);
      server.ctx.s2c.emit('s2c:blockChange', { x: event.x, y: event.y, z: event.z, blockId: nextBlockId });
      server.inventory.damageSelectedItem(1);
      server.syncInventory();
      const message = spec.message?.(event, nextBlockId);
      if (message) {
        server.addChatMessage('§7[Server]', message);
      }
      return true;
    };

    for (const spec of TOOL_TRANSFORMS) {
      if (applyTransform(spec)) return true;
    }

    const info = BLOCK_DEFS[event.blockId];
    const declarativeTransforms: BlockToolTransform[] = info?.toolTransforms ?? [];
    for (const transform of declarativeTransforms) {
      const applied = applyTransform({
        tool: transform.tool,
        canApply(currentServer, currentEvent) {
          if (transform.requiresAirAbove) {
            return currentServer.world.getBlock(currentEvent.x, currentEvent.y + 1, currentEvent.z) === B.AIR;
          }
          return true;
        },
        targetBlockId() {
          return transform.toBlockId;
        },
        preserveResolvedState: transform.preserveResolvedState,
        onAfterTransform(currentServer, currentEvent) {
          if (transform.setState && Object.keys(transform.setState).length > 0) {
            currentServer.world.setBlockState(currentEvent.x, currentEvent.y, currentEvent.z, transform.setState);
          }
        },
        message() {
          return transform.message;
        },
      });
      if (applied) return true;
    }
    return false;
  },
};

const ruleFarmlandMoistureTick: BlockRule = {
  id: 'farmland-moisture-tick',
  onTick(server, dt) {
    const prev = farmlandTickAccum.get(server) ?? 0;
    const next = prev + dt;
    if (next < FARMLAND_UPDATE_INTERVAL) {
      farmlandTickAccum.set(server, next);
      return;
    }
    farmlandTickAccum.set(server, 0);
    for (const { cx, cz, chunk } of nearbyChunks(server)) {
      for (let lx = 0; lx < 16; lx++) {
        for (let lz = 0; lz < 16; lz++) {
          for (let y = BLOCK_SCAN_Y_MIN; y < BLOCK_SCAN_Y_MAX; y++) {
            if (!hasBlockBehavior(chunk.getBlock(lx, y, lz), 'farmland')) continue;
            const wx = cx * 16 + lx;
            const wz = cz * 16 + lz;
            const hydrated = server.ctx.state.weather === 'rain' || hasWaterNearby(server, wx, y, wz);
            const state = server.world.getBlockState(wx, y, wz) ?? {};
            const current = typeof state.moisture === 'number' ? Math.max(0, Math.min(7, Math.floor(state.moisture))) : 7;
            if (hydrated) {
              if (current !== 7) server.world.setBlockState(wx, y, wz, { ...state, moisture: 7 });
              continue;
            }
            const moisture = Math.max(0, current - 1);
            if (moisture > 0) {
              server.world.setBlockState(wx, y, wz, { ...state, moisture });
            } else {
              server.world.setBlock(wx, y, wz, B.DIRT);
              server.ctx.s2c.emit('s2c:blockChange', { x: wx, y, z: wz, blockId: B.DIRT });
            }
          }
        }
      }
    }
  },
};

type GravityMove = {
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  blockId: number;
  state: BlockState | undefined;
};

const ruleGravityBlocks: BlockRule = {
  id: 'gravity-blocks',
  onTick(server, dt) {
    const prev = gravityBlockTickAccum.get(server) ?? 0;
    const next = prev + dt;
    if (next < GRAVITY_BLOCK_UPDATE_INTERVAL) {
      gravityBlockTickAccum.set(server, next);
      return;
    }
    gravityBlockTickAccum.set(server, next % GRAVITY_BLOCK_UPDATE_INTERVAL);

    const moves: GravityMove[] = [];
    for (const { cx, cz, chunk } of nearbyChunks(server)) {
      for (let lx = 0; lx < 16; lx++) {
        for (let lz = 0; lz < 16; lz++) {
          for (let y = BLOCK_SCAN_Y_MIN; y < BLOCK_SCAN_Y_MAX; y++) {
            const blockId = chunk.getBlock(lx, y, lz);
            if (!hasBlockBehavior(blockId, 'falls_with_gravity')) continue;
            const wx = cx * 16 + lx;
            const wz = cz * 16 + lz;
            const belowId = server.world.getBlock(wx, y - 1, wz);
            const belowIsSolid = BLOCK_DEFS[belowId]?.solid ?? false;
            if (belowIsSolid) continue;
            moves.push({
              from: { x: wx, y, z: wz },
              to: { x: wx, y: y - 1, z: wz },
              blockId,
              state: server.world.getBlockState(wx, y, wz),
            });
          }
        }
      }
    }

    for (const move of moves) {
      if (server.world.getBlock(move.from.x, move.from.y, move.from.z) !== move.blockId) continue;
      const belowId = server.world.getBlock(move.to.x, move.to.y, move.to.z);
      const belowIsSolid = BLOCK_DEFS[belowId]?.solid ?? false;
      if (belowIsSolid) continue;
      server.world.setBlock(move.from.x, move.from.y, move.from.z, B.AIR);
      server.world.setBlock(move.to.x, move.to.y, move.to.z, move.blockId);
      if (move.state) {
        server.world.setBlockState(move.to.x, move.to.y, move.to.z, move.state);
      }
      server.ctx.s2c.emit('s2c:blockChange', { x: move.from.x, y: move.from.y, z: move.from.z, blockId: B.AIR });
      server.ctx.s2c.emit('s2c:blockChange', { x: move.to.x, y: move.to.y, z: move.to.z, blockId: move.blockId });
    }
  },
};

const ruleFluidFlow: BlockRule = {
  id: 'fluid-flow',
  onTick(server, dt) {
    const prev = fluidTickAccum.get(server) ?? 0;
    const next = prev + dt;
    if (next < FLUID_UPDATE_INTERVAL) {
      fluidTickAccum.set(server, next);
      return;
    }
    fluidTickAccum.set(server, next % FLUID_UPDATE_INTERVAL);

    const solidifyLavaOps: Array<{ x: number; y: number; z: number; blockId: number }> = [];
    const seenSolidify = new Set<string>();
    for (const { cx, cz, chunk } of nearbyChunks(server)) {
      for (let lx = 0; lx < 16; lx++) {
        for (let lz = 0; lz < 16; lz++) {
          for (let y = BLOCK_SCAN_Y_MIN; y < BLOCK_SCAN_Y_MAX; y++) {
            const blockId = chunk.getBlock(lx, y, lz);
            if (blockId !== B.LAVA) continue;
            const wx = cx * 16 + lx;
            const wz = cz * 16 + lz;
            const neighbors: Array<[number, number, number]> = [
              [1, 0, 0],
              [-1, 0, 0],
              [0, 0, 1],
              [0, 0, -1],
              [0, 1, 0],
              [0, -1, 0],
            ];
            for (const [dx, dy, dz] of neighbors) {
              if (server.world.getBlock(wx + dx, y + dy, wz + dz) !== B.WATER) continue;
              const opKey = `${wx},${y},${wz}`;
              if (seenSolidify.has(opKey)) break;
              seenSolidify.add(opKey);
              const solidBlock = isFluidSourceCell(server, wx, y, wz) ? B.OBSIDIAN : B.COBBLESTONE;
              solidifyLavaOps.push({ x: wx, y, z: wz, blockId: solidBlock });
              break;
            }
          }
        }
      }
    }

    for (const op of solidifyLavaOps) {
      if (server.world.getBlock(op.x, op.y, op.z) !== B.LAVA) continue;
      server.world.setBlock(op.x, op.y, op.z, op.blockId);
      server.ctx.s2c.emit('s2c:blockChange', { x: op.x, y: op.y, z: op.z, blockId: op.blockId });
    }

    const spreadOpsByKey = new Map<string, FluidSpreadOp | FluidSpreadCollisionOp>();
    const queueSpread = (op: FluidSpreadOp) => {
      const key = `${op.x},${op.y},${op.z}`;
      const existing = spreadOpsByKey.get(key);
      if (!existing) {
        spreadOpsByKey.set(key, op);
        return;
      }
      if ('collision' in existing) return;
      if (existing.blockId !== op.blockId) {
        spreadOpsByKey.set(key, { x: op.x, y: op.y, z: op.z, collision: true });
        return;
      }
      if (op.distance < existing.distance) {
        spreadOpsByKey.set(key, op);
      }
    };
    for (const { cx, cz, chunk } of nearbyChunks(server)) {
      for (let lx = 0; lx < 16; lx++) {
        for (let lz = 0; lz < 16; lz++) {
          for (let y = BLOCK_SCAN_Y_MIN; y < BLOCK_SCAN_Y_MAX; y++) {
            const blockId = chunk.getBlock(lx, y, lz);
            if (blockId !== B.WATER && blockId !== B.LAVA) continue;
            const wx = cx * 16 + lx;
            const wz = cz * 16 + lz;
            const maxDistance = getFluidMaxDistance(blockId);
            if (maxDistance <= 0) continue;
            const meta = getFluidMeta(server, wx, y, wz);
            const belowY = y - 1;
            if (belowY >= 0 && server.world.getBlock(wx, belowY, wz) === B.AIR) {
              queueSpread({ x: wx, y: belowY, z: wz, blockId, distance: 1 });
            }
            if (meta.distance >= maxDistance) continue;
            const horizontalDistance = meta.distance + 1;
            if (horizontalDistance > maxDistance) continue;
            const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dx, dz] of dirs) {
              const nx = wx + dx;
              const nz = wz + dz;
              if (server.world.getBlock(nx, y, nz) !== B.AIR) continue;
              queueSpread({ x: nx, y, z: nz, blockId, distance: horizontalDistance });
            }
          }
        }
      }
    }

    const spreadOps = Array.from(spreadOpsByKey.values());
    for (const op of spreadOps) {
      if ('collision' in op) {
        const current = server.world.getBlock(op.x, op.y, op.z);
        if (current === B.AIR || current === B.WATER || current === B.LAVA) {
          server.world.setBlock(op.x, op.y, op.z, B.COBBLESTONE);
          server.ctx.s2c.emit('s2c:blockChange', { x: op.x, y: op.y, z: op.z, blockId: B.COBBLESTONE });
        }
        continue;
      }
      const current = server.world.getBlock(op.x, op.y, op.z);
      if (isFluidPair(op.blockId, current)) {
        server.world.setBlock(op.x, op.y, op.z, B.COBBLESTONE);
        server.ctx.s2c.emit('s2c:blockChange', { x: op.x, y: op.y, z: op.z, blockId: B.COBBLESTONE });
        continue;
      }
      if (current !== B.AIR && current !== op.blockId) continue;
      if (current === B.AIR) {
        server.world.setBlock(op.x, op.y, op.z, op.blockId);
        server.ctx.s2c.emit('s2c:blockChange', { x: op.x, y: op.y, z: op.z, blockId: op.blockId });
      }
      if (!getFluidMeta(server, op.x, op.y, op.z).isSource) {
        const existingDistance = getFluidMeta(server, op.x, op.y, op.z).distance;
        if (op.distance < existingDistance || current === B.AIR) {
          setFlowingFluidState(server, op.x, op.y, op.z, op.distance);
        }
      } else if (current === B.AIR) {
        setFlowingFluidState(server, op.x, op.y, op.z, op.distance);
      }
    }

    const retractOps: Array<{ x: number; y: number; z: number; blockId: number; distance: number | null }> = [];
    for (const { cx, cz, chunk } of nearbyChunks(server)) {
      for (let lx = 0; lx < 16; lx++) {
        for (let lz = 0; lz < 16; lz++) {
          for (let y = BLOCK_SCAN_Y_MIN; y < BLOCK_SCAN_Y_MAX; y++) {
            const blockId = chunk.getBlock(lx, y, lz);
            if (blockId !== B.WATER && blockId !== B.LAVA) continue;
            const wx = cx * 16 + lx;
            const wz = cz * 16 + lz;
            const meta = getFluidMeta(server, wx, y, wz);
            if (meta.isSource) continue;
            const maxDistance = getFluidMaxDistance(blockId);
            let bestDistance: number | null = null;

            if (server.world.getBlock(wx, y + 1, wz) === blockId) {
              bestDistance = 1;
            }

            const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dx, dz] of dirs) {
              const nx = wx + dx;
              const nz = wz + dz;
              if (server.world.getBlock(nx, y, nz) !== blockId) continue;
              const neighborMeta = getFluidMeta(server, nx, y, nz);
              const candidate = neighborMeta.distance + 1;
              if (candidate > maxDistance) continue;
              if (bestDistance == null || candidate < bestDistance) {
                bestDistance = candidate;
              }
            }

            retractOps.push({
              x: wx,
              y,
              z: wz,
              blockId,
              distance: bestDistance == null || bestDistance > maxDistance ? null : bestDistance,
            });
          }
        }
      }
    }

    for (const op of retractOps) {
      if (server.world.getBlock(op.x, op.y, op.z) !== op.blockId) continue;
      if (op.distance == null) {
        server.world.setBlock(op.x, op.y, op.z, B.AIR);
        server.ctx.s2c.emit('s2c:blockChange', { x: op.x, y: op.y, z: op.z, blockId: B.AIR });
        continue;
      }
      const currentMeta = getFluidMeta(server, op.x, op.y, op.z);
      if (currentMeta.isSource || currentMeta.distance === op.distance) continue;
      setFlowingFluidState(server, op.x, op.y, op.z, op.distance);
    }
  },
};

const CROP_GROWTH_INTERVAL = 8;
const CROP_MAX_GROWTH = 7;
const cropTickAccum = new WeakMap<GameServer, number>();

function getCropGrowthSteps(moisture: number): number {
  if (moisture < 3) return 0;
  if (moisture >= 6) return Math.random() < 0.5 ? 2 : 1;
  return 1;
}

const ruleCropGrowthTick: BlockRule = {
  id: 'crop-growth-tick',
  onTick(server, dt) {
    const prev = cropTickAccum.get(server) ?? 0;
    const next = prev + dt;
    if (next < CROP_GROWTH_INTERVAL) {
      cropTickAccum.set(server, next);
      return;
    }
    cropTickAccum.set(server, 0);
    for (const { cx, cz, chunk } of nearbyChunks(server)) {
      for (let lx = 0; lx < 16; lx++) {
        for (let lz = 0; lz < 16; lz++) {
          for (let y = BLOCK_SCAN_Y_MIN; y < BLOCK_SCAN_Y_MAX; y++) {
            if (!hasBlockBehavior(chunk.getBlock(lx, y, lz), 'crop')) continue;
            const wx = cx * 16 + lx;
            const wz = cz * 16 + lz;
            const state = server.world.getBlockState(wx, y, wz) ?? {};
            const growth = typeof state.growth === 'number' ? state.growth : 0;
            if (growth >= CROP_MAX_GROWTH) continue;
            const below = server.world.getBlock(wx, y - 1, wz);
            if (!hasBlockBehavior(below, 'farmland')) {
              server.world.setBlock(wx, y, wz, B.AIR);
              server.ctx.s2c.emit('s2c:blockChange', { x: wx, y, z: wz, blockId: B.AIR });
              continue;
            }
            const farmState = server.world.getBlockState(wx, y - 1, wz) ?? {};
            const moisture = typeof farmState.moisture === 'number' ? farmState.moisture : 7;
            const steps = getCropGrowthSteps(moisture);
            if (steps <= 0) continue;
            const nextGrowth = Math.min(CROP_MAX_GROWTH, growth + steps);
            server.world.setBlockState(wx, y, wz, { ...state, growth: nextGrowth });
          }
        }
      }
    }
  },
};

const GRASS_SEED_DROP_CHANCE = 0.125;

const ruleGrassSeedDrop: BlockRule = {
  id: 'grass-seed-drop',
  onBreak(server, event) {
    if (event.blockId !== B.GRASS) return;
    if (Math.random() < GRASS_SEED_DROP_CHANCE) {
      server.spawnItemDrop(ItemTypes.WHEAT_SEEDS, 1, { x: event.x + 0.5, y: event.y + 0.5, z: event.z + 0.5 });
    }
  },
};

function randomRange(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

type CropDropProfile = {
  matureItem: number;
  matureMin: number;
  matureMax: number;
  seedItem: number;
  seedMin: number;
  seedMax: number;
  immatureDrop: number;
};

const CROP_DROP_PROFILES: Record<number, CropDropProfile> = {
  [B.WHEAT_CROP]: {
    matureItem: ItemTypes.WHEAT, matureMin: 1, matureMax: 3,
    seedItem: ItemTypes.WHEAT_SEEDS, seedMin: 1, seedMax: 3,
    immatureDrop: ItemTypes.WHEAT_SEEDS,
  },
  [B.POTATO_CROP]: {
    matureItem: ItemTypes.POTATO, matureMin: 2, matureMax: 4,
    seedItem: ItemTypes.POTATO, seedMin: 1, seedMax: 2,
    immatureDrop: ItemTypes.POTATO,
  },
  [B.CARROT_CROP]: {
    matureItem: ItemTypes.CARROT, matureMin: 2, matureMax: 4,
    seedItem: ItemTypes.CARROT, seedMin: 1, seedMax: 2,
    immatureDrop: ItemTypes.CARROT,
  },
};

const ruleCropHarvestDrop: BlockRule = {
  id: 'crop-harvest-drop',
  onBreak(server, event) {
    if (!hasBlockBehavior(event.blockId, 'crop')) return;
    const profile = CROP_DROP_PROFILES[event.blockId];
    if (!profile) return;
    const state = server.world.getBlockState(event.x, event.y, event.z);
    const growth = typeof state?.growth === 'number' ? state.growth : 0;
    const pos = { x: event.x + 0.5, y: event.y + 0.5, z: event.z + 0.5 };
    if (growth >= CROP_MAX_GROWTH) {
      server.spawnItemDrop(profile.matureItem, randomRange(profile.matureMin, profile.matureMax), pos);
      server.spawnItemDrop(profile.seedItem, randomRange(profile.seedMin, profile.seedMax), pos);
    } else {
      server.spawnItemDrop(profile.immatureDrop, 1, pos);
    }
  },
};

const defaultRules: BlockRule[] = [
  rulePlacementStates,
  ruleBucketPickup,
  ruleFluidContainerPlaceConsume,
  ruleToolTransforms,
  ruleFarmlandMoistureTick,
  ruleCropGrowthTick,
  ruleGravityBlocks,
  ruleFluidFlow,
  ruleGrassSeedDrop,
  ruleCropHarvestDrop,
];

export class BlockRuleEngine {
  private readonly rules: BlockRule[];

  constructor(rules: BlockRule[] = defaultRules) {
    this.rules = [...rules];
  }

  register(rule: BlockRule, options?: { prepend?: boolean }) {
    const prepend = options?.prepend === true;
    if (prepend) this.rules.unshift(rule);
    else this.rules.push(rule);
    return () => {
      const index = this.rules.findIndex((r) => r.id === rule.id);
      if (index >= 0) this.rules.splice(index, 1);
    };
  }

  applyOnInteract(server: GameServer, event: BlockInteractEvent): boolean {
    for (const rule of this.rules) {
      if (!rule.onInteract) continue;
      if (rule.onInteract(server, event)) return true;
    }
    return false;
  }

  applyOnPlace(server: GameServer, event: BlockPlaceEvent) {
    for (const rule of this.rules) {
      rule.onPlace?.(server, event);
    }
  }

  applyOnPlaceConsume(server: GameServer, event: BlockPlaceEvent): boolean {
    for (const rule of this.rules) {
      if (!rule.onPlaceConsume) continue;
      if (rule.onPlaceConsume(server, event)) return true;
    }
    return false;
  }

  applyOnBreak(server: GameServer, event: BlockBreakEvent) {
    for (const rule of this.rules) {
      rule.onBreak?.(server, event);
    }
  }

  tick(server: GameServer, dt: number) {
    for (const rule of this.rules) {
      rule.onTick?.(server, dt);
    }
  }
}

export const blockRuleEngine = new BlockRuleEngine();
