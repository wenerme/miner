export interface SolidWorld {
  isSolid: (x: number, y: number, z: number) => boolean;
}

export interface ResolveHorizontalMovementInput {
  world: SolidWorld;
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number;
  noclip: boolean;
  flying?: boolean;
  onGround?: boolean;
}

const PLAYER_HALF_WIDTH = 0.3;
const PLAYER_HEIGHT = 1.8;
const STEP_UP_HEIGHT = 0.6;

export function canOccupyAt(world: SolidWorld, x: number, y: number, z: number): boolean {
  const hw = PLAYER_HALF_WIDTH;
  const minY = Math.floor(y);
  const maxY = Math.floor(y + PLAYER_HEIGHT);
  for (const ox of [-hw, hw]) {
    for (const oz of [-hw, hw]) {
      for (let by = minY; by <= maxY; by++) {
        if (world.isSolid(Math.floor(x + ox), by, Math.floor(z + oz))) return false;
      }
    }
  }
  return true;
}

function tryStepUp(world: SolidWorld, x: number, y: number, z: number): number | null {
  for (let stepY = y + 0.1; stepY <= y + STEP_UP_HEIGHT; stepY += 0.1) {
    const raised = Math.ceil(stepY * 10) / 10;
    if (canOccupyAt(world, x, raised, z)) {
      return raised;
    }
  }
  return null;
}

export function resolveHorizontalMovement(input: ResolveHorizontalMovementInput): { x: number; z: number; y?: number } {
  const { world, x, y, z, dx, dz, noclip, flying, onGround } = input;
  const allowStepUp = !noclip && !flying && (onGround ?? true);
  let nextX = x;
  let nextZ = z;
  let nextY: number | undefined;

  const candidateX = x + dx;
  if (noclip || canOccupyAt(world, candidateX, y, z)) {
    nextX = candidateX;
  } else if (allowStepUp) {
    const steppedY = tryStepUp(world, candidateX, y, z);
    if (steppedY != null) {
      nextX = candidateX;
      nextY = steppedY;
    }
  }

  const yForZ = nextY ?? y;
  const candidateZ = z + dz;
  if (noclip || canOccupyAt(world, nextX, yForZ, candidateZ)) {
    nextZ = candidateZ;
  } else if (allowStepUp) {
    const steppedY = tryStepUp(world, nextX, yForZ, candidateZ);
    if (steppedY != null) {
      nextZ = candidateZ;
      nextY = steppedY;
    }
  }

  return { x: nextX, z: nextZ, y: nextY };
}
