import { BlockTypes as B } from './BlockRegistry';
import { WATER_LEVEL } from './types';

export interface BiomeDef {
  id: string;
  name: string;
  topBlock: number;
  fillerBlock: number;
  stoneBlock: number;
  heatPoint: number;
  humidityPoint: number;
  minHeight: number;
  maxHeight: number;
  trees?: { log: number; leaves: number; density: number }[];
  flowers?: { blockId: number; density: number }[];
}

export const BIOMES: BiomeDef[] = [
  {
    id: 'grassland',
    name: 'Grassland',
    topBlock: B.GRASS,
    fillerBlock: B.DIRT,
    stoneBlock: B.STONE,
    heatPoint: 50,
    humidityPoint: 50,
    minHeight: 1,
    maxHeight: 200,
    trees: [{ log: B.OAK_LOG, leaves: B.OAK_LEAVES, density: 0.08 }],
    flowers: [
      { blockId: B.POPPY, density: 0.03 },
      { blockId: B.DANDELION, density: 0.03 },
      { blockId: B.AZURE_BLUET, density: 0.015 },
      { blockId: B.CORNFLOWER, density: 0.012 },
      { blockId: B.OXEYE_DAISY, density: 0.01 },
      { blockId: B.RED_TULIP, density: 0.008 },
      { blockId: B.ORANGE_TULIP, density: 0.006 },
    ],
  },
  {
    id: 'forest',
    name: 'Forest',
    topBlock: B.GRASS,
    fillerBlock: B.DIRT,
    stoneBlock: B.STONE,
    heatPoint: 45,
    humidityPoint: 70,
    minHeight: 1,
    maxHeight: 200,
    trees: [
      { log: B.OAK_LOG, leaves: B.OAK_LEAVES, density: 0.2 },
      { log: B.BIRCH_LOG, leaves: B.BIRCH_LEAVES, density: 0.1 },
    ],
    flowers: [
      { blockId: B.POPPY, density: 0.02 },
      { blockId: B.DANDELION, density: 0.02 },
      { blockId: B.ALLIUM, density: 0.01 },
      { blockId: B.LILY_OF_THE_VALLEY, density: 0.01 },
      { blockId: B.RED_TULIP, density: 0.007 },
      { blockId: B.ORANGE_TULIP, density: 0.007 },
      { blockId: B.WHITE_TULIP, density: 0.006 },
      { blockId: B.PINK_TULIP, density: 0.006 },
      { blockId: B.WITHER_ROSE, density: 0.002 },
    ],
  },
  {
    id: 'taiga',
    name: 'Taiga',
    topBlock: B.SNOW,
    fillerBlock: B.DIRT,
    stoneBlock: B.STONE,
    heatPoint: 20,
    humidityPoint: 60,
    minHeight: 1,
    maxHeight: 200,
    trees: [{ log: B.SPRUCE_LOG, leaves: B.SPRUCE_LEAVES, density: 0.15 }],
    flowers: [
      { blockId: B.ALLIUM, density: 0.006 },
      { blockId: B.BLUE_ORCHID, density: 0.005 },
    ],
  },
  {
    id: 'desert',
    name: 'Desert',
    topBlock: B.SAND,
    fillerBlock: B.SAND,
    stoneBlock: B.STONE,
    heatPoint: 80,
    humidityPoint: 20,
    minHeight: 1,
    maxHeight: 200,
  },
  {
    id: 'tundra',
    name: 'Tundra',
    topBlock: B.SNOW,
    fillerBlock: B.DIRT,
    stoneBlock: B.STONE,
    heatPoint: 10,
    humidityPoint: 30,
    minHeight: 1,
    maxHeight: 200,
  },
  {
    id: 'swamp',
    name: 'Swamp',
    topBlock: B.MOSS,
    fillerBlock: B.CLAY,
    stoneBlock: B.STONE,
    heatPoint: 55,
    humidityPoint: 85,
    minHeight: 1,
    maxHeight: 40,
    flowers: [
      { blockId: B.BLUE_ORCHID, density: 0.02 },
      { blockId: B.ALLIUM, density: 0.008 },
    ],
  },
  {
    id: 'beach',
    name: 'Beach',
    topBlock: B.SAND,
    fillerBlock: B.SAND,
    stoneBlock: B.STONE,
    heatPoint: 50,
    humidityPoint: 50,
    minHeight: -10,
    maxHeight: 34,
  },
  {
    id: 'mountains',
    name: 'Mountains',
    topBlock: B.STONE,
    fillerBlock: B.STONE,
    stoneBlock: B.STONE,
    heatPoint: 35,
    humidityPoint: 40,
    minHeight: 55,
    maxHeight: 200,
    trees: [{ log: B.SPRUCE_LOG, leaves: B.SPRUCE_LEAVES, density: 0.05 }],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    topBlock: B.SAND,
    fillerBlock: B.SAND,
    stoneBlock: B.STONE,
    heatPoint: 50,
    humidityPoint: 50,
    minHeight: -200,
    maxHeight: 30,
  },
];

/** Whittaker-style biome selection with height-based priority layers. */
export function selectBiome(heat: number, humidity: number, height: number): BiomeDef {
  if (height < WATER_LEVEL - 3) return BIOMES.find(b => b.id === 'ocean') ?? BIOMES[0];
  if (height <= WATER_LEVEL + 1) return BIOMES.find(b => b.id === 'beach') ?? BIOMES[0];
  if (height >= 60) return BIOMES.find(b => b.id === 'mountains') ?? BIOMES[0];

  const heatNorm = heat * 100;
  const humidityNorm = humidity * 100;

  let best: BiomeDef | null = null;
  let bestDist = Infinity;

  for (const b of BIOMES) {
    if (b.id === 'ocean' || b.id === 'beach' || b.id === 'mountains') continue;
    if (height < b.minHeight || height > b.maxHeight) continue;
    const d =
      (heatNorm - b.heatPoint) ** 2 + (humidityNorm - b.humidityPoint) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }

  return best ?? BIOMES[0];
}
