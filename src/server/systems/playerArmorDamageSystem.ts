import { getItemMaxDurability } from '#/common/ItemRegistry';
import type { PlayerArmorSlots } from '#/common/types';
import { ARMOR_SLOT_KEYS } from '#/common/types';

/** Minecraft-style simplified mitigation: damage *= (1 - min(20, armorPoints) / 25). */
export function mitigateDamageWithArmor(rawDamage: number, armorPoints: number): number {
  const capped = Math.min(20, Math.max(0, armorPoints));
  return rawDamage * (1 - capped / 25);
}

/** Lose 1 durability on a random non-empty armor piece. Returns true if armor state changed. */
export function damageRandomEquippedArmorPiece(armor: PlayerArmorSlots): boolean {
  const occupied = ARMOR_SLOT_KEYS.filter((k) => armor[k] != null);
  if (occupied.length === 0) return false;
  const rawIdx = Math.floor(Math.random() * occupied.length);
  const idx = Math.min(occupied.length - 1, Math.max(0, rawIdx));
  const pick = occupied[idx]!;
  const slot = armor[pick];
  if (!slot) return false;
  const maxD = getItemMaxDurability(slot.itemId);
  if (maxD == null) return false;
  const next = (slot.durability ?? maxD) - 1;
  if (next <= 0) {
    armor[pick] = null;
  } else {
    armor[pick] = { ...slot, durability: next };
  }
  return true;
}
