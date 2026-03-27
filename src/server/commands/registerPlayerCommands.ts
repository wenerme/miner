import { WORLD_HEIGHT } from '#/common/types';
import type { RegisterCommandFn } from './commandTypes';

export function registerPlayerCommands(input: { registerCommand: RegisterCommandFn }) {
  const { registerCommand } = input;

  registerCommand('fly', (ctx) => {
    const enabled = ctx.server.abilities.toggle('fly');
    ctx.server.syncAbilities();
    ctx.reply(enabled ? '§aFlight enabled' : '§cFlight disabled');
  });

  registerCommand('noclip', (ctx) => {
    const enabled = ctx.server.abilities.toggle('noclip');
    ctx.server.syncAbilities();
    ctx.reply(enabled ? '§aNoclip enabled' : '§cNoclip disabled');
  });

  registerCommand('flyspeed', (ctx) => {
    if (!ctx.args[0]) {
      ctx.reply(`§aFly speed: ${ctx.server.flySpeed}x`);
      return;
    }
    const speed = Number(ctx.args[0]);
    if (Number.isNaN(speed) || speed < 1 || speed > 5) {
      ctx.reply('§cUsage: /flyspeed <1-5> (multiplier)');
      return;
    }
    ctx.server.flySpeed = speed;
    ctx.reply(`§aFly speed set to ${speed}x`);
  });

  registerCommand('tp', (ctx) => {
    const [x, y, z] = ctx.args.map(Number);
    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
      ctx.reply('§cUsage: /tp <x> <y> <z>');
      return;
    }
    const clampedY = Math.max(0, Math.min(WORLD_HEIGHT - 1, y));
    ctx.server.ctx.state.player.position = { x, y: clampedY, z };
    ctx.reply(`§aTeleported to ${x}, ${clampedY}, ${z}`);
  });

  registerCommand('tool', (ctx) => {
    const tool = ctx.args[0];
    if (
      tool !== 'hand'
      && tool !== 'pickaxe'
      && tool !== 'axe'
      && tool !== 'shovel'
      && tool !== 'hoe'
      && tool !== 'sword'
      && tool !== 'shears'
    ) {
      ctx.reply('§cUsage: /tool <hand|pickaxe|axe|shovel|hoe|sword|shears>');
      return;
    }
    ctx.server.ctx.state.player.tool = tool;
    ctx.reply(`§aTool set to ${tool}`);
  });

  registerCommand('air', (ctx) => {
    const airMs = Math.max(0, Math.floor(ctx.server.ctx.state.player.airMs));
    const ratio = Math.max(0, Math.min(1, airMs / 10_000));
    const percent = Math.round(ratio * 100);
    ctx.reply(`§aAir: ${airMs}ms (${percent}%)`);
  });

  registerCommand('gamemode', (ctx) => {
    const mode = ctx.args[0];
    if (mode === 'creative' || mode === 'c') {
      ctx.server.abilities.set('fly', true);
      ctx.server.abilities.set('creative', true);
      ctx.server.syncAbilities();
      ctx.reply('§aCreative mode enabled (fly + unlimited blocks)');
    } else if (mode === 'survival' || mode === 's') {
      ctx.server.abilities.set('fly', false);
      ctx.server.abilities.set('creative', false);
      ctx.server.abilities.set('noclip', false);
      ctx.server.syncAbilities();
      ctx.reply('§aSurvival mode enabled');
    } else {
      ctx.reply('§cUsage: /gamemode <creative|survival>');
    }
  });

  registerCommand('abilities', (ctx) => {
    const list = ctx.server.abilities.getAll();
    const lines = list.map((a) => `  ${a.enabled ? '§a✓' : '§c✗'} ${a.name}`).join('\n');
    ctx.reply(`§aAbilities:\n${lines}`);
  });
}
