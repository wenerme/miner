import { canStack, getItemDef, getItemMaxDurability, getMaxStack } from '#/common/ItemRegistry';
import type { GameContext } from '#/common/GameContext';
import type { InventorySlot } from '#/common/types';
import type { Inventory } from '../Inventory';
import type { GameServer } from '../GameServer';

export const CHEST_SLOT_COUNT = 27;

export type ChestTileState = {
  slots: (InventorySlot | null)[];
};

export type ChestTileSnapshot = {
  slots: (InventorySlot | null)[];
};

export function chestKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function emptyChest(): ChestTileState {
  return { slots: new Array(CHEST_SLOT_COUNT).fill(null) };
}

export class ChestSystem {
  private tiles = new Map<string, ChestTileState>();
  private ctx: GameContext;
  private inventory: Inventory;
  private server: GameServer;
  private openChestKey: string | null = null;

  constructor(ctx: GameContext, inventory: Inventory, server: GameServer) {
    this.ctx = ctx;
    this.inventory = inventory;
    this.server = server;
  }

  getOrCreateTile(key: string): ChestTileState {
    let tile = this.tiles.get(key);
    if (!tile) {
      tile = emptyChest();
      this.tiles.set(key, tile);
    }
    return tile;
  }

  getTile(key: string): ChestTileState | undefined {
    return this.tiles.get(key);
  }

  hasTile(key: string): boolean {
    return this.tiles.has(key);
  }

  removeTile(key: string): void {
    this.tiles.delete(key);
  }

  tryOpen(x: number, y: number, z: number): boolean {
    const key = chestKey(x, y, z);
    this.openChestKey = key;
    const tile = this.getOrCreateTile(key);
    const s = this.ctx.state;
    s.ui.chestOpen = true;
    s.ui.isLocked = false;
    s.chest.chestId = key;
    s.chest.slots = [...tile.slots];
    this.ctx.s2c.emit('s2c:openChest', {
      chestId: key,
      slots: [...tile.slots],
    });
    return true;
  }

  handleSlotClick(slotIndex: number, button: 'left' | 'right', shift = false): void {
    if (!this.openChestKey) return;
    const tile = this.tiles.get(this.openChestKey);
    if (!tile) return;

    if (slotIndex < 0 || slotIndex >= CHEST_SLOT_COUNT) return;

    if (shift) {
      this.shiftClickChestSlot(tile, slotIndex);
      this.syncChest();
      return;
    }

    const cur = this.inventory.cursor;
    const chestSlot = tile.slots[slotIndex];

    if (button === 'left') {
      if (!cur && !chestSlot) return;
      if (!cur) {
        this.inventory.cursor = chestSlot;
        tile.slots[slotIndex] = null;
      } else if (!chestSlot) {
        tile.slots[slotIndex] = cur;
        this.inventory.cursor = null;
      } else if (cur.itemId === chestSlot.itemId && (cur.durability ?? undefined) === (chestSlot.durability ?? undefined)) {
        const max = getMaxStack(chestSlot.itemId);
        const space = max - chestSlot.count;
        const transfer = Math.min(cur.count, space);
        if (transfer > 0) {
          tile.slots[slotIndex] = { ...chestSlot, count: chestSlot.count + transfer };
          const remaining = cur.count - transfer;
          this.inventory.cursor = remaining > 0 ? { ...cur, count: remaining } : null;
        } else {
          tile.slots[slotIndex] = cur;
          this.inventory.cursor = chestSlot;
        }
      } else {
        tile.slots[slotIndex] = cur;
        this.inventory.cursor = chestSlot;
      }
    } else {
      if (!cur && chestSlot) {
        const half = Math.ceil(chestSlot.count / 2);
        this.inventory.cursor = { ...chestSlot, count: half };
        const remaining = chestSlot.count - half;
        tile.slots[slotIndex] = remaining > 0 ? { ...chestSlot, count: remaining } : null;
      } else if (cur && !chestSlot) {
        tile.slots[slotIndex] = { ...cur, count: 1 };
        const remaining = cur.count - 1;
        this.inventory.cursor = remaining > 0 ? { ...cur, count: remaining } : null;
      } else if (cur && chestSlot && canStack(cur, chestSlot)) {
        const max = getMaxStack(chestSlot.itemId);
        if (chestSlot.count < max) {
          tile.slots[slotIndex] = { ...chestSlot, count: chestSlot.count + 1 };
          const remaining = cur.count - 1;
          this.inventory.cursor = remaining > 0 ? { ...cur, count: remaining } : null;
        }
      }
    }

    this.syncChest();
  }

  /** Shift-click a chest slot: move item from chest → player inventory. */
  private shiftClickChestSlot(tile: ChestTileState, slotIndex: number): void {
    const item = tile.slots[slotIndex];
    if (!item) return;
    const placed = this.inventory.addItemPartial(item.itemId, item.count);
    if (placed === 0) return;
    if (placed >= item.count) {
      tile.slots[slotIndex] = null;
    } else {
      tile.slots[slotIndex] = { ...item, count: item.count - placed };
    }
  }

  /** Shift-click a player inventory slot while chest is open: move item from player → chest. */
  shiftClickPlayerToChest(playerSlotIndex: number): boolean {
    if (!this.openChestKey) return false;
    const tile = this.tiles.get(this.openChestKey);
    if (!tile) return false;
    const item = this.inventory.slots[playerSlotIndex];
    if (!item) return false;

    let remaining = item.count;
    const maxStack = getMaxStack(item.itemId);

    for (let i = 0; i < CHEST_SLOT_COUNT && remaining > 0; i++) {
      const slot = tile.slots[i];
      if (slot && slot.itemId === item.itemId && (slot.durability ?? undefined) === (item.durability ?? undefined)) {
        const space = maxStack - slot.count;
        if (space > 0) {
          const transfer = Math.min(remaining, space);
          tile.slots[i] = { ...slot, count: slot.count + transfer };
          remaining -= transfer;
        }
      }
    }
    for (let i = 0; i < CHEST_SLOT_COUNT && remaining > 0; i++) {
      if (!tile.slots[i]) {
        const transfer = Math.min(remaining, maxStack);
        tile.slots[i] = { ...item, count: transfer };
        remaining -= transfer;
      }
    }

    if (remaining === 0) {
      this.inventory.slots[playerSlotIndex] = null;
    } else {
      this.inventory.slots[playerSlotIndex] = { ...item, count: remaining };
    }

    this.syncChest();
    return remaining < item.count;
  }

  handleClose(): void {
    this.inventory.stowCraftTableGrid(this.server.craftTableGrid);
    this.inventory.stowCursor();
    this.openChestKey = null;
    const s = this.ctx.state.ui;
    s.chestOpen = false;
    s.isLocked = true;
    s.everLocked = true;
    this.server.syncInventory();
  }

  private syncChest(): void {
    if (!this.openChestKey) return;
    const tile = this.tiles.get(this.openChestKey);
    if (!tile) return;
    const s = this.ctx.state.chest;
    s.slots = [...tile.slots];
    this.ctx.s2c.emit('s2c:openChest', {
      chestId: this.openChestKey,
      slots: [...tile.slots],
    });
    this.server.syncInventory();
  }

  /** Called when the chest block is destroyed — spills items, closes UI if open. */
  onChestDestroyed(x: number, y: number, z: number): InventorySlot[] {
    const key = chestKey(x, y, z);
    const tile = this.tiles.get(key);
    const drops: InventorySlot[] = [];
    if (tile) {
      for (const slot of tile.slots) {
        if (slot) drops.push({ ...slot });
      }
    }
    this.tiles.delete(key);
    if (this.openChestKey === key) {
      this.openChestKey = null;
      this.ctx.state.ui.chestOpen = false;
      this.ctx.state.chest.chestId = '';
      this.ctx.state.chest.slots = [];
      this.inventory.stowCraftTableGrid(this.server.craftTableGrid);
      this.inventory.stowCursor();
      this.server.syncInventory();
    }
    return drops;
  }


  snapshotTiles(): Array<[string, ChestTileSnapshot]> {
    const out: Array<[string, ChestTileSnapshot]> = [];
    for (const [key, tile] of this.tiles) {
      const hasItems = tile.slots.some((s) => s != null);
      if (!hasItems) continue;
      out.push([key, { slots: tile.slots.map((s) => (s ? { ...s } : null)) }]);
    }
    return out;
  }

  loadTiles(entries: Array<[string, ChestTileSnapshot]>): void {
    this.tiles.clear();
    for (const [key, snap] of entries) {
      if (typeof key !== 'string' || !snap || !Array.isArray(snap.slots)) continue;
      const tile = emptyChest();
      for (let i = 0; i < Math.min(snap.slots.length, CHEST_SLOT_COUNT); i++) {
        const s = snap.slots[i];
        if (s && typeof s.itemId === 'number' && typeof s.count === 'number') {
          tile.slots[i] = { itemId: s.itemId, count: s.count, ...(s.durability != null ? { durability: s.durability } : {}) };
        }
      }
      this.tiles.set(key, tile);
    }
  }
}
