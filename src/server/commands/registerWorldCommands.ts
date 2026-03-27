import { BIOMES } from '#/common/BiomeRegistry';
import { BlockTypes } from '#/block/BlockRegistry';
import { CHUNK_SIZE, WATER_LEVEL, WORLD_HEIGHT } from '#/common/types';
import { buildRegressionScene } from '../RegressionScene';
import { isVillageChunk, VILLAGE_STRUCTURE_TARGETS } from '../World';
import type { RegisterCommandFn } from './commandTypes';

const B = BlockTypes;

export function registerWorldCommands(input: {
  registerCommand: RegisterCommandFn;
  parseStateValue: (raw: string) => string | number | boolean;
}) {
  const { registerCommand, parseStateValue } = input;

  registerCommand('seed', (ctx) => {
    ctx.reply(`§aSeed: ${ctx.server.seed}`);
  });

  registerCommand('weather', (ctx) => {
    const type = ctx.args[0];
    if (type === 'clear' || type === 'rain' || type === 'snow') {
      ctx.server.ctx.state.weather = type;
      ctx.reply(`§aWeather set to ${type}`);
    } else {
      ctx.reply('§cUsage: /weather <clear|rain|snow>');
    }
  });

  registerCommand('time', (ctx) => {
    const arg = ctx.args[0];
    if (arg === 'day') {
      ctx.server.ctx.state.timeOfDay = 0;
      ctx.reply('§aTime set to day');
    } else if (arg === 'night') {
      ctx.server.ctx.state.timeOfDay = 0.5;
      ctx.reply('§aTime set to night');
    } else if (arg === 'dawn') {
      ctx.server.ctx.state.timeOfDay = 0.75;
      ctx.reply('§aTime set to dawn');
    } else if (arg === 'dusk') {
      ctx.server.ctx.state.timeOfDay = 0.25;
      ctx.reply('§aTime set to dusk');
    } else {
      const gameTime = ctx.server.ctx.state.timeOfDay;
      ctx.reply(`§aGame time: ${gameTime.toFixed(3)} (${Math.round(gameTime * 24000)} ticks)`);
    }
  });

  registerCommand('chatclear', (ctx) => {
    ctx.server.ctx.state.chat.messages.length = 0;
    ctx.reply('§aChat cleared');
  }, { devOnly: true });

  registerCommand('blockstate', (ctx) => {
    const target = ctx.server.ctx.state.player.targetBlock;
    if (!target) {
      ctx.reply('§cUsage: look at a block, then /blockstate [get|set <key> <value>|clear [key]]');
      return;
    }

    const { x, y, z } = target;
    const blockId = ctx.server.world.getBlock(x, y, z);
    if (blockId === 0) {
      ctx.reply('§cNo solid target block selected');
      return;
    }

    const action = (ctx.args[0] ?? 'get').toLowerCase();
    if (action === 'get') {
      const state = ctx.server.world.getResolvedBlockState(x, y, z);
      if (!state || Object.keys(state).length === 0) {
        ctx.reply(`§7Block ${blockId} @ ${x},${y},${z} state: none`);
        return;
      }
      ctx.reply(`§aBlock ${blockId} @ ${x},${y},${z} state: ${JSON.stringify(state)}`);
      return;
    }

    if (action === 'set') {
      const key = ctx.args[1];
      const rawValue = ctx.args[2];
      if (!key || rawValue == null) {
        ctx.reply('§cUsage: /blockstate set <key> <value>');
        return;
      }
      const current = ctx.server.world.getBlockState(x, y, z) ?? {};
      const next = { ...current, [key]: parseStateValue(rawValue) };
      ctx.server.world.setBlockState(x, y, z, next);
      ctx.reply(`§aBlock state updated: ${key}=${String(next[key])}`);
      return;
    }

    if (action === 'clear') {
      const key = ctx.args[1];
      if (!key) {
        ctx.server.world.setBlockState(x, y, z, null);
        ctx.reply('§aBlock state cleared');
        return;
      }
      const current = ctx.server.world.getBlockState(x, y, z) ?? {};
      const next = { ...current };
      delete next[key];
      ctx.server.world.setBlockState(x, y, z, Object.keys(next).length > 0 ? next : null);
      ctx.reply(`§aBlock state key cleared: ${key}`);
      return;
    }

    ctx.reply('§cUsage: /blockstate [get|set <key> <value>|clear [key]]');
  }, { devOnly: true });

  registerCommand('locate', (ctx) => {
    const rawTarget = ctx.args[0]?.toLowerCase();
    const targetAliases: Record<string, string> = {
      country: 'village',
      countryside: 'village',
      villager: 'village',
      villagers: 'village',
      villige: 'village',
      villiger: 'village',
      village_house: 'house',
      villagehouse: 'house',
      country_house: 'house',
      countryhouse: 'house',
      village_hut: 'hut',
      village_farm: 'farm',
      village_well: 'well',
      village_storage: 'storage',
      village_smithy: 'smithy',
      village_lamp: 'lamp_post',
      village_lamp_post: 'lamp_post',
      village_plaza: 'plaza',
      square: 'plaza',
      center: 'plaza',
      lamp: 'lamp_post',
      lamppost: 'lamp_post',
      lantern: 'lamp_post',
      water: 'water_pool',
      lake: 'water_pool',
      pond: 'water_pool',
      river: 'water_pool',
      lava: 'lava_pool',
      magma: 'lava_pool',
    };
    const target = rawTarget ? (targetAliases[rawTarget] ?? rawTarget) : undefined;
    if (!target) {
      const biomeList = BIOMES.map((b) => b.id).join(', ');
      ctx.reply(
        `§cUsage: /locate <biome|village|plaza|house|hut|farm|well|smithy|storage|lamp_post|water_pool|lava_pool>\n`
        + '§7Aliases: country/countryside/villager(s) -> village, square/center -> plaza, country_house/village_house -> house, village_lamp/lamp/lamppost/lantern -> lamp_post, water/lake/pond/river -> water_pool, lava/magma -> lava_pool\n'
        + `§7Available biomes: ${biomeList}`,
      );
      return;
    }

    const pos = ctx.server.ctx.state.player.position;
    const px = Math.floor(pos.x);
    const pz = Math.floor(pos.z);
    const world = ctx.server.world;
    type VillageTargetName = keyof typeof VILLAGE_STRUCTURE_TARGETS;
    const villageTarget = (target in VILLAGE_STRUCTURE_TARGETS ? target : null) as VillageTargetName | null;
    if (villageTarget) {
      const playerCx = Math.floor(px / CHUNK_SIZE);
      const playerCz = Math.floor(pz / CHUNK_SIZE);
      const spec = VILLAGE_STRUCTURE_TARGETS[villageTarget];
      for (let radius = 0; radius <= 160; radius++) {
        const minCx = playerCx - radius;
        const maxCx = playerCx + radius;
        const minCz = playerCz - radius;
        const maxCz = playerCz + radius;
        for (let cx = minCx; cx <= maxCx; cx++) {
          for (let cz = minCz; cz <= maxCz; cz++) {
            const isPerimeter = radius === 0 || cx === minCx || cx === maxCx || cz === minCz || cz === maxCz;
            if (!isPerimeter) continue;
            if (!isVillageChunk(cx, cz, world.seed)) continue;
            const wx = cx * CHUNK_SIZE + spec.offsetX;
            const wz = cz * CHUNK_SIZE + spec.offsetZ;
            const biome = world.getBiomeAt(wx, wz);
            if (biome.id !== 'grassland' && biome.id !== 'forest') continue;
            const dist = Math.floor(Math.sqrt((wx - px) ** 2 + (wz - pz) ** 2));
            ctx.reply(`§aFound ${spec.label} at ${wx}, ${wz} (${dist} blocks away)`);
            return;
          }
        }
      }
      ctx.reply(`§cCould not find ${spec.label} within search radius`);
      return;
    }

    const fluidTarget = target === 'water_pool'
      ? B.WATER
      : target === 'lava_pool'
        ? B.LAVA
        : null;
    if (fluidTarget != null) {
      const playerCx = Math.floor(px / CHUNK_SIZE);
      const playerCz = Math.floor(pz / CHUNK_SIZE);
      for (let radius = 0; radius <= 120; radius++) {
        const minCx = playerCx - radius;
        const maxCx = playerCx + radius;
        const minCz = playerCz - radius;
        const maxCz = playerCz + radius;
        for (let cx = minCx; cx <= maxCx; cx++) {
          for (let cz = minCz; cz <= maxCz; cz++) {
            const isPerimeter = radius === 0 || cx === minCx || cx === maxCx || cz === minCz || cz === maxCz;
            if (!isPerimeter) continue;
            const chunk = world.getChunk(cx, cz);
            for (let lx = 1; lx < CHUNK_SIZE - 1; lx++) {
              for (let lz = 1; lz < CHUNK_SIZE - 1; lz++) {
                for (let y = WATER_LEVEL + 2; y < WORLD_HEIGHT - 2; y++) {
                  if (chunk.getBlock(lx, y, lz) !== fluidTarget) continue;
                  const wx = cx * CHUNK_SIZE + lx;
                  const wz = cz * CHUNK_SIZE + lz;
                  const dist = Math.floor(Math.sqrt((wx - px) ** 2 + (wz - pz) ** 2));
                  const label = fluidTarget === B.WATER ? 'water pool' : 'lava pool';
                  ctx.reply(`§aFound ${label} at ${wx}, ${y}, ${wz} (${dist} blocks away)`);
                  return;
                }
              }
            }
          }
        }
      }
      const label = fluidTarget === B.WATER ? 'water pool' : 'lava pool';
      ctx.reply(`§cCould not find ${label} within search radius`);
      return;
    }

    const biome = BIOMES.find((b) => b.id === target || b.name.toLowerCase() === target);
    if (!biome) {
      ctx.reply(`§cUnknown locate target: ${target}`);
      return;
    }
    for (let radius = 1; radius <= 200; radius += 4) {
      for (let angle = 0; angle < 8; angle++) {
        const a = (angle / 8) * Math.PI * 2;
        const tx = px + Math.floor(Math.cos(a) * radius * 16);
        const tz = pz + Math.floor(Math.sin(a) * radius * 16);
        const foundBiome = world.getBiomeAt(tx, tz);
        if (foundBiome.id === biome.id) {
          const dist = Math.floor(Math.sqrt((tx - px) ** 2 + (tz - pz) ** 2));
          ctx.reply(`§aFound ${biome.name} at ${tx}, ${tz} (${dist} blocks away)`);
          return;
        }
      }
    }

    ctx.reply(`§cCould not find ${biome.name} within search radius`);
  });

  registerCommand('biomes', (ctx) => {
    const list = BIOMES.map((b) => `§a${b.id}§7 (heat:${b.heatPoint} hum:${b.humidityPoint})`).join('\n');
    ctx.reply(`§aBiomes:\n${list}`);
  });

  registerCommand('testmap', (ctx) => {
    const layout = ctx.args[0] === 'entities'
      ? 'entities'
      : ctx.args[0] === 'portraits'
        ? 'portraits'
        : ctx.args[0] === 'cross'
          ? 'cross'
          : ctx.args[0] === 'village'
            ? 'village'
            : 'full';
    const scene = buildRegressionScene(ctx.server, { layout });
    ctx.reply(
      `§aRegression ${scene.layout} test map generated at ${scene.origin.x}, ${scene.origin.y}, ${scene.origin.z} with ${scene.entityTypes.length} entities and ${scene.blockIds.length} showcase blocks.`,
    );
  }, { devOnly: true });

  registerCommand('devinfo', (ctx) => {
    const state = ctx.server.ctx.state;
    const abilities = Object.entries(state.abilities)
      .map(([key, enabled]) => `${key}:${enabled ? 'on' : 'off'}`)
      .join(', ');
    const pos = state.player.position;
    const selected = state.inventory.selectedIndex;
    const selectedSlot = state.inventory.slots[selected];
    ctx.reply(
      `§aDevInfo env=dev pos=${pos.x.toFixed(2)},${pos.y.toFixed(2)},${pos.z.toFixed(2)} `
      + `hp=${state.player.hp}/${state.player.maxHp} `
      + `tool=${state.player.tool} selected=${selected}:${selectedSlot?.itemId ?? 'empty'} `
      + `entities=${Object.keys(state.entities).length} drops=${state.itemDrops.length} `
      + `weather=${state.weather} time=${state.timeOfDay.toFixed(3)} `
      + `abilities=[${abilities}]`,
    );
  }, { devOnly: true });
}
