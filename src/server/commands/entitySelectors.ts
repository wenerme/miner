import type { CommandContext } from './commandTypes';

function getEntityIdsWithinRadius(ctx: CommandContext, radius: number): number[] {
  const playerPos = ctx.server.ctx.state.player.position;
  const ids: number[] = [];
  for (const entity of ctx.server.entityManager.entities.values()) {
    const distance = Math.hypot(entity.position.x - playerPos.x, entity.position.z - playerPos.z);
    if (distance <= radius) ids.push(entity.id);
  }
  return ids;
}

export function resolveEntitySelectors(ctx: CommandContext, selector: string, radius = 12): number[] {
  const raw = selector.trim().toLowerCase();
  if (raw === 'all' || raw === '@e') {
    return Array.from(ctx.server.entityManager.entities.keys());
  }
  const radiusMatch = raw.match(/^@e\[\s*r\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*]$/);
  if (radiusMatch) {
    const parsedRadius = Number(radiusMatch[1]);
    if (!Number.isFinite(parsedRadius) || parsedRadius < 0) return [];
    return getEntityIdsWithinRadius(ctx, parsedRadius);
  }
  if (raw === 'nearest' || raw === '@p' || raw === '@n') {
    const nearest = ctx.server.entityManager.findNearestEntity(ctx.server.ctx.state.player.position, radius);
    return nearest ? [nearest.id] : [];
  }
  const parsed = Number(raw);
  if (!Number.isNaN(parsed) && ctx.server.entityManager.getEntity(parsed)) {
    return [parsed];
  }
  return [];
}

export function resolveEntitySelector(ctx: CommandContext, selector: string, radius = 12): number | null {
  const playerPos = ctx.server.ctx.state.player.position;
  if (selector === 'nearest' || selector === '@p' || selector === '@n') {
    return ctx.server.entityManager.findNearestEntity(playerPos, radius)?.id ?? null;
  }
  const parsed = Number(selector);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  const ids = resolveEntitySelectors(ctx, selector, radius);
  return ids.length === 1 ? (ids[0] ?? null) : null;
}

export function resolveEntityTargets(ctx: CommandContext, selector: string): number[] {
  const raw = selector.trim().toLowerCase();
  const isGroupSelector = raw === 'all' || raw === '@e' || raw.startsWith('@e[');
  if (isGroupSelector) {
    return resolveEntitySelectors(ctx, raw);
  }
  const single = resolveEntitySelector(ctx, selector);
  return single == null ? [] : [single];
}
