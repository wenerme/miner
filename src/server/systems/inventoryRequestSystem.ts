import type { ArmorSlotKey } from '#/common/types';
import { ARMOR_SLOT_KEYS } from '#/common/types';

export type InventoryClickArea = 'player' | 'craftTable' | 'craftResult';

/** Virtual armor slots use indices `inventorySize` .. `inventorySize + 3` (helmet → boots). */
export const PLAYER_ARMOR_UI_SLOT_COUNT = ARMOR_SLOT_KEYS.length;

export function armorUiIndexToKey(index: number, inventorySize: number): ArmorSlotKey | null {
  if (index < inventorySize || index >= inventorySize + PLAYER_ARMOR_UI_SLOT_COUNT) return null;
  return ARMOR_SLOT_KEYS[index - inventorySize] ?? null;
}

/** Offhand slot occupies the index right after the 4 armor slots. */
export function isOffhandUiIndex(index: number, inventorySize: number): boolean {
  return index === inventorySize + PLAYER_ARMOR_UI_SLOT_COUNT;
}

const TOTAL_PLAYER_VIRTUAL_SLOTS = PLAYER_ARMOR_UI_SLOT_COUNT + 1;

export interface InventoryClickRequest {
  area: InventoryClickArea;
  index: number;
  button: 'left' | 'right';
  shift: boolean;
}

function resolveClickArea(raw: unknown): InventoryClickArea {
  if (raw === 'craftTable' || raw === 'craftResult') return raw;
  return 'player';
}

export function resolveInventoryClickRequest(input: {
  index: number;
  button: unknown;
  shift: unknown;
  inventorySize: number;
  area?: unknown;
}): InventoryClickRequest | null {
  const { index, button, shift, inventorySize } = input;
  const area = resolveClickArea(input.area);
  const resolvedButton: 'left' | 'right' = button === 'right' ? 'right' : 'left';
  const shiftBool = Boolean(shift);

  if (area === 'craftResult') {
    return { area: 'craftResult', index: 0, button: resolvedButton, shift: shiftBool };
  }

  const resolvedIndex = Number.isFinite(index) ? Math.floor(index) : Number.NaN;
  const max = area === 'craftTable' ? 9 : inventorySize + TOTAL_PLAYER_VIRTUAL_SLOTS;
  if (Number.isNaN(resolvedIndex) || resolvedIndex < 0 || resolvedIndex >= max) {
    return null;
  }
  return {
    area,
    index: resolvedIndex,
    button: resolvedButton,
    shift: shiftBool,
  };
}

export function resolveInventoryCollectIndex(input: {
  index: number;
  inventorySize: number;
  area?: unknown;
}): number | null {
  const { index, inventorySize } = input;
  const area = resolveClickArea(input.area);
  const resolvedIndex = Number.isFinite(index) ? Math.floor(index) : Number.NaN;
  const max = area === 'craftTable' ? 9 : inventorySize + TOTAL_PLAYER_VIRTUAL_SLOTS;
  if (Number.isNaN(resolvedIndex) || resolvedIndex < 0 || resolvedIndex >= max) {
    return null;
  }
  return resolvedIndex;
}
