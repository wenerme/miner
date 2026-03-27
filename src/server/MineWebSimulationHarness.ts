import { Player } from '#/common/Player';
import { GameContext } from '#/common/GameContext';
import type { EntityInteractionAction, InventorySlot } from '#/common/types';
import type { Vec3 } from '#/common/types';
import { GameServer } from './GameServer';
import { createManualTickDriver } from './SimulationClock';
import {
  buildRegressionScene,
  type RegressionSceneLayout,
  type RegressionSceneResult,
} from './RegressionScene';

function stableStringify(value: unknown): string {
  if (value == null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function hashFNV1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function roundN(value: number, precision = 3) {
  const base = 10 ** precision;
  return Math.round(value * base) / base;
}

type HarnessScriptAction =
  | { type: 'step'; frames?: number; dt?: number }
  | {
    type: 'stepUntil';
    condition:
    | { type: 'chatIncludes'; text: string }
    | { type: 'itemDropsAtLeast'; count: number }
    | { type: 'entityCountAtLeast'; count: number }
    | { type: 'entityTypeCountAtLeast'; entityType: string; count: number }
    | { type: 'chatMessageCountAtLeast'; count: number }
    | { type: 'inventoryItemCountAtLeast'; itemId: number; count: number }
    | { type: 'weatherIs'; weather: 'clear' | 'rain' | 'snow' }
    | { type: 'timeOfDayBetween'; min: number; max: number }
    | { type: 'playerHpAtLeast'; hp: number }
    | { type: 'playerHpAtMost'; hp: number }
    | { type: 'abilityEnabled'; ability: string; enabled: boolean }
    | { type: 'entityStateEquals'; id: number; key: string; value: string | number | boolean }
    | { type: 'entityStateNumberAtLeast'; id: number; key: string; min: number }
    | { type: 'entityStateNumberAtMost'; id: number; key: string; max: number }
    | { type: 'entityAttributeEquals'; id: number; key: string; value: string | number | boolean }
    | { type: 'selectedItemIs'; itemId: number | null }
    | { type: 'playerYAtLeast'; y: number }
    | { type: 'playerYAtMost'; y: number }
    | { type: 'blockEquals'; x: number; y: number; z: number; blockId: number };
    maxFrames?: number;
    dt?: number;
    failOnTimeout?: boolean;
    timeoutMessage?: string;
  }
  | {
    type: 'assert';
    condition:
    | { type: 'chatIncludes'; text: string }
    | { type: 'itemDropsAtLeast'; count: number }
    | { type: 'entityCountAtLeast'; count: number }
    | { type: 'entityTypeCountAtLeast'; entityType: string; count: number }
    | { type: 'chatMessageCountAtLeast'; count: number }
    | { type: 'inventoryItemCountAtLeast'; itemId: number; count: number }
    | { type: 'weatherIs'; weather: 'clear' | 'rain' | 'snow' }
    | { type: 'timeOfDayBetween'; min: number; max: number }
    | { type: 'playerHpAtLeast'; hp: number }
    | { type: 'playerHpAtMost'; hp: number }
    | { type: 'abilityEnabled'; ability: string; enabled: boolean }
    | { type: 'entityStateEquals'; id: number; key: string; value: string | number | boolean }
    | { type: 'entityStateNumberAtLeast'; id: number; key: string; min: number }
    | { type: 'entityStateNumberAtMost'; id: number; key: string; max: number }
    | { type: 'entityAttributeEquals'; id: number; key: string; value: string | number | boolean }
    | { type: 'selectedItemIs'; itemId: number | null }
    | { type: 'playerYAtLeast'; y: number }
    | { type: 'playerYAtMost'; y: number }
    | { type: 'blockEquals'; x: number; y: number; z: number; blockId: number };
    message?: string;
  }
  | {
    type: 'spawnEntity';
    entityType: string;
    position: Vec3;
    attributes?: Record<string, string | number | boolean>;
  }
  | { type: 'interactNearestEntity'; action?: EntityInteractionAction; radius?: number }
  | { type: 'attackNearestEntity'; radius?: number }
  | { type: 'command'; command: string }
  | { type: 'chat'; message: string }
  | { type: 'breakBlock'; x: number; y: number; z: number }
  | { type: 'placeBlock'; x: number; y: number; z: number; blockId: number }
  | { type: 'interactBlock'; x: number; y: number; z: number }
  | { type: 'interactEntity'; id: number; action?: EntityInteractionAction }
  | { type: 'attackEntity'; id: number }
  | { type: 'setSlot'; index: number; slot: InventorySlot | null }
  | { type: 'setPlayerPose'; position: Vec3; yaw?: number; pitch?: number };

export class MineWebSimulationHarness {
  readonly ctx: GameContext;
  readonly server: GameServer;
  readonly player: Player;

  constructor(seed = 12345) {
    this.ctx = new GameContext();
    this.server = new GameServer(this.ctx, seed, createManualTickDriver());
    this.player = new Player(this.ctx);
  }

  buildRegressionScene(options?: {
    originX?: number;
    originZ?: number;
    chunkRadius?: number;
    layout?: RegressionSceneLayout;
  }): RegressionSceneResult {
    return buildRegressionScene(this.server, options);
  }

  setPlayerPose(position: Vec3, yaw = 0, pitch = 0) {
    this.ctx.state.player.position = { ...position };
    this.ctx.state.player.yaw = yaw;
    this.ctx.state.player.pitch = pitch;
  }

  step(frames = 1, dt = 1 / 60) {
    for (let i = 0; i < frames; i++) {
      this.server.tick(dt);
    }
  }

  runCommand(command: string) {
    this.ctx.c2s.emit('c2s:command', { command });
  }

  runChat(message: string) {
    this.ctx.c2s.emit('c2s:chat', { message });
  }

  interactEntity(id: number, action: EntityInteractionAction = 'use') {
    this.ctx.c2s.emit('c2s:interactEntity', { id, action });
  }

  breakBlock(x: number, y: number, z: number) {
    this.server.applyInstantBreak(x, y, z);
  }

  placeBlock(x: number, y: number, z: number, blockId: number) {
    this.ctx.c2s.emit('c2s:placeBlock', { x, y, z, blockId });
  }

  interactBlock(x: number, y: number, z: number) {
    this.ctx.c2s.emit('c2s:interactBlock', { x, y, z, action: 'use' });
  }

  attackEntity(id: number) {
    this.ctx.c2s.emit('c2s:attackEntity', { id });
  }

  setSelectedSlot(index: number, slot: InventorySlot | null) {
    this.server.inventory.selectedIndex = index;
    this.ctx.state.inventory.selectedIndex = index;
    this.server.inventory.slots[index] = slot ? { ...slot } : null;
    this.server.syncInventory();
  }

  getLastChatMessage() {
    return this.ctx.state.chat.messages.at(-1)?.message ?? '';
  }

  getStats() {
    return {
      chunks: this.server.world.chunks.size,
      entities: Object.keys(this.ctx.state.entities).length,
      itemDrops: this.ctx.state.itemDrops.length,
      biome: this.ctx.state.stats.biome,
    };
  }

  getStateSignature(options?: { includeChat?: boolean }): string {
    const includeChat = options?.includeChat === true;
    const state = this.ctx.state;
    const entityEntries = Object.entries(state.entities)
      .map(([id, entity]) => ({
        id: Number(id),
        type: entity.type,
        hp: entity.hp,
        maxHp: entity.maxHp,
        yaw: roundN(entity.yaw),
        position: {
          x: roundN(entity.position.x),
          y: roundN(entity.position.y),
          z: roundN(entity.position.z),
        },
        state: entity.state ?? {},
        attributes: entity.attributes ?? {},
      }))
      .sort((a, b) => a.id - b.id);
    const inventorySlots = state.inventory.slots.map((slot) =>
      slot
        ? { itemId: slot.itemId, count: slot.count, durability: slot.durability ?? null }
        : null);
    const craftTableSnap = (state.inventory.craftTableSlots ?? []).map((slot) =>
      slot
        ? { itemId: slot.itemId, count: slot.count, durability: slot.durability ?? null }
        : null);
    const dropEntries = state.itemDrops
      .map((drop) => ({
        id: drop.id,
        itemId: drop.itemId ?? drop.blockId ?? null,
        age: roundN(drop.age),
        position: {
          x: roundN(drop.position.x),
          y: roundN(drop.position.y),
          z: roundN(drop.position.z),
        },
      }))
      .sort((a, b) => a.id - b.id);

    const armorSnap = {
      helmet: state.player.armor.helmet
        ? { itemId: state.player.armor.helmet.itemId, count: state.player.armor.helmet.count, durability: state.player.armor.helmet.durability ?? null }
        : null,
      chestplate: state.player.armor.chestplate
        ? { itemId: state.player.armor.chestplate.itemId, count: state.player.armor.chestplate.count, durability: state.player.armor.chestplate.durability ?? null }
        : null,
      leggings: state.player.armor.leggings
        ? { itemId: state.player.armor.leggings.itemId, count: state.player.armor.leggings.count, durability: state.player.armor.leggings.durability ?? null }
        : null,
      boots: state.player.armor.boots
        ? { itemId: state.player.armor.boots.itemId, count: state.player.armor.boots.count, durability: state.player.armor.boots.durability ?? null }
        : null,
    };

    const snapshot = {
      player: {
        position: {
          x: roundN(state.player.position.x),
          y: roundN(state.player.position.y),
          z: roundN(state.player.position.z),
        },
        hp: state.player.hp,
        maxHp: state.player.maxHp,
        hunger: state.player.hunger,
        maxHunger: state.player.maxHunger,
        saturation: roundN(state.player.saturation),
        yaw: roundN(state.player.yaw),
        pitch: roundN(state.player.pitch),
        tool: state.player.tool,
        viewMode: state.player.viewMode,
        armor: armorSnap,
      },
      inventory: {
        selectedIndex: state.inventory.selectedIndex,
        offhand: state.inventory.offhand
          ? { itemId: state.inventory.offhand.itemId, count: state.inventory.offhand.count, durability: state.inventory.offhand.durability ?? null }
          : null,
        cursor: state.inventory.cursor
          ? { itemId: state.inventory.cursor.itemId, count: state.inventory.cursor.count, durability: state.inventory.cursor.durability ?? null }
          : null,
        slots: inventorySlots,
        craftTableSlots: craftTableSnap,
      },
      world: {
        weather: state.weather,
        timeOfDay: roundN(state.timeOfDay),
        chunks: this.server.world.chunks.size,
      },
      entities: entityEntries,
      itemDrops: dropEntries,
      ...(includeChat
        ? {
          chat: state.chat.messages.map((msg) => ({
            sender: msg.sender,
            message: msg.message,
          })),
        }
        : {}),
    };

    return hashFNV1a(stableStringify(snapshot));
  }

  getWorldBlockSignature(points: Array<{ x: number; y: number; z: number }>): string {
    const normalized = points
      .map((point) => ({
        x: Math.floor(point.x),
        y: Math.floor(point.y),
        z: Math.floor(point.z),
      }))
      .sort((a, b) => (a.x - b.x) || (a.y - b.y) || (a.z - b.z))
      .map((point) => {
        const blockId = this.server.world.getBlock(point.x, point.y, point.z);
        const state = this.server.world.getResolvedBlockState(point.x, point.y, point.z) ?? null;
        return { ...point, blockId, state };
      });
    return hashFNV1a(stableStringify(normalized));
  }

  runScript(actions: HarnessScriptAction[]): { finalSignature: string; actionCount: number } {
    const evaluateCondition = (
      condition: Extract<HarnessScriptAction, { type: 'stepUntil' | 'assert' }>['condition'],
    ) => {
      switch (condition.type) {
        case 'chatIncludes':
          return this.getLastChatMessage().includes(condition.text);
        case 'itemDropsAtLeast':
          return this.ctx.state.itemDrops.length >= condition.count;
        case 'entityCountAtLeast':
          return Object.keys(this.ctx.state.entities).length >= condition.count;
        case 'entityTypeCountAtLeast': {
          const count = Object.values(this.ctx.state.entities)
            .filter((entity) => entity.type === condition.entityType)
            .length;
          return count >= condition.count;
        }
        case 'chatMessageCountAtLeast':
          return this.ctx.state.chat.messages.length >= condition.count;
        case 'inventoryItemCountAtLeast': {
          const slots = this.ctx.state.inventory.slots;
          const slotCount = slots.reduce(
            (sum, slot) => (slot?.itemId === condition.itemId ? sum + slot.count : sum),
            0,
          );
          const offhandCount = this.ctx.state.inventory.offhand?.itemId === condition.itemId
            ? this.ctx.state.inventory.offhand.count
            : 0;
          const cursorCount = this.ctx.state.inventory.cursor?.itemId === condition.itemId
            ? this.ctx.state.inventory.cursor.count
            : 0;
          return slotCount + offhandCount + cursorCount >= condition.count;
        }
        case 'weatherIs':
          return this.ctx.state.weather === condition.weather;
        case 'timeOfDayBetween':
          return this.ctx.state.timeOfDay >= condition.min && this.ctx.state.timeOfDay <= condition.max;
        case 'playerHpAtLeast':
          return this.ctx.state.player.hp >= condition.hp;
        case 'playerHpAtMost':
          return this.ctx.state.player.hp <= condition.hp;
        case 'abilityEnabled':
          return this.server.abilities.has(condition.ability) === condition.enabled;
        case 'entityStateEquals': {
          const entity = this.ctx.state.entities[condition.id];
          if (!entity) return false;
          return entity.state?.[condition.key] === condition.value;
        }
        case 'entityStateNumberAtLeast': {
          const entity = this.ctx.state.entities[condition.id];
          if (!entity) return false;
          const value = entity.state?.[condition.key];
          return typeof value === 'number' && value >= condition.min;
        }
        case 'entityStateNumberAtMost': {
          const entity = this.ctx.state.entities[condition.id];
          if (!entity) return false;
          const value = entity.state?.[condition.key];
          return typeof value === 'number' && value <= condition.max;
        }
        case 'entityAttributeEquals': {
          const entity = this.ctx.state.entities[condition.id];
          if (!entity) return false;
          return entity.attributes?.[condition.key] === condition.value;
        }
        case 'selectedItemIs': {
          const selectedIndex = this.ctx.state.inventory.selectedIndex;
          const selected = this.ctx.state.inventory.slots[selectedIndex] ?? null;
          return (selected?.itemId ?? null) === condition.itemId;
        }
        case 'playerYAtLeast':
          return this.ctx.state.player.position.y >= condition.y;
        case 'playerYAtMost':
          return this.ctx.state.player.position.y <= condition.y;
        case 'blockEquals':
          return this.server.world.getBlock(condition.x, condition.y, condition.z) === condition.blockId;
        default:
          return false;
      }
    };

    for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
      const action = actions[actionIndex]!;
      switch (action.type) {
        case 'step':
          this.step(action.frames ?? 1, action.dt ?? 1 / 60);
          break;
        case 'stepUntil': {
          const maxFrames = action.maxFrames ?? 120;
          const dt = action.dt ?? 1 / 60;
          const failOnTimeout = action.failOnTimeout !== false;
          let met = evaluateCondition(action.condition);
          for (let frame = 0; frame < maxFrames && !met; frame++) {
            this.step(1, dt);
            met = evaluateCondition(action.condition);
          }
          if (!met && failOnTimeout) {
            const timeoutMessage = action.timeoutMessage
              ?? `stepUntil timeout: ${stableStringify(action.condition)} not met in ${maxFrames} frames`;
            throw new Error(`[HarnessScript action ${actionIndex}] ${timeoutMessage}`);
          }
          break;
        }
        case 'assert': {
          const ok = evaluateCondition(action.condition);
          if (!ok) {
            const reason = action.message ?? `Assertion failed for condition: ${stableStringify(action.condition)}`;
            throw new Error(`[HarnessScript action ${actionIndex}] ${reason}`);
          }
          break;
        }
        case 'spawnEntity': {
          const spawned = this.server.entityManager.spawn(action.entityType, action.position);
          if (!spawned) {
            throw new Error(`[HarnessScript action ${actionIndex}] Unknown entity type: ${action.entityType}`);
          }
          if (action.attributes) {
            for (const [key, value] of Object.entries(action.attributes)) {
              this.server.entityManager.setEntityAttribute(spawned.id, key, value);
            }
          }
          break;
        }
        case 'interactNearestEntity': {
          const nearest = this.server.entityManager.findNearestEntity(
            this.ctx.state.player.position,
            action.radius ?? 12,
          );
          if (!nearest) {
            throw new Error(`[HarnessScript action ${actionIndex}] No entity found within radius ${action.radius ?? 12}`);
          }
          this.interactEntity(nearest.id, action.action ?? 'use');
          break;
        }
        case 'attackNearestEntity': {
          const nearest = this.server.entityManager.findNearestEntity(
            this.ctx.state.player.position,
            action.radius ?? 12,
          );
          if (!nearest) {
            throw new Error(`[HarnessScript action ${actionIndex}] No entity found within radius ${action.radius ?? 12}`);
          }
          this.attackEntity(nearest.id);
          break;
        }
        case 'command':
          this.runCommand(action.command);
          break;
        case 'chat':
          this.runChat(action.message);
          break;
        case 'breakBlock':
          this.breakBlock(action.x, action.y, action.z);
          break;
        case 'placeBlock':
          this.placeBlock(action.x, action.y, action.z, action.blockId);
          break;
        case 'interactBlock':
          this.interactBlock(action.x, action.y, action.z);
          break;
        case 'interactEntity':
          this.interactEntity(action.id, action.action ?? 'use');
          break;
        case 'attackEntity':
          this.attackEntity(action.id);
          break;
        case 'setSlot':
          this.setSelectedSlot(action.index, action.slot);
          break;
        case 'setPlayerPose':
          this.setPlayerPose(action.position, action.yaw ?? 0, action.pitch ?? 0);
          break;
        default:
          break;
      }
    }
    return {
      finalSignature: this.getStateSignature({ includeChat: true }),
      actionCount: actions.length,
    };
  }

  dispose() {
    this.player.dispose();
    this.server.stop();
    this.ctx.dispose();
  }
}
