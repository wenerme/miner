import type {
  BlockBehaviorTag,
  BlockDef,
  BlockDropDef,
  BlockPlacementDefaultState,
  BlockPlacementStateKind,
  BlockTextures,
  BlockToolTransform,
  ToolType,
} from '#/common/types';
import blocksData from './blocks.json';

type BlockEntry = (typeof blocksData.blocks)[number];

function expandTextures(tex: Record<string, string | undefined>): BlockTextures {
  if (tex.all !== undefined) {
    return {
      top: tex.all,
      bottom: tex.all,
      north: tex.all,
      south: tex.all,
      east: tex.all,
      west: tex.all,
    };
  }
  const side = tex.side ?? tex.top ?? '';
  const front = tex.front ?? side;
  return {
    top: tex.top ?? side,
    bottom: tex.bottom ?? tex.top ?? side,
    north: front,
    south: side,
    east: side,
    west: side,
  };
}

function normalizeRenderShape(shape: string | undefined): BlockDef['renderShape'] {
  return shape === 'cross' ? 'cross' : 'cube';
}

function normalizePlacementState(input: string | undefined): BlockPlacementStateKind | undefined {
  if (input === 'axis' || input === 'facing') return input;
  return undefined;
}

function normalizePlacementStateDefault(input: unknown): BlockPlacementDefaultState | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const value = input as BlockPlacementDefaultState;
  const axis = value.axis === 'x' || value.axis === 'y' || value.axis === 'z'
    ? value.axis
    : undefined;
  const facing = value.facing === 'north' || value.facing === 'south' || value.facing === 'east' || value.facing === 'west'
    ? value.facing
    : undefined;
  if (!axis && !facing) return undefined;
  return {
    ...(axis ? { axis } : {}),
    ...(facing ? { facing } : {}),
  };
}

function normalizeBehaviors(input: unknown): BlockBehaviorTag[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const allowed = new Set<BlockBehaviorTag>(['fluid_source', 'irrigation_water', 'farmland', 'falls_with_gravity', 'crop']);
  const next: BlockBehaviorTag[] = [];
  for (const entry of input) {
    if (typeof entry !== 'string') continue;
    if (!allowed.has(entry as BlockBehaviorTag)) continue;
    if (next.includes(entry as BlockBehaviorTag)) continue;
    next.push(entry as BlockBehaviorTag);
  }
  return next.length > 0 ? next : undefined;
}

function normalizeToolTransforms(input: unknown): BlockToolTransform[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const allowedTools = new Set<ToolType>(['hand', 'pickaxe', 'axe', 'shovel', 'hoe', 'sword', 'shears']);
  const transforms: BlockToolTransform[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue;
    const value = entry as Partial<BlockToolTransform>;
    if (typeof value.toBlockId !== 'number') continue;
    if (typeof value.tool !== 'string' || !allowedTools.has(value.tool as ToolType)) continue;
    transforms.push({
      tool: value.tool as ToolType,
      toBlockId: value.toBlockId,
      requiresAirAbove: value.requiresAirAbove === true,
      preserveResolvedState: value.preserveResolvedState === true,
      setState: value.setState && typeof value.setState === 'object' ? { ...value.setState } : undefined,
      message: typeof value.message === 'string' ? value.message : undefined,
    });
  }
  return transforms.length > 0 ? transforms : undefined;
}

function normalizeDrops(input: unknown): BlockDropDef[] | undefined {
  if (!input) return undefined;
  const raw = Array.isArray(input) ? input : [input];
  const drops: BlockDropDef[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const value = entry as Partial<BlockDropDef>;
    const count = Math.max(1, Math.floor(value.count ?? 0));
    if (count <= 0) continue;
    if (value.itemId == null && value.blockId == null) continue;
    drops.push({
      itemId: value.itemId,
      blockId: value.blockId,
      count,
      chance: value.chance == null ? undefined : Math.max(0, Math.min(1, value.chance)),
    });
  }
  return drops.length > 0 ? drops : undefined;
}

const B_MAP: Record<string, number> = {};
export const BLOCK_DEFS: Record<number, BlockDef> = {};

for (const entry of blocksData.blocks as BlockEntry[]) {
  const key = entry.name.toUpperCase().replace(/\s+/g, '_');
  B_MAP[key] = entry.id;
  BLOCK_DEFS[entry.id] = {
    id: entry.id,
    name: entry.name,
    textures: expandTextures(entry.textures),
    transparent: entry.transparent ?? false,
    translucent: (entry as { translucent?: boolean }).translucent ?? false,
    solid: entry.solid ?? true,
    breakable: entry.breakable ?? true,
    hardness: entry.hardness ?? 1,
    drops: normalizeDrops(entry.drops),
    tool: entry.tool as ToolType | undefined,
    requiredToolTier: entry.requiredToolTier,
    itemTexture: entry.itemTexture,
    stripToBlockId: typeof (entry as { stripToBlockId?: unknown }).stripToBlockId === 'number'
      ? (entry as { stripToBlockId: number }).stripToBlockId
      : undefined,
    renderShape: normalizeRenderShape(entry.renderShape),
    placementState: normalizePlacementState((entry as { placementState?: string }).placementState),
    placementStateDefault: normalizePlacementStateDefault((entry as { placementStateDefault?: unknown }).placementStateDefault),
    toolTransforms: normalizeToolTransforms((entry as { toolTransforms?: unknown }).toolTransforms),
    behaviors: normalizeBehaviors((entry as { behaviors?: unknown }).behaviors),
    fluidPickupItemId: typeof (entry as { fluidPickupItemId?: unknown }).fluidPickupItemId === 'number'
      ? (entry as { fluidPickupItemId: number }).fluidPickupItemId
      : undefined,
    fluidFlowDistance: typeof (entry as { fluidFlowDistance?: unknown }).fluidFlowDistance === 'number'
      ? Math.max(1, Math.floor((entry as { fluidFlowDistance: number }).fluidFlowDistance))
      : undefined,
  };
}

export const BlockTypes = Object.freeze(B_MAP as Record<string, number>);
export type BlockId = number;

export function hasBlockBehavior(blockId: number, behavior: BlockBehaviorTag): boolean {
  return BLOCK_DEFS[blockId]?.behaviors?.includes(behavior) ?? false;
}

export function getBlockTextureNames(): string[] {
  const names = new Set<string>();
  for (const def of Object.values(BLOCK_DEFS)) {
    for (const name of Object.values(def.textures)) {
      if (name) names.add(name);
    }
    if (def.itemTexture) names.add(def.itemTexture);
  }
  return Array.from(names);
}

export const getTextureNames = getBlockTextureNames;
