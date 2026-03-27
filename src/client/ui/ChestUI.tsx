'use client';

import type { InventorySlot } from '#/common/types';
import { SlotContents, SLOT_STYLE, CursorFloat, PlayerInventoryGrid, useContainerDrag } from './container';

const CHEST_SLOT_KEYS = Array.from({ length: 27 }, (_, i) => `chest-slot-${i}`);

type ChestUiProps = {
  chestSlots: (InventorySlot | null)[];
  slots: (InventorySlot | null)[];
  cursorSlot: InventorySlot | null;
  selectedIndex: number;
  onSlotClick: (index: number, button: 'left' | 'right', shift: boolean) => void;
  onSlotCollect: (index: number) => void;
  onChestSlotClick: (slotIndex: number, button: 'left' | 'right', shift: boolean) => void;
  onClose: () => void;
};

export function ChestUI({
  chestSlots,
  slots,
  cursorSlot,
  selectedIndex,
  onSlotClick,
  onSlotCollect,
  onChestSlotClick,
  onClose,
}: ChestUiProps) {
  const { pointer, onOverlayMouseMove, createSlotBinder } = useContainerDrag();

  const chestBinder = createSlotBinder(
    'chest',
    (index, button, shift) => onChestSlotClick(index, button, shift),
  );

  const invBinder = createSlotBinder('chest-inv', onSlotClick, onSlotCollect);

  return (
    <>
      <div
        className='absolute inset-0 flex items-center justify-center bg-black/60'
        data-testid='mineweb-chest-overlay'
        onClick={onClose}
        onMouseMove={onOverlayMouseMove}
      >
        <div
          className='rounded-xl border border-white/15 bg-[#2b2b2f]/95 p-6 shadow-2xl'
          data-testid='mineweb-chest-panel'
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className='mb-3 text-center text-lg font-bold tracking-wide text-white'>Chest</h3>

          <div className='mb-4' data-testid='mineweb-chest-grid'>
            <div className='grid grid-cols-9 gap-1'>
              {chestSlots.map((slot, idx) => (
                <div
                  key={CHEST_SLOT_KEYS[idx]}
                  className='relative flex h-10 w-10 items-center justify-center'
                  style={SLOT_STYLE}
                  data-testid='mineweb-chest-slot'
                  {...chestBinder.bind(idx)}
                >
                  {slot && <SlotContents slot={slot} />}
                </div>
              ))}
            </div>
          </div>

          <div className='my-3 h-px bg-white/10' />

          <div data-testid='mineweb-chest-inventory'>
            <PlayerInventoryGrid
              slots={slots}
              selectedIndex={selectedIndex}
              onSlotClick={onSlotClick}
              onSlotCollect={onSlotCollect}
              onDragStart={invBinder.dragStart}
              onDragContinue={invBinder.dragContinue}
            />
          </div>

          <p className='mt-3 text-xs text-white/50'>LMB: pick/place/swap, RMB: split/place one, Shift+LMB: quick transfer</p>
          <p className='mt-2 text-center text-xs text-white/40'>Press E or ESC to close</p>
        </div>
      </div>
      {cursorSlot && (
        <div data-testid='mineweb-chest-cursor-float'>
          <CursorFloat slot={cursorSlot} x={pointer.x} y={pointer.y} />
        </div>
      )}
    </>
  );
}
