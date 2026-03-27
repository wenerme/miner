import { z } from 'zod';

/**
 * Protocol event names — only events that remain as EventBus messages.
 * All other state changes are now direct valtio proxy mutations via GameContext.
 */
export const C2S = {
  REQUEST_CHUNKS: 'c2s:requestChunks',
  ATTACK_ENTITY: 'c2s:attackEntity',
  BREAK_BLOCK: 'c2s:breakBlock',
  START_BREAK: 'c2s:startBreak',
  CANCEL_BREAK: 'c2s:cancelBreak',
  INTERACT_BLOCK: 'c2s:interactBlock',
  PLACE_BLOCK: 'c2s:placeBlock',
  INTERACT_ENTITY: 'c2s:interactEntity',
  CRAFT: 'c2s:craft',
  CHAT: 'c2s:chat',
  COMMAND: 'c2s:command',
  SWAP_OFFHAND: 'c2s:swapOffhand',
  USE_ITEM: 'c2s:useItem',
  INVENTORY_CLICK: 'c2s:inventoryClick',
  INVENTORY_COLLECT: 'c2s:inventoryCollect',
  INVENTORY_CLOSE: 'c2s:inventoryClose',
  FURNACE_CLICK: 'c2s:furnaceClick',
  FURNACE_CLOSE: 'c2s:furnaceClose',
  CHEST_CLICK: 'c2s:chestClick',
  CHEST_CLOSE: 'c2s:chestClose',
} as const;

export const S2C = {
  CHUNK: 's2c:chunk',
  BLOCK_CHANGE: 's2c:blockChange',
  OPEN_CRAFT_TABLE: 's2c:openCraftTable',
  BREAK_PROGRESS: 's2c:breakProgress',
  OPEN_FURNACE: 's2c:openFurnace',
  OPEN_CHEST: 's2c:openChest',
} as const;

export const Vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });
export const InventorySlotSchema = z.object({
  itemId: z.number(),
  count: z.number(),
  durability: z.number().int().positive().optional(),
});

export const ToolTypes = ['hand', 'pickaxe', 'axe', 'shovel', 'hoe', 'sword', 'shears'] as const;
export const ToolTypeSchema = z.enum(ToolTypes);

export const ViewModes = ['first-person', 'third-back', 'third-front'] as const;
export const ViewModeSchema = z.enum(ViewModes);

export const C2SSchemas = {
  [C2S.REQUEST_CHUNKS]: z.object({ cx: z.number(), cz: z.number(), radius: z.number() }),
  [C2S.ATTACK_ENTITY]: z.object({ id: z.number().int().positive() }),
  [C2S.BREAK_BLOCK]: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  [C2S.START_BREAK]: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  [C2S.CANCEL_BREAK]: z.object({}),
  [C2S.INTERACT_BLOCK]: z.object({ x: z.number(), y: z.number(), z: z.number(), action: z.enum(['use']) }),
  [C2S.PLACE_BLOCK]: z.object({ x: z.number(), y: z.number(), z: z.number(), blockId: z.number() }),
  [C2S.INTERACT_ENTITY]: z.object({ id: z.number().int().positive(), action: z.enum(['use', 'talk', 'shear', 'trade']) }),
  [C2S.CRAFT]: z.object({ recipeIndex: z.number().int().min(0) }),
  [C2S.CHAT]: z.object({ message: z.string().min(1).max(256) }),
  [C2S.COMMAND]: z.object({ command: z.string().min(1) }),
  [C2S.SWAP_OFFHAND]: z.object({}),
  [C2S.USE_ITEM]: z.object({}),
  [C2S.INVENTORY_CLICK]: z.object({
    index: z.number().int().min(0),
    button: z.enum(['left', 'right']),
    shift: z.boolean().optional(),
    area: z.enum(['player', 'craftTable', 'craftResult']).optional(),
  }),
  [C2S.INVENTORY_COLLECT]: z.object({
    index: z.number().int().min(0),
    area: z.enum(['player', 'craftTable']).optional(),
  }),
  [C2S.INVENTORY_CLOSE]: z.object({}),
  [C2S.FURNACE_CLICK]: z.object({
    slot: z.enum(['input', 'fuel', 'output']),
    button: z.enum(['left', 'right']),
    shift: z.boolean().optional(),
  }),
  [C2S.FURNACE_CLOSE]: z.object({}),
  [C2S.CHEST_CLICK]: z.object({
    slotIndex: z.number().int().min(0),
    button: z.enum(['left', 'right']),
    shift: z.boolean().optional(),
  }),
  [C2S.CHEST_CLOSE]: z.object({}),
} as const;

export const COMMANDS = {
  FLY: 'fly',
  FAST: 'fast',
  NOCLIP: 'noclip',
  TP: 'tp',
  GIVE: 'give',
  SEED: 'seed',
  TIME: 'time',
  CLEAR: 'clear',
  HELP: 'help',
  GAMEMODE: 'gamemode',
  ABILITIES: 'abilities',
  SPAWN: 'spawn',
  ENTITIES: 'entities',
} as const;
