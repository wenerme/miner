import { BlockTypes } from '#/block/BlockRegistry';
import { ItemTypes } from '#/common/ItemRegistry';
import type { InventorySlot } from '#/common/types';

export type LootEntry = {
  itemId: number;
  countMin: number;
  countMax: number;
  chance: number;
};

export type LootTable = {
  id: string;
  entries: LootEntry[];
  rollCount: number;
};

function roll(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function generateLoot(table: LootTable): InventorySlot[] {
  const items: InventorySlot[] = [];
  for (let r = 0; r < table.rollCount; r++) {
    for (const entry of table.entries) {
      if (Math.random() >= entry.chance) continue;
      items.push({ itemId: entry.itemId, count: roll(entry.countMin, entry.countMax) });
      break;
    }
  }
  return items;
}

export const LOOT_TABLES: Record<string, LootTable> = {
  village_smithy: {
    id: 'village_smithy',
    rollCount: 4,
    entries: [
      { itemId: ItemTypes.IRON_INGOT, countMin: 1, countMax: 3, chance: 0.45 },
      { itemId: ItemTypes.COAL, countMin: 2, countMax: 6, chance: 0.40 },
      { itemId: ItemTypes.EMERALD, countMin: 1, countMax: 1, chance: 0.25 },
      { itemId: ItemTypes.IRON_PICKAXE, countMin: 1, countMax: 1, chance: 0.15 },
      { itemId: ItemTypes.IRON_SWORD, countMin: 1, countMax: 1, chance: 0.10 },
      { itemId: ItemTypes.IRON_HELMET, countMin: 1, countMax: 1, chance: 0.10 },
      { itemId: ItemTypes.BREAD, countMin: 1, countMax: 3, chance: 0.50 },
      { itemId: ItemTypes.APPLE, countMin: 1, countMax: 2, chance: 0.30 },
    ],
  },
  village_storage: {
    id: 'village_storage',
    rollCount: 3,
    entries: [
      { itemId: ItemTypes.BREAD, countMin: 2, countMax: 4, chance: 0.50 },
      { itemId: ItemTypes.WHEAT, countMin: 3, countMax: 8, chance: 0.40 },
      { itemId: ItemTypes.POTATO, countMin: 2, countMax: 5, chance: 0.35 },
      { itemId: ItemTypes.CARROT, countMin: 2, countMax: 5, chance: 0.35 },
      { itemId: ItemTypes.WHEAT_SEEDS, countMin: 2, countMax: 4, chance: 0.30 },
      { itemId: ItemTypes.COAL, countMin: 1, countMax: 3, chance: 0.25 },
      { itemId: BlockTypes.TORCH, countMin: 4, countMax: 8, chance: 0.35 },
      { itemId: ItemTypes.EMERALD, countMin: 1, countMax: 1, chance: 0.15 },
    ],
  },
  dungeon: {
    id: 'dungeon',
    rollCount: 5,
    entries: [
      { itemId: ItemTypes.IRON_INGOT, countMin: 1, countMax: 4, chance: 0.35 },
      { itemId: ItemTypes.DIAMOND, countMin: 1, countMax: 2, chance: 0.12 },
      { itemId: ItemTypes.GOLDEN_APPLE, countMin: 1, countMax: 1, chance: 0.10 },
      { itemId: ItemTypes.IRON_SWORD, countMin: 1, countMax: 1, chance: 0.15 },
      { itemId: ItemTypes.IRON_CHESTPLATE, countMin: 1, countMax: 1, chance: 0.08 },
      { itemId: ItemTypes.COAL, countMin: 2, countMax: 6, chance: 0.40 },
      { itemId: ItemTypes.BREAD, countMin: 2, countMax: 4, chance: 0.45 },
      { itemId: ItemTypes.EMERALD, countMin: 1, countMax: 2, chance: 0.20 },
      { itemId: BlockTypes.TORCH, countMin: 4, countMax: 8, chance: 0.30 },
      { itemId: ItemTypes.RAW_IRON, countMin: 2, countMax: 5, chance: 0.35 },
    ],
  },
};
