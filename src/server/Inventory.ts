import { BlockTypes } from '#/block/BlockRegistry';
import { CRAFTING_RECIPES } from '#/common/CraftingRegistry';
import { getItemArmorSlot, getItemDef, getItemMaxDurability, ItemTypes } from '#/common/ItemRegistry';
import type { ArmorSlotKey, CraftingRecipe, InventorySlot, PlayerArmorSlots, WorldPreset } from '#/common/types';

function inventorySlotsAreAllEmpty(slots: (InventorySlot | null | undefined)[]): boolean {
  return slots.every((s) => s == null);
}

function makeInventorySlot(itemId: number, count: number): InventorySlot {
  const maxDurability = getItemMaxDurability(itemId);
  return {
    itemId,
    count,
    ...(maxDurability != null ? { durability: maxDurability } : {}),
  };
}

function applyDemoLoadout(inventory: Inventory) {
  const B = BlockTypes;
  const I = ItemTypes;
  const put = (index: number, itemId: number, count: number) => {
    inventory.slots[index] = makeInventorySlot(itemId, count);
  };
  put(0, I.STONE_PICKAXE, 1);
  put(1, I.STONE_AXE, 1);
  put(2, I.STONE_SHOVEL, 1);
  put(3, I.STONE_SWORD, 1);
  put(4, B.TORCH, 32);
  put(5, B.OAK_PLANKS, 64);
  put(6, B.COBBLESTONE, 64);
  put(7, B.DIRT, 64);
  put(8, B.GLASS, 16);
  put(9, B.OAK_LOG, 64);
  put(10, B.SAND, 64);
  put(11, B.BRICKS, 64);
  put(12, B.STONE, 64);
  put(13, B.CRAFTING_TABLE, 1);
  put(14, B.FURNACE, 1);
  put(15, I.BREAD, 16);
  put(16, I.COOKED_BEEF, 8);
  inventory.armor.helmet = makeInventorySlot(I.IRON_HELMET, 1);
  inventory.armor.boots = makeInventorySlot(I.IRON_BOOTS, 1);
}

function applySurvivalLoadout(inventory: Inventory) {
  inventory.slots[0] = makeInventorySlot(ItemTypes.BREAD, 3);
}

function applyDevLoadout(inventory: Inventory) {
  const B = BlockTypes;
  const I = ItemTypes;
  const put = (index: number, itemId: number, count: number) => {
    inventory.slots[index] = makeInventorySlot(itemId, count);
  };
  put(0, I.DIAMOND_PICKAXE, 1);
  put(1, I.DIAMOND_AXE, 1);
  put(2, I.DIAMOND_SHOVEL, 1);
  put(3, I.DIAMOND_SWORD, 1);
  put(4, B.TORCH, 64);
  put(5, B.OAK_PLANKS, 64);
  put(6, B.COBBLESTONE, 64);
  put(7, B.DIRT, 64);
  put(8, B.GLASS, 64);
  put(9, B.OAK_LOG, 64);
  put(10, B.SAND, 64);
  put(11, B.BRICKS, 64);
  put(12, B.STONE, 64);
  put(13, B.CRAFTING_TABLE, 4);
  put(14, B.FURNACE, 4);
  put(15, I.BREAD, 64);
  put(16, I.COOKED_BEEF, 64);
  put(17, I.COAL, 64);
  put(18, I.IRON_INGOT, 64);
  put(19, I.GOLD_INGOT, 64);
  put(20, I.DIAMOND, 64);
  inventory.armor.helmet = makeInventorySlot(I.DIAMOND_HELMET, 1);
  inventory.armor.chestplate = makeInventorySlot(I.DIAMOND_CHESTPLATE, 1);
  inventory.armor.leggings = makeInventorySlot(I.DIAMOND_LEGGINGS, 1);
  inventory.armor.boots = makeInventorySlot(I.DIAMOND_BOOTS, 1);
}

/** Fills inventory based on world preset when all slots are empty (new game or cleared save). */
export function applyDefaultStartingInventoryIfEmpty(inventory: Inventory, preset: WorldPreset = 'demo'): void {
  if (!inventorySlotsAreAllEmpty(inventory.slots)) return;
  switch (preset) {
    case 'survival':
      applySurvivalLoadout(inventory);
      break;
    case 'dev':
      applyDevLoadout(inventory);
      break;
    case 'demo':
    default:
      applyDemoLoadout(inventory);
      break;
  }
}

export class Inventory {
  slots: (InventorySlot | null)[];
  size: number;
  selectedIndex = 0;
  offhand: InventorySlot | null = null;
  cursor: InventorySlot | null = null;
  armor: PlayerArmorSlots = {
    helmet: null,
    chestplate: null,
    leggings: null,
    boots: null,
  };

  constructor(size = 36) {
    this.size = size;
    this.slots = new Array(size).fill(null);
  }

  /**
   * Try to add items to inventory. Returns true only when ALL items fit.
   * WARNING: always mutates — even on partial success. Use `addItemPartial`
   * when you need to know how many were actually placed.
   */
  addItem(itemId: number, count = 1): boolean {
    return this.addItemPartial(itemId, count) === count;
  }

  /** Add up to `count` items; returns the number actually placed. Always mutates. */
  addItemPartial(itemId: number, count: number): number {
    const maxStack = getItemDef(itemId)?.stackSize ?? 64;
    const maxDurability = getItemMaxDurability(itemId);
    let remaining = count;
    for (let i = 0; i < this.size && remaining > 0; i++) {
      const slot = this.slots[i];
      if (
        slot
        && slot.itemId === itemId
        && slot.count < maxStack
        && (slot.durability ?? undefined) === (maxDurability ?? undefined)
      ) {
        const add = Math.min(remaining, maxStack - slot.count);
        slot.count += add;
        remaining -= add;
      }
    }
    for (let i = 0; i < this.size && remaining > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(remaining, maxStack);
        this.slots[i] = { itemId, count: add, durability: maxDurability ?? undefined };
        remaining -= add;
      }
    }
    return count - remaining;
  }

  removeItem(itemId: number, count = 1): boolean {
    let remaining = count;
    for (let i = this.size - 1; i >= 0 && remaining > 0; i--) {
      const slot = this.slots[i];
      if (slot && slot.itemId === itemId) {
        const rm = Math.min(remaining, slot.count);
        slot.count -= rm;
        remaining -= rm;
        if (slot.count <= 0) this.slots[i] = null;
      }
    }
    return remaining <= 0;
  }

  hasItem(itemId: number, count = 1): boolean {
    let total = 0;
    for (const slot of this.slots) {
      if (slot && slot.itemId === itemId) {
        total += slot.count;
        if (total >= count) return true;
      }
    }
    return false;
  }

  getSelectedItem(): number | null {
    return this.slots[this.selectedIndex]?.itemId ?? null;
  }

  getSelectedSlot(): InventorySlot | null {
    return this.slots[this.selectedIndex] ?? null;
  }

  setSelectedSlot(slot: InventorySlot | null) {
    this.slots[this.selectedIndex] = slot ? { ...slot } : null;
  }

  damageSelectedItem(amount = 1): boolean {
    const slot = this.getSelectedSlot();
    if (!slot) return false;
    if (slot.count <= 0) return false;
    const maxDurability = getItemMaxDurability(slot.itemId);
    if (maxDurability == null) return false;
    const nextDurability = (slot.durability ?? maxDurability) - amount;
    if (nextDurability > 0) {
      slot.durability = nextDurability;
      this.setSelectedSlot(slot);
    } else {
      this.setSelectedSlot(null);
    }
    return true;
  }

  swapSelectedWithOffhand() {
    const selected = this.getSelectedSlot();
    this.setSelectedSlot(this.offhand ? { ...this.offhand } : null);
    this.offhand = selected ? { ...selected } : null;
  }

  snapshot(): (InventorySlot | null)[] {
    return this.slots.map((s) => (s ? { ...s } : null));
  }

  snapshotOffhand(): InventorySlot | null {
    return this.offhand ? { ...this.offhand } : null;
  }

  snapshotCursor(): InventorySlot | null {
    return this.cursor ? { ...this.cursor } : null;
  }

  snapshotArmor(): PlayerArmorSlots {
    return {
      helmet: this.armor.helmet ? { ...this.armor.helmet } : null,
      chestplate: this.armor.chestplate ? { ...this.armor.chestplate } : null,
      leggings: this.armor.leggings ? { ...this.armor.leggings } : null,
      boots: this.armor.boots ? { ...this.armor.boots } : null,
    };
  }

  clickOffhandSlot(button: 'left' | 'right' = 'left', shift = false) {
    if (shift) {
      const item = this.offhand;
      if (!item) return;
      const placed = this.addItemPartial(item.itemId, item.count);
      if (placed === 0) return;
      if (placed >= item.count) {
        this.offhand = null;
      } else {
        this.offhand = { ...item, count: item.count - placed };
      }
      return;
    }
    if (button === 'left') {
      if (!this.cursor) {
        if (!this.offhand) return;
        this.cursor = { ...this.offhand };
        this.offhand = null;
        return;
      }
      if (!this.offhand) {
        this.offhand = { ...this.cursor };
        this.cursor = null;
        return;
      }
      const tmp = { ...this.offhand };
      this.offhand = { ...this.cursor };
      this.cursor = tmp;
      return;
    }
    if (!this.cursor) {
      if (!this.offhand) return;
      const take = Math.ceil(this.offhand.count / 2);
      this.cursor = { ...this.offhand, count: take };
      const remaining = this.offhand.count - take;
      this.offhand = remaining > 0 ? { ...this.offhand, count: remaining } : null;
      return;
    }
    if (!this.offhand) {
      this.offhand = { ...this.cursor, count: 1 };
      this.cursor.count -= 1;
      if (this.cursor.count <= 0) this.cursor = null;
      return;
    }
    if (this.offhand.itemId === this.cursor.itemId
      && (this.offhand.durability ?? undefined) === (this.cursor.durability ?? undefined)) {
      const maxStack = getItemDef(this.offhand.itemId)?.stackSize ?? 64;
      if (this.offhand.count < maxStack) {
        this.offhand.count += 1;
        this.cursor.count -= 1;
        if (this.cursor.count <= 0) this.cursor = null;
      }
    }
  }

  private canPlaceInArmorSlot(itemId: number, slotKey: ArmorSlotKey): boolean {
    return getItemArmorSlot(itemId) === slotKey;
  }

  clickArmorSlot(slotKey: ArmorSlotKey, button: 'left' | 'right' = 'left', shift = false) {
    if (shift) {
      this.quickMoveArmorFromSlot(slotKey);
      return;
    }
    const target = this.armor[slotKey];
    const effectiveButton = button === 'right' ? 'left' : button;

    if (effectiveButton === 'left') {
      if (!this.cursor) {
        if (!target) return;
        this.cursor = { ...target };
        this.armor[slotKey] = null;
        return;
      }
      if (!target) {
        if (!this.canPlaceInArmorSlot(this.cursor.itemId, slotKey)) return;
        this.armor[slotKey] = { ...this.cursor };
        this.cursor = null;
        return;
      }
      if (!this.canPlaceInArmorSlot(this.cursor.itemId, slotKey)) return;
      this.armor[slotKey] = { ...this.cursor };
      this.cursor = { ...target };
    }
  }

  collectSimilarArmor(slotKey: ArmorSlotKey) {
    const clicked = this.armor[slotKey];
    if (!this.cursor) {
      if (!clicked) return;
      this.cursor = { ...clicked };
      this.armor[slotKey] = null;
      return;
    }
    if (clicked && !this.canStack(this.cursor, clicked)) return;
    if (!clicked) return;
    const maxStack = this.getMaxStack(this.cursor.itemId);
    if (this.cursor.count >= maxStack) return;
    const take = Math.min(clicked.count, maxStack - this.cursor.count);
    this.cursor.count += take;
    clicked.count -= take;
    this.armor[slotKey] = clicked.count > 0 ? clicked : null;
  }

  clickSlot(index: number, button: 'left' | 'right' = 'left', shift = false) {
    if (index < 0 || index >= this.size) return;
    if (shift) {
      this.quickMove(index);
      return;
    }
    const target = this.slots[index];

    if (button === 'left') {
      if (!this.cursor) {
        this.cursor = target ? { ...target } : null;
        this.slots[index] = null;
        return;
      }
      if (!target) {
        this.slots[index] = { ...this.cursor };
        this.cursor = null;
        return;
      }
      if (this.tryMergeCursorIntoSlot(index)) {
        return;
      }
      this.slots[index] = { ...this.cursor };
      this.cursor = { ...target };
      return;
    }

    // right click behavior
    if (!this.cursor) {
      if (!target) return;
      const take = Math.ceil(target.count / 2);
      this.cursor = { ...target, count: take };
      const remaining = target.count - take;
      this.slots[index] = remaining > 0 ? { ...target, count: remaining } : null;
      return;
    }
    if (!target) {
      this.slots[index] = { ...this.cursor, count: 1 };
      this.cursor.count -= 1;
      if (this.cursor.count <= 0) this.cursor = null;
      return;
    }
    if (!this.canStack(target, this.cursor)) return;
    const maxStack = this.getMaxStack(target.itemId);
    if (target.count >= maxStack) return;
    target.count += 1;
    this.slots[index] = target;
    this.cursor.count -= 1;
    if (this.cursor.count <= 0) this.cursor = null;
  }

  stowCursor() {
    if (!this.cursor || this.cursor.count <= 0) {
      this.cursor = null;
      return;
    }
    const incoming = { ...this.cursor };
    const maxStack = this.getMaxStack(incoming.itemId);

    for (let i = 0; i < this.size && incoming.count > 0; i++) {
      const slot = this.slots[i];
      if (!slot || !this.canStack(slot, incoming) || slot.count >= maxStack) continue;
      const add = Math.min(incoming.count, maxStack - slot.count);
      slot.count += add;
      incoming.count -= add;
    }
    for (let i = 0; i < this.size && incoming.count > 0; i++) {
      if (this.slots[i]) continue;
      const add = Math.min(incoming.count, maxStack);
      this.slots[i] = {
        itemId: incoming.itemId,
        count: add,
        durability: incoming.durability,
      };
      incoming.count -= add;
    }
    this.cursor = incoming.count > 0 ? incoming : null;
  }

  collectSimilar(index: number) {
    if (index < 0 || index >= this.size) return;
    const clicked = this.slots[index];
    if (!this.cursor) {
      if (!clicked) return;
      this.cursor = { ...clicked };
      this.slots[index] = null;
    } else if (clicked && !this.canStack(this.cursor, clicked)) {
      return;
    }
    if (!this.cursor) return;
    const maxStack = this.getMaxStack(this.cursor.itemId);
    if (this.cursor.count >= maxStack) return;

    for (let i = 0; i < this.size && this.cursor.count < maxStack; i++) {
      const slot = this.slots[i];
      if (!slot || !this.canStack(slot, this.cursor)) continue;
      const take = Math.min(slot.count, maxStack - this.cursor.count);
      this.cursor.count += take;
      slot.count -= take;
      this.slots[i] = slot.count > 0 ? slot : null;
    }
  }

  private tryMergeCursorIntoSlot(index: number): boolean {
    if (!this.cursor) return false;
    const slot = this.slots[index];
    if (!slot || !this.canStack(slot, this.cursor)) return false;
    const maxStack = this.getMaxStack(slot.itemId);
    if (slot.count >= maxStack) return false;
    const add = Math.min(this.cursor.count, maxStack - slot.count);
    slot.count += add;
    this.cursor.count -= add;
    this.slots[index] = slot;
    if (this.cursor.count <= 0) this.cursor = null;
    return true;
  }

  private canStack(a: InventorySlot, b: InventorySlot): boolean {
    return a.itemId === b.itemId && (a.durability ?? undefined) === (b.durability ?? undefined);
  }

  private getMaxStack(itemId: number): number {
    return getItemDef(itemId)?.stackSize ?? 64;
  }

  private quickMove(index: number) {
    const source = this.slots[index];
    if (!source) return;
    const armorKey = getItemArmorSlot(source.itemId);
    if (armorKey != null) {
      const dest = this.armor[armorKey];
      if (!dest) {
        this.armor[armorKey] = { ...source, count: 1 };
        if (source.count <= 1) this.slots[index] = null;
        else source.count -= 1;
        return;
      }
    }
    const targetIndexes = index < 9
      ? Array.from({ length: this.size - 9 }, (_, i) => i + 9)
      : Array.from({ length: Math.min(9, this.size) }, (_, i) => i);
    const moving = { ...source };
    const maxStack = this.getMaxStack(moving.itemId);

    for (const targetIndex of targetIndexes) {
      if (moving.count <= 0) break;
      const slot = this.slots[targetIndex];
      if (!slot || !this.canStack(slot, moving) || slot.count >= maxStack) continue;
      const add = Math.min(moving.count, maxStack - slot.count);
      slot.count += add;
      moving.count -= add;
      this.slots[targetIndex] = slot;
    }
    for (const targetIndex of targetIndexes) {
      if (moving.count <= 0) break;
      if (this.slots[targetIndex]) continue;
      const add = Math.min(moving.count, maxStack);
      this.slots[targetIndex] = {
        itemId: moving.itemId,
        count: add,
        durability: moving.durability,
      };
      moving.count -= add;
    }
    this.slots[index] = moving.count > 0
      ? { itemId: moving.itemId, count: moving.count, durability: moving.durability }
      : null;
  }

  private quickMoveArmorFromSlot(slotKey: ArmorSlotKey) {
    const source = this.armor[slotKey];
    if (!source) return;
    const targetIndexes = [
      ...Array.from({ length: this.size - 9 }, (_, i) => i + 9),
      ...Array.from({ length: Math.min(9, this.size) }, (_, i) => i),
    ];
    const moving = { ...source };
    const maxStack = this.getMaxStack(moving.itemId);

    for (const targetIndex of targetIndexes) {
      if (moving.count <= 0) break;
      const slot = this.slots[targetIndex];
      if (!slot || !this.canStack(slot, moving) || slot.count >= maxStack) continue;
      const add = Math.min(moving.count, maxStack - slot.count);
      slot.count += add;
      moving.count -= add;
      this.slots[targetIndex] = slot;
    }
    for (const targetIndex of targetIndexes) {
      if (moving.count <= 0) break;
      if (this.slots[targetIndex]) continue;
      const add = Math.min(moving.count, maxStack);
      this.slots[targetIndex] = {
        itemId: moving.itemId,
        count: add,
        durability: moving.durability,
      };
      moving.count -= add;
    }
    this.armor[slotKey] = moving.count > 0
      ? { itemId: moving.itemId, count: moving.count, durability: moving.durability }
      : null;
  }

  /** Crafting-table grid (3×3): same click rules as player slots; shift moves into main inv then hotbar. */
  clickCraftTableSlot(grid: (InventorySlot | null)[], index: number, button: 'left' | 'right' = 'left', shift = false) {
    if (index < 0 || index >= grid.length) return;
    if (shift) {
      this.quickMoveCraftTableToPlayer(grid, index);
      return;
    }
    const target = grid[index];

    if (button === 'left') {
      if (!this.cursor) {
        this.cursor = target ? { ...target } : null;
        grid[index] = null;
        return;
      }
      if (!target) {
        grid[index] = { ...this.cursor };
        this.cursor = null;
        return;
      }
      if (this.tryMergeCursorIntoCraftCell(grid, index)) {
        return;
      }
      grid[index] = { ...this.cursor };
      this.cursor = { ...target };
      return;
    }

    if (!this.cursor) {
      if (!target) return;
      const take = Math.ceil(target.count / 2);
      this.cursor = { ...target, count: take };
      const remaining = target.count - take;
      grid[index] = remaining > 0 ? { ...target, count: remaining } : null;
      return;
    }
    if (!target) {
      grid[index] = { ...this.cursor, count: 1 };
      this.cursor.count -= 1;
      if (this.cursor.count <= 0) this.cursor = null;
      return;
    }
    if (!this.canStack(target, this.cursor)) return;
    const maxStack = this.getMaxStack(target.itemId);
    if (target.count >= maxStack) return;
    target.count += 1;
    grid[index] = target;
    this.cursor.count -= 1;
    if (this.cursor.count <= 0) this.cursor = null;
  }

  collectSimilarCraftTable(grid: (InventorySlot | null)[], index: number) {
    if (index < 0 || index >= grid.length) return;
    const clicked = grid[index];
    if (!this.cursor) {
      if (!clicked) return;
      this.cursor = { ...clicked };
      grid[index] = null;
    } else if (clicked && !this.canStack(this.cursor, clicked)) {
      return;
    }
    if (!this.cursor) return;
    const maxStack = this.getMaxStack(this.cursor.itemId);
    if (this.cursor.count >= maxStack) return;

    for (let i = 0; i < grid.length && this.cursor.count < maxStack; i++) {
      const slot = grid[i];
      if (!slot || !this.canStack(slot, this.cursor)) continue;
      const take = Math.min(slot.count, maxStack - this.cursor.count);
      this.cursor.count += take;
      slot.count -= take;
      grid[i] = slot.count > 0 ? slot : null;
    }
  }

  /** Returns items that did not fit back into the same grid cells. */
  stowCraftTableGrid(grid: (InventorySlot | null)[]) {
    for (let i = 0; i < grid.length; i++) {
      const cell = grid[i];
      if (!cell) continue;
      let incoming = { ...cell };
      grid[i] = null;
      const maxStack = this.getMaxStack(incoming.itemId);
      for (let j = 0; j < this.size && incoming.count > 0; j++) {
        const slot = this.slots[j];
        if (!slot || !this.canStack(slot, incoming) || slot.count >= maxStack) continue;
        const add = Math.min(incoming.count, maxStack - slot.count);
        slot.count += add;
        incoming.count -= add;
      }
      for (let j = 0; j < this.size && incoming.count > 0; j++) {
        if (this.slots[j]) continue;
        const add = Math.min(incoming.count, maxStack);
        this.slots[j] = {
          itemId: incoming.itemId,
          count: add,
          durability: incoming.durability,
        };
        incoming.count -= add;
      }
      if (incoming.count > 0) grid[i] = incoming;
    }
  }

  private tryMergeCursorIntoCraftCell(grid: (InventorySlot | null)[], index: number): boolean {
    if (!this.cursor) return false;
    const slot = grid[index];
    if (!slot || !this.canStack(slot, this.cursor)) return false;
    const maxStack = this.getMaxStack(slot.itemId);
    if (slot.count >= maxStack) return false;
    const add = Math.min(this.cursor.count, maxStack - slot.count);
    slot.count += add;
    this.cursor.count -= add;
    grid[index] = slot;
    if (this.cursor.count <= 0) this.cursor = null;
    return true;
  }

  private quickMoveCraftTableToPlayer(grid: (InventorySlot | null)[], index: number) {
    const source = grid[index];
    if (!source) return;
    const targetIndexes = [
      ...Array.from({ length: this.size - 9 }, (_, i) => i + 9),
      ...Array.from({ length: Math.min(9, this.size) }, (_, i) => i),
    ];
    const moving = { ...source };
    const maxStack = this.getMaxStack(moving.itemId);

    for (const targetIndex of targetIndexes) {
      if (moving.count <= 0) break;
      const slot = this.slots[targetIndex];
      if (!slot || !this.canStack(slot, moving) || slot.count >= maxStack) continue;
      const add = Math.min(moving.count, maxStack - slot.count);
      slot.count += add;
      moving.count -= add;
      this.slots[targetIndex] = slot;
    }
    for (const targetIndex of targetIndexes) {
      if (moving.count <= 0) break;
      if (this.slots[targetIndex]) continue;
      const add = Math.min(moving.count, maxStack);
      this.slots[targetIndex] = {
        itemId: moving.itemId,
        count: add,
        durability: moving.durability,
      };
      moving.count -= add;
    }
    grid[index] = moving.count > 0
      ? { itemId: moving.itemId, count: moving.count, durability: moving.durability }
      : null;
  }
}

export function getAvailableRecipes(inventory: Inventory): CraftingRecipe[] {
  return CRAFTING_RECIPES.filter((r) => r.inputs.every((i) => inventory.hasItem(i.itemId, i.count)));
}

export function craft(inventory: Inventory, recipeIndex: number): boolean {
  const recipe = CRAFTING_RECIPES[recipeIndex];
  if (!recipe) return false;
  if (!recipe.inputs.every((i) => inventory.hasItem(i.itemId, i.count))) return false;
  for (const input of recipe.inputs) inventory.removeItem(input.itemId, input.count);
  inventory.addItem(recipe.output.itemId, recipe.output.count);
  return true;
}
