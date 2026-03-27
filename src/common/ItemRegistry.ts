import { BLOCK_DEFS, BlockTypes } from './BlockRegistry';
import type { ArmorSlotKey, InventorySlot, ToolStats, ToolType } from './types';

export type ItemDef = {
  id: number;
  name: string;
  kind: 'block' | 'tool' | 'material' | 'food' | 'armor';
  blockId?: number;
  placeBlockId?: number;
  toolType?: ToolType;
  toolTier?: number;
  texture: string;
  stackSize: number;
  maxDurability?: number;
  armorSlot?: ArmorSlotKey;
  armorPoints?: number;
  toolStats?: ToolStats;
  nutrition?: number;
  saturationModifier?: number;
};

export const ItemTypes = Object.freeze({
  ...BlockTypes,
  BUCKET: 1002,
  WATER_BUCKET: 1005,
  LAVA_BUCKET: 1006,
  MILK_BUCKET: 1003,
  SHEARS: 1001,
  STICK: 1016,
  EGG: 1017,
  EMERALD: 1018,
  FEATHER: 1019,
  LEATHER: 1023,
  COAL: 1024,
  RAW_IRON: 1025,
  RAW_GOLD: 1026,
  DIAMOND: 1027,
  RAW_COPPER: 1028,
  LAPIS_LAZULI: 1029,
  REDSTONE_DUST: 1033,
  IRON_INGOT: 1030,
  GOLD_INGOT: 1031,
  COPPER_INGOT: 1032,
  WOODEN_AXE: 1004,
  WOODEN_PICKAXE: 1009,
  WOODEN_SHOVEL: 1007,
  WOODEN_HOE: 1008,
  WOODEN_SWORD: 1010,
  STONE_AXE: 1011,
  STONE_PICKAXE: 1012,
  STONE_SHOVEL: 1013,
  STONE_HOE: 1014,
  STONE_SWORD: 1015,
  APPLE: 1034,
  BREAD: 1035,
  COOKED_BEEF: 1036,
  COOKED_PORKCHOP: 1037,
  COOKED_CHICKEN: 1038,
  RAW_BEEF: 1039,
  RAW_PORKCHOP: 1040,
  RAW_CHICKEN: 1041,
  GOLDEN_APPLE: 1042,
  COOKED_MUTTON: 1043,
  RAW_MUTTON: 1044,
  BAKED_POTATO: 1045,
  COOKIE: 1046,
  MELON_SLICE: 1047,
  SWEET_BERRIES: 1048,
  CHARCOAL: 1049,
  LEATHER_HELMET: 1050,
  LEATHER_CHESTPLATE: 1051,
  LEATHER_LEGGINGS: 1052,
  LEATHER_BOOTS: 1053,
  IRON_HELMET: 1054,
  IRON_CHESTPLATE: 1055,
  IRON_LEGGINGS: 1056,
  IRON_BOOTS: 1057,
  GOLD_HELMET: 1058,
  GOLD_CHESTPLATE: 1059,
  GOLD_LEGGINGS: 1060,
  GOLD_BOOTS: 1061,
  DIAMOND_HELMET: 1062,
  DIAMOND_CHESTPLATE: 1063,
  DIAMOND_LEGGINGS: 1064,
  DIAMOND_BOOTS: 1065,
  IRON_PICKAXE: 1066,
  IRON_AXE: 1067,
  IRON_SHOVEL: 1068,
  IRON_HOE: 1069,
  IRON_SWORD: 1070,
  DIAMOND_PICKAXE: 1071,
  DIAMOND_AXE: 1072,
  DIAMOND_SHOVEL: 1073,
  DIAMOND_HOE: 1074,
  DIAMOND_SWORD: 1075,
  GOLD_PICKAXE: 1076,
  GOLD_AXE: 1077,
  GOLD_SHOVEL: 1078,
  GOLD_HOE: 1079,
  GOLD_SWORD: 1080,
  WHEAT_SEEDS: 1081,
  WHEAT: 1082,
  POTATO: 1083,
  CARROT: 1084,
  ROTTEN_FLESH: 1085,
  BONE: 1086,
  STRING: 1087,
  GUNPOWDER: 1088,
  SPIDER_EYE: 1089,
  ENDER_PEARL: 1090,
  SLIMEBALL: 1091,
  BLAZE_ROD: 1092,
  GHAST_TEAR: 1093,
} as const);

export const ITEM_DEFS: Record<number, ItemDef> = {};

for (const [idText, def] of Object.entries(BLOCK_DEFS)) {
  const id = Number(idText);
  ITEM_DEFS[id] = {
    id,
    name: def.name,
    kind: 'block',
    blockId: id,
    texture: def.itemTexture ?? def.textures.top,
    stackSize: 64,
  };
}

ITEM_DEFS[ItemTypes.SHEARS] = {
  id: ItemTypes.SHEARS,
  name: 'Shears',
  kind: 'tool',
  toolType: 'shears',
  toolTier: 1,
  texture: 'shears',
  stackSize: 1,
  maxDurability: 238,
  toolStats: { attackDamage: 1, useCooldownMs: 450 },
};

ITEM_DEFS[ItemTypes.STICK] = {
  id: ItemTypes.STICK,
  name: 'Stick',
  kind: 'material',
  texture: 'stick',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.EGG] = {
  id: ItemTypes.EGG,
  name: 'Egg',
  kind: 'material',
  texture: 'egg',
  stackSize: 16,
};

ITEM_DEFS[ItemTypes.EMERALD] = {
  id: ItemTypes.EMERALD,
  name: 'Emerald',
  kind: 'material',
  texture: 'emerald',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.FEATHER] = {
  id: ItemTypes.FEATHER,
  name: 'Feather',
  kind: 'material',
  texture: 'feather',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.LEATHER] = {
  id: ItemTypes.LEATHER,
  name: 'Leather',
  kind: 'material',
  texture: 'leather',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.COAL] = {
  id: ItemTypes.COAL,
  name: 'Coal',
  kind: 'material',
  texture: 'coal',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.CHARCOAL] = {
  id: ItemTypes.CHARCOAL,
  name: 'Charcoal',
  kind: 'material',
  texture: 'charcoal',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.RAW_IRON] = {
  id: ItemTypes.RAW_IRON,
  name: 'Raw Iron',
  kind: 'material',
  texture: 'raw_iron',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.RAW_GOLD] = {
  id: ItemTypes.RAW_GOLD,
  name: 'Raw Gold',
  kind: 'material',
  texture: 'raw_gold',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.DIAMOND] = {
  id: ItemTypes.DIAMOND,
  name: 'Diamond',
  kind: 'material',
  texture: 'diamond',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.RAW_COPPER] = {
  id: ItemTypes.RAW_COPPER,
  name: 'Raw Copper',
  kind: 'material',
  texture: 'raw_copper',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.LAPIS_LAZULI] = {
  id: ItemTypes.LAPIS_LAZULI,
  name: 'Lapis Lazuli',
  kind: 'material',
  texture: 'lapis_lazuli',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.REDSTONE_DUST] = {
  id: ItemTypes.REDSTONE_DUST,
  name: 'Redstone Dust',
  kind: 'material',
  texture: 'redstone',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.IRON_INGOT] = {
  id: ItemTypes.IRON_INGOT,
  name: 'Iron Ingot',
  kind: 'material',
  texture: 'iron_ingot',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.GOLD_INGOT] = {
  id: ItemTypes.GOLD_INGOT,
  name: 'Gold Ingot',
  kind: 'material',
  texture: 'gold_ingot',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.COPPER_INGOT] = {
  id: ItemTypes.COPPER_INGOT,
  name: 'Copper Ingot',
  kind: 'material',
  texture: 'copper_ingot',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.WOODEN_AXE] = {
  id: ItemTypes.WOODEN_AXE,
  name: 'Wooden Axe',
  kind: 'tool',
  toolType: 'axe',
  toolTier: 1,
  texture: 'wooden_axe',
  stackSize: 1,
  maxDurability: 59,
  toolStats: { attackDamage: 4, useCooldownMs: 700 },
};

ITEM_DEFS[ItemTypes.WOODEN_PICKAXE] = {
  id: ItemTypes.WOODEN_PICKAXE,
  name: 'Wooden Pickaxe',
  kind: 'tool',
  toolType: 'pickaxe',
  toolTier: 1,
  texture: 'wooden_pickaxe',
  stackSize: 1,
  maxDurability: 59,
  toolStats: { attackDamage: 2, useCooldownMs: 600 },
};

ITEM_DEFS[ItemTypes.WOODEN_SHOVEL] = {
  id: ItemTypes.WOODEN_SHOVEL,
  name: 'Wooden Shovel',
  kind: 'tool',
  toolType: 'shovel',
  toolTier: 1,
  texture: 'wooden_shovel',
  stackSize: 1,
  maxDurability: 59,
  toolStats: { attackDamage: 2, useCooldownMs: 550 },
};

ITEM_DEFS[ItemTypes.WOODEN_HOE] = {
  id: ItemTypes.WOODEN_HOE,
  name: 'Wooden Hoe',
  kind: 'tool',
  toolType: 'hoe',
  toolTier: 1,
  texture: 'wooden_hoe',
  stackSize: 1,
  maxDurability: 59,
  toolStats: { attackDamage: 1, useCooldownMs: 500 },
};

ITEM_DEFS[ItemTypes.WOODEN_SWORD] = {
  id: ItemTypes.WOODEN_SWORD,
  name: 'Wooden Sword',
  kind: 'tool',
  toolType: 'sword',
  toolTier: 1,
  texture: 'wooden_sword',
  stackSize: 1,
  maxDurability: 59,
  toolStats: { attackDamage: 6, useCooldownMs: 550 },
};

ITEM_DEFS[ItemTypes.STONE_AXE] = {
  id: ItemTypes.STONE_AXE,
  name: 'Stone Axe',
  kind: 'tool',
  toolType: 'axe',
  toolTier: 2,
  texture: 'stone_axe',
  stackSize: 1,
  maxDurability: 131,
  toolStats: { attackDamage: 5, useCooldownMs: 650 },
};

ITEM_DEFS[ItemTypes.STONE_PICKAXE] = {
  id: ItemTypes.STONE_PICKAXE,
  name: 'Stone Pickaxe',
  kind: 'tool',
  toolType: 'pickaxe',
  toolTier: 2,
  texture: 'stone_pickaxe',
  stackSize: 1,
  maxDurability: 131,
  toolStats: { attackDamage: 3, useCooldownMs: 580 },
};

ITEM_DEFS[ItemTypes.STONE_SHOVEL] = {
  id: ItemTypes.STONE_SHOVEL,
  name: 'Stone Shovel',
  kind: 'tool',
  toolType: 'shovel',
  toolTier: 2,
  texture: 'stone_shovel',
  stackSize: 1,
  maxDurability: 131,
  toolStats: { attackDamage: 2, useCooldownMs: 520 },
};

ITEM_DEFS[ItemTypes.STONE_HOE] = {
  id: ItemTypes.STONE_HOE,
  name: 'Stone Hoe',
  kind: 'tool',
  toolType: 'hoe',
  toolTier: 2,
  texture: 'stone_hoe',
  stackSize: 1,
  maxDurability: 131,
  toolStats: { attackDamage: 1, useCooldownMs: 500 },
};

ITEM_DEFS[ItemTypes.STONE_SWORD] = {
  id: ItemTypes.STONE_SWORD,
  name: 'Stone Sword',
  kind: 'tool',
  toolType: 'sword',
  toolTier: 2,
  texture: 'stone_sword',
  stackSize: 1,
  maxDurability: 131,
  toolStats: { attackDamage: 7, useCooldownMs: 520 },
};

function defTool(id: number, name: string, type: ToolType, tier: number, texture: string, dur: number, atk: number, cd: number) {
  ITEM_DEFS[id] = { id, name, kind: 'tool', toolType: type, toolTier: tier, texture, stackSize: 1, maxDurability: dur, toolStats: { attackDamage: atk, useCooldownMs: cd } };
}

defTool(ItemTypes.IRON_PICKAXE, 'Iron Pickaxe', 'pickaxe', 3, 'iron_pickaxe', 250, 4, 560);
defTool(ItemTypes.IRON_AXE, 'Iron Axe', 'axe', 3, 'iron_axe', 250, 6, 630);
defTool(ItemTypes.IRON_SHOVEL, 'Iron Shovel', 'shovel', 3, 'iron_shovel', 250, 3, 500);
defTool(ItemTypes.IRON_HOE, 'Iron Hoe', 'hoe', 3, 'iron_hoe', 250, 1, 500);
defTool(ItemTypes.IRON_SWORD, 'Iron Sword', 'sword', 3, 'iron_sword', 250, 8, 500);

defTool(ItemTypes.DIAMOND_PICKAXE, 'Diamond Pickaxe', 'pickaxe', 4, 'diamond_pickaxe', 1561, 5, 540);
defTool(ItemTypes.DIAMOND_AXE, 'Diamond Axe', 'axe', 4, 'diamond_axe', 1561, 7, 600);
defTool(ItemTypes.DIAMOND_SHOVEL, 'Diamond Shovel', 'shovel', 4, 'diamond_shovel', 1561, 4, 480);
defTool(ItemTypes.DIAMOND_HOE, 'Diamond Hoe', 'hoe', 4, 'diamond_hoe', 1561, 1, 480);
defTool(ItemTypes.DIAMOND_SWORD, 'Diamond Sword', 'sword', 4, 'diamond_sword', 1561, 9, 480);

defTool(ItemTypes.GOLD_PICKAXE, 'Gold Pickaxe', 'pickaxe', 1, 'golden_pickaxe', 32, 2, 540);
defTool(ItemTypes.GOLD_AXE, 'Gold Axe', 'axe', 1, 'golden_axe', 32, 4, 600);
defTool(ItemTypes.GOLD_SHOVEL, 'Gold Shovel', 'shovel', 1, 'golden_shovel', 32, 1, 500);
defTool(ItemTypes.GOLD_HOE, 'Gold Hoe', 'hoe', 1, 'golden_hoe', 32, 1, 500);
defTool(ItemTypes.GOLD_SWORD, 'Gold Sword', 'sword', 1, 'golden_sword', 32, 6, 500);

ITEM_DEFS[ItemTypes.BUCKET] = {
  id: ItemTypes.BUCKET,
  name: 'Bucket',
  kind: 'tool',
  texture: 'bucket',
  stackSize: 1,
};

ITEM_DEFS[ItemTypes.WATER_BUCKET] = {
  id: ItemTypes.WATER_BUCKET,
  name: 'Water Bucket',
  kind: 'tool',
  placeBlockId: BlockTypes.WATER,
  texture: 'water_bucket',
  stackSize: 1,
};

ITEM_DEFS[ItemTypes.LAVA_BUCKET] = {
  id: ItemTypes.LAVA_BUCKET,
  name: 'Lava Bucket',
  kind: 'tool',
  placeBlockId: BlockTypes.LAVA,
  texture: 'lava_bucket',
  stackSize: 1,
};

ITEM_DEFS[ItemTypes.MILK_BUCKET] = {
  id: ItemTypes.MILK_BUCKET,
  name: 'Milk Bucket',
  kind: 'tool',
  texture: 'milk_bucket',
  stackSize: 1,
};

ITEM_DEFS[ItemTypes.APPLE] = {
  id: ItemTypes.APPLE,
  name: 'Apple',
  kind: 'food',
  texture: 'apple',
  stackSize: 64,
  nutrition: 4,
  saturationModifier: 2.4,
};

ITEM_DEFS[ItemTypes.BREAD] = {
  id: ItemTypes.BREAD,
  name: 'Bread',
  kind: 'food',
  texture: 'bread',
  stackSize: 64,
  nutrition: 5,
  saturationModifier: 6.0,
};

ITEM_DEFS[ItemTypes.WHEAT_SEEDS] = {
  id: ItemTypes.WHEAT_SEEDS,
  name: 'Wheat Seeds',
  kind: 'material',
  texture: 'wheat_seeds',
  stackSize: 64,
  placeBlockId: BlockTypes.WHEAT_CROP,
};

ITEM_DEFS[ItemTypes.WHEAT] = {
  id: ItemTypes.WHEAT,
  name: 'Wheat',
  kind: 'material',
  texture: 'wheat',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.POTATO] = {
  id: ItemTypes.POTATO,
  name: 'Potato',
  kind: 'food',
  texture: 'potato',
  stackSize: 64,
  nutrition: 1,
  saturationModifier: 0.6,
  placeBlockId: BlockTypes.POTATO_CROP,
};

ITEM_DEFS[ItemTypes.CARROT] = {
  id: ItemTypes.CARROT,
  name: 'Carrot',
  kind: 'food',
  texture: 'carrot',
  stackSize: 64,
  nutrition: 3,
  saturationModifier: 3.6,
  placeBlockId: BlockTypes.CARROT_CROP,
};

ITEM_DEFS[ItemTypes.ROTTEN_FLESH] = {
  id: ItemTypes.ROTTEN_FLESH,
  name: 'Rotten Flesh',
  kind: 'food',
  texture: 'rotten_flesh',
  stackSize: 64,
  nutrition: 4,
  saturationModifier: 0.8,
};

ITEM_DEFS[ItemTypes.BONE] = {
  id: ItemTypes.BONE,
  name: 'Bone',
  kind: 'material',
  texture: 'bone',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.STRING] = {
  id: ItemTypes.STRING,
  name: 'String',
  kind: 'material',
  texture: 'string',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.GUNPOWDER] = {
  id: ItemTypes.GUNPOWDER,
  name: 'Gunpowder',
  kind: 'material',
  texture: 'gunpowder',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.SPIDER_EYE] = {
  id: ItemTypes.SPIDER_EYE,
  name: 'Spider Eye',
  kind: 'material',
  texture: 'spider_eye',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.ENDER_PEARL] = {
  id: ItemTypes.ENDER_PEARL,
  name: 'Ender Pearl',
  kind: 'material',
  texture: 'ender_pearl',
  stackSize: 16,
};

ITEM_DEFS[ItemTypes.SLIMEBALL] = {
  id: ItemTypes.SLIMEBALL,
  name: 'Slimeball',
  kind: 'material',
  texture: 'slimeball',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.BLAZE_ROD] = {
  id: ItemTypes.BLAZE_ROD,
  name: 'Blaze Rod',
  kind: 'material',
  texture: 'blaze_rod',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.GHAST_TEAR] = {
  id: ItemTypes.GHAST_TEAR,
  name: 'Ghast Tear',
  kind: 'material',
  texture: 'ghast_tear',
  stackSize: 64,
};

ITEM_DEFS[ItemTypes.COOKED_BEEF] = {
  id: ItemTypes.COOKED_BEEF,
  name: 'Cooked Beef',
  kind: 'food',
  texture: 'cooked_beef',
  stackSize: 64,
  nutrition: 8,
  saturationModifier: 12.8,
};

ITEM_DEFS[ItemTypes.COOKED_PORKCHOP] = {
  id: ItemTypes.COOKED_PORKCHOP,
  name: 'Cooked Porkchop',
  kind: 'food',
  texture: 'cooked_porkchop',
  stackSize: 64,
  nutrition: 8,
  saturationModifier: 12.8,
};

ITEM_DEFS[ItemTypes.COOKED_CHICKEN] = {
  id: ItemTypes.COOKED_CHICKEN,
  name: 'Cooked Chicken',
  kind: 'food',
  texture: 'cooked_chicken',
  stackSize: 64,
  nutrition: 6,
  saturationModifier: 7.2,
};

ITEM_DEFS[ItemTypes.RAW_BEEF] = {
  id: ItemTypes.RAW_BEEF,
  name: 'Raw Beef',
  kind: 'food',
  texture: 'beef',
  stackSize: 64,
  nutrition: 3,
  saturationModifier: 1.8,
};

ITEM_DEFS[ItemTypes.RAW_PORKCHOP] = {
  id: ItemTypes.RAW_PORKCHOP,
  name: 'Raw Porkchop',
  kind: 'food',
  texture: 'porkchop',
  stackSize: 64,
  nutrition: 3,
  saturationModifier: 1.8,
};

ITEM_DEFS[ItemTypes.RAW_CHICKEN] = {
  id: ItemTypes.RAW_CHICKEN,
  name: 'Raw Chicken',
  kind: 'food',
  texture: 'chicken',
  stackSize: 64,
  nutrition: 2,
  saturationModifier: 1.2,
};

ITEM_DEFS[ItemTypes.GOLDEN_APPLE] = {
  id: ItemTypes.GOLDEN_APPLE,
  name: 'Golden Apple',
  kind: 'food',
  texture: 'golden_apple',
  stackSize: 64,
  nutrition: 4,
  saturationModifier: 9.6,
};

ITEM_DEFS[ItemTypes.COOKED_MUTTON] = {
  id: ItemTypes.COOKED_MUTTON,
  name: 'Cooked Mutton',
  kind: 'food',
  texture: 'cooked_mutton',
  stackSize: 64,
  nutrition: 6,
  saturationModifier: 9.6,
};

ITEM_DEFS[ItemTypes.RAW_MUTTON] = {
  id: ItemTypes.RAW_MUTTON,
  name: 'Raw Mutton',
  kind: 'food',
  texture: 'mutton',
  stackSize: 64,
  nutrition: 2,
  saturationModifier: 1.2,
};

ITEM_DEFS[ItemTypes.BAKED_POTATO] = {
  id: ItemTypes.BAKED_POTATO,
  name: 'Baked Potato',
  kind: 'food',
  texture: 'baked_potato',
  stackSize: 64,
  nutrition: 5,
  saturationModifier: 6.0,
};

ITEM_DEFS[ItemTypes.COOKIE] = {
  id: ItemTypes.COOKIE,
  name: 'Cookie',
  kind: 'food',
  texture: 'cookie',
  stackSize: 64,
  nutrition: 2,
  saturationModifier: 0.4,
};

ITEM_DEFS[ItemTypes.MELON_SLICE] = {
  id: ItemTypes.MELON_SLICE,
  name: 'Melon Slice',
  kind: 'food',
  texture: 'melon_slice',
  stackSize: 64,
  nutrition: 2,
  saturationModifier: 1.2,
};

ITEM_DEFS[ItemTypes.SWEET_BERRIES] = {
  id: ItemTypes.SWEET_BERRIES,
  name: 'Sweet Berries',
  kind: 'food',
  texture: 'sweet_berries',
  stackSize: 64,
  nutrition: 2,
  saturationModifier: 0.4,
};

function defArmor(
  id: number,
  name: string,
  texture: string,
  armorSlot: ArmorSlotKey,
  armorPoints: number,
  maxDurability: number,
): ItemDef {
  return {
    id,
    name,
    kind: 'armor',
    texture,
    armorSlot,
    armorPoints,
    stackSize: 1,
    maxDurability,
  };
}

ITEM_DEFS[ItemTypes.LEATHER_HELMET] = defArmor(ItemTypes.LEATHER_HELMET, 'Leather Cap', 'leather_helmet', 'helmet', 1, 55);
ITEM_DEFS[ItemTypes.LEATHER_CHESTPLATE] = defArmor(ItemTypes.LEATHER_CHESTPLATE, 'Leather Tunic', 'leather_chestplate', 'chestplate', 3, 80);
ITEM_DEFS[ItemTypes.LEATHER_LEGGINGS] = defArmor(ItemTypes.LEATHER_LEGGINGS, 'Leather Pants', 'leather_leggings', 'leggings', 2, 75);
ITEM_DEFS[ItemTypes.LEATHER_BOOTS] = defArmor(ItemTypes.LEATHER_BOOTS, 'Leather Boots', 'leather_boots', 'boots', 1, 65);

ITEM_DEFS[ItemTypes.IRON_HELMET] = defArmor(ItemTypes.IRON_HELMET, 'Iron Helmet', 'iron_helmet', 'helmet', 2, 165);
ITEM_DEFS[ItemTypes.IRON_CHESTPLATE] = defArmor(ItemTypes.IRON_CHESTPLATE, 'Iron Chestplate', 'iron_chestplate', 'chestplate', 6, 240);
ITEM_DEFS[ItemTypes.IRON_LEGGINGS] = defArmor(ItemTypes.IRON_LEGGINGS, 'Iron Leggings', 'iron_leggings', 'leggings', 5, 225);
ITEM_DEFS[ItemTypes.IRON_BOOTS] = defArmor(ItemTypes.IRON_BOOTS, 'Iron Boots', 'iron_boots', 'boots', 2, 195);

ITEM_DEFS[ItemTypes.GOLD_HELMET] = defArmor(ItemTypes.GOLD_HELMET, 'Golden Helmet', 'golden_helmet', 'helmet', 2, 77);
ITEM_DEFS[ItemTypes.GOLD_CHESTPLATE] = defArmor(ItemTypes.GOLD_CHESTPLATE, 'Golden Chestplate', 'golden_chestplate', 'chestplate', 5, 112);
ITEM_DEFS[ItemTypes.GOLD_LEGGINGS] = defArmor(ItemTypes.GOLD_LEGGINGS, 'Golden Leggings', 'golden_leggings', 'leggings', 3, 105);
ITEM_DEFS[ItemTypes.GOLD_BOOTS] = defArmor(ItemTypes.GOLD_BOOTS, 'Golden Boots', 'golden_boots', 'boots', 1, 91);

ITEM_DEFS[ItemTypes.DIAMOND_HELMET] = defArmor(ItemTypes.DIAMOND_HELMET, 'Diamond Helmet', 'diamond_helmet', 'helmet', 3, 363);
ITEM_DEFS[ItemTypes.DIAMOND_CHESTPLATE] = defArmor(ItemTypes.DIAMOND_CHESTPLATE, 'Diamond Chestplate', 'diamond_chestplate', 'chestplate', 8, 528);
ITEM_DEFS[ItemTypes.DIAMOND_LEGGINGS] = defArmor(ItemTypes.DIAMOND_LEGGINGS, 'Diamond Leggings', 'diamond_leggings', 'leggings', 6, 495);
ITEM_DEFS[ItemTypes.DIAMOND_BOOTS] = defArmor(ItemTypes.DIAMOND_BOOTS, 'Diamond Boots', 'diamond_boots', 'boots', 3, 429);

export function getItemDef(itemId: number | null | undefined) {
  return itemId == null ? null : (ITEM_DEFS[itemId] ?? null);
}

export function getItemBlockId(itemId: number | null | undefined) {
  return getItemDef(itemId)?.blockId ?? null;
}

export function getItemPlaceBlockId(itemId: number | null | undefined) {
  return getItemDef(itemId)?.placeBlockId ?? null;
}

export function getItemToolType(itemId: number | null | undefined) {
  return getItemDef(itemId)?.toolType ?? null;
}

export function getItemMaxDurability(itemId: number | null | undefined) {
  return getItemDef(itemId)?.maxDurability ?? null;
}

export function getItemToolStats(itemId: number | null | undefined) {
  return getItemDef(itemId)?.toolStats ?? null;
}

export function getItemToolTier(itemId: number | null | undefined) {
  return getItemDef(itemId)?.toolTier ?? 0;
}

export function getItemArmorSlot(itemId: number | null | undefined): ArmorSlotKey | null {
  const d = getItemDef(itemId);
  if (d?.kind !== 'armor' || !d.armorSlot) return null;
  return d.armorSlot;
}

export function sumEquippedArmorPointsFromSlots(armor: {
  helmet: { itemId: number } | null;
  chestplate: { itemId: number } | null;
  leggings: { itemId: number } | null;
  boots: { itemId: number } | null;
}): number {
  let t = 0;
  for (const key of ['helmet', 'chestplate', 'leggings', 'boots'] as const) {
    const s = armor[key];
    if (!s) continue;
    t += getItemDef(s.itemId)?.armorPoints ?? 0;
  }
  return t;
}

export function getItemIconFallbackLabel(itemId: number | null | undefined): string {
  if (itemId == null) return '?';
  const def = getItemDef(itemId);
  if (!def) return String(itemId);
  const words = def.name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return String(itemId);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}

export function getMaxStack(itemId: number): number {
  return getItemDef(itemId)?.stackSize ?? 64;
}

export function canStack(a: InventorySlot, b: InventorySlot): boolean {
  return a.itemId === b.itemId && (a.durability ?? undefined) === (b.durability ?? undefined);
}

export function getItemTextureNames(): string[] {
  const names = new Set<string>();
  for (const def of Object.values(ITEM_DEFS)) {
    if (def.texture) names.add(def.texture);
  }
  return Array.from(names);
}
