import * as THREE from 'three';
import type { AssetManager } from '#/common/AssetManager';
import { assetManager } from '#/common/AssetManager';
import {
  nextAtlasPerfInstanceId,
  perfAtlasDiscoveryEnd,
  perfAtlasDiscoveryStart,
  perfAtlasTileAssemblyEnd,
  perfAtlasTileAssemblyStart,
  perfAtlasTextureUploadMarkEnd,
  perfAtlasTextureUploadMarkStart,
} from '#/common/assetPipelinePerf';
import { getBlockTextureNames } from '#/block/BlockRegistry';
import { FALLBACK_COLORS } from '#/block/blockColors';
import { getItemTextureNames } from '#/common/ItemRegistry';
import { ATLAS_COLS, ATLAS_TILE_SIZE } from '#/common/types';

const GLASS_TEXTURES = new Set(['glass', 'ice']);
const ALPHA_PRESERVE_TEXTURES = new Set([
  'oak_leaves', 'birch_leaves', 'spruce_leaves', 'acacia_leaves', 'jungle_leaves',
]);

const CROSS_PLANT_TEXTURES = new Set([
  'poppy', 'dandelion', 'torch', 'allium', 'azure_bluet', 'blue_orchid',
  'cornflower', 'lily_of_the_valley', 'oxeye_daisy', 'wither_rose',
  'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip',
]);

// Textures that need green biome tint (Minecraft ships them as grayscale)
export const TINTED_TEXTURES: Record<string, string> = {
  grass_block_top: '#79c05a',
  grass_block_side_overlay: '#79c05a',
  oak_leaves: '#77ab2f',
  birch_leaves: '#80a755',
  spruce_leaves: '#619961',
  acacia_leaves: '#77ab2f',
  jungle_leaves: '#59c93c',
  vine: '#77ab2f',
  lily_pad: '#208030',
  grass: '#79c05a',
  tall_grass_top: '#79c05a',
  tall_grass_bottom: '#79c05a',
  fern: '#77ab2f',
  large_fern_top: '#77ab2f',
  large_fern_bottom: '#77ab2f',
};

export type TextureAtlasOptions = {
  /** Defaults to the shared {@link assetManager}. */
  assetManager?: AssetManager;
  /** When set, only these names are packed (used by perf tests / diagnostics). */
  textureNamesSubset?: readonly string[];
};

export class TextureAtlas {
  texture: THREE.CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nameToIndex = new Map<string, number>();
  ready = false;
  private textureNames: string[];
  private itemOnlyNames: Set<string>;
  private _warnedMissing = new Set<string>();
  private readonly assetMgr: AssetManager;
  private readonly perfAtlasId: number;
  private tilePromises: Promise<void>[] = [];

  constructor(options?: TextureAtlasOptions) {
    this.perfAtlasId = nextAtlasPerfInstanceId();
    this.assetMgr = options?.assetManager ?? assetManager;

    perfAtlasDiscoveryStart(this.perfAtlasId);
    const blockNames = new Set<string>(getBlockTextureNames());
    const itemNames = new Set<string>(getItemTextureNames());
    if (options?.textureNamesSubset?.length) {
      this.textureNames = Array.from(new Set(options.textureNamesSubset));
      this.itemOnlyNames = new Set(this.textureNames.filter((n) => !blockNames.has(n)));
    } else {
      const allNames = new Set<string>(blockNames);
      this.itemOnlyNames = new Set<string>();
      for (const name of itemNames) {
        allNames.add(name);
        if (!blockNames.has(name)) {
          this.itemOnlyNames.add(name);
        }
      }
      this.textureNames = Array.from(allNames);
    }
    perfAtlasDiscoveryEnd(this.perfAtlasId);

    this.canvas = document.createElement('canvas');
    const rows = Math.ceil(this.textureNames.length / ATLAS_COLS);
    this.canvas.width = ATLAS_COLS * ATLAS_TILE_SIZE;
    this.canvas.height = rows * ATLAS_TILE_SIZE;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.fillStyle = '#808080';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.textureNames.forEach((name, i) => this.nameToIndex.set(name, i));
  }

  async load(): Promise<void> {
    for (const [i, name] of this.textureNames.entries()) {
      this.drawFallback(i, name);
    }
    const uInitial = perfAtlasTextureUploadMarkStart(this.perfAtlasId, 'load', 'initial-ready');
    this.texture.needsUpdate = true;
    perfAtlasTextureUploadMarkEnd(this.perfAtlasId, 'load', 'initial-ready', uInitial);
    this.ready = true;

    this.tilePromises = this.textureNames.map((name, i) => this.loadTile(name, i));
    Promise.allSettled(this.tilePromises).then(() => {
      const uSettled = perfAtlasTextureUploadMarkStart(this.perfAtlasId, 'load', 'all-tiles-settled');
      this.texture.needsUpdate = true;
      perfAtlasTextureUploadMarkEnd(this.perfAtlasId, 'load', 'all-tiles-settled', uSettled);
    });
  }

  /** Resolves after all async tile draws from the last {@link load} have settled (for tests / diagnostics). */
  async whenTilesSettled(): Promise<void> {
    await Promise.allSettled(this.tilePromises);
  }

  private async loadTile(name: string, index: number): Promise<void> {
    const img = this.itemOnlyNames.has(name)
      ? await this.assetMgr.loadItemTexture(name)
      : (await this.assetMgr.loadBlockTexture(name) ?? await this.assetMgr.loadItemTexture(name));
    if (!img) return;
    const asmStart = perfAtlasTileAssemblyStart(this.perfAtlasId, index);
    try {
      this.drawTileIntoAtlas(name, index, img);
    } finally {
      perfAtlasTileAssemblyEnd(this.perfAtlasId, index, asmStart);
    }
    const uTile = perfAtlasTextureUploadMarkStart(this.perfAtlasId, 'tile', index);
    this.texture.needsUpdate = true;
    perfAtlasTextureUploadMarkEnd(this.perfAtlasId, 'tile', index, uTile);
  }

  private drawTileIntoAtlas(name: string, index: number, img: HTMLImageElement): void {
    const col = index % ATLAS_COLS;
    const row = Math.floor(index / ATLAS_COLS);
    const x = col * ATLAS_TILE_SIZE;
    const y = row * ATLAS_TILE_SIZE;

    // Clear tile area first to preserve alpha transparency (leaves, glass, flowers)
    this.ctx.clearRect(x, y, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE);

    const tintColor = TINTED_TEXTURES[name];
    if (tintColor) {
      // Tint on a temporary canvas to avoid destination-in wiping the atlas
      const tmp = document.createElement('canvas');
      tmp.width = ATLAS_TILE_SIZE;
      tmp.height = ATLAS_TILE_SIZE;
      const tc = tmp.getContext('2d')!;
      tc.imageSmoothingEnabled = false;
      tc.drawImage(img, 0, 0, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE);
      tc.globalCompositeOperation = 'multiply';
      tc.fillStyle = tintColor;
      tc.fillRect(0, 0, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE);
      tc.globalCompositeOperation = 'destination-in';
      tc.drawImage(img, 0, 0, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE);
      this.ctx.drawImage(tmp, x, y);
    } else {
      this.ctx.drawImage(img, x, y, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE);
    }
    if (GLASS_TEXTURES.has(name)) {
      const imageData = this.ctx.getImageData(x, y, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE);
      const data = imageData.data;
      const border = Math.max(1, Math.floor(ATLAS_TILE_SIZE / 16));
      for (let py = 0; py < ATLAS_TILE_SIZE; py++) {
        for (let px = 0; px < ATLAS_TILE_SIZE; px++) {
          if (px >= border && px < ATLAS_TILE_SIZE - border && py >= border && py < ATLAS_TILE_SIZE - border) {
            const idx = (py * ATLAS_TILE_SIZE + px) * 4;
            data[idx + 3] = Math.min(data[idx + 3], 80);
          }
        }
      }
      this.ctx.putImageData(imageData, x, y);
    } else if (!CROSS_PLANT_TEXTURES.has(name) && !ALPHA_PRESERVE_TEXTURES.has(name)) {
      const imageData = this.ctx.getImageData(x, y, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE);
      const data = imageData.data;
      let modified = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) { data[i] = 255; modified = true; }
      }
      if (modified) this.ctx.putImageData(imageData, x, y);
    }
  }

  private drawFallback(index: number, name: string) {
    const col = index % ATLAS_COLS;
    const row = Math.floor(index / ATLAS_COLS);
    const x = col * ATLAS_TILE_SIZE;
    const y = row * ATLAS_TILE_SIZE;
    const color = FALLBACK_COLORS[name] ?? '#808080';
    if (CROSS_PLANT_TEXTURES.has(name)) {
      this.ctx.clearRect(x, y, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE);
      const cx = x + ATLAS_TILE_SIZE / 2;
      const cy = y + ATLAS_TILE_SIZE / 2;
      const w = ATLAS_TILE_SIZE * 0.5;
      this.ctx.fillStyle = `${color}cc`;
      this.ctx.fillRect(cx - w / 2, cy - w / 2, w, 2);
      this.ctx.fillRect(cx - 1, cy - w / 2, 2, w);
    } else if (GLASS_TEXTURES.has(name)) {
      this.ctx.clearRect(x, y, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE);
      const s = ATLAS_TILE_SIZE;
      const border = Math.max(1, Math.floor(s / 16));
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, y, s, border);           // top
      this.ctx.fillRect(x, y + s - border, s, border); // bottom
      this.ctx.fillRect(x, y, border, s);            // left
      this.ctx.fillRect(x + s - border, y, border, s); // right
      this.ctx.globalAlpha = 0.3;
      this.ctx.fillRect(x + border, y + border, s - border * 2, s - border * 2);
      this.ctx.globalAlpha = 1.0;
    } else {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, y, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE);
    }
  }

  hasTexture(textureName: string): boolean {
    return this.nameToIndex.has(textureName);
  }

  getUV(textureName: string): [number, number, number, number] {
    const index = this.nameToIndex.get(textureName);
    if (index == null) {
      if (textureName && !this._warnedMissing.has(textureName)) {
        this._warnedMissing.add(textureName);
        console.warn(`[TextureAtlas] missing texture: "${textureName}"`);
      }
      return [0, 0, 0, 0];
    }
    const col = index % ATLAS_COLS;
    const row = Math.floor(index / ATLAS_COLS);
    const totalRows = Math.ceil(this.nameToIndex.size / ATLAS_COLS);

    // Half-pixel inset to prevent UV bleeding at tile boundaries
    const halfPixelU = 0.5 / (ATLAS_COLS * ATLAS_TILE_SIZE);
    const halfPixelV = 0.5 / (totalRows * ATLAS_TILE_SIZE);

    const u0 = col / ATLAS_COLS + halfPixelU;
    const v0 = 1 - (row + 1) / totalRows + halfPixelV;
    const u1 = (col + 1) / ATLAS_COLS - halfPixelU;
    const v1 = 1 - row / totalRows - halfPixelV;
    return [u0, v0, u1, v1];
  }
}
