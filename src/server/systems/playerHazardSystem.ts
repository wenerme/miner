import { mitigateDamageWithArmor } from './playerArmorDamageSystem';

const LAVA_DAMAGE = 4;
const LAVA_HURT_COOLDOWN_MS = 500;
const PLAYER_MAX_AIR_MS = 10_000;
const PLAYER_AIR_RECOVER_PER_SEC = 4_000;
const DROWNING_DAMAGE = 2;
const DROWNING_HURT_COOLDOWN_MS = 700;
const FALL_DAMAGE_SPEED_THRESHOLD = 12;
const FALL_HURT_COOLDOWN_MS = 500;

export interface HazardPlayerState {
  hp: number;
  maxHp: number;
  airMs: number;
  hurtCooldownMs: number;
}

export interface TickPlayerHazardsInput {
  player: HazardPlayerState;
  realDt: number;
  touchingLava: boolean;
  headInWater: boolean;
  headInLava: boolean;
  /** Sum of equipped armor points; when set, lava/drowning damage is mitigated. */
  armorPoints?: number;
  /** After HP loss from mitigated environmental damage (lava/drowning), roll armor durability. */
  onMitigatedEnvironmentalDamage?: () => void;
}

export interface TickPlayerHazardsResult {
  messages: string[];
  didDie: boolean;
}

export interface ApplyFallImpactInput {
  player: HazardPlayerState;
  landingImpactSpeed: number;
  flying: boolean;
  noclip: boolean;
  /** True when any part of the player (feet, body, or head) is in water. */
  inWater: boolean;
  armorPoints?: number;
  onMitigatedFallDamage?: () => void;
}

export interface ApplyFallImpactResult {
  message: string | null;
  didDie: boolean;
}

export function tickPlayerHazards(input: TickPlayerHazardsInput): TickPlayerHazardsResult {
  const { player, realDt, touchingLava, headInWater, headInLava } = input;
  const messages: string[] = [];
  const ap = input.armorPoints ?? 0;

  if (player.hurtCooldownMs <= 0 && touchingLava) {
    const raw = LAVA_DAMAGE;
    const mitigated = ap > 0 ? mitigateDamageWithArmor(raw, ap) : raw;
    const dealt = Math.max(0, Math.floor(mitigated));
    if (dealt > 0) {
      player.hp = Math.max(0, player.hp - dealt);
      player.hurtCooldownMs = LAVA_HURT_COOLDOWN_MS;
      messages.push(`§cLava burns! (${player.hp}/${player.maxHp})`);
      input.onMitigatedEnvironmentalDamage?.();
    }
  }

  const effectiveHeadInWater = headInWater && !headInLava;
  if (effectiveHeadInWater) {
    player.airMs = Math.max(0, player.airMs - realDt * 1000);
    if (player.airMs <= 0 && player.hurtCooldownMs <= 0 && !touchingLava) {
      const raw = DROWNING_DAMAGE;
      const mitigated = ap > 0 ? mitigateDamageWithArmor(raw, ap) : raw;
      const dealt = Math.max(0, Math.floor(mitigated));
      if (dealt > 0) {
        player.hp = Math.max(0, player.hp - dealt);
        player.hurtCooldownMs = DROWNING_HURT_COOLDOWN_MS;
        messages.push(`§cDrowning! (${player.hp}/${player.maxHp})`);
        input.onMitigatedEnvironmentalDamage?.();
      }
    }
  } else {
    player.airMs = Math.min(PLAYER_MAX_AIR_MS, player.airMs + realDt * PLAYER_AIR_RECOVER_PER_SEC);
  }

  return { messages, didDie: player.hp <= 0 };
}

export function applyFallImpactDamage(input: ApplyFallImpactInput): ApplyFallImpactResult {
  const { player, landingImpactSpeed, flying, noclip, inWater } = input;
  if (flying || noclip || landingImpactSpeed <= FALL_DAMAGE_SPEED_THRESHOLD || player.hurtCooldownMs > 0 || inWater) {
    return { message: null, didDie: player.hp <= 0 };
  }
  const rawDamage = Math.max(1, Math.floor(landingImpactSpeed - FALL_DAMAGE_SPEED_THRESHOLD));
  const ap = input.armorPoints ?? 0;
  const mitigated = ap > 0 ? mitigateDamageWithArmor(rawDamage, ap) : rawDamage;
  const damage = Math.max(0, Math.floor(mitigated));
  if (damage <= 0) {
    return { message: null, didDie: player.hp <= 0 };
  }
  player.hp = Math.max(0, player.hp - damage);
  player.hurtCooldownMs = FALL_HURT_COOLDOWN_MS;
  input.onMitigatedFallDamage?.();
  return {
    message: `§cYou fell ${damage} damage (${player.hp}/${player.maxHp})`,
    didDie: player.hp <= 0,
  };
}
