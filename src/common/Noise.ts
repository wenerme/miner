export interface NoiseParams {
  offset: number;
  scale: number;
  spreadX: number;
  spreadZ: number;
  seed: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
}

export function defaultNoiseParams(overrides?: Partial<NoiseParams>): NoiseParams {
  return {
    offset: 0,
    scale: 1,
    spreadX: 100,
    spreadZ: 100,
    seed: 0,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2,
    ...overrides,
  };
}

/** Hash-based 2D noise (no Math.sin). Returns [0, 1]. */
export function hash2d(x: number, z: number, seed: number): number {
  let h = seed + x * 374761393 + z * 668265263;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

/** Smoothstep interpolation t(t(3-2t)) */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Base noise at (x, z) with smooth interpolation. Returns [0, 1]. */
export function noise2d(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = smoothstep(fx);
  const uz = smoothstep(fz);

  const a = hash2d(ix, iz, seed);
  const b = hash2d(ix + 1, iz, seed);
  const c = hash2d(ix, iz + 1, seed);
  const d = hash2d(ix + 1, iz + 1, seed);

  return (
    a * (1 - ux) * (1 - uz) +
    b * ux * (1 - uz) +
    c * (1 - ux) * uz +
    d * ux * uz
  );
}

/** 3D hash for cave noise. Returns [0, 1]. */
export function hash3d(x: number, y: number, z: number, seed: number): number {
  let h = seed + x * 374761393 + y * 668265263 + z * 1274126177;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

/** Trilinear-interpolated 3D noise. Returns [0, 1]. */
export function noise3d(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const fz = smoothstep(z - iz);

  let v = 0;
  for (let dz = 0; dz <= 1; dz++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const h = hash3d(ix + dx, iy + dy, iz + dz, seed);
        v +=
          h *
          (dx ? fx : 1 - fx) *
          (dy ? fy : 1 - fy) *
          (dz ? fz : 1 - fz);
      }
    }
  }
  return v;
}

/** Fractal Brownian Motion: multi-octave noise. Returns [0, 1]. */
export function fractalNoise2d(x: number, z: number, params: NoiseParams): number {
  const { offset, scale, spreadX, spreadZ, seed, octaves, persistence, lacunarity } = params;
  const nx = x / spreadX;
  const nz = z / spreadZ;

  let val = 0;
  let amp = 1;
  let freq = 1;
  let maxVal = 0;

  for (let i = 0; i < octaves; i++) {
    val += noise2d(nx * freq, nz * freq, seed + i * 1000) * amp;
    maxVal += amp;
    amp *= persistence;
    freq *= lacunarity;
  }

  return val / maxVal;
}
