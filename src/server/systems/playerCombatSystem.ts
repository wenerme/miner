import type { ToolStats, ToolType } from '#/common/types';

export interface AttackGateResult {
  allowed: boolean;
  message: string | null;
}

export function gatePlayerEntityAttack(input: {
  activeTool: ToolType;
  attackCooldownMs: number;
}): AttackGateResult {
  const { activeTool, attackCooldownMs } = input;
  if (activeTool !== 'sword') {
    return {
      allowed: false,
      message: '§eYou need a weapon to deal damage',
    };
  }
  if (attackCooldownMs > 0) {
    return {
      allowed: false,
      message: `§eAttack cooling down (${Math.ceil(attackCooldownMs)}ms)`,
    };
  }
  return { allowed: true, message: null };
}

export function resolveAttackCooldownMs(toolStats: ToolStats | null | undefined): number {
  return toolStats?.useCooldownMs ?? 450;
}
