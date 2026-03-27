import { resolveItemId, type EntityInteractionAction, type Vec3 } from '#/common/types';
import type { EntityInteractionResult } from '../EntityManager';
import type { EntityAttackResult } from '../EntityManager';

export interface TradeOffer {
  wantItemId: number;
  wantCount: number;
  giveItemId: number;
  giveCount: number;
}

export interface ResolvedInteractionTrade {
  success: boolean;
  message: string;
  applyTradeOffer: TradeOffer | null;
}

export function resolveInteractionTrade(input: {
  result: EntityInteractionResult;
  hasRequiredItems: (offer: TradeOffer) => boolean;
}): ResolvedInteractionTrade {
  const { result, hasRequiredItems } = input;
  const offers = result.tradeOffers;
  if (!(result.ok && result.action === 'trade' && offers?.length)) {
    return {
      success: result.ok,
      message: result.message,
      applyTradeOffer: null,
    };
  }
  for (const offer of offers) {
    if (hasRequiredItems(offer)) {
      return {
        success: true,
        message: `${result.message} (traded ${offer.wantCount}x item ${offer.wantItemId} -> ${offer.giveCount}x item ${offer.giveItemId})`,
        applyTradeOffer: offer,
      };
    }
  }
  const first = offers[0];
  return {
    success: false,
    message: `${result.message} (need ${first.wantCount}x item ${first.wantItemId} for cheapest offer)`,
    applyTradeOffer: null,
  };
}

export function shouldDamageInteractionSelectedItem(input: {
  result: EntityInteractionResult;
  requestedAction: EntityInteractionAction | 'auto';
  selectedItemId: number | null;
  selectedItemMaxDurability: number | null | undefined;
}): boolean {
  const { result, requestedAction, selectedItemId, selectedItemMaxDurability } = input;
  return (
    result.ok
    && requestedAction !== 'trade'
    && selectedItemId != null
    && selectedItemMaxDurability != null
  );
}

export interface EntityInteractionDropSpawn {
  itemId: number;
  count: number;
  position: Vec3;
  velocity: Vec3;
}

export function planEntityInteractionDropSpawns(input: {
  result: EntityInteractionResult;
  entityPosition: Vec3 | null;
  random?: () => number;
}): EntityInteractionDropSpawn[] {
  const { result, entityPosition, random = Math.random } = input;
  if (!(result.ok && result.drops?.length) || !entityPosition) return [];

  const spawns: EntityInteractionDropSpawn[] = [];
  for (const drop of result.drops) {
    const itemId = resolveItemId(drop);
    if (itemId == null) continue;
    spawns.push({
      itemId,
      count: drop.count,
      position: { x: entityPosition.x, y: entityPosition.y + 0.9, z: entityPosition.z },
      velocity: { x: (random() - 0.5) * 1.2, y: 3.5, z: (random() - 0.5) * 1.2 },
    });
  }
  return spawns;
}

export interface EntityAttackDropSpawn {
  itemId: number;
  count: number;
  position: Vec3;
}

export function planEntityAttackDropSpawns(input: {
  result: EntityAttackResult;
  playerPosition: Vec3;
}): EntityAttackDropSpawn[] {
  const { result, playerPosition } = input;
  if (!(result.ok && result.drops?.length)) return [];
  const spawns: EntityAttackDropSpawn[] = [];
  for (const drop of result.drops) {
    const itemId = resolveItemId(drop);
    if (itemId == null) continue;
    spawns.push({
      itemId,
      count: drop.count,
      position: { x: playerPosition.x, y: playerPosition.y + 0.6, z: playerPosition.z },
    });
  }
  return spawns;
}
