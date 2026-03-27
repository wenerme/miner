import { PLAYER_SPEED } from '#/common/types';

/** Lose 1 saturation (or 1 hunger if saturation empty) per this many walk-speed-equivalent seconds of movement. */
export const SECONDS_MOVEMENT_PER_FOOD_POINT = 60;
export const SPRINT_HUNGER_MOVE_MULT = 2;
export const HEALTH_REGEN_INTERVAL_SEC = 4;
export const STARVATION_DAMAGE_INTERVAL_SEC = 4;
/** Passive hunger drain: 1 point every N real seconds even while standing still. */
export const PASSIVE_HUNGER_DRAIN_INTERVAL_SEC = 120;

export interface SurvivalTickPlayer {
  hp: number;
  maxHp: number;
  hunger: number;
  maxHunger: number;
  saturation: number;
}

export interface TickPlayerSurvivalInput {
  player: SurvivalTickPlayer;
  realDt: number;
  /** Horizontal distance moved since last survival tick (blocks), sprint already baked in. */
  moveDistanceBlocks: number;
  creative: boolean;
  flying: boolean;
  /** When true, passive hunger drains 2x faster. */
  isNightTime?: boolean;
}

export interface SurvivalAccumulators {
  /** Leftover walk-equivalent seconds toward the next food drain (sub-minute carry). */
  hungerMoveCarrySec: number;
  regenTimer: number;
  starvationTimer: number;
  /** Passive hunger drain timer (real seconds). */
  passiveHungerTimer: number;
}

export function createSurvivalAccumulators(): SurvivalAccumulators {
  return { hungerMoveCarrySec: 0, regenTimer: 0, starvationTimer: 0, passiveHungerTimer: 0 };
}

/**
 * Hunger from movement, natural regen when hunger &gt; 17, starvation when hunger is 0.
 */
export function advancePlayerSurvival(acc: SurvivalAccumulators, input: TickPlayerSurvivalInput): void {
  const { player, realDt, creative, flying } = input;

  if (creative || flying) {
    acc.hungerMoveCarrySec = 0;
    acc.regenTimer = 0;
    acc.starvationTimer = 0;
    acc.passiveHungerTimer = 0;
    return;
  }

  const passiveDrainInterval = input.isNightTime ? PASSIVE_HUNGER_DRAIN_INTERVAL_SEC / 2 : PASSIVE_HUNGER_DRAIN_INTERVAL_SEC;
  acc.passiveHungerTimer += realDt;
  while (acc.passiveHungerTimer >= passiveDrainInterval && (player.saturation > 0 || player.hunger > 0)) {
    acc.passiveHungerTimer -= passiveDrainInterval;
    if (player.saturation >= 1) {
      player.saturation -= 1;
    } else {
      player.hunger = Math.max(0, player.hunger - 1);
    }
  }

  const moveDist = input.moveDistanceBlocks;
  let sec = moveDist / Math.max(1e-6, PLAYER_SPEED) + acc.hungerMoveCarrySec;

  while (sec >= SECONDS_MOVEMENT_PER_FOOD_POINT && (player.saturation > 0 || player.hunger > 0)) {
    sec -= SECONDS_MOVEMENT_PER_FOOD_POINT;
    if (player.saturation >= 1) {
      player.saturation -= 1;
    } else {
      player.hunger = Math.max(0, player.hunger - 1);
    }
  }

  acc.hungerMoveCarrySec = sec;

  player.hunger = Math.max(0, Math.min(player.maxHunger, player.hunger));
  player.saturation = Math.max(0, Math.min(player.maxHunger, player.saturation));

  if (player.hunger <= 0) {
    acc.starvationTimer += realDt;
    acc.regenTimer = 0;
    while (acc.starvationTimer >= STARVATION_DAMAGE_INTERVAL_SEC) {
      acc.starvationTimer -= STARVATION_DAMAGE_INTERVAL_SEC;
      player.hp = Math.max(0, player.hp - 1);
    }
  } else {
    acc.starvationTimer = 0;
    if (player.hunger > 17 && player.hp < player.maxHp) {
      acc.regenTimer += realDt;
      while (acc.regenTimer >= HEALTH_REGEN_INTERVAL_SEC) {
        acc.regenTimer -= HEALTH_REGEN_INTERVAL_SEC;
        player.hp = Math.min(player.maxHp, player.hp + 1);
      }
    } else {
      acc.regenTimer = 0;
    }
  }
}
