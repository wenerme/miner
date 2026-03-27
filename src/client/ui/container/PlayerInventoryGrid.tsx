'use client';

import type { MouseEvent } from 'react';
import type { InventorySlot } from '#/common/types';
import { SlotContents, SLOT_STYLE } from './ContainerSlot';

type SlotClickHandler = (index: number, button: 'left' | 'right', shift: boolean) => void;

export type PlayerInventoryGridProps = {
  slots: (InventorySlot | null)[];
  selectedIndex: number;
  onSlotClick: SlotClickHandler;
  onSlotCollect: (index: number) => void;
  onDragStart?: (index: number, button: 'left' | 'right', shift: boolean) => void;
  onDragContinue?: (index: number) => void;
};

const SLOT_KEYS = Array.from({ length: 36 }, (_, i) => `grid-slot-${i}`);

export function PlayerInventoryGrid({
  slots,
  selectedIndex,
  onSlotClick,
  onSlotCollect,
  onDragStart,
  onDragContinue,
}: PlayerInventoryGridProps) {
  const mainSlots = slots.slice(9, 36);
  const hotbarSlots = slots.slice(0, 9);

  const bindSlot = (index: number) => ({
    onMouseDown: (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const button = e.button === 2 ? 'right' as const : 'left' as const;
      const shift = e.shiftKey;
      onSlotClick(index, button, shift);
      onDragStart?.(index, button, shift);
    },
    onMouseEnter: () => onDragContinue?.(index),
    onDoubleClick: () => onSlotCollect(index),
    onContextMenu: (e: MouseEvent<HTMLDivElement>) => e.preventDefault(),
  });

  return (
    <>
      <div>
        <p className='mb-1 text-xs uppercase tracking-wide text-white/60'>Backpack</p>
        <div className='grid grid-cols-9 gap-1'>
          {mainSlots.map((slot, idx) => {
            const i = idx + 9;
            return (
              <div
                key={SLOT_KEYS[i]}
                className={`relative flex h-10 w-10 items-center justify-center ${i === selectedIndex ? 'outline outline-2 outline-amber-300' : ''}`}
                data-testid='mineweb-inventory-slot'
                data-slot-index={i}
                style={SLOT_STYLE}
                {...bindSlot(i)}
              >
                {slot && <SlotContents slot={slot} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className='my-3 h-px bg-white/10' />

      <div>
        <p className='mb-1 text-xs uppercase tracking-wide text-white/60'>Hotbar</p>
        <div className='grid grid-cols-9 gap-1'>
          {hotbarSlots.map((slot, idx) => (
            <div
              key={SLOT_KEYS[idx]}
              className={`relative flex h-10 w-10 items-center justify-center ${idx === selectedIndex ? 'outline outline-2 outline-amber-300' : ''}`}
              data-testid='mineweb-inventory-slot'
              data-slot-index={idx}
              style={SLOT_STYLE}
              {...bindSlot(idx)}
            >
              {slot && <SlotContents slot={slot} />}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
