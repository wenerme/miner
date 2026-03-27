'use client';

import type { InventorySlot } from '#/common/types';
import { SlotContents, SLOT_STYLE, CursorFloat, PlayerInventoryGrid, useContainerDrag } from './container';

const FURNACE_SLOT_NAMES = ['input', 'fuel', 'output'] as const;

type FurnaceUiProps = {
  inputSlot: InventorySlot | null;
  fuelSlot: InventorySlot | null;
  outputSlot: InventorySlot | null;
  burnTimeLeft: number;
  burnTimeTotal: number;
  cookProgress: number;
  cookTimeTotal: number;
  slots: (InventorySlot | null)[];
  cursorSlot: InventorySlot | null;
  selectedIndex: number;
  onSlotClick: (index: number, button: 'left' | 'right', shift: boolean) => void;
  onSlotCollect: (index: number) => void;
  onFurnaceSlotClick: (slot: 'input' | 'fuel' | 'output', button: 'left' | 'right', shift: boolean) => void;
  onClose: () => void;
};

function FurnaceSlotCell({
  label,
  slot,
  bind,
}: {
  label: string;
  slot: InventorySlot | null;
  bind: ReturnType<ReturnType<typeof useContainerDrag>['createSlotBinder']>['bind'] extends (i: number) => infer R ? R : never;
}) {
  return (
    <div>
      <p className='mb-1 text-xs uppercase tracking-wide text-white/60'>{label}</p>
      <div
        className='relative flex h-10 w-10 items-center justify-center'
        style={SLOT_STYLE}
        data-testid='mineweb-furnace-slot'
        {...bind}
      >
        {slot && <SlotContents slot={slot} />}
      </div>
    </div>
  );
}

export function FurnaceUI({
  inputSlot,
  fuelSlot,
  outputSlot,
  burnTimeLeft,
  burnTimeTotal,
  cookProgress,
  cookTimeTotal,
  slots,
  cursorSlot,
  selectedIndex,
  onSlotClick,
  onSlotCollect,
  onFurnaceSlotClick,
  onClose,
}: FurnaceUiProps) {
  const { pointer, onOverlayMouseMove, createSlotBinder } = useContainerDrag();

  const fireRatio = burnTimeTotal > 0 ? Math.max(0, Math.min(1, burnTimeLeft / burnTimeTotal)) : 0;
  const cookRatio = cookTimeTotal > 0 ? Math.max(0, Math.min(1, cookProgress / cookTimeTotal)) : 0;

  const furnaceBinder = createSlotBinder(
    'furnace',
    (index, button, shift) => {
      onFurnaceSlotClick(FURNACE_SLOT_NAMES[index] ?? 'input', button, shift);
    },
  );

  const invBinder = createSlotBinder('furnace-inv', onSlotClick, onSlotCollect);

  return (
    <>
      <div
        className='absolute inset-0 flex items-center justify-center bg-black/60'
        data-testid='mineweb-furnace-overlay'
        onClick={onClose}
        onMouseMove={onOverlayMouseMove}
      >
        <div
          className='rounded-xl border border-white/15 bg-[#2b2b2f]/95 p-6 shadow-2xl'
          data-testid='mineweb-furnace-panel'
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className='mb-4 text-center text-lg font-bold tracking-wide text-white'>Furnace</h3>

          <div className='mb-4 flex items-end justify-center gap-4'>
            <FurnaceSlotCell label='Input' slot={inputSlot} bind={furnaceBinder.bind(0)} />

            <div className='flex flex-col items-center gap-2 pb-1'>
              <div
                className='relative h-10 w-3 overflow-hidden rounded-sm border border-white/20 bg-black/40'
                title='Smelting progress'
              >
                <div
                  className='absolute bottom-0 left-0 right-0 bg-amber-400/90'
                  style={{ height: `${Math.round(cookRatio * 100)}%`, imageRendering: 'pixelated' }}
                />
              </div>
              <div
                className='text-lg leading-none'
                title='Fuel'
                style={{ filter: fireRatio > 0 ? 'none' : 'grayscale(1) opacity(0.35)' }}
              >
                🔥
              </div>
              <div className='h-1 w-8 overflow-hidden rounded-full bg-black/50'>
                <div className='h-full rounded-full bg-orange-500' style={{ width: `${Math.round(fireRatio * 100)}%` }} />
              </div>
            </div>

            <FurnaceSlotCell label='Output' slot={outputSlot} bind={furnaceBinder.bind(2)} />
          </div>

          <div className='mb-4 flex justify-start'>
            <FurnaceSlotCell label='Fuel' slot={fuelSlot} bind={furnaceBinder.bind(1)} />
          </div>

          <div className='my-3 h-px bg-white/10' />

          <div data-testid='mineweb-furnace-inventory'>
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
        <div data-testid='mineweb-furnace-cursor-float'>
          <CursorFloat slot={cursorSlot} x={pointer.x} y={pointer.y} />
        </div>
      )}
    </>
  );
}
