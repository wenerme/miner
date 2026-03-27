import { createEntity, type Entity } from '#/entity/Entity';
import { ENTITY_DEFS, NPC_INTERACTION_PROFILES, type NpcTradeOffer } from '#/entity/EntityDefs';
import { BlockTypes } from '#/block/BlockRegistry';
import type { GameContext } from '#/common/GameContext';
import { selectBiome } from '#/common/BiomeRegistry';
import { fractalNoise2d } from '#/common/Noise';
import {
  HEAT_PARAMS,
  HUMIDITY_PARAMS,
  MOUNTAIN_PARAMS,
  TERRAIN_PARAMS,
} from './World';
import {
  CHUNK_SIZE,
  GRAVITY,
  JUMP_VELOCITY,
  resolveItemId,
  type EntityInteractionAction,
  type ToolType,
  type Vec3,
} from '#/common/types';
import type { World } from './World';
const B = BlockTypes;
export const VILLAGER_PROFESSIONS = [
  'farmer',
  'librarian',
  'cleric',
  'fletcher',
  'cartographer',
  'fisherman',
  'shepherd',
  'toolsmith',
  'weaponsmith',
  'armorer',
] as const;

const VILLAGER_PROFESSION_ALIASES: Record<string, (typeof VILLAGER_PROFESSIONS)[number]> = {
  blacksmith: 'armorer',
  smith: 'armorer',
  weaponsmith: 'weaponsmith',
  toolsmith: 'toolsmith',
  armor: 'armorer',
};

export function normalizeVillagerProfession(input: string): (typeof VILLAGER_PROFESSIONS)[number] | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;
  if ((VILLAGER_PROFESSIONS as readonly string[]).includes(value)) {
    return value as (typeof VILLAGER_PROFESSIONS)[number];
  }
  return VILLAGER_PROFESSION_ALIASES[value] ?? null;
}

function pickRandom<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

function normalizeInteractionDrop(entry: { itemId?: number; blockId?: number; count: number }) {
  const itemId = resolveItemId(entry);
  if (itemId == null) return null;
  return {
    itemId,
    count: entry.count,
    ...(entry.blockId != null ? { blockId: entry.blockId } : {}),
  };
}

function getNpcDialogue(type: string, profession: string | null) {
  const profile = NPC_INTERACTION_PROFILES[type];
  if (profile) {
    if (profession && profile.dialogueByProfession?.[profession]) {
      return profile.dialogueByProfession[profession];
    }
    if (profile.defaultDialogue) {
      return profile.defaultDialogue;
    }
  }

  const villagerProfile = NPC_INTERACTION_PROFILES.villager;
  if (profession && villagerProfile?.dialogueByProfession?.[profession]) {
    return villagerProfile.dialogueByProfession[profession];
  }
  return villagerProfile?.defaultDialogue ?? 'the village is still taking shape';
}

export function getNpcTradeOffers(type: string, profession: string | null): NpcTradeOffer[] {
  const profile = NPC_INTERACTION_PROFILES[type];
  if (profile) {
    if (profession && profile.tradeOffersByProfession?.[profession]) {
      return profile.tradeOffersByProfession[profession];
    }
    if (profile.defaultTradeOffers?.length) {
      return profile.defaultTradeOffers;
    }
  }

  const villagerProfile = NPC_INTERACTION_PROFILES.villager;
  if (profession && villagerProfile?.tradeOffersByProfession?.[profession]) {
    return villagerProfile.tradeOffersByProfession[profession];
  }
  return villagerProfile?.defaultTradeOffers ?? [];
}

export interface EntityInteractionResult {
  ok: boolean;
  action: string;
  entityId: number;
  message: string;
  drops?: Array<{ itemId: number; count: number; blockId?: number }>;
  replaceSelectedItem?: { itemId: number; count: number } | null;
  tradeOffers?: NpcTradeOffer[];
}

export interface EntityAttackResult {
  ok: boolean;
  entityId: number;
  message: string;
  damage: number;
  dead?: boolean;
  drops?: Array<{ itemId: number; count: number; blockId?: number }>;
}

export function resolveEntityInteractionAction(input: {
  requested: EntityInteractionAction;
  supported: readonly EntityInteractionAction[];
  tool: ToolType;
  defaults?: {
    use?: EntityInteractionAction;
    withTool?: Partial<Record<ToolType, EntityInteractionAction>>;
  };
}): EntityInteractionAction {
  const { requested, supported, tool, defaults } = input;
  if (supported.includes(requested)) return requested;
  if (requested !== 'use') return requested;
  const byTool = defaults?.withTool?.[tool];
  if (byTool && supported.includes(byTool)) return byTool;
  const byDefault = defaults?.use;
  if (byDefault && supported.includes(byDefault)) return byDefault;
  if (tool === 'shears' && supported.includes('shear')) return 'shear';
  if (supported.includes('talk')) return 'talk';
  if (supported.includes('trade')) return 'trade';
  return requested;
}

export interface PlayerHitEvent {
  entityId: number;
  entityType: string;
  damage: number;
  message: string;
}

function setCurrentAction(entity: Entity, action: string, durationMs = 0) {
  entity.state.currentAction = action;
  entity.state.actionTimeMs = durationMs;
}

const TIMED_ACTIONS = new Set(['attack', 'milked', 'laying', 'trade', 'talk', 'use', 'hurt', 'regrow']);
const DEFAULT_PANIC_MS = 1_600;
const PANIC_SPEED_MULTIPLIER = 1.8;
/** Vertical speed above this counts as already airborne / jumping (see `Entity.velocity.y`). */
const MOB_JUMP_VY_EPS = 0.05;
const DAYLIGHT_BURN_TICK_MS = 1_000;
const DAYLIGHT_BURN_DAMAGE = 1;

function getActionDurationMs(entityType: string, action: string, fallbackMs: number) {
  return ENTITY_DEFS[entityType]?.timing?.actionDurationsMs?.[action] ?? fallbackMs;
}

function getCooldownMs(entityType: string, key: string, fallbackMs: number) {
  return ENTITY_DEFS[entityType]?.timing?.cooldownsMs?.[key] ?? fallbackMs;
}

/** MC-style normalized time (tick/24000): hostile-friendly outside 1000–12000. */
export function isNightTime(timeOfDay: number): boolean {
  const tick = (((timeOfDay % 1) + 1) % 1) * 24_000;
  return tick < 1000 || tick >= 12_000;
}

export function getSpawnWeightByTime(def: typeof ENTITY_DEFS[string], timeOfDay: number): number {
  const base = def.spawnWeight ?? 1;
  if (isNightTime(timeOfDay)) {
    return def.hostile ? base * 1.6 : base * 0.55;
  }
  return def.hostile ? base * 0.02 : base * 1.25;
}

export function getSpawnWeightByEnvironment(
  def: typeof ENTITY_DEFS[string],
  timeOfDay: number,
  weather: 'clear' | 'rain' | 'snow',
): number {
  let weight = getSpawnWeightByTime(def, timeOfDay);
  if (weather === 'rain') {
    if (def.type === 'fish') weight *= 2.0;
    if (def.hostile) weight *= 0.85;
  } else if (weather === 'snow') {
    if (def.hostile) weight *= 0.7;
  }
  return weight;
}

export type NightSpawnParams = { cooldown: number; minDist: number; maxDist: number; entityCap: number };

const TORCH_SUPPRESS_RADIUS = 6;
const TORCH_BLOCK_ID = BlockTypes.TORCH;

export function hasTorchNearby(world: World, x: number, y: number, z: number): boolean {
  const r = TORCH_SUPPRESS_RADIUS;
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dz * dz > r * r) continue;
      for (let dy = -2; dy <= 3; dy++) {
        if (world.getBlock(x + dx, y + dy, z + dz) === TORCH_BLOCK_ID) return true;
      }
    }
  }
  return false;
}

export function getNightSpawnParams(timeOfDay: number): NightSpawnParams {
  if (isNightTime(timeOfDay)) {
    return { cooldown: 2.5, minDist: 12, maxDist: 40, entityCap: 40 };
  }
  return { cooldown: 5, minDist: 20, maxDist: 60, entityCap: 30 };
}

export class EntityManager {
  entities = new Map<number, Entity>();
  private nextId = 1;
  private ctx: GameContext;
  private world: World;
  private spawnCooldown = 0;

  constructor(ctx: GameContext, world: World) {
    this.ctx = ctx;
    this.world = world;
  }

  spawn(type: string, position: Vec3): Entity | null {
    const def = ENTITY_DEFS[type];
    if (!def) return null;
    const entity = createEntity(this.nextId++, def, position);
    if (entity.type === 'villager' && entity.attributes.profession === 'none') {
      entity.attributes.profession = pickRandom(VILLAGER_PROFESSIONS);
    }
    if (typeof entity.state.currentAction !== 'string') {
      entity.state.currentAction = 'idle';
    }
    if (typeof entity.state.actionTimeMs !== 'number') {
      entity.state.actionTimeMs = 0;
    }
    if (typeof entity.state.attackCooldownMs !== 'number' && ENTITY_DEFS[type]?.hostile) {
      entity.state.attackCooldownMs = 0;
    }
    this.entities.set(entity.id, entity);
    this.ctx.state.entities[entity.id] = {
      type,
      position: { ...position },
      yaw: entity.yaw,
      hp: entity.hp,
      maxHp: entity.maxHp,
      state: { ...entity.state },
      attributes: { ...entity.attributes },
    };
    return entity;
  }

  remove(id: number) {
    this.entities.delete(id);
    delete this.ctx.state.entities[id];
  }

  removeEntitiesInChunk(cx: number, cz: number) {
    const minX = cx * CHUNK_SIZE;
    const maxX = minX + CHUNK_SIZE;
    const minZ = cz * CHUNK_SIZE;
    const maxZ = minZ + CHUNK_SIZE;
    for (const [id, entity] of this.entities) {
      if (entity.position.x >= minX && entity.position.x < maxX &&
          entity.position.z >= minZ && entity.position.z < maxZ) {
        this.remove(id);
      }
    }
  }

  getEntity(id: number): Entity | null {
    return this.entities.get(id) ?? null;
  }

  setEntityState(id: number, key: string, value: string | number | boolean): boolean {
    const entity = this.entities.get(id);
    const snap = this.ctx.state.entities[id];
    if (!entity || !snap) return false;
    entity.state[key] = value;
    snap.state = { ...entity.state };
    return true;
  }

  setEntityAttribute(id: number, key: string, value: string | number | boolean): boolean {
    const entity = this.entities.get(id);
    const snap = this.ctx.state.entities[id];
    if (!entity || !snap) return false;
    entity.attributes[key] = value;
    snap.attributes = { ...entity.attributes };
    return true;
  }

  healEntity(id: number, amount: number): { ok: boolean; hp: number; maxHp: number; healed: number } {
    const entity = this.entities.get(id);
    const snap = this.ctx.state.entities[id];
    if (!entity || !snap) {
      return { ok: false, hp: 0, maxHp: 0, healed: 0 };
    }
    const nextHp = Math.min(entity.maxHp, entity.hp + Math.max(0, amount));
    const healed = nextHp - entity.hp;
    entity.hp = nextHp;
    snap.hp = nextHp;
    return { ok: true, hp: entity.hp, maxHp: entity.maxHp, healed };
  }

  findNearestEntity(pos: Vec3, radius: number): Entity | null {
    let nearest: Entity | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const entity of this.entities.values()) {
      const distance = Math.hypot(entity.position.x - pos.x, entity.position.z - pos.z);
      if (distance <= radius && distance < nearestDistance) {
        nearest = entity;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  interactEntity(
    id: number,
    action: EntityInteractionAction,
    context: { tool: ToolType; itemId: number | null } = { tool: 'hand', itemId: null },
  ): EntityInteractionResult {
    const entity = this.entities.get(id);
    const snap = this.ctx.state.entities[id];
    if (!entity || !snap) {
      return {
        ok: false,
        action,
        entityId: id,
        message: `Entity not found: ${id}`,
      };
    }

    const def = ENTITY_DEFS[entity.type];
    const supported = def?.interactions ?? [];
    const resolvedAction = resolveEntityInteractionAction({
      requested: action,
      supported,
      tool: context.tool,
      defaults: def?.interactionDefaults,
    });
    if (!supported.includes(resolvedAction)) {
      return {
        ok: false,
        action: resolvedAction,
        entityId: id,
        message: `${def.name} does not support ${action}`,
      };
    }

    const shearing = def.interactionMechanics?.shearing;
    const shearingTriggered = shearing
      && (resolvedAction === shearing.action || (resolvedAction === 'use' && shearing.action === 'shear'));
    if (shearingTriggered) {
      const resolvedShearAction = shearing.action;
      if (context.tool !== shearing.requiredTool) {
        return {
          ok: false,
          action: resolvedShearAction,
          entityId: id,
          message: `${def.name} ${id} ${shearing.missingToolMessage}`,
        };
      }
      if (entity.state[shearing.shearedStateKey] === true) {
        return {
          ok: false,
          action: resolvedShearAction,
          entityId: id,
          message: `${def.name} ${id} ${shearing.alreadyDoneMessage}`,
        };
      }
      entity.state[shearing.shearedStateKey] = true;
      entity.state[shearing.cooldownStateKey] = getCooldownMs(entity.type, shearing.cooldownStateKey, shearing.cooldownMs);
      setCurrentAction(entity, 'sheared');
      snap.state = { ...entity.state };
      return {
        ok: true,
        action: resolvedShearAction,
        entityId: id,
        message: `${def.name} ${id} ${shearing.successMessage}`,
        drops: shearing.drops
          .map(normalizeInteractionDrop)
          .filter((entry): entry is { itemId: number; count: number; blockId?: number } => entry != null),
      };
    }

    const fillContainer = def.interactionMechanics?.fillContainerOnUse;
    if (fillContainer && resolvedAction === fillContainer.action) {
      if (context.itemId !== fillContainer.requiredItemId) {
        return {
          ok: false,
          action: resolvedAction,
          entityId: id,
          message: `${def.name} ${id} ${fillContainer.missingItemMessage}`,
        };
      }
      const cooldownMs = typeof entity.state[fillContainer.cooldownStateKey] === 'number'
        ? Number(entity.state[fillContainer.cooldownStateKey])
        : 0;
      if (cooldownMs > 0) {
        return {
          ok: false,
          action: resolvedAction,
          entityId: id,
          message: `${def.name} ${id} ${fillContainer.cooldownMessage}`,
        };
      }
      entity.state[fillContainer.cooldownStateKey] = getCooldownMs(entity.type, fillContainer.cooldownStateKey, fillContainer.cooldownMs);
      setCurrentAction(
        entity,
        fillContainer.actionStateName,
        getActionDurationMs(entity.type, fillContainer.actionStateName, fillContainer.actionDurationMs),
      );
      snap.state = { ...entity.state };
      return {
        ok: true,
        action: fillContainer.actionName,
        entityId: id,
        message: `${def.name} ${id} ${fillContainer.successMessage}`,
        replaceSelectedItem: { ...fillContainer.replaceSelectedItem },
      };
    }

    const cooldownDrop = def.interactionMechanics?.cooldownDropOnUse;
    if (cooldownDrop && resolvedAction === cooldownDrop.action) {
      const cooldownMs = typeof entity.state[cooldownDrop.cooldownStateKey] === 'number'
        ? Number(entity.state[cooldownDrop.cooldownStateKey])
        : 0;
      if (cooldownMs > 0) {
        return {
          ok: false,
          action: cooldownDrop.actionName,
          entityId: id,
          message: `${def.name} ${id} ${cooldownDrop.cooldownMessage}`,
        };
      }
      entity.state[cooldownDrop.cooldownStateKey] = getCooldownMs(entity.type, cooldownDrop.cooldownStateKey, cooldownDrop.cooldownMs);
      setCurrentAction(
        entity,
        cooldownDrop.actionStateName,
        getActionDurationMs(entity.type, cooldownDrop.actionStateName, cooldownDrop.actionDurationMs),
      );
      snap.state = { ...entity.state };
      return {
        ok: true,
        action: cooldownDrop.actionName,
        entityId: id,
        message: `${def.name} ${id} ${cooldownDrop.successMessage}`,
        drops: [normalizeInteractionDrop(cooldownDrop.drop)].filter(
          (entry): entry is { itemId: number; count: number; blockId?: number } => entry != null,
        ),
      };
    }

    if (resolvedAction === 'trade' && entity.attributes.interactable === true) {
      const profession = typeof entity.attributes.profession === 'string' && entity.attributes.profession !== 'none'
        ? entity.attributes.profession
        : null;
      const offers = getNpcTradeOffers(entity.type, profession);
      if (!offers.length) {
        return {
          ok: false,
          action,
          entityId: id,
          message: `${def.name} ${id} has no trade offers right now`,
        };
      }
      setCurrentAction(entity, 'trade', getActionDurationMs(entity.type, 'trade', 300));
      snap.state = { ...entity.state };
      const label = profession ? `${def.name} ${id} (${profession})` : `${def.name} ${id}`;
      return {
        ok: true,
        action,
        entityId: id,
        message: `${label} has ${offers.length} offer(s)`,
        tradeOffers: offers,
      };
    }

    if ((resolvedAction === 'talk' || resolvedAction === 'use') && entity.attributes.interactable === true) {
      const profession = typeof entity.attributes.profession === 'string' && entity.attributes.profession !== 'none'
        ? entity.attributes.profession
        : null;
      const dialogue = getNpcDialogue(entity.type, profession);
      const currentAction = resolvedAction === 'talk' ? 'talk' : 'use';
      setCurrentAction(entity, currentAction, getActionDurationMs(entity.type, currentAction, 450));
      snap.state = { ...entity.state };
      return {
        ok: true,
        action: resolvedAction,
        entityId: id,
        message: profession
          ? `${def.name} ${id} (${profession}): ${dialogue}`
          : `${def.name} ${id}: ${dialogue}`,
      };
    }

    return {
      ok: true,
      action: resolvedAction,
      entityId: id,
      message: `${def.name} ${id} acknowledged ${resolvedAction}`,
    };
  }

  attackEntity(
    id: number,
    context: { tool: ToolType; itemId: number | null; damage?: number; attackerPosition?: Vec3 } = {
      tool: 'hand',
      itemId: null,
    },
  ): EntityAttackResult {
    const entity = this.entities.get(id);
    const snap = this.ctx.state.entities[id];
    if (!entity || !snap) {
      return { ok: false, entityId: id, message: `Entity not found: ${id}`, damage: 0 };
    }

    const def = ENTITY_DEFS[entity.type];
    const defaultDamage = {
      hand: 1,
      hoe: 1,
      shovel: 2,
      pickaxe: 2,
      axe: 4,
      sword: 6,
      shears: 1,
    } satisfies Record<ToolType, number>;
    const dealt = context.damage ?? defaultDamage[context.tool] ?? 1;
    entity.hp = Math.max(0, entity.hp - dealt);
    snap.hp = entity.hp;
    const attackerPos = context.attackerPosition;
    if (attackerPos && entity.hp > 0) {
      let dx = entity.position.x - attackerPos.x;
      let dz = entity.position.z - attackerPos.z;
      const horiz = Math.hypot(dx, dz);
      if (horiz > 1e-6) {
        dx /= horiz;
        dz /= horiz;
        entity.velocity.x += dx * 0.4;
        entity.velocity.z += dz * 0.4;
      }
      entity.velocity.y += 0.36;
    }
    if (entity.hp <= 0) {
      entity.dead = true;
      const drops: Array<{ itemId: number; count: number; blockId?: number }> = [];
      for (const drop of def.drops ?? []) {
        const chance = drop.chance ?? 1;
        if (chance < 1 && Math.random() > chance) continue;
        let count = drop.count ?? 1;
        if (drop.countMin != null && drop.countMax != null) {
          count = Math.floor(Math.random() * (drop.countMax - drop.countMin + 1)) + drop.countMin;
        }
        const itemId = resolveItemId(drop);
        if (itemId == null) continue;
        drops.push(
          drop.blockId == null
            ? { itemId, count }
            : { itemId, blockId: drop.blockId, count },
        );
      }
      this.remove(id);
      return {
        ok: true,
        entityId: id,
        message: `${def.name} ${id} was defeated`,
        damage: dealt,
        dead: true,
        drops,
      };
    }
    setCurrentAction(entity, 'hurt', getActionDurationMs(entity.type, 'hurt', 220));
    if (!def.hostile && entity.attributes.interactable !== true) {
      const nextPanicMs = getCooldownMs(entity.type, 'panicMs', DEFAULT_PANIC_MS);
      const currentPanicMs = typeof entity.state.panicMs === 'number' ? Number(entity.state.panicMs) : 0;
      entity.state.panicMs = Math.max(currentPanicMs, nextPanicMs);
    }
    snap.state = { ...entity.state };
    return {
      ok: true,
      entityId: id,
      message: `${def.name} ${id} took ${dealt} damage (${entity.hp}/${entity.maxHp})`,
      damage: dealt,
    };
  }

  private tickCounter = 0;

  tick(dt: number, playerPos: Vec3): { playerHits: PlayerHitEvent[] } {
    const simDt = Math.min(dt, 0.1);
    const playerHits: PlayerHitEvent[] = [];
    this.tickCounter++;
    const ACTIVE_RANGE_SQ = 48 * 48;
    const INACTIVE_RANGE_SQ = 96 * 96;
    for (const entity of this.entities.values()) {
      const dxp = entity.position.x - playerPos.x;
      const dzp = entity.position.z - playerPos.z;
      const distSq = dxp * dxp + dzp * dzp;

      this.updateRuntimeState(entity, dt);

      if (distSq <= ACTIVE_RANGE_SQ) {
        const hit = this.updateEntity(entity, simDt, playerPos);
        if (hit) playerHits.push(hit);
      } else if (distSq <= INACTIVE_RANGE_SQ && this.tickCounter % 4 === (entity.id & 3)) {
        this.updateEntity(entity, simDt * 4, playerPos);
      } else {
        const def = ENTITY_DEFS[entity.type];
        if (def?.hostile && entity.state.currentAction === 'chase') {
          setCurrentAction(entity, 'idle');
          const snap = this.ctx.state.entities[entity.id];
          if (snap) snap.state = { ...entity.state };
        }
      }
    }
    this.spawnCooldown -= simDt;
    if (this.spawnCooldown <= 0) {
      const spawnParams = getNightSpawnParams(this.ctx.state.timeOfDay);
      this.trySpawnNearPlayer(playerPos, spawnParams);
      this.spawnCooldown = spawnParams.cooldown;
    }
    const despawnDistSq = (CHUNK_SIZE * 8) * (CHUNK_SIZE * 8);
    for (const [id, entity] of this.entities) {
      const dx = entity.position.x - playerPos.x;
      const dz = entity.position.z - playerPos.z;
      if (dx * dx + dz * dz > despawnDistSq) this.remove(id);
    }
    return { playerHits };
  }

  private updateRuntimeState(entity: Entity, dt: number) {
    let changed = false;
    let skipActionTimeDecay = false;
    const def = ENTITY_DEFS[entity.type];
    if (def?.burnsInDaylight) {
      const inDaylight = !isNightTime(this.ctx.state.timeOfDay)
        && this.ctx.state.weather === 'clear'
        && this.hasSkyExposure(entity)
        && !this.isEntityWet(entity);
      if (inDaylight) {
        const burnTickMs = typeof entity.state.daylightBurnTickMs === 'number'
          ? Number(entity.state.daylightBurnTickMs)
          : DAYLIGHT_BURN_TICK_MS;
        let nextBurnTickMs = burnTickMs - dt * 1000;
        if (nextBurnTickMs <= 0) {
          entity.hp = Math.max(0, entity.hp - DAYLIGHT_BURN_DAMAGE);
          nextBurnTickMs += DAYLIGHT_BURN_TICK_MS;
          setCurrentAction(entity, 'hurt', getActionDurationMs(entity.type, 'hurt', 220));
          skipActionTimeDecay = true;
          changed = true;
          if (entity.hp <= 0) {
            this.remove(entity.id);
            return;
          }
        }
        if (nextBurnTickMs !== burnTickMs) {
          entity.state.daylightBurnTickMs = Math.max(0, nextBurnTickMs);
          changed = true;
        }
      } else {
        const burnTickMs = typeof entity.state.daylightBurnTickMs === 'number'
          ? Number(entity.state.daylightBurnTickMs)
          : DAYLIGHT_BURN_TICK_MS;
        if (burnTickMs !== DAYLIGHT_BURN_TICK_MS) {
          entity.state.daylightBurnTickMs = DAYLIGHT_BURN_TICK_MS;
          changed = true;
        }
      }
    }
    const mechanics = ENTITY_DEFS[entity.type]?.interactionMechanics;
    const shearing = mechanics?.shearing;
    if (shearing && entity.state[shearing.shearedStateKey] === true) {
      const cooldownMs = typeof entity.state[shearing.cooldownStateKey] === 'number'
        ? Number(entity.state[shearing.cooldownStateKey])
        : 0;
      const nextCooldownMs = Math.max(0, cooldownMs - dt * 1000);
      if (nextCooldownMs !== cooldownMs) {
        entity.state[shearing.cooldownStateKey] = nextCooldownMs;
        changed = true;
      }
      if (nextCooldownMs === 0 && entity.state[shearing.shearedStateKey] === true) {
        entity.state[shearing.shearedStateKey] = false;
        setCurrentAction(
          entity,
          'regrow',
          getActionDurationMs(entity.type, 'regrow', 300),
        );
        skipActionTimeDecay = true;
        changed = true;
      }
    }
    const fillContainer = mechanics?.fillContainerOnUse;
    if (fillContainer) {
      const cooldownMs = typeof entity.state[fillContainer.cooldownStateKey] === 'number'
        ? Number(entity.state[fillContainer.cooldownStateKey])
        : 0;
      const nextCooldownMs = Math.max(0, cooldownMs - dt * 1000);
      if (nextCooldownMs !== cooldownMs) {
        entity.state[fillContainer.cooldownStateKey] = nextCooldownMs;
        changed = true;
      }
    }
    const cooldownDrop = mechanics?.cooldownDropOnUse;
    if (cooldownDrop) {
      const cooldownMs = typeof entity.state[cooldownDrop.cooldownStateKey] === 'number'
        ? Number(entity.state[cooldownDrop.cooldownStateKey])
        : 0;
      const nextCooldownMs = Math.max(0, cooldownMs - dt * 1000);
      if (nextCooldownMs !== cooldownMs) {
        entity.state[cooldownDrop.cooldownStateKey] = nextCooldownMs;
        changed = true;
      }
    }
    if (typeof entity.state.attackCooldownMs === 'number') {
      const attackCooldownMs = entity.state.attackCooldownMs;
      const nextAttackCooldownMs = Math.max(0, attackCooldownMs - dt * 1000);
      if (nextAttackCooldownMs !== attackCooldownMs) {
        entity.state.attackCooldownMs = nextAttackCooldownMs;
        changed = true;
      }
    }
    if (!skipActionTimeDecay && typeof entity.state.actionTimeMs === 'number') {
      const actionTimeMs = entity.state.actionTimeMs;
      const nextActionTimeMs = Math.max(0, actionTimeMs - dt * 1000);
      if (nextActionTimeMs !== actionTimeMs) {
        entity.state.actionTimeMs = nextActionTimeMs;
        changed = true;
      }
      if (nextActionTimeMs === 0 && TIMED_ACTIONS.has(String(entity.state.currentAction))) {
        entity.state.currentAction = entity.type === 'sheep' && entity.state.sheared === true ? 'sheared' : 'idle';
        changed = true;
      }
    }
    if (typeof entity.state.panicMs === 'number') {
      const panicMs = Number(entity.state.panicMs);
      const nextPanicMs = Math.max(0, panicMs - dt * 1000);
      if (nextPanicMs !== panicMs) {
        entity.state.panicMs = nextPanicMs;
        changed = true;
      }
      if (nextPanicMs === 0 && entity.state.currentAction === 'panic') {
        entity.state.currentAction = 'idle';
        changed = true;
      }
    }
    if (changed) {
      const snap = this.ctx.state.entities[entity.id];
      if (snap) {
        for (const k in entity.state) {
          if (snap.state[k] !== entity.state[k]) snap.state[k] = entity.state[k];
        }
      }
    }
  }

  private updateEntity(entity: Entity, dt: number, playerPos: Vec3): PlayerHitEvent | null {
    if (entity.dead) return null;
    const def = ENTITY_DEFS[entity.type];
    if (!def) return null;

    const dxToPlayer = playerPos.x - entity.position.x;
    const dzToPlayer = playerPos.z - entity.position.z;
    const distToPlayerSq = dxToPlayer * dxToPlayer + dzToPlayer * dzToPlayer;

    if (def.hostile) {
      const aggroRange = def.aggroRange ?? 0;
      if (distToPlayerSq <= aggroRange * aggroRange && distToPlayerSq > 0.000001) {
        entity.yaw = Math.atan2(-dxToPlayer, -dzToPlayer);
        const attackRange = def.attackRange ?? 1;
        if (distToPlayerSq > attackRange * attackRange) {
          setCurrentAction(entity, 'chase');
        }
      }
      const attackCooldownMs = typeof entity.state.attackCooldownMs === 'number' ? entity.state.attackCooldownMs : 0;
      const attackRange = def.attackRange ?? 1;
      if (distToPlayerSq <= attackRange * attackRange && attackCooldownMs <= 0) {
        if (entity.type === 'creeper') {
          this.remove(entity.id);
          return {
            entityId: entity.id,
            entityType: entity.type,
            damage: def.attackDamage ?? 1,
            message: `${def.name} ${entity.id} exploded for ${def.attackDamage ?? 1}`,
          };
        }
        entity.state.attackCooldownMs = getCooldownMs(entity.type, 'attackCooldownMs', 1_200);
        setCurrentAction(entity, 'attack', getActionDurationMs(entity.type, 'attack', 350));
        const snap = this.ctx.state.entities[entity.id];
        if (snap) {
          snap.state = { ...entity.state };
        }
        return {
          entityId: entity.id,
          entityType: entity.type,
          damage: def.attackDamage ?? 1,
          message: entity.type === 'skeleton'
            ? `${def.name} ${entity.id} shot the player for ${def.attackDamage ?? 1}`
            : `${def.name} ${entity.id} hit the player for ${def.attackDamage ?? 1}`,
        };
      }
    }

    const aggroRangeSq = (def.aggroRange ?? 0) * (def.aggroRange ?? 0);
    const isAggro = def.hostile && distToPlayerSq <= aggroRangeSq;
    const panicMs = !def.hostile && entity.attributes.interactable !== true && typeof entity.state.panicMs === 'number'
      ? Number(entity.state.panicMs)
      : 0;
    const isPanicking = panicMs > 0;

    if (isPanicking) {
      if (distToPlayerSq > 0.000001) {
        entity.yaw = Math.atan2(dxToPlayer, dzToPlayer);
      }
      const activeActionTimeMs = typeof entity.state.actionTimeMs === 'number' ? entity.state.actionTimeMs : 0;
      if (activeActionTimeMs <= 0 && entity.state.currentAction !== 'panic') {
        setCurrentAction(entity, 'panic');
      }
    } else if (!isAggro && Math.random() < dt * 0.3) {
      entity.yaw += (Math.random() - 0.5) * Math.PI * 0.5;
    }

    const speed = def.speed * dt * (isPanicking ? PANIC_SPEED_MULTIPLIER : 1);
    const wanderDx = -Math.sin(entity.yaw) * speed;
    const wanderDz = -Math.cos(entity.yaw) * speed;
    const knockDx = entity.velocity.x * dt;
    const knockDz = entity.velocity.z * dt;

    const nx = entity.position.x + wanderDx + knockDx;
    const nz = entity.position.z + wanderDz + knockDz;
    let movedThisTick = false;
    if (this.canOccupy(def, nx, entity.position.y, nz)) {
      entity.position.x = nx;
      entity.position.z = nz;
      movedThisTick = true;
      if (!def.hostile) {
        const activeActionTimeMs = typeof entity.state.actionTimeMs === 'number' ? entity.state.actionTimeMs : 0;
        if (activeActionTimeMs <= 0 && !isPanicking) {
          setCurrentAction(entity, 'wander');
        }
      }
    } else if (
      this.mobTryJumpOverForwardObstacle(def, entity, nx, nz)
    ) {
      // Jump replaces the old "spin only" behavior for 1-block steps (wander + chase share this path).
    } else {
      entity.yaw += Math.PI * 0.5;
    }

    entity.velocity.x *= 0.85;
    entity.velocity.z *= 0.85;
    if (Math.abs(entity.velocity.x) < 1e-4) entity.velocity.x = 0;
    if (Math.abs(entity.velocity.z) < 1e-4) entity.velocity.z = 0;

    entity.velocity.y -= GRAVITY * dt;
    if (entity.velocity.y < -20) entity.velocity.y = -20;
    const prevY = entity.position.y;
    const ny = prevY + entity.velocity.y * dt;
    const supportY = this.findSupportY(
      def,
      entity.position.x,
      entity.position.z,
      Math.max(prevY, ny),
      Math.min(prevY, ny) - 1,
    );
    if (entity.velocity.y <= 0 && supportY != null && ny <= supportY + 0.01) {
      entity.position.y = supportY + 0.01;
      entity.velocity.y = 0;
    } else if (this.canOccupy(def, entity.position.x, ny, entity.position.z)) {
      entity.position.y = ny;
    } else {
      if (entity.velocity.y < 0 && supportY != null) {
        entity.position.y = supportY + 0.01;
      }
      entity.velocity.y = 0;
    }
    if (entity.position.y < 0) {
      entity.position.y = 0;
      entity.velocity.y = 0;
    }
    const nearbySupportY = this.findSupportY(
      def,
      entity.position.x,
      entity.position.z,
      entity.position.y,
      entity.position.y - 2,
    );
    if (entity.velocity.y <= 0 && nearbySupportY != null) {
      const groundedY = nearbySupportY + 0.01;
      const gap = entity.position.y - groundedY;
      if (gap > 0 && gap <= 1.05 && this.canOccupy(def, entity.position.x, groundedY, entity.position.z)) {
        entity.position.y = groundedY;
        entity.velocity.y = 0;
      }
    }

    const groundedSupportY = this.findSupportY(
      def,
      entity.position.x,
      entity.position.z,
      entity.position.y,
      entity.position.y - 1,
    );
    entity.onGround = groundedSupportY != null && entity.position.y - (groundedSupportY + 0.01) <= 0.05;

    const snap = this.ctx.state.entities[entity.id];
    if (snap) {
      if (snap.position.x !== entity.position.x) snap.position.x = entity.position.x;
      if (snap.position.y !== entity.position.y) snap.position.y = entity.position.y;
      if (snap.position.z !== entity.position.z) snap.position.z = entity.position.z;
      if (snap.yaw !== entity.yaw) snap.yaw = entity.yaw;
      if (snap.hp !== entity.hp) snap.hp = entity.hp;
      for (const k in entity.state) {
        if (snap.state[k] !== entity.state[k]) snap.state[k] = entity.state[k];
      }
      for (const k in entity.attributes) {
        if (snap.attributes[k] !== entity.attributes[k]) snap.attributes[k] = entity.attributes[k];
      }
    }
    const actionTimeMs = typeof entity.state.actionTimeMs === 'number' ? entity.state.actionTimeMs : 0;
    if (actionTimeMs <= 0) {
      let shouldIdle = false;
      if (!def.hostile) {
        if (entity.state.currentAction === 'panic' && isPanicking) {
          shouldIdle = false;
        } else if (entity.state.currentAction === 'wander' && !movedThisTick) {
          shouldIdle = true;
        } else if (
          entity.state.currentAction !== 'wander'
          && entity.state.currentAction !== 'sheared'
          && entity.state.currentAction !== 'panic'
        ) {
          shouldIdle = true;
        }
      } else if (!isAggro && entity.state.currentAction === 'chase') {
        shouldIdle = true;
      }

      if (shouldIdle) {
        setCurrentAction(entity, 'idle');
        const idleSnap = this.ctx.state.entities[entity.id];
        if (idleSnap) {
          for (const k in entity.state) {
            if (idleSnap.state[k] !== entity.state[k]) idleSnap.state[k] = entity.state[k];
          }
        }
      }
    }
    return null;
  }

  /**
   * Mobs use `Entity.velocity.y` as vertical velocity (same role as player `vy`).
   * Jump only when grounded, not already rising, with headroom and a clear landing column one block up ahead.
   */
  private mobCanJumpOverForwardObstacle(
    def: typeof ENTITY_DEFS[string],
    entity: Entity,
    nx: number,
    nz: number,
  ): boolean {
    if (!entity.onGround) return false;
    if (entity.velocity.y > MOB_JUMP_VY_EPS) return false;
    if (!this.canOccupy(def, entity.position.x, entity.position.y + 1, entity.position.z)) return false;
    if (!this.canOccupy(def, nx, entity.position.y + 1, nz)) return false;
    return true;
  }

  private mobTryJumpOverForwardObstacle(
    def: typeof ENTITY_DEFS[string],
    entity: Entity,
    nx: number,
    nz: number,
  ): boolean {
    if (!this.mobCanJumpOverForwardObstacle(def, entity, nx, nz)) return false;
    entity.velocity.y = JUMP_VELOCITY;
    return true;
  }

  private canOccupy(def: typeof ENTITY_DEFS[string], x: number, y: number, z: number): boolean {
    const samples = this.getFootprintSamples(def.width);
    const ySamples = [0, Math.max(0, def.height * 0.5), Math.max(0, def.height - 0.05)];
    for (const [ox, oz] of samples) {
      for (const oy of ySamples) {
        if (this.world.isSolid(Math.floor(x + ox), Math.floor(y + oy), Math.floor(z + oz))) {
          return false;
        }
      }
    }
    return true;
  }

  private findSupportY(
    def: typeof ENTITY_DEFS[string],
    x: number,
    z: number,
    fromY: number,
    toY: number,
  ): number | null {
    let supportY: number | null = null;
    for (const [ox, oz] of this.getFootprintSamples(def.width)) {
      const localSupportY = this.world.findLocalSupportY(
        Math.floor(x + ox),
        Math.floor(z + oz),
        fromY,
        toY,
      );
      if (localSupportY != null && (supportY == null || localSupportY > supportY)) {
        supportY = localSupportY;
      }
    }
    return supportY;
  }

  private footprintCache = new Map<number, Array<[number, number]>>();

  private getFootprintSamples(width: number): Array<[number, number]> {
    let cached = this.footprintCache.get(width);
    if (cached) return cached;
    const halfWidth = Math.max(0.05, width * 0.5 - 0.05);
    cached = [
      [0, 0],
      [-halfWidth, -halfWidth],
      [-halfWidth, halfWidth],
      [halfWidth, -halfWidth],
      [halfWidth, halfWidth],
    ];
    this.footprintCache.set(width, cached);
    return cached;
  }

  private hasSkyExposure(entity: Entity): boolean {
    const def = ENTITY_DEFS[entity.type];
    if (!def) return false;
    const headY = Math.floor(entity.position.y + def.height);
    const x = Math.floor(entity.position.x);
    const z = Math.floor(entity.position.z);
    for (let y = headY + 1; y < 128; y++) {
      if (this.world.isSolid(x, y, z)) return false;
    }
    return true;
  }

  private isEntityWet(entity: Entity): boolean {
    const def = ENTITY_DEFS[entity.type];
    if (!def) return false;
    const x = Math.floor(entity.position.x);
    const z = Math.floor(entity.position.z);
    const y0 = Math.floor(entity.position.y);
    const y1 = Math.floor(entity.position.y + def.height * 0.5);
    const y2 = Math.floor(entity.position.y + def.height);
    return this.world.getBlock(x, y0, z) === B.WATER
      || this.world.getBlock(x, y1, z) === B.WATER
      || this.world.getBlock(x, y2, z) === B.WATER;
  }

  private trySpawnNearPlayer(playerPos: Vec3, params: NightSpawnParams = { cooldown: 5, minDist: 20, maxDist: 60, entityCap: 30 }) {
    if (this.entities.size >= params.entityCap) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = params.minDist + Math.random() * (params.maxDist - params.minDist);
    const sx = Math.floor(playerPos.x + Math.cos(angle) * dist);
    const sz = Math.floor(playerPos.z + Math.sin(angle) * dist);

    const seed = this.world.seed;
    const terrainP = { ...TERRAIN_PARAMS, seed: TERRAIN_PARAMS.seed + seed };
    const mountainP = { ...MOUNTAIN_PARAMS, seed: MOUNTAIN_PARAMS.seed + seed };
    const heatP = { ...HEAT_PARAMS, seed: HEAT_PARAMS.seed + seed };
    const humidityP = { ...HUMIDITY_PARAMS, seed: HUMIDITY_PARAMS.seed + seed };

    const base =
      terrainP.offset + fractalNoise2d(sx, sz, terrainP) * terrainP.scale;
    const mountains =
      fractalNoise2d(sx, sz, mountainP) * mountainP.scale;
    const height = Math.floor(base + mountains);
    const heat = fractalNoise2d(sx, sz, heatP);
    const humidity = fractalNoise2d(sx, sz, humidityP);
    const biome = selectBiome(heat, humidity, height);

    const timeOfDay = this.ctx.state.timeOfDay;
    const weather = this.ctx.state.weather;
    const candidates = Object.values(ENTITY_DEFS)
      .filter((d) => d.spawnBiomes?.includes(biome.id))
      .map((def) => ({
        def,
        weight: getSpawnWeightByEnvironment(def, timeOfDay, weather),
      }))
      .filter((entry) => entry.weight > 0);
    if (candidates.length === 0) return;

    const totalWeight = candidates.reduce(
      (sum, entry) => sum + entry.weight,
      0,
    );
    let roll = Math.random() * totalWeight;
    let selected = candidates[0]!.def;
    for (const entry of candidates) {
      roll -= entry.weight;
      if (roll <= 0) {
        selected = entry.def;
        break;
      }
    }

    const spawnY = this.world.findSpawnY(sx, sz);
    if (spawnY > 0) {
      if (selected.hostile && hasTorchNearby(this.world, sx, spawnY, sz)) return;
      this.spawn(selected.type, {
        x: sx + 0.5,
        y: spawnY + 0.1,
        z: sz + 0.5,
      });
    }
  }

  getEntitiesNear(pos: Vec3, radius: number): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities.values()) {
      const d = Math.hypot(
        entity.position.x - pos.x,
        entity.position.z - pos.z,
      );
      if (d <= radius) result.push(entity);
    }
    return result;
  }
}
