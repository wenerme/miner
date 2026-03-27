'use client';

import type { InventorySlot, PlayerArmorSlots } from '#/common/types';
import { matchRecipeFromGrid } from '#/common/CraftingRegistry';
import { SlotContents, SLOT_STYLE, CursorFloat, PlayerInventoryGrid, useContainerDrag } from './container';

const CRAFT_KEYS = Array.from({ length: 9 }, (_, i) => `craft-slot-${i}`);
const ARMOR_UI_BASE_INDEX = 36;
const OFFHAND_UI_INDEX = ARMOR_UI_BASE_INDEX + 4;

export type InventoryUiMode = 'inventory' | 'craftTable';

interface InventoryUIProps {
  mode?: InventoryUiMode;
  slots: (InventorySlot | null)[];
  armorSlots: PlayerArmorSlots;
  craftTableSlots?: (InventorySlot | null)[];
  offhandSlot: InventorySlot | null;
  cursorSlot: InventorySlot | null;
  selectedIndex: number;
  onSlotClick: (index: number, button: 'left' | 'right', shift: boolean) => void;
  onSlotCollect: (index: number) => void;
  onCraftTableSlotClick?: (index: number, button: 'left' | 'right', shift: boolean) => void;
  onCraftTableSlotCollect?: (index: number) => void;
  onCraftResultClick?: (button: 'left' | 'right', shift: boolean) => void;
  onClose: () => void;
}

export function InventoryUI({
  mode = 'inventory',
  slots,
  armorSlots,
  craftTableSlots,
  offhandSlot,
  cursorSlot,
  selectedIndex,
  onSlotClick,
  onSlotCollect,
  onCraftTableSlotClick,
  onCraftTableSlotCollect,
  onCraftResultClick,
  onClose,
}: InventoryUIProps) {
  const { pointer, onOverlayMouseMove, createSlotBinder } = useContainerDrag();
  const armorOrder: (keyof PlayerArmorSlots)[] = ['helmet', 'chestplate', 'leggings', 'boots'];
  const armorLabels = ['Helmet', 'Chest', 'Legs', 'Boots'];

  const grid = craftTableSlots ?? Array(9).fill(null);
  const matchedRecipe = mode === 'craftTable' ? matchRecipeFromGrid(grid) : null;
  const previewOutput = matchedRecipe?.output ?? null;

  const invBinder = createSlotBinder('inv', onSlotClick, onSlotCollect);
  const craftBinder = createSlotBinder(
    'craft',
    (index, button, shift) => onCraftTableSlotClick?.(index, button, shift),
    (index) => onCraftTableSlotCollect?.(index),
  );
  const resultBinder = createSlotBinder(
    'result',
    (_index, button, shift) => onCraftResultClick?.(button, shift),
  );

  const title = mode === 'craftTable' ? 'Crafting' : 'Inventory';

  return (
    <>
      <div
        className='absolute inset-0 flex items-center justify-center bg-black/60'
        data-testid='mineweb-inventory-overlay'
        onClick={onClose}
        onMouseMove={onOverlayMouseMove}
      >
        <div
          className='rounded-xl border border-white/15 bg-[#2b2b2f]/95 p-6 shadow-2xl'
          data-testid='mineweb-inventory-panel'
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className='mb-3 text-center text-lg font-bold tracking-wide text-white'>{title}</h3>

          {mode === 'craftTable' && (
            <div className='mb-4 flex items-start justify-center gap-6'>
              <div data-testid='mineweb-craft-table-grid'>
                <p className='mb-1 text-xs uppercase tracking-wide text-white/60'>Crafting</p>
                <div className='grid grid-cols-3 gap-1'>
                  {grid.map((slot, idx) => (
                    <div
                      key={CRAFT_KEYS[idx] ?? `craft-${idx}`}
                      className='relative flex h-10 w-10 items-center justify-center'
                      data-testid='mineweb-craft-table-slot'
                      data-craft-slot-index={idx}
                      style={SLOT_STYLE}
                      {...craftBinder.bind(idx)}
                    >
                      {slot && <SlotContents slot={slot} />}
                    </div>
                  ))}
                </div>
              </div>
              <div className='flex flex-col justify-center pt-6'>
                <p className='mb-1 text-xs uppercase tracking-wide text-white/60'>Result</p>
                <div
                  className='relative flex h-10 w-10 items-center justify-center'
                  data-testid='mineweb-craft-result-slot'
                  style={SLOT_STYLE}
                  {...resultBinder.bind(0)}
                >
                  {previewOutput && (
                    <SlotContents slot={{ itemId: previewOutput.itemId, count: previewOutput.count }} />
                  )}
                </div>
              </div>
            </div>
          )}

          <div className={`flex gap-4 ${mode === 'craftTable' ? 'justify-center' : ''}`}>
            {mode === 'inventory' && (
              <div className='w-[92px]'>
                <p className='mb-1 text-xs uppercase tracking-wide text-white/60'>Armor</p>
                <div className='space-y-1.5'>
                  {armorLabels.map((label, ai) => {
                    const slotKey = armorOrder[ai] ?? 'helmet';
                    const uiIndex = ARMOR_UI_BASE_INDEX + ai;
                    const slot = armorSlots[slotKey];
                    return (
                      <div key={label} className='flex items-center gap-2'>
                        <div
                          className='relative flex h-10 w-10 items-center justify-center'
                          data-testid='mineweb-inventory-armor-slot'
                          data-slot-index={uiIndex}
                          style={SLOT_STYLE}
                          {...invBinder.bind(uiIndex)}
                        >
                          {slot && <SlotContents slot={slot} />}
                        </div>
                        <span className='text-[10px] text-white/50'>{label}</span>
                      </div>
                    );
                  })}
                </div>
                <p className='mb-1 mt-3 text-xs uppercase tracking-wide text-white/60'>Offhand</p>
                <div
                  className='relative flex h-10 w-10 items-center justify-center'
                  data-testid='mineweb-inventory-offhand-slot'
                  style={SLOT_STYLE}
                  {...invBinder.bind(OFFHAND_UI_INDEX)}
                >
                  {offhandSlot && <SlotContents slot={offhandSlot} />}
                </div>
              </div>
            )}

            <div data-testid='mineweb-inventory-grid'>
              <PlayerInventoryGrid
                slots={slots}
                selectedIndex={selectedIndex}
                onSlotClick={onSlotClick}
                onSlotCollect={onSlotCollect}
                onDragStart={invBinder.dragStart}
                onDragContinue={invBinder.dragContinue}
              />
            </div>
          </div>

          <div className='mt-3'>
            <p className='text-xs text-white/50'>LMB: pick/place/swap, RMB: split/place one, Shift+LMB: quick move</p>
          </div>

          <p className='mt-3 text-center text-xs text-white/40'>Press E or ESC to close</p>
        </div>
      </div>
      {cursorSlot && (
        <div data-testid='mineweb-inventory-cursor-float'>
          <CursorFloat slot={cursorSlot} x={pointer.x} y={pointer.y} />
        </div>
      )}
    </>
  );
}
