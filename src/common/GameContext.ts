import { proxy } from 'valtio';
import { EventBus } from './EventBus';
import {
  DEFAULT_SETTINGS,
  type ChatMessage,
  type GameSettings,
  type InventorySlot,
  type ItemDrop,
  type EntityStateMap,
  type PlayerArmorSlots,
  type TargetBlock,
  type ToolType,
  type Vec3,
  type ViewMode,
  PLAYER_FOOD_MAX,
  PLAYER_START_SATURATION,
} from './types';

export interface EntitySnapshot {
  type: string;
  position: Vec3;
  yaw: number;
  hp: number;
  maxHp: number;
  state: EntityStateMap;
  attributes: EntityStateMap;
}

export type NetworkMode = 'local' | 'multiplayer';

export interface GameState {
  network: {
    mode: NetworkMode;
    /** WebSocket URL when `mode === 'multiplayer'` */
    wsUrl?: string;
  };

  ui: {
    isLocked: boolean;
    everLocked: boolean;
    showInventory: boolean;
    /** When `showInventory` is true: normal player inventory vs crafting-table GUI. */
    inventoryMode: 'inventory' | 'craftTable';
    /** Bumped by `s2c:openCraftTable` so React overlay can open + pause (mirrors E-key flow). */
    craftTableOpenSignal: number;
    showCrafting: boolean;
    showChat: boolean;
    showSettings: boolean;
    showDebug: boolean;
    loading: boolean;
    webglError: boolean;
    chatPrefix?: string;
    furnaceOpen: boolean;
    chestOpen: boolean;
  };

  player: {
    position: Vec3;
    vy: number;
    yaw: number;
    pitch: number;
    hp: number;
    maxHp: number;
    hunger: number;
    maxHunger: number;
    saturation: number;
    airMs: number;
    attackCooldownMs: number;
    hurtCooldownMs: number;
    onGround: boolean;
    jumping: boolean;
    sneaking: boolean;
    sprinting: boolean;
    tool: ToolType;
    viewMode: ViewMode;
    targetBlock: TargetBlock | null;
    targetEntity: { id: number; type: string } | null;
    /** Client-only: mining progress 0–1 from `s2c:breakProgress`; `null` when not mining. */
    miningProgress: number | null;
    armor: PlayerArmorSlots;
  };

  inventory: {
    slots: (InventorySlot | null)[];
    selectedIndex: number;
    offhand: InventorySlot | null;
    cursor: InventorySlot | null;
    craftTableSlots: (InventorySlot | null)[];
  };

  chat: {
    messages: ChatMessage[];
    nextId: number;
  };

  settings: GameSettings;

  stats: {
    fps: number;
    biome?: string;
  };

  abilities: Record<string, boolean>;

  entities: Record<number, EntitySnapshot>;

  itemDrops: ItemDrop[];

  furnace: {
    inputSlot: InventorySlot | null;
    fuelSlot: InventorySlot | null;
    outputSlot: InventorySlot | null;
    burnTimeLeft: number;
    burnTimeTotal: number;
    cookProgress: number;
    cookTimeTotal: number;
  };

  chest: {
    chestId: string;
    slots: (InventorySlot | null)[];
  };

  seed: number;

  weather: 'clear' | 'rain' | 'snow';
  timeOfDay: number;
}

/** True when any container/overlay UI is open that should block gameplay actions like eating. */
export function isContainerUiOpen(ui: GameState['ui']): boolean {
  return ui.showInventory || ui.furnaceOpen || ui.chestOpen;
}

export function createDefaultState(): GameState {
  return {
    network: {
      mode: 'local',
      wsUrl: undefined,
    },
    ui: {
      isLocked: false,
      everLocked: false,
      showInventory: false,
      inventoryMode: 'inventory',
      craftTableOpenSignal: 0,
      showCrafting: false,
      showChat: false,
      showSettings: false,
      showDebug: false,
      loading: true,
      webglError: false,
      furnaceOpen: false,
      chestOpen: false,
    },
    player: {
      position: { x: 0, y: 0, z: 0 },
      vy: 0,
      yaw: 0,
      pitch: 0,
      hp: 20,
      maxHp: 20,
      hunger: PLAYER_FOOD_MAX,
      maxHunger: PLAYER_FOOD_MAX,
      saturation: PLAYER_START_SATURATION,
      airMs: 10_000,
      attackCooldownMs: 0,
      hurtCooldownMs: 0,
      onGround: false,
      jumping: false,
      sneaking: false,
      sprinting: false,
      tool: 'hand',
      viewMode: 'first-person',
      targetBlock: null,
      targetEntity: null,
      miningProgress: null,
      armor: {
        helmet: null,
        chestplate: null,
        leggings: null,
        boots: null,
      },
    },
    inventory: {
      slots: Array(36).fill(null),
      selectedIndex: 0,
      offhand: null,
      cursor: null,
      craftTableSlots: Array(9).fill(null),
    },
    chat: {
      messages: [],
      nextId: 1,
    },
    settings: { ...DEFAULT_SETTINGS },
    stats: {
      fps: 0,
      biome: '',
    },
    abilities: {
      fly: false,
      fast: false,
      noclip: false,
      creative: false,
    },
    entities: {},
    itemDrops: [],
    furnace: {
      inputSlot: null,
      fuelSlot: null,
      outputSlot: null,
      burnTimeLeft: 0,
      burnTimeTotal: 0,
      cookProgress: 0,
      cookTimeTotal: 200,
    },
    chest: {
      chestId: '',
      slots: new Array(27).fill(null),
    },
    seed: 0,
    weather: 'clear' as const,
    timeOfDay: 0,
  };
}

export function appendChatMessage(
  state: GameState,
  input: {
    sender: string;
    message: string;
    id?: string;
    timestamp?: number;
  },
  options?: { maxMessages?: number },
) {
  const timestamp = input.timestamp ?? Date.now();
  const id = input.id ?? `${timestamp}-${state.chat.nextId++}`;
  state.chat.messages.push({
    id,
    sender: input.sender,
    message: input.message,
    timestamp,
  });
  const maxMessages = options?.maxMessages ?? 50;
  if (state.chat.messages.length > maxMessages) {
    state.chat.messages.splice(0, state.chat.messages.length - maxMessages);
  }
}

/**
 * Protocol events that remain as events (not state mutations).
 * These represent actions or large data transfers that don't map cleanly to state.
 */
export interface ProtocolC2S extends Record<string, unknown> {
  'c2s:requestChunks': { cx: number; cz: number; radius: number };
  'c2s:attackEntity': { id: number };
  'c2s:breakBlock': { x: number; y: number; z: number };
  'c2s:startBreak': { x: number; y: number; z: number };
  'c2s:cancelBreak': Record<string, never>;
  'c2s:interactBlock': { x: number; y: number; z: number; action: 'use' };
  'c2s:placeBlock': { x: number; y: number; z: number; blockId: number };
  'c2s:interactEntity': { id: number; action: 'use' | 'talk' | 'shear' | 'trade' };
  'c2s:craft': { recipeIndex: number };
  'c2s:chat': { message: string };
  'c2s:command': { command: string };
  'c2s:swapOffhand': {};
  'c2s:inventoryClick': {
    index: number;
    button: 'left' | 'right';
    shift?: boolean;
    area?: 'player' | 'craftTable' | 'craftResult';
  };
  'c2s:inventoryCollect': { index: number; area?: 'player' | 'craftTable' };
  'c2s:inventoryClose': {};
  'c2s:furnaceClick': { slot: 'input' | 'fuel' | 'output'; button: 'left' | 'right'; shift?: boolean };
  'c2s:furnaceClose': Record<string, never>;
  'c2s:chestClick': { slotIndex: number; button: 'left' | 'right'; shift?: boolean };
  'c2s:chestClose': Record<string, never>;
  /** Use selected hotbar item (e.g. eat food). */
  'c2s:useItem': Record<string, never>;
}

export interface ProtocolS2C extends Record<string, unknown> {
  's2c:chunk': { cx: number; cz: number; blocks: Uint8Array; facings?: Record<string, string> };
  's2c:blockChange': { x: number; y: number; z: number; blockId: number };
  's2c:openCraftTable': Record<string, never>;
  's2c:openFurnace': { furnaceId: string };
  's2c:openChest': { chestId: string; slots: (InventorySlot | null)[] };
  /** `progress` in [0, 1] while mining; `-1` clears crack / HUD bar. */
  's2c:breakProgress': { x: number; y: number; z: number; progress: number };
}

/**
 * Central game context holding proxy state + protocol events.
 * All game modules receive this instead of scattered EventBus/refs.
 */
export class GameContext {
  state: GameState;
  c2s = new EventBus<ProtocolC2S>();
  s2c = new EventBus<ProtocolS2C>();

  constructor() {
    this.state = proxy(createDefaultState());
  }

  dispose() {
    this.c2s.clear();
    this.s2c.clear();
  }
}

export function createGameContext(): GameContext {
  return new GameContext();
}
