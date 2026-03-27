'use client';

import type { InventorySlot } from '#/common/types';
import { getItemMaxDurability } from '#/common/ItemRegistry';
import { BlockIcon } from '../BlockIcon';

export const SLOT_BG = '/mc/assets/minecraft/textures/gui/sprites/container/slot.png';

export const SLOT_STYLE = {
  backgroundImage: `url(${SLOT_BG})`,
  backgroundSize: 'contain',
  imageRendering: 'pixelated' as const,
};

export function SlotContents({ slot }: { slot: InventorySlot }) {
  return (
    <>
      <BlockIcon itemId={slot.itemId} size={32} />
      {slot.durability != null && (
        <div className='absolute bottom-0.5 left-1 right-1 h-1 rounded bg-black/80'>
          <div
            className='h-full rounded bg-lime-400'
            style={{
              width: `${Math.max(0, Math.min(100, ((slot.durability / (getItemMaxDurability(slot.itemId) ?? slot.durability)) * 100)))}%`,
            }}
          />
        </div>
      )}
      {slot.count > 1 && (
        <span className='absolute bottom-0 right-0.5 text-[9px] font-bold text-white'>{slot.count}</span>
      )}
    </>
  );
}
