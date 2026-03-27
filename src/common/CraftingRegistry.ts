import { BlockTypes } from './BlockRegistry';
import { ItemTypes } from './ItemRegistry';
import type { CraftingRecipe, InventorySlot } from './types';

const B = BlockTypes;
const I = ItemTypes;
const _ = 0;

/** Build 3×3 shape from 3 rows of 3. */
function s3(r0: number[], r1: number[], r2: number[]): number[] {
  return [...r0, ...r1, ...r2];
}

function toolShape(mat: number): { pickaxe: number[]; axe: number[]; shovel: number[]; hoe: number[]; sword: number[] } {
  const S = I.STICK;
  return {
    pickaxe: s3([mat, mat, mat], [_, S, _], [_, S, _]),
    axe:     s3([mat, mat, _], [mat, S, _], [_, S, _]),
    shovel:  s3([_, mat, _], [_, S, _], [_, S, _]),
    hoe:     s3([mat, mat, _], [_, S, _], [_, S, _]),
    sword:   s3([_, mat, _], [_, mat, _], [_, S, _]),
  };
}

function armorShape(mat: number): { helmet: number[]; chestplate: number[]; leggings: number[]; boots: number[] } {
  return {
    helmet:     s3([mat, mat, mat], [mat, _, mat], [_, _, _]),
    chestplate: s3([mat, _, mat], [mat, mat, mat], [mat, mat, mat]),
    leggings:   s3([mat, mat, mat], [mat, _, mat], [mat, _, mat]),
    boots:      s3([_, _, _], [mat, _, mat], [mat, _, mat]),
  };
}

const woodTools = toolShape(B.OAK_PLANKS);
const stoneTools = toolShape(B.COBBLESTONE);
const ironTools = toolShape(I.IRON_INGOT);
const diamondTools = toolShape(I.DIAMOND);
const goldTools = toolShape(I.GOLD_INGOT);
const P = B.OAK_PLANKS;
const C = B.COBBLESTONE;

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // Shapeless material recipes
  { name: 'Planks', inputs: [{ itemId: B.OAK_LOG, count: 1 }], output: { itemId: B.OAK_PLANKS, count: 4 } },
  { name: 'Sticks', inputs: [{ itemId: B.OAK_PLANKS, count: 2 }], output: { itemId: I.STICK, count: 4 },
    shape: s3([_, _, _], [_, P, _], [_, P, _]) },
  { name: 'Torch', inputs: [{ itemId: I.COAL, count: 1 }, { itemId: I.STICK, count: 1 }],
    output: { itemId: B.TORCH, count: 4 },
    shape: s3([_, _, _], [_, I.COAL, _], [_, I.STICK, _]) },
  { name: 'Cobblestone', inputs: [{ itemId: B.GRAVEL, count: 2 }], output: { itemId: B.COBBLESTONE, count: 1 } },
  { name: 'Glass', inputs: [{ itemId: B.SAND, count: 1 }], output: { itemId: B.GLASS, count: 1 } },
  { name: 'Bricks', inputs: [{ itemId: B.CLAY, count: 4 }], output: { itemId: B.BRICKS, count: 1 } },

  // Shaped workstations
  { name: 'Crafting Table', inputs: [{ itemId: P, count: 4 }], output: { itemId: B.CRAFTING_TABLE, count: 1 },
    shape: s3([_, _, _], [P, P, _], [P, P, _]) },
  { name: 'Furnace', inputs: [{ itemId: C, count: 8 }], output: { itemId: B.FURNACE, count: 1 },
    shape: s3([C, C, C], [C, _, C], [C, C, C]) },
  { name: 'Chest', inputs: [{ itemId: P, count: 8 }], output: { itemId: B.CHEST, count: 1 },
    shape: s3([P, P, P], [P, _, P], [P, P, P]) },

  // Shaped tools — wood
  { name: 'Wooden Pickaxe', inputs: [{ itemId: P, count: 3 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.WOODEN_PICKAXE, count: 1 }, shape: woodTools.pickaxe },
  { name: 'Wooden Axe', inputs: [{ itemId: P, count: 3 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.WOODEN_AXE, count: 1 }, shape: woodTools.axe },
  { name: 'Wooden Shovel', inputs: [{ itemId: P, count: 1 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.WOODEN_SHOVEL, count: 1 }, shape: woodTools.shovel },
  { name: 'Wooden Hoe', inputs: [{ itemId: P, count: 2 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.WOODEN_HOE, count: 1 }, shape: woodTools.hoe },
  { name: 'Wooden Sword', inputs: [{ itemId: P, count: 2 }, { itemId: I.STICK, count: 1 }], output: { itemId: I.WOODEN_SWORD, count: 1 }, shape: woodTools.sword },

  // Shaped tools — stone
  { name: 'Stone Pickaxe', inputs: [{ itemId: C, count: 3 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.STONE_PICKAXE, count: 1 }, shape: stoneTools.pickaxe },
  { name: 'Stone Axe', inputs: [{ itemId: C, count: 3 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.STONE_AXE, count: 1 }, shape: stoneTools.axe },
  { name: 'Stone Shovel', inputs: [{ itemId: C, count: 1 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.STONE_SHOVEL, count: 1 }, shape: stoneTools.shovel },
  { name: 'Stone Hoe', inputs: [{ itemId: C, count: 2 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.STONE_HOE, count: 1 }, shape: stoneTools.hoe },
  { name: 'Stone Sword', inputs: [{ itemId: C, count: 2 }, { itemId: I.STICK, count: 1 }], output: { itemId: I.STONE_SWORD, count: 1 }, shape: stoneTools.sword },

  // Shaped tools — iron/diamond/gold
  { name: 'Iron Pickaxe', inputs: [{ itemId: I.IRON_INGOT, count: 3 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.IRON_PICKAXE, count: 1 }, shape: ironTools.pickaxe },
  { name: 'Iron Axe', inputs: [{ itemId: I.IRON_INGOT, count: 3 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.IRON_AXE, count: 1 }, shape: ironTools.axe },
  { name: 'Iron Shovel', inputs: [{ itemId: I.IRON_INGOT, count: 1 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.IRON_SHOVEL, count: 1 }, shape: ironTools.shovel },
  { name: 'Iron Hoe', inputs: [{ itemId: I.IRON_INGOT, count: 2 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.IRON_HOE, count: 1 }, shape: ironTools.hoe },
  { name: 'Iron Sword', inputs: [{ itemId: I.IRON_INGOT, count: 2 }, { itemId: I.STICK, count: 1 }], output: { itemId: I.IRON_SWORD, count: 1 }, shape: ironTools.sword },
  { name: 'Diamond Pickaxe', inputs: [{ itemId: I.DIAMOND, count: 3 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.DIAMOND_PICKAXE, count: 1 }, shape: diamondTools.pickaxe },
  { name: 'Diamond Axe', inputs: [{ itemId: I.DIAMOND, count: 3 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.DIAMOND_AXE, count: 1 }, shape: diamondTools.axe },
  { name: 'Diamond Shovel', inputs: [{ itemId: I.DIAMOND, count: 1 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.DIAMOND_SHOVEL, count: 1 }, shape: diamondTools.shovel },
  { name: 'Diamond Hoe', inputs: [{ itemId: I.DIAMOND, count: 2 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.DIAMOND_HOE, count: 1 }, shape: diamondTools.hoe },
  { name: 'Diamond Sword', inputs: [{ itemId: I.DIAMOND, count: 2 }, { itemId: I.STICK, count: 1 }], output: { itemId: I.DIAMOND_SWORD, count: 1 }, shape: diamondTools.sword },
  { name: 'Golden Pickaxe', inputs: [{ itemId: I.GOLD_INGOT, count: 3 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.GOLD_PICKAXE, count: 1 }, shape: goldTools.pickaxe },
  { name: 'Golden Axe', inputs: [{ itemId: I.GOLD_INGOT, count: 3 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.GOLD_AXE, count: 1 }, shape: goldTools.axe },
  { name: 'Golden Shovel', inputs: [{ itemId: I.GOLD_INGOT, count: 1 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.GOLD_SHOVEL, count: 1 }, shape: goldTools.shovel },
  { name: 'Golden Hoe', inputs: [{ itemId: I.GOLD_INGOT, count: 2 }, { itemId: I.STICK, count: 2 }], output: { itemId: I.GOLD_HOE, count: 1 }, shape: goldTools.hoe },
  { name: 'Golden Sword', inputs: [{ itemId: I.GOLD_INGOT, count: 2 }, { itemId: I.STICK, count: 1 }], output: { itemId: I.GOLD_SWORD, count: 1 }, shape: goldTools.sword },

  // Shaped armor
  ...(() => {
    const mats = [
      { name: 'Leather', mat: I.LEATHER, h: I.LEATHER_HELMET, c: I.LEATHER_CHESTPLATE, l: I.LEATHER_LEGGINGS, b: I.LEATHER_BOOTS },
      { name: 'Iron', mat: I.IRON_INGOT, h: I.IRON_HELMET, c: I.IRON_CHESTPLATE, l: I.IRON_LEGGINGS, b: I.IRON_BOOTS },
      { name: 'Golden', mat: I.GOLD_INGOT, h: I.GOLD_HELMET, c: I.GOLD_CHESTPLATE, l: I.GOLD_LEGGINGS, b: I.GOLD_BOOTS },
      { name: 'Diamond', mat: I.DIAMOND, h: I.DIAMOND_HELMET, c: I.DIAMOND_CHESTPLATE, l: I.DIAMOND_LEGGINGS, b: I.DIAMOND_BOOTS },
    ];
    const out: CraftingRecipe[] = [];
    for (const m of mats) {
      const s = armorShape(m.mat);
      out.push({ name: `${m.name} Helmet`, inputs: [{ itemId: m.mat, count: 5 }], output: { itemId: m.h, count: 1 }, shape: s.helmet });
      out.push({ name: `${m.name} Chestplate`, inputs: [{ itemId: m.mat, count: 8 }], output: { itemId: m.c, count: 1 }, shape: s.chestplate });
      out.push({ name: `${m.name} Leggings`, inputs: [{ itemId: m.mat, count: 7 }], output: { itemId: m.l, count: 1 }, shape: s.leggings });
      out.push({ name: `${m.name} Boots`, inputs: [{ itemId: m.mat, count: 4 }], output: { itemId: m.b, count: 1 }, shape: s.boots });
    }
    return out;
  })(),

  // Shaped food
  { name: 'Bread', inputs: [{ itemId: I.WHEAT, count: 3 }], output: { itemId: I.BREAD, count: 1 },
    shape: s3([_, _, _], [I.WHEAT, I.WHEAT, I.WHEAT], [_, _, _]) },

  // Shapeless cooking (these should use furnace, kept for backward compat)
  { name: 'Cooked Beef', inputs: [{ itemId: I.COAL, count: 1 }, { itemId: I.RAW_BEEF, count: 1 }], output: { itemId: I.COOKED_BEEF, count: 1 } },
  { name: 'Cooked Porkchop', inputs: [{ itemId: I.COAL, count: 1 }, { itemId: I.RAW_PORKCHOP, count: 1 }], output: { itemId: I.COOKED_PORKCHOP, count: 1 } },
  { name: 'Cooked Chicken', inputs: [{ itemId: I.COAL, count: 1 }, { itemId: I.RAW_CHICKEN, count: 1 }], output: { itemId: I.COOKED_CHICKEN, count: 1 } },
  { name: 'Cooked Mutton', inputs: [{ itemId: I.COAL, count: 1 }, { itemId: I.RAW_MUTTON, count: 1 }], output: { itemId: I.COOKED_MUTTON, count: 1 } },
];

function aggregateRecipeInputs(recipe: CraftingRecipe): Map<number, number> {
  const m = new Map<number, number>();
  for (const inp of recipe.inputs) {
    m.set(inp.itemId, (m.get(inp.itemId) ?? 0) + inp.count);
  }
  return m;
}

function aggregateGridItems(grid: (InventorySlot | null)[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const cell of grid) {
    if (!cell) continue;
    m.set(cell.itemId, (m.get(cell.itemId) ?? 0) + cell.count);
  }
  return m;
}

function multisetsEqual(a: Map<number, number>, b: Map<number, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

/** Shapeless match: grid item counts must exactly match a recipe's inputs (same as MC shapeless). */
export function matchShapelessRecipeFromGrid(grid: (InventorySlot | null)[]): CraftingRecipe | null {
  const g = aggregateGridItems(grid);
  if (g.size === 0) return null;
  for (const recipe of CRAFTING_RECIPES) {
    if (recipe.shape) continue;
    const r = aggregateRecipeInputs(recipe);
    if (multisetsEqual(g, r)) return recipe;
  }
  return null;
}

type BBox = { r0: number; c0: number; r1: number; c1: number };

function getBBox3x3(cells: (number | null)[]): BBox | null {
  let r0 = 3, c0 = 3, r1 = -1, c1 = -1;
  for (let i = 0; i < 9; i++) {
    if (!cells[i]) continue;
    const r = Math.floor(i / 3), c = i % 3;
    if (r < r0) r0 = r;
    if (r > r1) r1 = r;
    if (c < c0) c0 = c;
    if (c > c1) c1 = c;
  }
  return r1 < 0 ? null : { r0, c0, r1, c1 };
}

function shapedMatch(gridIds: (number | null)[], pattern: number[]): boolean {
  const gBox = getBBox3x3(gridIds);
  const pBox = getBBox3x3(pattern.map((v) => v || null));
  if (!gBox || !pBox) return false;
  const gh = gBox.r1 - gBox.r0, gw = gBox.c1 - gBox.c0;
  const ph = pBox.r1 - pBox.r0, pw = pBox.c1 - pBox.c0;
  if (gh !== ph || gw !== pw) return false;
  for (let dr = 0; dr <= gh; dr++) {
    for (let dc = 0; dc <= gw; dc++) {
      const gi = (gBox.r0 + dr) * 3 + (gBox.c0 + dc);
      const pi = (pBox.r0 + dr) * 3 + (pBox.c0 + dc);
      if ((gridIds[gi] ?? 0) !== (pattern[pi] ?? 0)) return false;
    }
  }
  return true;
}

function mirrorPattern(p: number[]): number[] {
  const m = new Array(9);
  for (let r = 0; r < 3; r++) {
    m[r * 3 + 0] = p[r * 3 + 2];
    m[r * 3 + 1] = p[r * 3 + 1];
    m[r * 3 + 2] = p[r * 3 + 0];
  }
  return m;
}

/** Shaped match: try original + horizontal mirror, with bounding-box alignment. */
export function matchShapedRecipeFromGrid(grid: (InventorySlot | null)[]): CraftingRecipe | null {
  const gridIds = grid.map((s) => s?.itemId ?? 0);
  for (const recipe of CRAFTING_RECIPES) {
    if (!recipe.shape) continue;
    if (shapedMatch(gridIds, recipe.shape) || shapedMatch(gridIds, mirrorPattern(recipe.shape))) {
      return recipe;
    }
  }
  return null;
}

/** Try shaped first, then shapeless. */
export function matchRecipeFromGrid(grid: (InventorySlot | null)[]): CraftingRecipe | null {
  return matchShapedRecipeFromGrid(grid) ?? matchShapelessRecipeFromGrid(grid);
}

export function consumeShapelessRecipeFromGrid(grid: (InventorySlot | null)[], recipe: CraftingRecipe): void {
  for (const inp of recipe.inputs) {
    let remaining = inp.count;
    for (let i = 0; i < grid.length && remaining > 0; i++) {
      const cell = grid[i];
      if (!cell || cell.itemId !== inp.itemId) continue;
      const take = Math.min(remaining, cell.count);
      remaining -= take;
      const newCount = cell.count - take;
      grid[i] = newCount <= 0 ? null : { ...cell, count: newCount };
    }
    if (remaining > 0) {
      throw new Error('consumeShapelessRecipeFromGrid: insufficient items');
    }
  }
}
