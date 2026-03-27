export type Vec3 = { x: number; y: number; z: number };
export type InventorySlot = { itemId: number; count: number; durability?: number };

/** World creation preset — controls initial resources, onboarding, and difficulty. */
export type WorldPreset = 'demo' | 'survival' | 'dev';

export const WORLD_PRESETS = Object.freeze({
  demo: { label: 'Demo / Showcase', description: 'Rich starter kit — great for quick testing and screenshots' },
  survival: { label: 'Survival Preview', description: 'Bare-hands start — true progression from wood to iron' },
  dev: { label: 'Dev / Sandbox', description: 'Full creative loadout — all items, debug tools' },
} as const);

/** Armor equipment slot keys (helmet → boots, top to bottom in UI). */
export type ArmorSlotKey = 'helmet' | 'chestplate' | 'leggings' | 'boots';

export type PlayerArmorSlots = {
  helmet: InventorySlot | null;
  chestplate: InventorySlot | null;
  leggings: InventorySlot | null;
  boots: InventorySlot | null;
};

export const ARMOR_SLOT_KEYS: readonly ArmorSlotKey[] = ['helmet', 'chestplate', 'leggings', 'boots'] as const;
export type ItemDrop = {
  id: number;
  itemId: number;
  blockId?: number;
  position: Vec3;
  velocity: Vec3;
  age: number;
};
export type ChunkData = { cx: number; cz: number; blocks: Uint8Array; facings?: Record<string, string> };
export type ViewMode = 'first-person' | 'third-back' | 'third-front';
export type ToolType = 'hand' | 'pickaxe' | 'axe' | 'shovel' | 'hoe' | 'sword' | 'shears';
export type ChatMessage = { id: string; sender: string; message: string; timestamp?: number };
export type EntityStateValue = string | number | boolean;
export type EntityStateMap = Record<string, EntityStateValue>;
export type EntityInteractionAction = 'use' | 'talk' | 'shear' | 'trade';
export type ItemOrBlockRef = { itemId?: number | null; blockId?: number | null };

export type BlockFace = 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west';
export type BlockTextures = Record<BlockFace, string>;
export type BlockRenderShape = 'cube' | 'cross';
export type BlockPlacementStateKind = 'axis' | 'facing';
export type BlockPlacementDefaultState = {
  axis?: 'x' | 'y' | 'z';
  facing?: 'north' | 'south' | 'east' | 'west';
};
export type BlockBehaviorTag = 'fluid_source' | 'irrigation_water' | 'farmland' | 'falls_with_gravity' | 'crop';

export interface BlockToolTransform {
  tool: ToolType;
  toBlockId: number;
  requiresAirAbove?: boolean;
  preserveResolvedState?: boolean;
  setState?: EntityStateMap;
  message?: string;
}

export interface BlockDropDef {
  itemId?: number;
  blockId?: number;
  count: number;
  chance?: number;
}

export interface BlockDef {
  id: number;
  name: string;
  textures: BlockTextures;
  transparent: boolean;
  translucent: boolean;
  solid: boolean;
  breakable: boolean;
  hardness: number;
  drops?: BlockDropDef[];
  tool?: ToolType;
  requiredToolTier?: number;
  itemTexture?: string;
  stripToBlockId?: number;
  renderShape?: BlockRenderShape;
  placementState?: BlockPlacementStateKind;
  placementStateDefault?: BlockPlacementDefaultState;
  toolTransforms?: BlockToolTransform[];
  behaviors?: BlockBehaviorTag[];
  fluidPickupItemId?: number;
  fluidFlowDistance?: number;
}

export interface CraftingRecipe {
  name: string;
  inputs: { itemId: number; count: number }[];
  output: { itemId: number; count: number };
  /** 3×3 shaped pattern (row-major, length 9). 0 = empty, >0 = required itemId. If absent, recipe is shapeless. */
  shape?: number[];
}

export interface TargetBlock {
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number;
  state?: EntityStateMap;
}

export interface GameSettings {
  renderDistance: number;
  mouseSensitivity: number;
  fov: number;
  showCoords: boolean;
  showFps: boolean;
  nativeHud: boolean;
  volume: number;
  shadows: boolean;
  shadowQuality: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  renderDistance: 6,
  mouseSensitivity: 1,
  fov: 75,
  showCoords: true,
  showFps: true,
  nativeHud: true,
  volume: 100,
  shadows: false,
  shadowQuality: 1,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function clampGameSettings(input: GameSettings): GameSettings {
  return {
    renderDistance: Math.round(clamp(input.renderDistance, 2, 16)),
    mouseSensitivity: Number(clamp(input.mouseSensitivity, 0.1, 3).toFixed(2)),
    fov: Math.round(clamp(input.fov, 50, 120)),
    showCoords: Boolean(input.showCoords),
    showFps: Boolean(input.showFps),
    nativeHud: Boolean(input.nativeHud),
    volume: Math.round(clamp(input.volume, 0, 100)),
    shadows: Boolean(input.shadows),
    shadowQuality: Math.round(clamp(input.shadowQuality, 0, 2)),
  };
}

export interface ToolStats {
  attackDamage?: number;
  useCooldownMs?: number;
}

// World constants
export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 128;
export const RENDER_DIST = 6;
export const WATER_LEVEL = 32;

// Player constants
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_SPEED = 5;
/** Survival HUD / hunger scale (10 icons × 2 half-shanks). */
export const PLAYER_FOOD_MAX = 20;
/** Initial hidden saturation when spawning (drains before visible hunger). */
export const PLAYER_START_SATURATION = 5;
export const JUMP_VELOCITY = 7.5;
export const GRAVITY = 22;
export const TERMINAL_VELOCITY = 50;

// Texture atlas
export const ATLAS_TILE_SIZE = 16;
export const ATLAS_COLS = 32;

// Asset paths - served by Vite middleware from cloned repo
export const MC_ASSETS = '/mc/assets/minecraft';
export const MC_TEXTURES = `${MC_ASSETS}/textures`;
export const MC_MODELS = `${MC_ASSETS}/models`;

export function resolveItemId(ref: ItemOrBlockRef | null | undefined): number | null {
  if (!ref) return null;
  return ref.itemId ?? ref.blockId ?? null;
}

/** `c2s:useItem` body — uses selected hotbar item (see `ProtocolC2S` in GameContext). */
export type C2SUseItemPayload = Record<string, never>;
