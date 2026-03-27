export const CHUNK_REQUEST_RADIUS_HARD_MAX = 12;
export const CHUNK_REQUEST_RADIUS_RENDER_PADDING = 2;

export function resolveChunkRequestRadius(input: {
  requestedRadius: number;
  renderDistance: number;
}): number {
  const { requestedRadius, renderDistance } = input;
  const safeRequested = Number.isFinite(requestedRadius) ? Math.floor(requestedRadius) : 0;
  const safeRenderDistance = Number.isFinite(renderDistance) ? Math.floor(renderDistance) : 0;
  const dynamicMax = Math.max(0, safeRenderDistance + CHUNK_REQUEST_RADIUS_RENDER_PADDING);
  const maxRadius = Math.min(CHUNK_REQUEST_RADIUS_HARD_MAX, dynamicMax);
  if (safeRequested < 0) return 0;
  if (safeRequested > maxRadius) return maxRadius;
  return safeRequested;
}
