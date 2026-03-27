import { BlockTypes as B } from '#/block/BlockRegistry';
import { getSmeltingRecipe, getFuelBurnTime } from '#/common/SmeltingRegistry';
import { canStack, getItemDef, getItemMaxDurability, getMaxStack } from '#/common/ItemRegistry';
import type { GameContext } from '#/common/GameContext';
import type { InventorySlot } from '#/common/types';
import type { Inventory } from '../Inventory';
import type { GameServer } from '../GameServer';

export type FurnaceTileState = {
  inputSlot: InventorySlot | null;
  fuelSlot: InventorySlot | null;
  outputSlot: InventorySlot | null;
  burnTimeLeft: number;
  burnTimeTotal: number;
  cookProgress: number;
  cookTimeTotal: number;
  tickAccumulator: number;
};

export function furnaceKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function emptyTile(): FurnaceTileState {
  return {
    inputSlot: null,
    fuelSlot: null,
    outputSlot: null,
    burnTimeLeft: 0,
    burnTimeTotal: 0,
    cookProgress: 0,
    cookTimeTotal: 200,
    tickAccumulator: 0,
  };
}

function canAcceptOutput(output: InventorySlot | null, recipe: { output: number; outputCount: number }): boolean {
  if (!output) return true;
  if (output.itemId !== recipe.output) return false;
  const maxStack = getMaxStack(recipe.output);
  return output.count + recipe.outputCount <= maxStack;
}

function tryMergeCursorIntoSlot(
  cursor: InventorySlot,
  target: InventorySlot,
): { cursor: InventorySlot | null; target: InventorySlot | null } {
  if (!canStack(target, cursor)) return { cursor, target };
  const maxStack = getMaxStack(target.itemId);
  if (target.count >= maxStack) return { cursor, target };
  const add = Math.min(cursor.count, maxStack - target.count);
  target.count += add;
  let nextCursor: InventorySlot | null = { ...cursor, count: cursor.count - add };
  if (nextCursor.count <= 0) nextCursor = null;
  return { cursor: nextCursor, target: target.count > 0 ? target : null };
}

function consumeOneFromSlot(slot: InventorySlot | null): InventorySlot | null {
  if (!slot || slot.count <= 0) return slot;
  const next = { ...slot, count: slot.count - 1 };
  return next.count > 0 ? next : null;
}

function applySmelt(tile: FurnaceTileState, recipe: { output: number; outputCount: number }): void {
  const maxDurability = getItemMaxDurability(recipe.output);
  const produced: InventorySlot = {
    itemId: recipe.output,
    count: recipe.outputCount,
    ...(maxDurability != null ? { durability: maxDurability } : {}),
  };
  if (!tile.outputSlot) {
    tile.outputSlot = produced;
  } else {
    tile.outputSlot.count += recipe.outputCount;
  }
  tile.inputSlot = consumeOneFromSlot(tile.inputSlot);
}

function stepFurnaceMcTick(tile: FurnaceTileState): void {
  const inputId = tile.inputSlot?.itemId;
  const recipe = inputId != null ? getSmeltingRecipe(inputId) : null;
  const canSmeltNow = recipe != null && canAcceptOutput(tile.outputSlot, recipe);

  const wasBurning = tile.burnTimeLeft > 0;

  if (wasBurning && canSmeltNow && recipe) {
    tile.cookTimeTotal = recipe.cookTime;
    tile.cookProgress += 1;
    if (tile.cookProgress >= recipe.cookTime) {
      applySmelt(tile, recipe);
      tile.cookProgress = 0;
    }
  } else {
    tile.cookProgress = 0;
  }

  if (wasBurning) {
    tile.burnTimeLeft -= 1;
  }

  if (tile.burnTimeLeft <= 0 && canSmeltNow && tile.fuelSlot) {
    const burn = getFuelBurnTime(tile.fuelSlot.itemId);
    if (burn > 0) {
      tile.burnTimeLeft += burn;
      tile.burnTimeTotal = burn;
      tile.fuelSlot = consumeOneFromSlot(tile.fuelSlot);
    }
  }
}

function tryMergeCursorIntoFurnaceCell(inventory: Inventory, target: InventorySlot): boolean {
  const cur = inventory.cursor;
  if (!cur || !canStack(target, cur)) return false;
  const maxStack = getMaxStack(target.itemId);
  if (target.count >= maxStack) return false;
  const add = Math.min(cur.count, maxStack - target.count);
  target.count += add;
  cur.count -= add;
  if (cur.count <= 0) inventory.cursor = null;
  return true;
}

function clickNormalFurnaceSlot(
  inventory: Inventory,
  tile: FurnaceTileState,
  key: 'inputSlot' | 'fuelSlot',
  button: 'left' | 'right',
): void {
  const target = tile[key];

  if (button === 'left') {
    if (!inventory.cursor) {
      inventory.cursor = target ? { ...target } : null;
      tile[key] = null;
      return;
    }
    if (!target) {
      tile[key] = { ...inventory.cursor };
      inventory.cursor = null;
      return;
    }
    if (tryMergeCursorIntoFurnaceCell(inventory, target)) {
      tile[key] = target;
      return;
    }
    tile[key] = { ...inventory.cursor };
    inventory.cursor = { ...target };
    return;
  }

  if (!inventory.cursor) {
    if (!target) return;
    const take = Math.ceil(target.count / 2);
    inventory.cursor = { ...target, count: take };
    const remaining = target.count - take;
    tile[key] = remaining > 0 ? { ...target, count: remaining } : null;
    return;
  }
  if (!target) {
    tile[key] = { ...inventory.cursor, count: 1 };
    inventory.cursor.count -= 1;
    if (inventory.cursor.count <= 0) inventory.cursor = null;
    return;
  }
  if (!canStack(target, inventory.cursor)) return;
  const maxStack = getMaxStack(target.itemId);
  if (target.count >= maxStack) return;
  target.count += 1;
  tile[key] = target;
  inventory.cursor.count -= 1;
  if (inventory.cursor.count <= 0) inventory.cursor = null;
}

function clickOutputFurnaceSlot(inventory: Inventory, tile: FurnaceTileState, button: 'left' | 'right'): void {
  const target = tile.outputSlot;
  const cur = inventory.cursor;

  if (button === 'left') {
    if (!cur) {
      if (!target) return;
      inventory.cursor = { ...target };
      tile.outputSlot = null;
      return;
    }
    if (!target) return;
    if (!canStack(cur, target)) return;
    const maxStack = getMaxStack(target.itemId);
    const add = Math.min(target.count, maxStack - cur.count);
    if (add <= 0) return;
    cur.count += add;
    target.count -= add;
    tile.outputSlot = target.count > 0 ? target : null;
    return;
  }

  if (!cur) {
    if (!target) return;
    const take = Math.ceil(target.count / 2);
    inventory.cursor = { ...target, count: take };
    target.count -= take;
    tile.outputSlot = target.count > 0 ? target : null;
    return;
  }
  if (!target) return;
  if (!canStack(cur, target)) return;
  const maxStack = getMaxStack(target.itemId);
  if (cur.count >= maxStack) return;
  target.count -= 1;
  cur.count += 1;
  tile.outputSlot = target.count > 0 ? target : null;
}

export type FurnaceTileSnapshot = {
  inputSlot: InventorySlot | null;
  fuelSlot: InventorySlot | null;
  outputSlot: InventorySlot | null;
  burnTimeLeft: number;
  burnTimeTotal: number;
  cookProgress: number;
  cookTimeTotal: number;
};

/** Serializable snapshot of all tile-entity state keyed by position string. */
export type TileEntitySnapshot = {
  furnaces: Array<[string, FurnaceTileSnapshot]>;
  chests?: Array<[string, import('./chestSystem').ChestTileSnapshot]>;
};

export class FurnaceSystem {
  private readonly tiles = new Map<string, FurnaceTileState>();
  activeFurnaceId: string | null = null;

  getTile(id: string): FurnaceTileState | undefined {
    return this.tiles.get(id);
  }

  getOrCreateTile(id: string): FurnaceTileState {
    let t = this.tiles.get(id);
    if (!t) {
      t = emptyTile();
      this.tiles.set(id, t);
    }
    return t;
  }

  snapshotTiles(): Array<[string, FurnaceTileSnapshot]> {
    const out: Array<[string, FurnaceTileSnapshot]> = [];
    for (const [key, tile] of this.tiles) {
      const hasContent = tile.inputSlot || tile.fuelSlot || tile.outputSlot
        || tile.burnTimeLeft > 0 || tile.cookProgress > 0;
      if (!hasContent) continue;
      out.push([key, {
        inputSlot: tile.inputSlot ? { ...tile.inputSlot } : null,
        fuelSlot: tile.fuelSlot ? { ...tile.fuelSlot } : null,
        outputSlot: tile.outputSlot ? { ...tile.outputSlot } : null,
        burnTimeLeft: tile.burnTimeLeft,
        burnTimeTotal: tile.burnTimeTotal,
        cookProgress: tile.cookProgress,
        cookTimeTotal: tile.cookTimeTotal,
      }]);
    }
    return out;
  }

  loadTiles(entries: Array<[string, FurnaceTileSnapshot]>): void {
    for (const [key, snap] of entries) {
      if (typeof key !== 'string' || !key) continue;
      const tile = this.getOrCreateTile(key);
      tile.inputSlot = snap.inputSlot ?? null;
      tile.fuelSlot = snap.fuelSlot ?? null;
      tile.outputSlot = snap.outputSlot ?? null;
      tile.burnTimeLeft = typeof snap.burnTimeLeft === 'number' ? snap.burnTimeLeft : 0;
      tile.burnTimeTotal = typeof snap.burnTimeTotal === 'number' ? snap.burnTimeTotal : 0;
      tile.cookProgress = typeof snap.cookProgress === 'number' ? snap.cookProgress : 0;
      tile.cookTimeTotal = typeof snap.cookTimeTotal === 'number' ? snap.cookTimeTotal : 200;
      tile.tickAccumulator = 0;
    }
  }

  openFurnace(server: GameServer, x: number, y: number, z: number): void {
    if (!server.isBlockReachable(x, y, z)) return;
    if (server.world.getBlock(x, y, z) !== B.FURNACE) return;
    const id = furnaceKey(x, y, z);
    this.getOrCreateTile(id);
    this.activeFurnaceId = id;
    const s = server.ctx.state;
    s.ui.furnaceOpen = true;
    s.ui.isLocked = false;
    this.syncFurnaceToState(server.ctx);
    server.ctx.s2c.emit('s2c:openFurnace', { furnaceId: id });
  }

  closeFurnace(server: GameServer): void {
    this.activeFurnaceId = null;
    const s = server.ctx.state.ui;
    s.furnaceOpen = false;
    s.isLocked = true;
    s.everLocked = true;
    this.clearFurnaceState(server.ctx);
    server.inventory.stowCraftTableGrid(server.craftTableGrid);
    server.inventory.stowCursor();
    server.syncInventory();
  }

  clearFurnaceState(ctx: GameContext): void {
    const f = ctx.state.furnace;
    f.inputSlot = null;
    f.fuelSlot = null;
    f.outputSlot = null;
    f.burnTimeLeft = 0;
    f.burnTimeTotal = 0;
    f.cookProgress = 0;
    f.cookTimeTotal = 200;
  }

  syncFurnaceToState(ctx: GameContext): void {
    if (!this.activeFurnaceId) {
      this.clearFurnaceState(ctx);
      return;
    }
    const tile = this.tiles.get(this.activeFurnaceId);
    const f = ctx.state.furnace;
    if (!tile) {
      this.clearFurnaceState(ctx);
      return;
    }
    f.inputSlot = tile.inputSlot ? { ...tile.inputSlot } : null;
    f.fuelSlot = tile.fuelSlot ? { ...tile.fuelSlot } : null;
    f.outputSlot = tile.outputSlot ? { ...tile.outputSlot } : null;
    f.burnTimeLeft = tile.burnTimeLeft;
    f.burnTimeTotal = tile.burnTimeTotal;
    f.cookProgress = tile.cookProgress;
    f.cookTimeTotal = tile.cookTimeTotal;
  }

  click(server: GameServer, slot: 'input' | 'fuel' | 'output', button: 'left' | 'right', shift = false): void {
    if (!this.activeFurnaceId) return;
    const tile = this.tiles.get(this.activeFurnaceId);
    if (!tile) return;
    if (shift) {
      this.shiftClickFurnaceSlot(server.inventory, tile, slot);
      this.syncFurnaceToState(server.ctx);
      server.syncInventory();
      return;
    }
    if (slot === 'output') {
      clickOutputFurnaceSlot(server.inventory, tile, button);
    } else if (slot === 'input') {
      clickNormalFurnaceSlot(server.inventory, tile, 'inputSlot', button);
    } else {
      clickNormalFurnaceSlot(server.inventory, tile, 'fuelSlot', button);
    }
    this.syncFurnaceToState(server.ctx);
    server.syncInventory();
  }

  /** Shift-click a furnace slot: move its contents into the player inventory. */
  private shiftClickFurnaceSlot(
    inventory: Inventory,
    tile: FurnaceTileState,
    slot: 'input' | 'fuel' | 'output',
  ): void {
    const key = slot === 'input' ? 'inputSlot' : slot === 'fuel' ? 'fuelSlot' : 'outputSlot';
    const item = tile[key];
    if (!item) return;
    const placed = inventory.addItemPartial(item.itemId, item.count);
    if (placed === 0) return;
    if (placed >= item.count) {
      tile[key] = null;
    } else {
      tile[key] = { ...item, count: item.count - placed };
    }
  }

  /** Shift-click a player inventory slot while furnace is open: route to input or fuel. */
  shiftClickPlayerToFurnace(inventory: Inventory, playerSlotIndex: number): boolean {
    if (!this.activeFurnaceId) return false;
    const tile = this.tiles.get(this.activeFurnaceId);
    if (!tile) return false;
    const item = inventory.slots[playerSlotIndex];
    if (!item) return false;

    const recipe = getSmeltingRecipe(item.itemId);
    const fuelTime = getFuelBurnTime(item.itemId);
    const isSmeltable = !!recipe;
    const isFuel = fuelTime > 0;
    if (!isSmeltable && !isFuel) return false;
    // Dual-role items (both smeltable and fuel) go to input, matching MC behavior.
    const targetKey: 'inputSlot' | 'fuelSlot' = isSmeltable ? 'inputSlot' : 'fuelSlot';
    const target = tile[targetKey];
    const maxStack = getMaxStack(item.itemId);

    if (!target) {
      tile[targetKey] = { ...item };
      inventory.slots[playerSlotIndex] = null;
      return true;
    }
    if (canStack(target, item) && target.count < maxStack) {
      const transfer = Math.min(item.count, maxStack - target.count);
      tile[targetKey] = { ...target, count: target.count + transfer };
      const remaining = item.count - transfer;
      inventory.slots[playerSlotIndex] = remaining > 0 ? { ...item, count: remaining } : null;
      return transfer > 0;
    }
    return false;
  }

  tick(server: GameServer, dtSeconds: number): void {
    const mcTicks = dtSeconds * 20;
    for (const [, tile] of this.tiles) {
      tile.tickAccumulator += mcTicks;
      let steps = Math.floor(tile.tickAccumulator);
      tile.tickAccumulator -= steps;
      const cap = 64;
      if (steps > cap) {
        tile.tickAccumulator = 0;
        steps = cap;
      }
      for (let i = 0; i < steps; i++) {
        stepFurnaceMcTick(tile);
      }
    }

    if (this.activeFurnaceId) {
      const [fx, fy, fz] = this.activeFurnaceId.split(',').map(Number);
      if (
        !Number.isFinite(fx)
        || !Number.isFinite(fy)
        || !Number.isFinite(fz)
        || server.world.getBlock(fx, fy, fz) !== B.FURNACE
      ) {
        this.closeFurnace(server);
      } else {
        this.syncFurnaceToState(server.ctx);
      }
    }
  }

  spillToWorld(server: GameServer, x: number, y: number, z: number, tile: FurnaceTileState): void {
    const pos = { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
    for (const slot of [tile.inputSlot, tile.fuelSlot, tile.outputSlot]) {
      if (slot && slot.count > 0) {
        server.spawnItemDrop(slot.itemId, slot.count, pos);
      }
    }
  }

  onFurnaceDestroyed(server: GameServer, x: number, y: number, z: number): void {
    const id = furnaceKey(x, y, z);
    const tile = this.tiles.get(id);
    if (tile) {
      this.spillToWorld(server, x, y, z, tile);
    }
    this.tiles.delete(id);
    if (this.activeFurnaceId === id) {
      this.activeFurnaceId = null;
      server.ctx.state.ui.furnaceOpen = false;
      this.clearFurnaceState(server.ctx);
      server.inventory.stowCraftTableGrid(server.craftTableGrid);
      server.inventory.stowCursor();
      server.syncInventory();
    }
  }
}
