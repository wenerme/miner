import * as THREE from 'three';
import { BLOCK_DEFS, BlockTypes } from '#/block/BlockRegistry';
import { CHUNK_SIZE, WORLD_HEIGHT } from '#/common/types';
import type { TextureAtlas } from './TextureAtlas';

type BlockFace = 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west';

interface FaceDef {
  dir: [number, number, number];
  corners: [number, number, number][];
  face: BlockFace;
  light: number;
}

const FACES: FaceDef[] = [
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], face: 'top', light: 1.0 },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], face: 'bottom', light: 0.5 },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], face: 'north', light: 0.8 },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], face: 'south', light: 0.7 },
  { dir: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], face: 'east', light: 0.9 },
  { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], face: 'west', light: 0.6 },
];

/** Full-height side faces for stacked fluid (same as FACES[2..5]); module-level to avoid per-voxel slice(). */
const FLUID_STACKED_SIDE_FACES: FaceDef[] = FACES.slice(2);

const WATER_TOP_HEIGHT = 0.875;

const WATER_TOP_FACE: FaceDef = {
  dir: [0, 1, 0],
  corners: [[0, WATER_TOP_HEIGHT, 1], [1, WATER_TOP_HEIGHT, 1], [1, WATER_TOP_HEIGHT, 0], [0, WATER_TOP_HEIGHT, 0]],
  face: 'top',
  light: 1.0,
};

const WATER_SIDE_FACES: FaceDef[] = [
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, WATER_TOP_HEIGHT, 1], [0, WATER_TOP_HEIGHT, 1]], face: 'north', light: 0.8 },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, WATER_TOP_HEIGHT, 0], [1, WATER_TOP_HEIGHT, 0]], face: 'south', light: 0.7 },
  { dir: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, WATER_TOP_HEIGHT, 0], [1, WATER_TOP_HEIGHT, 1]], face: 'east', light: 0.9 },
  { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, WATER_TOP_HEIGHT, 1], [0, WATER_TOP_HEIGHT, 0]], face: 'west', light: 0.6 },
];

const WATER_BLOCK_ID = BlockTypes.WATER;
const LAVA_BLOCK_ID = BlockTypes.LAVA;
const FLUID_BLOCK_IDS = new Set([WATER_BLOCK_ID, LAVA_BLOCK_ID]);

/** Minecraft-style vertex AO: 0 = fully occluded … 3 = none. Maps to multipliers on face light. */
const AO_LEVEL_TO_FACTOR = [0.48, 0.65, 0.82, 1.0] as const;

/**
 * Compute AO levels for all 4 corners of a face at once.
 * Returns [ao0, ao1, ao2, ao3] where each is 0..3 (0=occluded, 3=none).
 * Batches neighbor lookups to reduce per-corner overhead.
 */
function computeFaceAO(
  getBlock: (wx: number, wy: number, wz: number) => number,
  wx: number,
  wy: number,
  wz: number,
  faceIdx: number,
): [number, number, number, number] {
  const occ = (x: number, y: number, z: number) => {
    const bid = getBlock(x, y, z);
    if (bid === 0) return 0;
    const inf = BLOCK_DEFS[bid];
    return inf && inf.solid && !inf.transparent ? 1 : 0;
  };
  const aoCorner = (s1: number, s2: number, corner: number) => {
    if (s1 !== 0 && s2 !== 0) return 0;
    return 3 - (s1 + s2 + Math.max(corner, s1 * s2));
  };

  if (faceIdx <= 1) {
    const yOff = faceIdx === 0 ? 1 : -1;
    const by = wy + yOff;
    const o00 = occ(wx - 1, by, wz - 1);
    const o10 = occ(wx, by, wz - 1);
    const o20 = occ(wx + 1, by, wz - 1);
    const o01 = occ(wx - 1, by, wz);
    const o21 = occ(wx + 1, by, wz);
    const o02 = occ(wx - 1, by, wz + 1);
    const o12 = occ(wx, by, wz + 1);
    const o22 = occ(wx + 1, by, wz + 1);
    if (faceIdx === 0) {
      return [
        aoCorner(o01, o12, o02),
        aoCorner(o21, o12, o22),
        aoCorner(o21, o10, o20),
        aoCorner(o01, o10, o00),
      ];
    }
    return [
      aoCorner(o01, o10, o00),
      aoCorner(o21, o10, o20),
      aoCorner(o21, o12, o22),
      aoCorner(o01, o12, o02),
    ];
  }
  if (faceIdx === 2 || faceIdx === 3) {
    const zOff = faceIdx === 2 ? 1 : -1;
    const bz = wz + zOff;
    const left = occ(wx - 1, wy, bz);
    const right = occ(wx + 1, wy, bz);
    const down = occ(wx, wy - 1, bz);
    const up = occ(wx, wy + 1, bz);
    const ld = occ(wx - 1, wy - 1, bz);
    const lu = occ(wx - 1, wy + 1, bz);
    const rd = occ(wx + 1, wy - 1, bz);
    const ru = occ(wx + 1, wy + 1, bz);
    if (faceIdx === 2) {
      return [
        aoCorner(left, down, ld),
        aoCorner(right, down, rd),
        aoCorner(right, up, ru),
        aoCorner(left, up, lu),
      ];
    }
    return [
      aoCorner(right, down, rd),
      aoCorner(left, down, ld),
      aoCorner(left, up, lu),
      aoCorner(right, up, ru),
    ];
  }
  {
    const xOff = faceIdx === 4 ? 1 : -1;
    const bx = wx + xOff;
    const front = occ(bx, wy, wz + 1);
    const back = occ(bx, wy, wz - 1);
    const down = occ(bx, wy - 1, wz);
    const up = occ(bx, wy + 1, wz);
    const fd = occ(bx, wy - 1, wz + 1);
    const fu = occ(bx, wy + 1, wz + 1);
    const bd = occ(bx, wy - 1, wz - 1);
    const bu = occ(bx, wy + 1, wz - 1);
    if (faceIdx === 4) {
      return [
        aoCorner(front, down, fd),
        aoCorner(back, down, bd),
        aoCorner(back, up, bu),
        aoCorner(front, up, fu),
      ];
    }
    return [
      aoCorner(back, down, bd),
      aoCorner(front, down, fd),
      aoCorner(front, up, fu),
      aoCorner(back, up, bu),
    ];
  }
}

function aoLevelToFactor(level: number): number {
  const clamped = level < 0 ? 0 : level > 3 ? 3 : level;
  return AO_LEVEL_TO_FACTOR[clamped];
}

export function isFluidBlock(blockId: number): boolean {
  return FLUID_BLOCK_IDS.has(blockId);
}

export function shouldUseCrossGeometry(blockId: number): boolean {
  const info = BLOCK_DEFS[blockId];
  if (!info) return false;
  return info.renderShape === 'cross';
}

export type ChunkGeometryResult = {
  opaque: THREE.BufferGeometry | null;
  transparent: THREE.BufferGeometry | null;
  lava: THREE.BufferGeometry | null;
  glass: THREE.BufferGeometry | null;
};

function buildGeometryFromArrays(
  positions: number[],
  normals: number[],
  uvs: number[],
  lights: number[],
  animated: number[],
  indices: number[],
  vertCount: number,
): THREE.BufferGeometry | null {
  if (vertCount === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aLight', new THREE.Float32BufferAttribute(lights, 1));
  geo.setAttribute('aAnimated', new THREE.Float32BufferAttribute(animated, 1));
  geo.setIndex(indices);
  return geo;
}

const FACING_REMAP: Record<string, Record<BlockFace, BlockFace>> = {
  north: { top: 'top', bottom: 'bottom', north: 'north', south: 'south', east: 'east', west: 'west' },
  south: { top: 'top', bottom: 'bottom', north: 'south', south: 'north', east: 'west', west: 'east' },
  east: { top: 'top', bottom: 'bottom', north: 'east', south: 'west', east: 'south', west: 'north' },
  west: { top: 'top', bottom: 'bottom', north: 'west', south: 'east', east: 'north', west: 'south' },
};

export function buildChunkGeometry(
  blocks: Uint8Array,
  cx: number,
  cz: number,
  getNeighborBlock: (wx: number, wy: number, wz: number) => number,
  atlas: TextureAtlas,
  facings?: Record<string, string>,
): ChunkGeometryResult {
  const oPositions: number[] = [];
  const oNormals: number[] = [];
  const oUvs: number[] = [];
  const oLights: number[] = [];
  const oAnimated: number[] = [];
  const oIndices: number[] = [];
  let oVertCount = 0;

  const tPositions: number[] = [];
  const tNormals: number[] = [];
  const tUvs: number[] = [];
  const tLights: number[] = [];
  const tAnimated: number[] = [];
  const tIndices: number[] = [];
  let tVertCount = 0;

  const lPositions: number[] = [];
  const lNormals: number[] = [];
  const lUvs: number[] = [];
  const lLights: number[] = [];
  const lAnimated: number[] = [];
  const lIndices: number[] = [];
  let lVertCount = 0;

  const gPositions: number[] = [];
  const gNormals: number[] = [];
  const gUvs: number[] = [];
  const gLights: number[] = [];
  const gAnimated: number[] = [];
  const gIndices: number[] = [];
  let gVertCount = 0;

  const wx0 = cx * CHUNK_SIZE;
  const wz0 = cz * CHUNK_SIZE;

  for (let ly = 0; ly < WORLD_HEIGHT; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const blockId = blocks[ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx];
        if (blockId === 0) continue;
        const info = BLOCK_DEFS[blockId];
        if (!info) continue;

        const wx = wx0 + lx;
        const wz = wz0 + lz;
        const isFluid = FLUID_BLOCK_IDS.has(blockId);
        const isCrossPlant = !isFluid && shouldUseCrossGeometry(blockId);

        if (isFluid) {
          const isLava = blockId === LAVA_BLOCK_ID;
          const fPos = isLava ? lPositions : tPositions;
          const fNor = isLava ? lNormals : tNormals;
          const fUv = isLava ? lUvs : tUvs;
          const fLit = isLava ? lLights : tLights;
          const fAni = isLava ? lAnimated : tAnimated;
          const fIdx = isLava ? lIndices : tIndices;

          const texName = info.textures.top || info.textures.north;
          const [u0, v0, u1, v1] = atlas.getUV(texName);

          const aboveId = getNeighborBlock(wx, ly + 1, wz);
          const aboveIsFluid = FLUID_BLOCK_IDS.has(aboveId);

          const fVC = () => isLava ? lVertCount : tVertCount;
          const fVCInc = () => { if (isLava) lVertCount += 4; else tVertCount += 4; };

          if (!aboveIsFluid) {
            const topFace = WATER_TOP_FACE;
            const vc = fVC();
            for (const corner of topFace.corners) {
              fPos.push(wx + corner[0], ly + corner[1], wz + corner[2]);
              fNor.push(topFace.dir[0], topFace.dir[1], topFace.dir[2]);
              fLit.push(topFace.light);
              fAni.push(isLava ? 0.0 : 1.0);
            }
            fUv.push(u0, v0, u1, v0, u1, v1, u0, v1);
            fIdx.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
            fVCInc();
          }

          const bottomFace = FACES[1];
          const belowId = getNeighborBlock(wx, ly - 1, wz);
          if (!FLUID_BLOCK_IDS.has(belowId) && !(BLOCK_DEFS[belowId]?.solid)) {
            const vc = fVC();
            for (const corner of bottomFace.corners) {
              fPos.push(wx + corner[0], ly + corner[1], wz + corner[2]);
              fNor.push(bottomFace.dir[0], bottomFace.dir[1], bottomFace.dir[2]);
              fLit.push(bottomFace.light);
              fAni.push(isLava ? 0.0 : 1.0);
            }
            fUv.push(u0, v0, u1, v0, u1, v1, u0, v1);
            fIdx.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
            fVCInc();
          }

          const sideFaces = aboveIsFluid ? FLUID_STACKED_SIDE_FACES : WATER_SIDE_FACES;
          for (const face of sideFaces) {
            const nx = wx + face.dir[0];
            const nz = wz + face.dir[2];
            const neighborId = getNeighborBlock(nx, ly, nz);
            if (FLUID_BLOCK_IDS.has(neighborId)) continue;
            if (BLOCK_DEFS[neighborId]?.solid && !BLOCK_DEFS[neighborId]?.transparent) continue;

            const vc = fVC();
            for (const corner of face.corners) {
              fPos.push(wx + corner[0], ly + corner[1], wz + corner[2]);
              fNor.push(face.dir[0], face.dir[1], face.dir[2]);
              fLit.push(face.light);
              fAni.push(isLava ? 0.0 : 1.0);
            }
            fUv.push(u0, v0, u1, v0, u1, v1, u0, v1);
            fIdx.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
            fVCInc();
          }
        } else if (isCrossPlant) {
          const texName = info.textures.north;
          const [u0, v0, u1, v1] = atlas.getUV(texName);
          const addQuad = (corners: [number, number, number][], fnx: number, fny: number, fnz: number, light: number) => {
            for (const c of corners) {
              oPositions.push(wx + c[0], ly + c[1], wz + c[2]);
              oNormals.push(fnx, fny, fnz);
              oLights.push(light);
              oAnimated.push(0.0);
            }
            oUvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
            oIndices.push(oVertCount, oVertCount + 1, oVertCount + 2, oVertCount, oVertCount + 2, oVertCount + 3);
            oVertCount += 4;
          };
          const d1f: [number, number, number][] = [[0, 0, 0], [1, 0, 1], [1, 1, 1], [0, 1, 0]];
          const d1b: [number, number, number][] = [[1, 0, 1], [0, 0, 0], [0, 1, 0], [1, 1, 1]];
          const d2f: [number, number, number][] = [[1, 0, 0], [0, 0, 1], [0, 1, 1], [1, 1, 0]];
          const d2b: [number, number, number][] = [[0, 0, 1], [1, 0, 0], [1, 1, 0], [0, 1, 1]];
          addQuad(d1f, 0.7, 0, 0.7, 0.9);
          addQuad(d1b, -0.7, 0, -0.7, 0.9);
          addQuad(d2f, -0.7, 0, 0.7, 0.9);
          addQuad(d2b, 0.7, 0, -0.7, 0.9);
        } else {
          const isTranslucent = info.translucent;
          const pos = isTranslucent ? gPositions : oPositions;
          const nrm = isTranslucent ? gNormals : oNormals;
          const uva = isTranslucent ? gUvs : oUvs;
          const lgt = isTranslucent ? gLights : oLights;
          const ani = isTranslucent ? gAnimated : oAnimated;
          const idx = isTranslucent ? gIndices : oIndices;

          const blockFacing = facings?.[`${lx},${ly},${lz}`];
          const faceRemap = blockFacing ? FACING_REMAP[blockFacing] : undefined;

          for (let fi = 0; fi < 6; fi++) {
            const face = FACES[fi];
            const nx = wx + face.dir[0];
            const ny = ly + face.dir[1];
            const nz = wz + face.dir[2];
            const neighborId = getNeighborBlock(nx, ny, nz);
            const neighborInfo = BLOCK_DEFS[neighborId];
            if (neighborInfo?.solid && !neighborInfo.transparent) continue;
            if (neighborId === blockId && info.transparent) continue;

            const texFace = faceRemap ? faceRemap[face.face] : face.face;
            const texName = info.textures[texFace];
            const [u0, v0, u1, v1] = atlas.getUV(texName);

            const vc = isTranslucent ? gVertCount : oVertCount;
            const aoLevels = isTranslucent
              ? null
              : computeFaceAO(getNeighborBlock, wx, ly, wz, fi);
            for (let ci = 0; ci < 4; ci++) {
              const corner = face.corners[ci];
              pos.push(wx + corner[0], ly + corner[1], wz + corner[2]);
              nrm.push(face.dir[0], face.dir[1], face.dir[2]);
              const lightMul = aoLevels ? aoLevelToFactor(aoLevels[ci]) : 1.0;
              lgt.push(face.light * lightMul);
              ani.push(0.0);
            }
            uva.push(u0, v0, u1, v0, u1, v1, u0, v1);
            if (aoLevels && aoLevels[0] + aoLevels[2] < aoLevels[3] + aoLevels[1]) {
              idx.push(vc, vc + 1, vc + 3, vc + 1, vc + 2, vc + 3);
            } else {
              idx.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
            }
            if (isTranslucent) gVertCount += 4; else oVertCount += 4;
          }
        }
      }
    }
  }

  return {
    opaque: buildGeometryFromArrays(oPositions, oNormals, oUvs, oLights, oAnimated, oIndices, oVertCount),
    transparent: buildGeometryFromArrays(tPositions, tNormals, tUvs, tLights, tAnimated, tIndices, tVertCount),
    lava: buildGeometryFromArrays(lPositions, lNormals, lUvs, lLights, lAnimated, lIndices, lVertCount),
    glass: buildGeometryFromArrays(gPositions, gNormals, gUvs, gLights, gAnimated, gIndices, gVertCount),
  };
}
