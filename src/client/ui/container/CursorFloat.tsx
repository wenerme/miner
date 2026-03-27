'use client';

import type { InventorySlot } from '#/common/types';
import { getItemMaxDurability } from '#/common/ItemRegistry';
import { BlockIcon } from '../BlockIcon';

const CURSOR_OFFSET = 2;

export function CursorFloat({ slot, x, y }: { slot: InventorySlot; x: number; y: number }) {
  return (
    <div
      className='pointer-events-none fixed z-[100000]'
      style={{ left: x + CURSOR_OFFSET, top: y + CURSOR_OFFSET }}
    >
      <div className='relative flex h-10 w-10 items-center justify-center drop-shadow-lg'>
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
          <span className='absolute bottom-0 right-0.5 text-[10px] font-bold text-white drop-shadow'>{slot.count}</span>
        )}
      </div>
    </div>
  );
}
