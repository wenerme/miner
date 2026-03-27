import { nextImageLoadPerfId } from './assetPipelinePerf';
import { MC_TEXTURES } from './types';

const PERF_PREFIX = 'mineweb:asset:img:';

export class AssetManager {
  private imageCache = new Map<string, HTMLImageElement>();
  private loadingPromises = new Map<string, Promise<HTMLImageElement | null>>();

  /**
   * Pre-register a decoded image (e.g. data URL) for a path without going through Image decode.
   * Used by perf tests to isolate atlas assembly from network/decoding.
   */
  registerCachedImage(path: string, img: HTMLImageElement): void {
    this.imageCache.set(path, img);
  }

  async loadImage(path: string): Promise<HTMLImageElement | null> {
    if (this.imageCache.has(path)) return this.imageCache.get(path)!;
    if (this.loadingPromises.has(path)) return this.loadingPromises.get(path)!;

    const loadId = nextImageLoadPerfId();
    const startMark = `${PERF_PREFIX}${loadId}:start`;
    const endMark = `${PERF_PREFIX}${loadId}:end`;

    const promise = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      const finish = (imgEl: HTMLImageElement | null) => {
        performance.mark(endMark);
        try {
          performance.measure(`${PERF_PREFIX}${loadId}:individualImageLoad`, startMark, endMark);
        } catch {
          /* ignore */
        }
        resolve(imgEl);
      };
      img.onload = () => {
        this.imageCache.set(path, img);
        finish(img);
      };
      img.onerror = () => finish(null);
      performance.mark(startMark);
      img.src = path;
    });
    this.loadingPromises.set(path, promise);
    return promise;
  }

  async loadBlockTexture(name: string): Promise<HTMLImageElement | null> {
    return this.loadImage(`${MC_TEXTURES}/block/${name}.png`);
  }

  async loadItemTexture(name: string): Promise<HTMLImageElement | null> {
    return this.loadImage(`${MC_TEXTURES}/item/${name}.png`);
  }

  async loadGuiTexture(path: string): Promise<HTMLImageElement | null> {
    return this.loadImage(`${MC_TEXTURES}/gui/${path}`);
  }

  getImage(path: string): HTMLImageElement | undefined {
    return this.imageCache.get(path);
  }
}

export const assetManager = new AssetManager();
