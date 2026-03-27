'use client';

import { getItemDef } from '#/common/ItemRegistry';
import type { CraftingRecipe } from '#/common/types';
import { BlockIcon } from './BlockIcon';

interface CraftingUIProps {
  recipes: Array<CraftingRecipe & { craftable: boolean; index: number }>;
  onCraft: (index: number) => void;
  onClose: () => void;
}

export function CraftingUI({ recipes, onCraft, onClose }: CraftingUIProps) {
  return (
    <div className='absolute inset-0 flex items-center justify-center bg-black/60' onClick={onClose}>
      <div className='w-80 rounded-xl bg-gray-800/95 p-6' onClick={(e) => e.stopPropagation()}>
        <h3 className='mb-3 text-center text-lg font-bold text-white'>Crafting</h3>
        <div className='max-h-64 space-y-2 overflow-y-auto'>
          {recipes.map((r) => {
            const outInfo = getItemDef(r.output.itemId);
            return (
              <button
                key={r.index}
                type='button'
                className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-white ${
                  r.craftable ? 'bg-green-800/40 hover:bg-green-700/50' : 'cursor-not-allowed bg-red-900/20 opacity-50'
                }`}
                disabled={!r.craftable}
                onClick={() => onCraft(r.index)}
              >
                <BlockIcon itemId={r.output.itemId} size={24} />
                <div className='flex-1'>
                  <div className='text-sm font-medium'>{r.name}</div>
                  <div className='text-xs text-white/50'>
                    {r.inputs.map((inp) => `${getItemDef(inp.itemId)?.name ?? '?'}×${inp.count}`).join(' + ')}
                    {' → '}
                    {outInfo?.name ?? '?'}×{r.output.count}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <p className='mt-2 text-center text-xs text-white/40'>Press C to close</p>
      </div>
    </div>
  );
}
