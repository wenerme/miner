import { getItemDef, getItemMaxDurability } from '#/common/ItemRegistry';
import { consumeShapelessRecipeFromGrid, matchRecipeFromGrid } from '#/common/CraftingRegistry';
import type { InventorySlot } from '#/common/types';
import type { Inventory } from '../Inventory';

export class CraftingSystem {
  readonly grid: (InventorySlot | null)[] = Array.from({ length: 9 }, () => null);

  clickCraftTableResult(inventory: Inventory, button: 'left' | 'right'): void {
    void button;
    const recipe = matchRecipeFromGrid(this.grid);
    if (!recipe) return;
    const out = recipe.output;
    const maxStack = getItemDef(out.itemId)?.stackSize ?? 64;
    const maxDurability = getItemMaxDurability(out.itemId);
    const crafted: InventorySlot = {
      itemId: out.itemId,
      count: out.count,
      ...(maxDurability != null ? { durability: maxDurability } : {}),
    };
    const cur = inventory.cursor;
    if (cur) {
      if (cur.itemId !== crafted.itemId) return;
      if ((cur.durability ?? undefined) !== (crafted.durability ?? undefined)) return;
      if (cur.count + crafted.count > maxStack) return;
      try {
        consumeShapelessRecipeFromGrid(this.grid, recipe);
      } catch {
        return;
      }
      cur.count += crafted.count;
      return;
    }
    try {
      consumeShapelessRecipeFromGrid(this.grid, recipe);
    } catch {
      return;
    }
    inventory.cursor = crafted;
  }
}
