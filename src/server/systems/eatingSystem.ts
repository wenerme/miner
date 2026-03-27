import { getItemDef } from '#/common/ItemRegistry';
import type { Inventory } from '../Inventory';

/** MC-like eat duration: 32 ticks @ 20 TPS ≈ 1.6s. */
const EATING_DURATION_TICKS = 32;
const SERVER_LOGIC_TPS = 20;

type EatingState = { ticksLeft: number; slot: number; itemId: number } | null;

export class EatingSystem {
  private state: EatingState = null;
  private tickAccumulator = 0;

  cancel(): void {
    this.state = null;
    this.tickAccumulator = 0;
  }

  handleUseItem(input: {
    selectedIndex: number;
    inventory: Inventory;
    player: { hunger: number; maxHunger: number };
  }): void {
    const { selectedIndex: idx, inventory, player } = input;
    const slot = inventory.slots[idx];
    const itemId = slot?.itemId ?? null;
    const def = getItemDef(itemId);
    if (!def || def.kind !== 'food') return;
    if (itemId == null) return;
    if (player.hunger >= player.maxHunger) return;
    if (this.state && this.state.slot === idx && this.state.itemId === itemId) {
      return;
    }
    this.state = { ticksLeft: EATING_DURATION_TICKS, slot: idx, itemId };
    this.tickAccumulator = 0;
  }

  tick(
    realDt: number,
    input: {
      selectedIndex: number;
      inventory: Inventory;
      player: { hunger: number; maxHunger: number; saturation: number };
      syncInventory: () => void;
    },
  ): void {
    if (!this.state) return;
    if (input.selectedIndex !== this.state.slot) {
      this.cancel();
      return;
    }
    this.tickAccumulator += realDt;
    const period = 1 / SERVER_LOGIC_TPS;
    while (this.tickAccumulator >= period && this.state) {
      this.tickAccumulator -= period;
      this.state.ticksLeft -= 1;
      if (this.state.ticksLeft <= 0) {
        this.finish(input);
        break;
      }
    }
  }

  private finish(input: {
    selectedIndex: number;
    inventory: Inventory;
    player: { hunger: number; maxHunger: number; saturation: number };
    syncInventory: () => void;
  }): void {
    const st = this.state;
    this.cancel();
    if (!st) return;
    if (input.selectedIndex !== st.slot) return;
    const { player, inventory } = input;
    if (player.hunger >= player.maxHunger) return;
    const slot = inventory.slots[st.slot];
    if (!slot || slot.itemId !== st.itemId) return;
    const foodDef = getItemDef(slot.itemId);
    if (!foodDef || foodDef.kind !== 'food' || foodDef.nutrition == null) return;
    player.hunger = Math.min(player.maxHunger, player.hunger + foodDef.nutrition);
    const sat = foodDef.saturationModifier ?? 0;
    player.saturation = Math.min(player.maxHunger, player.saturation + sat);
    if (slot.count > 1) {
      slot.count -= 1;
    } else {
      inventory.slots[st.slot] = null;
    }
    input.syncInventory();
  }
}
