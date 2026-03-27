import { BLOCK_DEFS, BlockTypes } from '#/block/BlockRegistry';
import { getItemPlaceBlockId, getItemToolTier, getItemToolType } from '#/common/ItemRegistry';
import { resolveItemId, type ToolType, type Vec3 } from '#/common/types';

const B = BlockTypes;

/** Matches break-speed / harvest rules: no required tool type, or right tool + tier. */
export function hasCorrectToolForBreakSpeed(input: {
  blockId: number;
  selectedItemId: number | null;
  playerTool: ToolType;
}): boolean {
  const info = BLOCK_DEFS[input.blockId];
  if (!info || input.blockId === B.AIR) return false;
  const activeTool = getItemToolType(input.selectedItemId) ?? input.playerTool;
  const toolTier = getItemToolTier(input.selectedItemId);
  if (info.tool == null) return true;
  return info.tool === activeTool && toolTier >= (info.requiredToolTier ?? 0);
}

export interface BreakDropPlan {
  itemId: number;
  count: number;
}

export interface BreakBlockPlan {
  shouldBreak: boolean;
  activeTool: ToolType;
  warningMessage: string | null;
  drops: BreakDropPlan[];
  shouldDamageSelectedItem: boolean;
}

export function planBreakBlock(input: {
  blockId: number;
  selectedItemId: number | null;
  playerTool: ToolType;
  random?: () => number;
}): BreakBlockPlan {
  const { blockId, selectedItemId, playerTool, random = Math.random } = input;
  if (blockId === B.AIR) {
    return {
      shouldBreak: false,
      activeTool: playerTool,
      warningMessage: null,
      drops: [],
      shouldDamageSelectedItem: false,
    };
  }
  const info = BLOCK_DEFS[blockId];
  if (!info?.breakable) {
    return {
      shouldBreak: false,
      activeTool: playerTool,
      warningMessage: null,
      drops: [],
      shouldDamageSelectedItem: false,
    };
  }

  const activeTool = getItemToolType(selectedItemId) ?? playerTool;
  const hasCorrectTool = hasCorrectToolForBreakSpeed({ blockId, selectedItemId, playerTool });
  const requiresToolForDrop = info.requiredToolTier != null && info.requiredToolTier > 0;
  const canHarvest = hasCorrectTool || !requiresToolForDrop;
  const drops: BreakDropPlan[] = [];

  if (canHarvest) {
    const rawDrops = info.drops ?? [{ blockId, count: 1 }];
    for (const drop of rawDrops) {
      if (drop.chance != null && (drop.chance <= 0 || random() > drop.chance)) continue;
      const dropItemId = resolveItemId(drop);
      if (dropItemId == null) continue;
      drops.push({ itemId: dropItemId, count: drop.count });
    }
  }

  return {
    shouldBreak: true,
    activeTool,
    warningMessage: !hasCorrectTool && requiresToolForDrop
      ? `§e${info.name} requires a ${info.tool} (tier ${info.requiredToolTier ?? 0}+) to drop items`
      : null,
    drops,
    shouldDamageSelectedItem: selectedItemId != null && activeTool !== 'hand',
  };
}

export interface PlaceBlockPlan {
  allowed: boolean;
  placingViaContainer: boolean;
}

export function planPlaceBlock(input: {
  isSolidAtTarget: boolean;
  playerPosition: Vec3;
  x: number;
  y: number;
  z: number;
  blockId: number;
  selectedItemId: number | null;
  isCreative: boolean;
  hasInventoryBlock: boolean;
}): PlaceBlockPlan {
  const {
    isSolidAtTarget,
    playerPosition,
    x,
    y,
    z,
    blockId,
    selectedItemId,
    isCreative,
    hasInventoryBlock,
  } = input;
  if (isSolidAtTarget) {
    return { allowed: false, placingViaContainer: false };
  }

  const px = Math.floor(playerPosition.x);
  const py = Math.floor(playerPosition.y);
  const pz = Math.floor(playerPosition.z);
  if (x === px && z === pz && (y === py || y === py + 1)) {
    return { allowed: false, placingViaContainer: false };
  }

  const placeBlockId = getItemPlaceBlockId(selectedItemId);
  const placingViaContainer = placeBlockId != null && placeBlockId === blockId;
  if (!isCreative && !placingViaContainer && !hasInventoryBlock) {
    return { allowed: false, placingViaContainer };
  }

  return { allowed: true, placingViaContainer };
}
