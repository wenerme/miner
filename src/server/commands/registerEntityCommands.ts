import { normalizeVillagerProfession, VILLAGER_PROFESSIONS } from '../EntityManager';
import { resolveEntitySelector, resolveEntitySelectors, resolveEntityTargets } from './entitySelectors';
import type { RegisterCommandFn } from './commandTypes';

export function registerEntityCommands(input: {
  registerCommand: RegisterCommandFn;
  parseStateValue: (raw: string) => string | number | boolean;
}) {
  const { registerCommand, parseStateValue } = input;

  registerCommand('heal', (ctx) => {
    const rawTarget = ctx.args[0]?.toLowerCase();
    const maybeNumericTarget = rawTarget != null ? Number(rawTarget) : Number.NaN;
    const numericLooksLikeAmount = rawTarget != null
      && !Number.isNaN(maybeNumericTarget)
      && !ctx.server.entityManager.getEntity(maybeNumericTarget);
    const target = rawTarget == null || numericLooksLikeAmount ? 'player' : rawTarget;
    const amountArg = rawTarget == null
      ? undefined
      : numericLooksLikeAmount
        ? rawTarget
        : ctx.args[1];

    const parsedAmount = amountArg == null ? Number.POSITIVE_INFINITY : Number(amountArg);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      ctx.reply('§cUsage: /heal [player|self|@s|nearest|id|@e|@e[r=N]|all] [amount]');
      return;
    }

    if (target === 'player' || target === 'self' || target === '@s') {
      const healAmount = Number.isFinite(parsedAmount) ? parsedAmount : ctx.server.ctx.state.player.maxHp;
      const result = ctx.server.healPlayer(healAmount);
      ctx.reply(`§aHealed player +${result.healed} (${result.hp}/${result.maxHp})`);
      return;
    }

    const ids = resolveEntitySelectors(ctx, target);
    if (ids.length === 0) {
      ctx.reply(`§cCould not resolve entity selector: ${target}`);
      return;
    }
    const healAmount = Number.isFinite(parsedAmount) ? parsedAmount : Number.MAX_SAFE_INTEGER;
    let healedCount = 0;
    let totalHealed = 0;
    const healedIds: number[] = [];
    for (const id of ids) {
      const result = ctx.server.entityManager.healEntity(id, healAmount);
      if (!result.ok) continue;
      healedCount++;
      totalHealed += result.healed;
      healedIds.push(id);
    }
    if (healedCount === 0) {
      ctx.reply(`§cCould not heal entity selector: ${target}`);
      return;
    }
    ctx.reply(`§aHealed ${healedCount} entities (+${totalHealed} hp) ids: ${healedIds.join(',')}`);
  });

  registerCommand('kill', (ctx) => {
    const selector = ctx.args[0] ?? 'nearest';
    if (selector === 'player' || selector === 'self' || selector === '@s') {
      ctx.server.killPlayer('Killed by command');
      ctx.reply('§aKilled player');
      return;
    }
    const ids = resolveEntitySelectors(ctx, selector);
    if (ids.length === 0) {
      ctx.reply(`§cCould not resolve entity selector: ${selector}`);
      return;
    }
    let killed = 0;
    for (const id of ids) {
      if (!ctx.server.entityManager.getEntity(id)) continue;
      ctx.server.entityManager.remove(id);
      killed++;
    }
    ctx.reply(`§aKilled ${killed} entities`);
  });

  registerCommand('spawn', (ctx) => {
    const type = ctx.args[0];
    if (!type) {
      ctx.reply('§cUsage: /spawn <entity_type> [count] | /spawn villager <profession> [count]');
      return;
    }
    let profession: string | undefined;
    let countArg: string | undefined;
    if (type === 'villager') {
      const second = ctx.args[1];
      const secondAsNum = Number(second);
      if (second != null && Number.isNaN(secondAsNum)) {
        profession = second;
        countArg = ctx.args[2];
      } else {
        countArg = second;
      }
    } else {
      countArg = ctx.args[1];
    }
    const countRaw = countArg ? Number(countArg) : 1;
    const count = Number.isNaN(countRaw) ? 1 : Math.max(1, Math.min(10, Math.floor(countRaw)));
    let normalizedProfession: string | undefined;
    if (type === 'villager' && profession) {
      const resolved = normalizeVillagerProfession(profession);
      if (!resolved) {
        ctx.reply(`§cUnknown villager profession: ${profession}. Available: ${VILLAGER_PROFESSIONS.join(', ')}`);
        return;
      }
      normalizedProfession = resolved;
    }

    const pos = ctx.server.ctx.state.player.position;
    const spawnedIds: number[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 4 + Math.random() * 3;
      const spawnPos = { x: pos.x + Math.cos(angle) * dist, y: pos.y, z: pos.z + Math.sin(angle) * dist };
      spawnPos.y = ctx.server.world.findSpawnY(Math.floor(spawnPos.x), Math.floor(spawnPos.z)) + 0.1;
      const entity = ctx.server.entityManager.spawn(type, spawnPos);
      if (!entity) continue;
      if (type === 'villager' && normalizedProfession) {
        ctx.server.entityManager.setEntityAttribute(entity.id, 'profession', normalizedProfession);
      }
      spawnedIds.push(entity.id);
    }
    if (spawnedIds.length > 0) {
      const detail = type === 'villager' && normalizedProfession ? ` profession=${normalizedProfession}` : '';
      ctx.reply(`§aSpawned ${spawnedIds.length}x ${type}${detail} (ids: ${spawnedIds.join(',')})`);
    } else {
      ctx.reply(`§cUnknown entity type: ${type}`);
    }
  });

  registerCommand('entities', (ctx) => {
    const count = ctx.server.entityManager.entities.size;
    const types = new Map<string, number>();
    for (const e of ctx.server.entityManager.entities.values()) {
      types.set(e.type, (types.get(e.type) ?? 0) + 1);
    }
    const list = Array.from(types.entries()).map(([t, c]) => `${t}: ${c}`).join(', ');
    ctx.reply(`§aEntities (${count}): ${list || 'none'}`);
  });

  registerCommand('entityinfo', (ctx) => {
    const selector = ctx.args[0] ?? 'nearest';
    const ids = resolveEntityTargets(ctx, selector);
    if (ids.length === 0) {
      ctx.reply(`§cCould not resolve entity selector: ${selector}`);
      return;
    }
    const lines: string[] = [];
    const missing: number[] = [];
    for (const id of ids.slice(0, 8)) {
      const entity = ctx.server.entityManager.getEntity(id);
      if (!entity) {
        missing.push(id);
        continue;
      }
      lines.push(
        `#${entity.id} ${entity.type} hp:${entity.hp}/${entity.maxHp} `
        + `state=${JSON.stringify(entity.state)} attr=${JSON.stringify(entity.attributes)}`,
      );
    }
    if (lines.length === 0) {
      if (missing.length === 1) {
        ctx.reply(`§cEntity not found: ${missing[0]}`);
        return;
      }
      ctx.reply(`§cNo entities found for selector: ${selector}`);
      return;
    }
    const suffix = ids.length > 8 ? `\n§7(Showing first 8 of ${ids.length})` : '';
    ctx.reply(`§aEntity info:\n${lines.join('\n')}${suffix}`);
  }, { devOnly: true });

  registerCommand('entitystate', (ctx) => {
    const [selector, key, rawValue] = ctx.args;
    if (!selector || !key || rawValue == null) {
      ctx.reply('§cUsage: /entitystate <nearest|id|@e|@e[r=N]|all> <key> <value>');
      return;
    }

    const targets = resolveEntityTargets(ctx, selector);
    if (targets.length === 0) {
      ctx.reply(`§cCould not resolve entity selector: ${selector}`);
      return;
    }

    const value = parseStateValue(rawValue);
    let updated = 0;
    const missing: number[] = [];
    for (const entityId of targets) {
      const ok = ctx.server.entityManager.setEntityState(entityId, key, value);
      if (ok) updated++;
      else missing.push(entityId);
    }
    if (updated === 0) {
      if (missing.length === 1) {
        ctx.reply(`§cEntity not found: ${missing[0]}`);
        return;
      }
      ctx.reply(`§cNo entities updated for selector: ${selector}`);
      return;
    }
    if (missing.length > 0) {
      ctx.reply(`§eUpdated ${updated} entities (${key}=${String(value)}), missing: ${missing.join(',')}`);
      return;
    }
    ctx.reply(`§aUpdated ${updated} entities: ${key}=${String(value)}`);
  }, { devOnly: true });

  registerCommand('entityattr', (ctx) => {
    const [selector, key, rawValue] = ctx.args;
    if (!selector || !key || rawValue == null) {
      ctx.reply('§cUsage: /entityattr <nearest|id|@e|@e[r=N]|all> <key> <value>');
      return;
    }

    const targets = resolveEntityTargets(ctx, selector);
    if (targets.length === 0) {
      ctx.reply(`§cCould not resolve entity selector: ${selector}`);
      return;
    }

    const value = parseStateValue(rawValue);
    let updated = 0;
    const missing: number[] = [];
    for (const entityId of targets) {
      const ok = ctx.server.entityManager.setEntityAttribute(entityId, key, value);
      if (ok) updated++;
      else missing.push(entityId);
    }
    if (updated === 0) {
      if (missing.length === 1) {
        ctx.reply(`§cEntity not found: ${missing[0]}`);
        return;
      }
      ctx.reply(`§cNo entities updated for selector: ${selector}`);
      return;
    }
    if (missing.length > 0) {
      ctx.reply(`§eUpdated ${updated} entities (${key}=${String(value)}), missing: ${missing.join(',')}`);
      return;
    }
    ctx.reply(`§aUpdated ${updated} entities: ${key}=${String(value)}`);
  }, { devOnly: true });

  registerCommand('interact', (ctx) => {
    const [selector, actionArg] = ctx.args;
    if (!selector) {
      ctx.reply('§cUsage: /interact <nearest|id> [auto|use|talk|shear|trade]');
      return;
    }

    const entityId = resolveEntitySelector(ctx, selector);
    if (entityId == null) {
      ctx.reply(`§cCould not resolve entity selector: ${selector}`);
      return;
    }

    if (actionArg && actionArg !== 'auto' && actionArg !== 'use' && actionArg !== 'talk' && actionArg !== 'shear' && actionArg !== 'trade') {
      ctx.reply('§cUsage: /interact <nearest|id> [auto|use|talk|shear|trade]');
      return;
    }
    const action = actionArg == null
      ? 'auto'
      : actionArg === 'auto'
        ? 'auto'
        : (actionArg === 'talk' || actionArg === 'shear' || actionArg === 'trade' ? actionArg : 'use');
    ctx.server.interactEntity(entityId, action);
  });

  registerCommand('trade', (ctx) => {
    const selector = ctx.args[0] ?? 'nearest';
    const entityId = resolveEntitySelector(ctx, selector);
    if (entityId == null) {
      ctx.reply(`§cCould not resolve entity selector: ${selector}`);
      return;
    }
    ctx.server.interactEntity(entityId, 'trade');
  });
}
