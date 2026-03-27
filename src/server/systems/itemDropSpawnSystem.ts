import type { ItemDrop, Vec3 } from '#/common/types';

export interface CreateItemDropEntriesInput {
  startDropId: number;
  itemId: number;
  count: number;
  position: Vec3;
  velocity?: Vec3;
  random?: () => number;
}

export interface CreateItemDropEntriesResult {
  nextDropId: number;
  drops: ItemDrop[];
}

export function createItemDropEntries(input: CreateItemDropEntriesInput): CreateItemDropEntriesResult {
  const {
    startDropId,
    itemId,
    count,
    position,
    velocity,
    random = Math.random,
  } = input;
  const drops: ItemDrop[] = [];
  let nextDropId = startDropId;
  for (let i = 0; i < count; i++) {
    nextDropId += 1;
    drops.push({
      id: nextDropId,
      itemId,
      blockId: itemId,
      position: { ...position },
      velocity: velocity
        ? { ...velocity }
        : { x: (random() - 0.5) * 2, y: 4, z: (random() - 0.5) * 2 },
      age: 0,
    });
  }
  return { nextDropId, drops };
}
