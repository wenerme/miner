import { BlockTypes as B } from '#/block/BlockRegistry';
import { ItemTypes } from '#/common/ItemRegistry';
import type { EntityDef } from './Entity';

export interface NpcTradeOffer {
  wantItemId: number;
  wantCount: number;
  giveItemId: number;
  giveCount: number;
}

export interface NpcInteractionProfile {
  defaultDialogue?: string;
  dialogueByProfession?: Record<string, string>;
  defaultTradeOffers?: NpcTradeOffer[];
  tradeOffersByProfession?: Record<string, NpcTradeOffer[]>;
}

export const NPC_INTERACTION_PROFILES: Record<string, NpcInteractionProfile> = {
  farmer: {
    defaultDialogue: 'crops look healthy today',
    defaultTradeOffers: [
      { wantItemId: ItemTypes.WHEAT, wantCount: 20, giveItemId: ItemTypes.EMERALD, giveCount: 1 },
      { wantItemId: ItemTypes.POTATO, wantCount: 24, giveItemId: ItemTypes.EMERALD, giveCount: 1 },
      { wantItemId: ItemTypes.EMERALD, wantCount: 1, giveItemId: ItemTypes.BREAD, giveCount: 6 },
    ],
  },
  miner: {
    defaultDialogue: 'keep a torch ready before heading underground',
    defaultTradeOffers: [
      { wantItemId: ItemTypes.COAL, wantCount: 15, giveItemId: ItemTypes.EMERALD, giveCount: 1 },
      { wantItemId: ItemTypes.RAW_IRON, wantCount: 8, giveItemId: ItemTypes.EMERALD, giveCount: 1 },
    ],
  },
  guard: {
    defaultDialogue: 'stay alert near the tree line after sunset',
  },
  villager: {
    defaultDialogue: 'the village is still taking shape',
    dialogueByProfession: {
      farmer: 'crops look healthy today',
      librarian: 'books and maps are easier to trust than rumors',
      cleric: 'redstone dust and rare minerals both have their uses',
      fletcher: 'straight feathers make the best arrows',
      cartographer: 'every new biome deserves a mark on the map',
      fisherman: 'rivers are calmer before sunrise and after rain',
      shepherd: 'keep the flock calm and the wool stays cleaner',
      toolsmith: 'a sharp edge matters more than a shiny handle',
      weaponsmith: 'balance the swing before you chase the damage',
      armorer: 'good armor is quieter confidence than loud steel',
    },
    tradeOffersByProfession: {
      farmer: [
        { wantItemId: ItemTypes.WHEAT, wantCount: 20, giveItemId: ItemTypes.EMERALD, giveCount: 1 },
        { wantItemId: ItemTypes.POTATO, wantCount: 24, giveItemId: ItemTypes.EMERALD, giveCount: 1 },
        { wantItemId: ItemTypes.CARROT, wantCount: 22, giveItemId: ItemTypes.EMERALD, giveCount: 1 },
        { wantItemId: ItemTypes.EMERALD, wantCount: 1, giveItemId: ItemTypes.BREAD, giveCount: 6 },
      ],
      toolsmith: [
        { wantItemId: ItemTypes.COAL, wantCount: 15, giveItemId: ItemTypes.EMERALD, giveCount: 1 },
        { wantItemId: ItemTypes.EMERALD, wantCount: 3, giveItemId: ItemTypes.IRON_PICKAXE, giveCount: 1 },
        { wantItemId: ItemTypes.EMERALD, wantCount: 3, giveItemId: ItemTypes.IRON_AXE, giveCount: 1 },
      ],
      librarian: [
        { wantItemId: B.OAK_PLANKS, wantCount: 24, giveItemId: ItemTypes.EMERALD, giveCount: 1 },
        { wantItemId: ItemTypes.EMERALD, wantCount: 1, giveItemId: B.TORCH, giveCount: 16 },
      ],
      armorer: [
        { wantItemId: ItemTypes.IRON_INGOT, wantCount: 4, giveItemId: ItemTypes.EMERALD, giveCount: 1 },
        { wantItemId: ItemTypes.EMERALD, wantCount: 5, giveItemId: ItemTypes.IRON_CHESTPLATE, giveCount: 1 },
        { wantItemId: ItemTypes.EMERALD, wantCount: 3, giveItemId: ItemTypes.IRON_HELMET, giveCount: 1 },
      ],
      fisherman: [
        { wantItemId: B.SAND, wantCount: 10, giveItemId: ItemTypes.EMERALD, giveCount: 1 },
        { wantItemId: ItemTypes.EMERALD, wantCount: 1, giveItemId: ItemTypes.COOKED_BEEF, giveCount: 4 },
      ],
      weaponsmith: [
        { wantItemId: ItemTypes.IRON_INGOT, wantCount: 6, giveItemId: ItemTypes.EMERALD, giveCount: 1 },
        { wantItemId: ItemTypes.EMERALD, wantCount: 4, giveItemId: ItemTypes.IRON_SWORD, giveCount: 1 },
      ],
      shepherd: [
        { wantItemId: B.WHITE_WOOL, wantCount: 18, giveItemId: ItemTypes.EMERALD, giveCount: 1 },
        { wantItemId: ItemTypes.EMERALD, wantCount: 1, giveItemId: ItemTypes.SHEARS, giveCount: 1 },
      ],
    },
  },
};

export const ENTITY_DEFS: Record<string, EntityDef> = {
  chicken: {
    type: 'chicken',
    name: 'Chicken',
    maxHp: 4,
    speed: 1.5,
    width: 0.4,
    height: 0.7,
    hostile: false,
    defaultState: {
      eggCooldownMs: 0,
    },
    timing: {
      actionDurationsMs: {
        laying: 250,
      },
      cooldownsMs: {
        eggCooldownMs: 18_000,
        panicMs: 1_600,
      },
    },
    interactions: ['use'],
    interactionMechanics: {
      cooldownDropOnUse: {
        action: 'use',
        cooldownStateKey: 'eggCooldownMs',
        cooldownMs: 18_000,
        drop: { itemId: ItemTypes.EGG, blockId: ItemTypes.EGG, count: 1 },
        actionName: 'collect_egg',
        actionStateName: 'laying',
        actionDurationMs: 250,
        cooldownMessage: 'has no egg ready yet',
        successMessage: 'laid an egg',
      },
    },
    drops: [
      { blockId: ItemTypes.RAW_CHICKEN, count: 1 },
      { blockId: ItemTypes.FEATHER, count: 1, chance: 0.9 },
    ],
    spawnBiomes: ['grassland', 'forest'],
    spawnWeight: 10,
  },
  cow: {
    type: 'cow',
    name: 'Cow',
    maxHp: 10,
    speed: 1.2,
    width: 0.9,
    height: 1.4,
    hostile: false,
    defaultState: {
      milkCooldownMs: 0,
    },
    timing: {
      actionDurationsMs: {
        milked: 250,
        hurt: 220,
      },
      cooldownsMs: {
        milkCooldownMs: 20_000,
        panicMs: 1_900,
      },
    },
    interactions: ['use'],
    interactionMechanics: {
      fillContainerOnUse: {
        action: 'use',
        requiredItemId: ItemTypes.BUCKET,
        cooldownStateKey: 'milkCooldownMs',
        cooldownMs: 20_000,
        replaceSelectedItem: { itemId: ItemTypes.MILK_BUCKET, count: 1 },
        actionName: 'milk',
        actionStateName: 'milked',
        actionDurationMs: 250,
        missingItemMessage: 'needs an empty bucket',
        cooldownMessage: 'needs more time before you can milk it again',
        successMessage: 'filled your bucket with milk',
      },
    },
    drops: [
      { blockId: ItemTypes.RAW_BEEF, countMin: 1, countMax: 3 },
      { blockId: ItemTypes.LEATHER, count: 1, chance: 0.7 },
    ],
    spawnBiomes: ['grassland', 'forest'],
    spawnWeight: 8,
  },
  sheep: {
    type: 'sheep',
    name: 'Sheep',
    maxHp: 8,
    speed: 1.3,
    width: 0.9,
    height: 1.3,
    hostile: false,
    defaultState: {
      sheared: false,
      woolColor: 'white',
      regrowMs: 0,
    },
    timing: {
      actionDurationsMs: {
        hurt: 220,
        regrow: 300,
      },
      cooldownsMs: {
        regrowMs: 30_000,
        panicMs: 1_900,
      },
    },
    interactions: ['use', 'shear'],
    interactionDefaults: {
      withTool: {
        shears: 'shear',
      },
    },
    drops: [
      { blockId: ItemTypes.RAW_MUTTON, countMin: 1, countMax: 2 },
    ],
    interactionMechanics: {
      shearing: {
        action: 'shear',
        requiredTool: 'shears',
        shearedStateKey: 'sheared',
        cooldownStateKey: 'regrowMs',
        cooldownMs: 30_000,
        drops: [{ itemId: B.WHITE_WOOL, blockId: B.WHITE_WOOL, count: 2 }],
        missingToolMessage: 'needs shears',
        alreadyDoneMessage: 'is already sheared',
        successMessage: 'was sheared',
      },
    },
    spawnBiomes: ['grassland', 'forest', 'taiga'],
    spawnWeight: 8,
  },
  pig: {
    type: 'pig',
    name: 'Pig',
    maxHp: 10,
    speed: 1.3,
    width: 0.9,
    height: 0.9,
    hostile: false,
    timing: {
      cooldownsMs: {
        panicMs: 1_900,
      },
    },
    drops: [{ blockId: ItemTypes.RAW_PORKCHOP, countMin: 1, countMax: 3 }],
    spawnBiomes: ['grassland', 'forest'],
    spawnWeight: 8,
  },
  wolf: {
    type: 'wolf',
    name: 'Wolf',
    maxHp: 8,
    speed: 2.0,
    width: 0.6,
    height: 0.85,
    hostile: false,
    spawnBiomes: ['forest', 'taiga'],
    spawnWeight: 3,
  },
  cat: {
    type: 'cat',
    name: 'Cat',
    maxHp: 10,
    speed: 1.8,
    width: 0.6,
    height: 0.7,
    hostile: false,
    spawnBiomes: ['grassland'],
    spawnWeight: 2,
  },
  rabbit: {
    type: 'rabbit',
    name: 'Rabbit',
    maxHp: 3,
    speed: 2.5,
    width: 0.4,
    height: 0.5,
    hostile: false,
    spawnBiomes: ['grassland', 'desert', 'taiga', 'tundra'],
    spawnWeight: 6,
  },
  fish: {
    type: 'fish',
    name: 'Fish',
    maxHp: 3,
    speed: 1.5,
    width: 0.4,
    height: 0.3,
    hostile: false,
    spawnBiomes: ['ocean', 'beach'],
    spawnWeight: 10,
  },
  farmer: {
    type: 'farmer',
    name: 'Farmer',
    maxHp: 20,
    speed: 1.0,
    width: 0.6,
    height: 1.8,
    hostile: false,
    defaultAttributes: {
      profession: 'farmer',
      interactable: true,
    },
    timing: {
      actionDurationsMs: {
        talk: 450,
        use: 450,
        trade: 300,
        hurt: 220,
      },
    },
    interactions: ['use', 'talk', 'trade'],
    interactionDefaults: {
      use: 'talk',
    },
    spawnBiomes: ['grassland'],
    spawnWeight: 1,
  },
  miner: {
    type: 'miner',
    name: 'Miner',
    maxHp: 20,
    speed: 1.0,
    width: 0.6,
    height: 1.8,
    hostile: false,
    defaultAttributes: {
      profession: 'miner',
      interactable: true,
    },
    timing: {
      actionDurationsMs: {
        talk: 450,
        use: 450,
        trade: 300,
        hurt: 220,
      },
    },
    interactions: ['use', 'talk', 'trade'],
    interactionDefaults: {
      use: 'talk',
    },
    spawnBiomes: ['mountains'],
    spawnWeight: 1,
  },
  guard: {
    type: 'guard',
    name: 'Guard',
    maxHp: 30,
    speed: 1.5,
    width: 0.6,
    height: 1.8,
    hostile: false,
    defaultAttributes: {
      profession: 'guard',
      interactable: true,
    },
    timing: {
      actionDurationsMs: {
        talk: 450,
        use: 450,
        hurt: 220,
      },
    },
    interactions: ['use', 'talk'],
    interactionDefaults: {
      use: 'talk',
    },
    spawnBiomes: ['grassland', 'forest'],
    spawnWeight: 1,
  },

  // Hostile mobs
  zombie: {
    type: 'zombie',
    name: 'Zombie',
    maxHp: 20,
    speed: 1.0,
    width: 0.6,
    height: 1.8,
    hostile: true,
    burnsInDaylight: true,
    attackDamage: 3,
    attackRange: 1.3,
    aggroRange: 12,
    timing: {
      actionDurationsMs: {
        attack: 350,
        hurt: 220,
      },
      cooldownsMs: {
        attackCooldownMs: 1_200,
      },
    },
    spawnBiomes: ['grassland', 'forest', 'taiga'],
    spawnWeight: 5,
    drops: [
      { itemId: ItemTypes.ROTTEN_FLESH, countMin: 0, countMax: 2 },
      { itemId: ItemTypes.IRON_INGOT, count: 1, chance: 0.025 },
    ],
  },
  skeleton: {
    type: 'skeleton',
    name: 'Skeleton',
    maxHp: 20,
    speed: 1.2,
    width: 0.6,
    height: 1.8,
    hostile: true,
    burnsInDaylight: true,
    attackDamage: 2,
    attackRange: 6.5,
    aggroRange: 14,
    timing: {
      actionDurationsMs: {
        attack: 350,
        hurt: 220,
      },
      cooldownsMs: {
        attackCooldownMs: 1_200,
      },
    },
    spawnBiomes: ['grassland', 'forest', 'taiga'],
    spawnWeight: 5,
    drops: [
      { itemId: ItemTypes.BONE, countMin: 0, countMax: 2 },
      { itemId: ItemTypes.COAL, count: 1, chance: 0.1 },
    ],
  },
  creeper: {
    type: 'creeper',
    name: 'Creeper',
    maxHp: 20,
    speed: 1.0,
    width: 0.6,
    height: 1.7,
    hostile: true,
    attackDamage: 5,
    attackRange: 1.1,
    aggroRange: 10,
    timing: {
      actionDurationsMs: {
        attack: 350,
        hurt: 220,
      },
      cooldownsMs: {
        attackCooldownMs: 1_200,
      },
    },
    spawnBiomes: ['grassland', 'forest', 'taiga'],
    spawnWeight: 5,
    drops: [
      { itemId: ItemTypes.GUNPOWDER, countMin: 0, countMax: 2 },
    ],
  },
  spider: {
    type: 'spider',
    name: 'Spider',
    maxHp: 16,
    speed: 1.5,
    width: 1.4,
    height: 0.9,
    hostile: true,
    attackDamage: 2,
    attackRange: 1.6,
    aggroRange: 12,
    timing: {
      actionDurationsMs: {
        attack: 350,
        hurt: 220,
      },
      cooldownsMs: {
        attackCooldownMs: 1_200,
      },
    },
    spawnBiomes: ['forest', 'taiga'],
    spawnWeight: 3,
    drops: [
      { itemId: ItemTypes.STRING, countMin: 0, countMax: 2 },
      { itemId: ItemTypes.SPIDER_EYE, count: 1, chance: 0.33 },
    ],
  },

  // Passive / neutral animals
  horse: {
    type: 'horse',
    name: 'Horse',
    maxHp: 30,
    speed: 2.5,
    width: 1.4,
    height: 1.6,
    hostile: false,
    spawnBiomes: ['grassland', 'forest'],
    spawnWeight: 4,
  },
  donkey: {
    type: 'donkey',
    name: 'Donkey',
    maxHp: 30,
    speed: 1.8,
    width: 1.4,
    height: 1.5,
    hostile: false,
    spawnBiomes: ['grassland', 'desert'],
    spawnWeight: 3,
  },
  llama: {
    type: 'llama',
    name: 'Llama',
    maxHp: 30,
    speed: 1.5,
    width: 0.9,
    height: 1.87,
    hostile: false,
    spawnBiomes: ['mountains', 'grassland'],
    spawnWeight: 2,
  },
  fox: {
    type: 'fox',
    name: 'Fox',
    maxHp: 10,
    speed: 2.0,
    width: 0.6,
    height: 0.7,
    hostile: false,
    spawnBiomes: ['taiga', 'forest'],
    spawnWeight: 4,
  },
  bee: {
    type: 'bee',
    name: 'Bee',
    maxHp: 10,
    speed: 1.2,
    width: 0.7,
    height: 0.6,
    hostile: false,
    spawnBiomes: ['grassland', 'forest'],
    spawnWeight: 6,
  },
  panda: {
    type: 'panda',
    name: 'Panda',
    maxHp: 20,
    speed: 1.0,
    width: 1.3,
    height: 1.25,
    hostile: false,
    spawnBiomes: ['forest'],
    spawnWeight: 2,
  },
  parrot: {
    type: 'parrot',
    name: 'Parrot',
    maxHp: 6,
    speed: 1.5,
    width: 0.5,
    height: 0.9,
    hostile: false,
    spawnBiomes: ['forest'],
    spawnWeight: 3,
  },
  goat: {
    type: 'goat',
    name: 'Goat',
    maxHp: 10,
    speed: 1.8,
    width: 0.9,
    height: 1.3,
    hostile: false,
    spawnBiomes: ['mountains', 'taiga'],
    spawnWeight: 4,
  },

  // Villager
  villager: {
    type: 'villager',
    name: 'Villager',
    maxHp: 20,
    speed: 1.0,
    width: 0.6,
    height: 1.8,
    hostile: false,
    defaultAttributes: {
      profession: 'none',
      interactable: true,
    },
    timing: {
      actionDurationsMs: {
        talk: 450,
        use: 450,
        trade: 300,
        hurt: 220,
      },
    },
    interactions: ['use', 'talk', 'trade'],
    interactionDefaults: {
      use: 'talk',
    },
    spawnBiomes: ['grassland', 'forest'],
    spawnWeight: 2,
  },

  // Golems
  iron_golem: {
    type: 'iron_golem',
    name: 'Iron Golem',
    maxHp: 100,
    speed: 0.8,
    width: 1.4,
    height: 2.7,
    hostile: false,
    spawnBiomes: ['grassland'],
    spawnWeight: 1,
  },
  snow_golem: {
    type: 'snow_golem',
    name: 'Snow Golem',
    maxHp: 4,
    speed: 0.8,
    width: 0.7,
    height: 1.9,
    hostile: false,
    spawnBiomes: ['taiga', 'tundra'],
    spawnWeight: 1,
  },

  bat: {
    type: 'bat',
    name: 'Bat',
    maxHp: 6,
    speed: 1.0,
    width: 0.4,
    height: 0.6,
    hostile: false,
    spawnBiomes: ['desert', 'taiga'],
    spawnWeight: 3,
  },
  slime: {
    type: 'slime',
    name: 'Slime',
    maxHp: 4,
    speed: 0.8,
    width: 0.6,
    height: 0.6,
    hostile: true,
    attackDamage: 2,
    attackRange: 1.3,
    aggroRange: 10,
    spawnBiomes: ['swamp'],
    spawnWeight: 5,
    drops: [
      { itemId: ItemTypes.SLIMEBALL, countMin: 0, countMax: 2 },
    ],
  },
  enderman: {
    type: 'enderman',
    name: 'Enderman',
    maxHp: 40,
    speed: 1.6,
    width: 0.6,
    height: 2.9,
    hostile: true,
    attackDamage: 7,
    attackRange: 2,
    aggroRange: 14,
    spawnBiomes: ['desert', 'grassland', 'forest', 'taiga'],
    spawnWeight: 3,
    drops: [
      { itemId: ItemTypes.ENDER_PEARL, count: 1, chance: 0.5 },
    ],
  },
  blaze: {
    type: 'blaze',
    name: 'Blaze',
    maxHp: 20,
    speed: 1.0,
    width: 0.6,
    height: 1.8,
    hostile: true,
    attackDamage: 6,
    attackRange: 3,
    aggroRange: 14,
    spawnBiomes: ['desert'],
    spawnWeight: 2,
    drops: [
      { itemId: ItemTypes.BLAZE_ROD, count: 1, chance: 0.5 },
    ],
  },
  ghast: {
    type: 'ghast',
    name: 'Ghast',
    maxHp: 10,
    speed: 0.8,
    width: 4,
    height: 4,
    hostile: true,
    attackDamage: 6,
    attackRange: 8,
    aggroRange: 20,
    spawnBiomes: ['desert'],
    spawnWeight: 1,
    drops: [
      { itemId: ItemTypes.GHAST_TEAR, count: 1, chance: 0.33 },
      { itemId: ItemTypes.GUNPOWDER, countMin: 0, countMax: 2 },
    ],
  },
  witch: {
    type: 'witch',
    name: 'Witch',
    maxHp: 26,
    speed: 1.0,
    width: 0.6,
    height: 1.9,
    hostile: true,
    attackDamage: 5,
    attackRange: 3,
    aggroRange: 14,
    spawnBiomes: ['swamp', 'forest'],
    spawnWeight: 2,
    drops: [
      { itemId: ItemTypes.SPIDER_EYE, count: 1, chance: 0.25 },
      { itemId: ItemTypes.GUNPOWDER, count: 1, chance: 0.25 },
      { itemId: ItemTypes.REDSTONE_DUST, countMin: 0, countMax: 2, chance: 0.33 },
    ],
  },
};

export const ANIMAL_TYPES = Object.keys(ENTITY_DEFS).filter(
  (k) =>
    !['farmer', 'miner', 'guard', 'villager', 'iron_golem', 'snow_golem'].includes(
      k,
    ),
);
export const NPC_TYPES = ['farmer', 'miner', 'guard', 'villager'];
export const HOSTILE_TYPES = Object.keys(ENTITY_DEFS).filter(
  (k) => ENTITY_DEFS[k].hostile,
);

export const RENDERABLE_ENTITY_TYPES = [
  'pig',
  'cow',
  'chicken',
  'sheep',
  'wolf',
  'rabbit',
  'cat',
  'farmer',
  'miner',
  'guard',
  'villager',
  'zombie',
  'skeleton',
  'creeper',
  'spider',
  'horse',
  'donkey',
  'fox',
  'bee',
  'panda',
  'parrot',
  'goat',
  'llama',
  'iron_golem',
  'snow_golem',
  'fish',
  'bat',
  'slime',
  'enderman',
  'blaze',
  'ghast',
  'witch',
] as const satisfies readonly string[];
