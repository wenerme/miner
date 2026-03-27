'use client';

import { useEffect, useRef } from 'react';
import { assetManager } from '#/common/AssetManager';
import { getItemDef, getItemIconFallbackLabel } from '#/common/ItemRegistry';
import { FALLBACK_COLORS } from '#/block/blockColors';
import { MC_TEXTURES } from '#/common/types';

const GENERIC_FALLBACK = '#808080';

function drawFallback(ctx: CanvasRenderingContext2D, texName: string, size: number, label: string) {
  const color = FALLBACK_COLORS[texName] ?? GENERIC_FALLBACK;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, size - Math.floor(size * 0.42), size, Math.floor(size * 0.42));
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.lineWidth = Math.max(1, Math.floor(size * 0.06));
  ctx.font = `bold ${Math.max(8, Math.floor(size * 0.28))}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(label, size * 0.5, size * 0.78);
  ctx.fillText(label, size * 0.5, size * 0.78);
}

export function BlockIcon({
  itemId,
  blockId,
  size = 32,
}: {
  itemId?: number;
  blockId?: number;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resolvedItemId = itemId ?? blockId;
  const def = getItemDef(resolvedItemId);
  const itemKind = def?.kind ?? 'block';
  const texName = def?.texture;
  const fallbackLabel = getItemIconFallbackLabel(resolvedItemId);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);

    if (!texName) {
      drawFallback(ctx, String(resolvedItemId ?? ''), size, fallbackLabel);
      return;
    }
    const primaryFolder = itemKind === 'block' ? 'block' : 'item';
    const secondaryFolder = primaryFolder === 'block' ? 'item' : 'block';
    const primaryPath = `${MC_TEXTURES}/${primaryFolder}/${texName}.png`;
    const secondaryPath = `${MC_TEXTURES}/${secondaryFolder}/${texName}.png`;
    const cachedPrimary = assetManager.getImage(primaryPath);
    if (cachedPrimary) {
      ctx.drawImage(cachedPrimary, 0, 0, size, size);
      return;
    }
    const cachedSecondary = assetManager.getImage(secondaryPath);
    if (cachedSecondary) {
      ctx.drawImage(cachedSecondary, 0, 0, size, size);
      return;
    }

    let cancelled = false;
    drawFallback(ctx, texName, size, fallbackLabel);
    const primaryLoader = primaryFolder === 'block'
      ? assetManager.loadBlockTexture(texName)
      : assetManager.loadItemTexture(texName);
    void primaryLoader.then(async (img) => {
      if (cancelled) return;
      const resolved = img ?? await (secondaryFolder === 'block'
        ? assetManager.loadBlockTexture(texName)
        : assetManager.loadItemTexture(texName));
      if (!resolved) return;
      const c = canvasRef.current?.getContext('2d');
      if (!c) return;
      c.imageSmoothingEnabled = false;
      c.clearRect(0, 0, size, size);
      c.drawImage(resolved, 0, 0, size, size);
    });
    return () => {
      cancelled = true;
    };
  }, [itemKind, texName, size, resolvedItemId, fallbackLabel]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className='block'
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  );
}
