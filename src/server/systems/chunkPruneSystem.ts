export interface ChunkPruneDecisionInput {
  key: string;
  dirty: boolean;
  centerCx: number;
  centerCz: number;
  keepRadius: number;
}

export interface ParsedChunkKey {
  cx: number;
  cz: number;
}

export function parseChunkKey(key: string): ParsedChunkKey | null {
  const [cxStr, czStr] = key.split(',');
  const cx = Number(cxStr);
  const cz = Number(czStr);
  if (Number.isNaN(cx) || Number.isNaN(cz)) return null;
  return { cx, cz };
}

export function shouldPruneChunk(input: ChunkPruneDecisionInput): boolean {
  const { key, dirty, centerCx, centerCz, keepRadius } = input;
  if (dirty) return false;
  const parsed = parseChunkKey(key);
  if (!parsed) return false;
  const dcx = Math.abs(parsed.cx - centerCx);
  const dcz = Math.abs(parsed.cz - centerCz);
  return Math.max(dcx, dcz) > keepRadius;
}
