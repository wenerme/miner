'use client';

import type { InventorySlot } from '#/common/types';
import { getItemMaxDurability } from '#/common/ItemRegistry';
import { BlockIcon } from './BlockIcon';

const SLOT_SIZE = 40;

interface HotbarUIProps {
  slots: (InventorySlot | null)[];
  offhandSlot?: InventorySlot | null;
  selectedIndex: number;
  onSelect: (i: number) => void;
}

export function HotbarUI({ slots, offhandSlot, selectedIndex, onSelect }: HotbarUIProps) {
  const renderSlotContent = (slot: InventorySlot | null) => {
    if (!slot) return null;
    return (
      <>
        <BlockIcon itemId={slot.itemId} size={28} />
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
          <span className='absolute bottom-0 right-1 text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]'>
            {slot.count}
          </span>
        )}
      </>
    );
  };

  return (
    <div className='absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center'>
      <div className='mr-2 flex items-center gap-0.5 rounded-lg bg-black/50 px-1 py-1'>
        <div
          className='relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded border border-cyan-300/50 bg-black/40'
          style={{ minWidth: SLOT_SIZE }}
          title='Offhand'
          data-testid='mineweb-hotbar-offhand-slot'
        >
          <span className='absolute left-0.5 top-0.5 text-[10px] font-medium text-cyan-200/80'>
            F
          </span>
          {renderSlotContent(offhandSlot ?? null)}
        </div>
      </div>
      <div className='flex items-center gap-0.5 rounded-lg bg-black/50 px-1 py-1'>
        {slots.map((slot, i) => {
          const isSelected = i === selectedIndex;
          return (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: hotbar positions are fixed slots, not reorderable list items
              key={`hotbar-slot-${i}-${slot?.itemId ?? 'empty'}`}
              type='button'
              className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded transition-all ${
                isSelected
                  ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black/80 shadow-lg shadow-amber-500/30'
                  : 'hover:bg-white/10'
              }`}
              style={{ minWidth: SLOT_SIZE }}
              onClick={() => onSelect(i)}
              data-testid='mineweb-hotbar-slot'
              data-slot-index={i}
            >
              <span className='absolute left-0.5 top-0.5 text-[10px] font-medium text-white/40'>
                {i + 1}
              </span>
              {renderSlotContent(slot)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
