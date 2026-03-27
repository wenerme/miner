import * as THREE from 'three';

export const PX = 1 / 16; // 1 pixel = 1/16 block

/**
 * Compute UV face regions for a Minecraft-style box.
 * texOff = [u, v] pixel offset on the texture sheet.
 * boxDims = [width, height, depth] in pixels.
 * texSize = [texWidth, texHeight] of the texture image.
 * Returns [right, left, top, bottom, front, back] UV quads.
 */
export function boxUVs(
  texOff: [number, number],
  boxDims: [number, number, number],
  texSize: [number, number],
): [number, number, number, number][] {
  const [u, v] = texOff;
  const [w, h, d] = boxDims;
  const [tw, th] = texSize;
  return [
    [u, v + d, d, h],             // right (+X) → face 0
    [u + d + w, v + d, d, h],     // left  (-X) → face 1
    [u + d, v, w, d],             // top   (+Y) → face 2
    [u + d + w, v, w, d],         // bottom(-Y) → face 3
    [u + d + w + d, v + d, w, h], // back  → face 4 (+Z, which is model's back)
    [u + d, v + d, w, h],         // front → face 5 (-Z, which is model's face)
  ].map(([sx, sy, sw, sh]) => [sx / tw, sy / th, sw / tw, sh / th]) as [number, number, number, number][];
}

export function makeBox(
  w: number, h: number, d: number,
  faceUVs: [number, number, number, number][],
  fallbackColor: number,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w * PX, h * PX, d * PX);
  const mat = new THREE.MeshLambertMaterial({
    color: fallbackColor,
    transparent: true,
    alphaTest: 0.1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const uvAttr = geo.getAttribute('uv');
  const uvs = uvAttr.array as Float32Array;
  for (let face = 0; face < 6 && face < faceUVs.length; face++) {
    const [u0n, v0n, wn, hn] = faceUVs[face];
    const u1n = u0n + wn;
    const v1n = v0n + hn;
    const vTop = 1 - v0n;
    const vBot = 1 - v1n;
    const base = face * 8;
    uvs[base] = u0n;     uvs[base + 1] = vTop;
    uvs[base + 2] = u1n; uvs[base + 3] = vTop;
    uvs[base + 4] = u0n; uvs[base + 5] = vBot;
    uvs[base + 6] = u1n; uvs[base + 7] = vBot;
  }
  uvAttr.needsUpdate = true;
  return mesh;
}

export function createPivot(mesh: THREE.Mesh, pivotY: number): THREE.Group {
  const pivot = new THREE.Group();
  mesh.position.y = pivotY;
  pivot.add(mesh);
  return pivot;
}
