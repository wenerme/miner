/**
 * Performance marks/measures for the runtime texture atlas pipeline.
 * Names are prefixed so tests can filter and clear without touching global entries.
 */
const PREFIX = 'mineweb:asset:';

let atlasInstanceSeq = 0;
let imageLoadSeq = 0;

export function nextAtlasPerfInstanceId(): number {
  return ++atlasInstanceSeq;
}

export function nextImageLoadPerfId(): number {
  return ++imageLoadSeq;
}

export function perfAtlasDiscoveryStart(atlasId: number): void {
  performance.mark(`${PREFIX}atlas:${atlasId}:discovery:start`);
}

export function perfAtlasDiscoveryEnd(atlasId: number): void {
  const start = `${PREFIX}atlas:${atlasId}:discovery:start`;
  const end = `${PREFIX}atlas:${atlasId}:discovery:end`;
  performance.mark(end);
  try {
    performance.measure(`${PREFIX}atlas:${atlasId}:discovery`, start, end);
  } catch {
    /* duplicate or missing marks */
  }
}

export function perfAtlasTileAssemblyStart(atlasId: number, tileIndex: number): string {
  const start = `${PREFIX}atlas:${atlasId}:tile:${tileIndex}:assembly:start`;
  performance.mark(start);
  return start;
}

export function perfAtlasTileAssemblyEnd(atlasId: number, tileIndex: number, startMark: string): void {
  const end = `${PREFIX}atlas:${atlasId}:tile:${tileIndex}:assembly:end`;
  performance.mark(end);
  try {
    performance.measure(`${PREFIX}atlas:${atlasId}:tile:${tileIndex}:assembly`, startMark, end);
  } catch {
    /* ignore */
  }
}

/** Call immediately before `texture.needsUpdate = true`; pair with `perfAtlasTextureUploadMarkEnd`. */
export function perfAtlasTextureUploadMarkStart(atlasId: number, phase: string, detail: string | number): string {
  const start = `${PREFIX}atlas:${atlasId}:upload:${phase}:${detail}:start`;
  performance.mark(start);
  return start;
}

/** Call immediately after assigning `needsUpdate` (measures sync invalidation, not GPU transfer). */
export function perfAtlasTextureUploadMarkEnd(atlasId: number, phase: string, detail: string | number, startMark: string): void {
  const end = `${PREFIX}atlas:${atlasId}:upload:${phase}:${detail}:end`;
  performance.mark(end);
  try {
    performance.measure(`${PREFIX}atlas:${atlasId}:upload:${phase}:${detail}`, startMark, end);
  } catch {
    /* ignore */
  }
}

/** Remove MineWeb asset pipeline marks/measures (for isolated perf tests). */
export function clearMinewebAssetPerfEntries(): void {
  const measureNames = performance
    .getEntriesByType('measure')
    .map((e) => e.name)
    .filter((n) => n.startsWith(PREFIX));
  for (const n of measureNames) {
    try {
      performance.clearMeasures(n);
    } catch {
      /* ignore */
    }
  }
  const markNames = performance
    .getEntriesByType('mark')
    .map((e) => e.name)
    .filter((n) => n.startsWith(PREFIX));
  for (const n of markNames) {
    try {
      performance.clearMarks(n);
    } catch {
      /* ignore */
    }
  }
}

export function minewebAssetPerfMeasurePrefix(): string {
  return PREFIX;
}
