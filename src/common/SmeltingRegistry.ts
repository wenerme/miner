import { BlockTypes as B } from '#/block/BlockRegistry';
import { ItemTypes as I } from '#/common/ItemRegistry';

export type SmeltingRecipe = {
  input: number;
  output: number;
  outputCount: number;
  cookTime: number;
};

export type FuelEntry = {
  itemId: number;
  burnTime: number;
};

const DEFAULT_COOK = 200;

/** Smelting recipes: input is itemId (blocks use the same id as their item form). */
export const SMELTING_RECIPES: SmeltingRecipe[] = [
  { input: I.RAW_IRON, output: I.IRON_INGOT, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: I.RAW_GOLD, output: I.GOLD_INGOT, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: I.RAW_COPPER, output: I.COPPER_INGOT, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: I.RAW_BEEF, output: I.COOKED_BEEF, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: I.RAW_PORKCHOP, output: I.COOKED_PORKCHOP, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: I.RAW_CHICKEN, output: I.COOKED_CHICKEN, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: I.RAW_MUTTON, output: I.COOKED_MUTTON, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: B.IRON_ORE, output: I.IRON_INGOT, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: B.GOLD_ORE, output: I.GOLD_INGOT, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: B.COPPER_ORE, output: I.COPPER_INGOT, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: B.SAND, output: B.GLASS, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: B.COBBLESTONE, output: B.STONE, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: B.CLAY, output: B.BRICKS, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: B.OAK_LOG, output: I.CHARCOAL, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: B.BIRCH_LOG, output: I.CHARCOAL, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: B.SPRUCE_LOG, output: I.CHARCOAL, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: B.STRIPPED_OAK_LOG, output: I.CHARCOAL, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: B.STRIPPED_BIRCH_LOG, output: I.CHARCOAL, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: B.STRIPPED_SPRUCE_LOG, output: I.CHARCOAL, outputCount: 1, cookTime: DEFAULT_COOK },
  { input: I.POTATO, output: I.BAKED_POTATO, outputCount: 1, cookTime: DEFAULT_COOK },
];

const recipeByInput = new Map<number, SmeltingRecipe>();
for (const r of SMELTING_RECIPES) {
  recipeByInput.set(r.input, r);
}

export function getSmeltingRecipe(inputItemId: number): SmeltingRecipe | null {
  return recipeByInput.get(inputItemId) ?? null;
}

const LOG_AND_PLANK_FUEL = 300;

export const FUEL_ENTRIES: FuelEntry[] = [
  { itemId: I.COAL, burnTime: 1600 },
  { itemId: I.CHARCOAL, burnTime: 1600 },
  { itemId: I.STICK, burnTime: 100 },
  { itemId: B.OAK_LOG, burnTime: LOG_AND_PLANK_FUEL },
  { itemId: B.BIRCH_LOG, burnTime: LOG_AND_PLANK_FUEL },
  { itemId: B.SPRUCE_LOG, burnTime: LOG_AND_PLANK_FUEL },
  { itemId: B.STRIPPED_OAK_LOG, burnTime: LOG_AND_PLANK_FUEL },
  { itemId: B.STRIPPED_BIRCH_LOG, burnTime: LOG_AND_PLANK_FUEL },
  { itemId: B.STRIPPED_SPRUCE_LOG, burnTime: LOG_AND_PLANK_FUEL },
  { itemId: B.OAK_PLANKS, burnTime: LOG_AND_PLANK_FUEL },
];

const fuelByItemId = new Map<number, number>();
for (const e of FUEL_ENTRIES) {
  fuelByItemId.set(e.itemId, e.burnTime);
}

export function getFuelBurnTime(itemId: number): number {
  return fuelByItemId.get(itemId) ?? 0;
}
