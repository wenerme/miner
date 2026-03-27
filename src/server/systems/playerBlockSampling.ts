import type { Vec3 } from '#/common/types';

interface BlockReader {
  getBlock: (x: number, y: number, z: number) => number;
}

export function isPlayerTouchingBlock(
  world: BlockReader,
  position: Vec3,
  blockId: number,
): boolean {
  const samplePoints = [
    { x: position.x, y: position.y + 0.05, z: position.z },
    { x: position.x, y: position.y + 0.9, z: position.z },
    { x: position.x, y: position.y + 1.55, z: position.z },
  ];
  for (const sample of samplePoints) {
    const wx = Math.floor(sample.x);
    const wy = Math.floor(sample.y);
    const wz = Math.floor(sample.z);
    if (world.getBlock(wx, wy, wz) === blockId) return true;
  }
  return false;
}

export function isPlayerHeadInBlock(
  world: BlockReader,
  position: Vec3,
  blockId: number,
): boolean {
  const samplePoints = [
    { x: position.x, y: position.y + 1.45, z: position.z },
    { x: position.x, y: position.y + 1.62, z: position.z },
  ];
  for (const sample of samplePoints) {
    const wx = Math.floor(sample.x);
    const wy = Math.floor(sample.y);
    const wz = Math.floor(sample.z);
    if (world.getBlock(wx, wy, wz) === blockId) return true;
  }
  return false;
}

export function isPlayerInWater(
  world: BlockReader,
  position: Vec3,
  waterBlockId: number,
): { feet: boolean; body: boolean; head: boolean } {
  const x = Math.floor(position.x);
  const z = Math.floor(position.z);
  return {
    feet: world.getBlock(x, Math.floor(position.y + 0.1), z) === waterBlockId,
    body: world.getBlock(x, Math.floor(position.y + 0.9), z) === waterBlockId,
    head: world.getBlock(x, Math.floor(position.y + 1.55), z) === waterBlockId,
  };
}
