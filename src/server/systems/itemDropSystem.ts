import { resolveItemId, type ItemDrop, type Vec3 } from '#/common/types';

export interface ItemDropTickInput {
  drops: ItemDrop[];
  dt: number;
  playerPosition: Vec3;
  findLocalSupportY: (
    x: number,
    z: number,
    fromY: number,
    toY: number,
  ) => number | null;
  onPickup: (itemId: number) => void;
}

export interface ItemDropTickResult {
  pickedUpCount: number;
  expiredCount: number;
}

export function tickItemDrops(input: ItemDropTickInput): ItemDropTickResult {
  const { drops, dt, playerPosition, findLocalSupportY, onPickup } = input;
  let pickedUpCount = 0;
  let expiredCount = 0;

  for (let i = drops.length - 1; i >= 0; i--) {
    const drop = drops[i];
    const prevY = drop.position.y;
    drop.age += dt;
    drop.velocity.y -= 20 * dt;
    drop.position.x += drop.velocity.x * dt;
    drop.position.y += drop.velocity.y * dt;
    drop.position.z += drop.velocity.z * dt;

    const supportY = findLocalSupportY(
      Math.floor(drop.position.x),
      Math.floor(drop.position.z),
      Math.max(prevY, drop.position.y),
      Math.min(prevY, drop.position.y) - 1,
    );
    if (supportY != null && drop.position.y < supportY + 0.3) {
      drop.position.y = supportY + 0.3;
      drop.velocity.y = Math.abs(drop.velocity.y) * 0.3;
      drop.velocity.x *= 0.8;
      drop.velocity.z *= 0.8;
      if (Math.abs(drop.velocity.y) < 0.5) drop.velocity.y = 0;
    }
    if (drop.age > 0.5) {
      drop.velocity.x *= 0.95;
      drop.velocity.z *= 0.95;
    }

    const dx = playerPosition.x - drop.position.x;
    const dy = playerPosition.y - drop.position.y;
    const dz = playerPosition.z - drop.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 1.5 && drop.age > 0.3) {
      const itemId = resolveItemId(drop);
      if (itemId != null) {
        onPickup(itemId);
        pickedUpCount++;
      }
      drops.splice(i, 1);
      continue;
    }

    if (drop.age > 60) {
      drops.splice(i, 1);
      expiredCount++;
    }
  }

  return { pickedUpCount, expiredCount };
}
