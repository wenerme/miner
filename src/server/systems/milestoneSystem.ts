import { BlockTypes } from '#/block/BlockRegistry';
import { ItemTypes, getItemDef } from '#/common/ItemRegistry';
import type { InventorySlot } from '#/common/types';

export type MilestoneId =
  | 'first_log'
  | 'first_planks'
  | 'first_tool'
  | 'first_stone'
  | 'first_iron'
  | 'first_smelt'
  | 'first_trade'
  | 'find_village'
  | 'first_night_survived'
  | 'first_diamond'
  | 'iron_age'
  | 'diamond_age'
  | 'deep_miner'
  | 'find_dungeon';

export type MilestoneReward = {
  items: Array<{ itemId: number; count: number }>;
  message: string;
};

export type MilestoneDef = {
  id: MilestoneId;
  title: string;
  announce: string;
  reward: MilestoneReward;
};

const MILESTONE_DEFS: MilestoneDef[] = [
  {
    id: 'first_log',
    title: 'Lumberjack',
    announce: '§6[Milestone] §fLumberjack §7— You got your first log!',
    reward: { items: [], message: '' },
  },
  {
    id: 'first_planks',
    title: 'Woodworker',
    announce: '§6[Milestone] §fWoodworker §7— Planks unlocked!',
    reward: { items: [{ itemId: ItemTypes.STICK, count: 4 }], message: '§a+4 Sticks' },
  },
  {
    id: 'first_tool',
    title: 'Toolsmith',
    announce: '§6[Milestone] §fToolsmith §7— Your first tool!',
    reward: { items: [{ itemId: BlockTypes.TORCH, count: 8 }], message: '§a+8 Torches' },
  },
  {
    id: 'first_stone',
    title: 'Stone Age',
    announce: '§6[Milestone] §fStone Age §7— You mined stone!',
    reward: { items: [{ itemId: ItemTypes.BREAD, count: 3 }], message: '§a+3 Bread' },
  },
  {
    id: 'first_iron',
    title: 'Iron Hunter',
    announce: '§6[Milestone] §fIron Hunter §7— Iron ore found!',
    reward: { items: [{ itemId: ItemTypes.COAL, count: 8 }], message: '§a+8 Coal' },
  },
  {
    id: 'first_smelt',
    title: 'Smelter',
    announce: '§6[Milestone] §fSmelter §7— Your first ingot!',
    reward: { items: [{ itemId: ItemTypes.EMERALD, count: 1 }], message: '§a+1 Emerald' },
  },
  {
    id: 'first_trade',
    title: 'Merchant',
    announce: '§6[Milestone] §fMerchant §7— Your first trade!',
    reward: { items: [{ itemId: ItemTypes.GOLDEN_APPLE, count: 1 }], message: '§a+1 Golden Apple' },
  },
  {
    id: 'find_village',
    title: 'Explorer',
    announce: '§6[Milestone] §fExplorer §7— You found a village!',
    reward: { items: [{ itemId: ItemTypes.BREAD, count: 6 }], message: '§a+6 Bread' },
  },
  {
    id: 'first_night_survived',
    title: 'Night Watch',
    announce: '§6[Milestone] §fNight Watch §7— You survived your first night!',
    reward: { items: [{ itemId: ItemTypes.IRON_INGOT, count: 4 }, { itemId: ItemTypes.COAL, count: 8 }], message: '§a+4 Iron Ingots, +8 Coal' },
  },
  {
    id: 'first_diamond',
    title: 'Diamonds!',
    announce: '§6[Milestone] §fDiamonds! §7— You found your first diamond!',
    reward: { items: [{ itemId: ItemTypes.IRON_INGOT, count: 8 }], message: '§a+8 Iron Ingots' },
  },
  {
    id: 'iron_age',
    title: 'Iron Age',
    announce: '§6[Milestone] §fIron Age §7— You crafted iron tools!',
    reward: { items: [{ itemId: ItemTypes.DIAMOND, count: 2 }], message: '§a+2 Diamonds' },
  },
  {
    id: 'diamond_age',
    title: 'Diamond Age',
    announce: '§6[Milestone] §fDiamond Age §7— Diamond tools crafted!',
    reward: { items: [{ itemId: ItemTypes.GOLDEN_APPLE, count: 3 }], message: '§a+3 Golden Apples' },
  },
  {
    id: 'deep_miner',
    title: 'Deep Miner',
    announce: '§6[Milestone] §fDeep Miner §7— You reached the deepslate layer!',
    reward: { items: [{ itemId: ItemTypes.DIAMOND, count: 1 }, { itemId: ItemTypes.EMERALD, count: 2 }], message: '§a+1 Diamond, +2 Emeralds' },
  },
  {
    id: 'find_dungeon',
    title: 'Dungeon Crawler',
    announce: '§6[Milestone] §fDungeon Crawler §7— You found a dungeon!',
    reward: { items: [{ itemId: ItemTypes.DIAMOND, count: 2 }], message: '§a+2 Diamonds' },
  },
];

const MILESTONE_MAP = new Map(MILESTONE_DEFS.map((m) => [m.id, m]));

export function getMilestoneDef(id: MilestoneId): MilestoneDef | undefined {
  return MILESTONE_MAP.get(id);
}

export function getAllMilestoneDefs(): readonly MilestoneDef[] {
  return MILESTONE_DEFS;
}

const LOG_BLOCKS = new Set([BlockTypes.OAK_LOG, BlockTypes.BIRCH_LOG, BlockTypes.SPRUCE_LOG, BlockTypes.JUNGLE_LOG]);
const STONE_BLOCKS = new Set([BlockTypes.COBBLESTONE, BlockTypes.STONE]);
const IRON_BLOCKS = new Set([BlockTypes.IRON_ORE]);

const TOOL_ITEMS: Set<number> = new Set([
  ItemTypes.WOODEN_PICKAXE, ItemTypes.WOODEN_AXE, ItemTypes.WOODEN_SHOVEL, ItemTypes.WOODEN_HOE, ItemTypes.WOODEN_SWORD,
  ItemTypes.STONE_PICKAXE, ItemTypes.STONE_AXE, ItemTypes.STONE_SHOVEL, ItemTypes.STONE_HOE, ItemTypes.STONE_SWORD,
  ItemTypes.IRON_PICKAXE, ItemTypes.IRON_AXE, ItemTypes.IRON_SHOVEL, ItemTypes.IRON_HOE, ItemTypes.IRON_SWORD,
  ItemTypes.DIAMOND_PICKAXE, ItemTypes.DIAMOND_AXE, ItemTypes.DIAMOND_SHOVEL, ItemTypes.DIAMOND_HOE, ItemTypes.DIAMOND_SWORD,
]);

const IRON_TOOLS: Set<number> = new Set([
  ItemTypes.IRON_PICKAXE, ItemTypes.IRON_AXE, ItemTypes.IRON_SHOVEL, ItemTypes.IRON_HOE, ItemTypes.IRON_SWORD,
]);

const DIAMOND_TOOLS: Set<number> = new Set([
  ItemTypes.DIAMOND_PICKAXE, ItemTypes.DIAMOND_AXE, ItemTypes.DIAMOND_SHOVEL, ItemTypes.DIAMOND_HOE, ItemTypes.DIAMOND_SWORD,
]);

const DIAMOND_BLOCKS = new Set([BlockTypes.DIAMOND_ORE]);

const INGOT_ITEMS: Set<number> = new Set([ItemTypes.IRON_INGOT, ItemTypes.GOLD_INGOT, ItemTypes.COPPER_INGOT]);

export class MilestoneTracker {
  readonly completed = new Set<MilestoneId>();

  isComplete(id: MilestoneId): boolean {
    return this.completed.has(id);
  }

  complete(id: MilestoneId): MilestoneDef | null {
    if (this.completed.has(id)) return null;
    this.completed.add(id);
    return MILESTONE_MAP.get(id) ?? null;
  }

  checkBlockBreak(blockId: number): MilestoneId | null {
    if (!this.completed.has('first_log') && LOG_BLOCKS.has(blockId)) return 'first_log';
    if (!this.completed.has('first_stone') && STONE_BLOCKS.has(blockId)) return 'first_stone';
    if (!this.completed.has('first_iron') && IRON_BLOCKS.has(blockId)) return 'first_iron';
    if (!this.completed.has('first_diamond') && DIAMOND_BLOCKS.has(blockId)) return 'first_diamond';
    return null;
  }

  checkCraft(outputItemId: number): MilestoneId | null {
    if (!this.completed.has('first_planks') && outputItemId === BlockTypes.OAK_PLANKS) return 'first_planks';
    if (!this.completed.has('first_tool') && TOOL_ITEMS.has(outputItemId)) return 'first_tool';
    if (!this.completed.has('iron_age') && IRON_TOOLS.has(outputItemId)) return 'iron_age';
    if (!this.completed.has('diamond_age') && DIAMOND_TOOLS.has(outputItemId)) return 'diamond_age';
    return null;
  }

  checkDepth(playerY: number): MilestoneId | null {
    if (!this.completed.has('deep_miner') && playerY <= 16) return 'deep_miner';
    return null;
  }

  checkDungeonDiscovery(): MilestoneId | null {
    if (!this.completed.has('find_dungeon')) return 'find_dungeon';
    return null;
  }

  checkSmeltOutput(outputItemId: number): MilestoneId | null {
    if (!this.completed.has('first_smelt') && INGOT_ITEMS.has(outputItemId)) return 'first_smelt';
    return null;
  }

  checkTrade(): MilestoneId | null {
    if (!this.completed.has('first_trade')) return 'first_trade';
    return null;
  }

  checkVillageDiscovery(): MilestoneId | null {
    if (!this.completed.has('find_village')) return 'find_village';
    return null;
  }

  checkNightSurvived(): MilestoneId | null {
    if (!this.completed.has('first_night_survived')) return 'first_night_survived';
    return null;
  }

  snapshot(): MilestoneId[] {
    return [...this.completed];
  }

  load(ids: MilestoneId[]): void {
    this.completed.clear();
    for (const id of ids) {
      if (MILESTONE_MAP.has(id)) {
        this.completed.add(id);
      }
    }
  }
}
