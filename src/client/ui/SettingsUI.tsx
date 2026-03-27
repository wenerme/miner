'use client';

import { useState } from 'react';
import type { GameSettings } from '#/common/types';

interface SettingsUIProps {
  settings: GameSettings;
  onSave: (settings: GameSettings) => void;
  onReset: () => void;
  onClose: () => void;
  onNewGame?: () => void;
  onQuitToMenu?: () => void;
}

function SliderRow({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className='flex items-center gap-3'>
      <span className='w-28 text-sm text-white/70'>{label}</span>
      <input
        type='range'
        className='range range-sm range-primary flex-1'
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className='w-12 text-right text-sm font-mono text-white/60'>
        {value}{unit ?? ''}
      </span>
    </div>
  );
}

export function SettingsUI({ settings, onSave, onReset, onClose, onNewGame, onQuitToMenu }: SettingsUIProps) {
  const [draft, setDraft] = useState<GameSettings>({ ...settings });

  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className='absolute inset-0 flex items-center justify-center bg-black/70' onClick={onClose}>
      <div className='w-96 rounded-xl bg-gray-800/95 p-6' onClick={(e) => e.stopPropagation()}>
        <button type='button' className='btn btn-primary btn-block mb-4' onClick={onClose}>
          Back to Game
        </button>
        <h3 className='mb-4 text-center text-lg font-bold text-white'>Settings</h3>
        <div className='space-y-4'>
          <div>
            <h4 className='mb-2 text-sm font-medium text-white/50 uppercase'>Video</h4>
            <div className='space-y-2'>
              <SliderRow label='Render Distance' value={draft.renderDistance} min={2} max={16} onChange={(v) => update('renderDistance', v)} />
              <SliderRow label='FOV' value={draft.fov} min={50} max={120} unit='°' onChange={(v) => update('fov', v)} />
              <label className='flex cursor-pointer items-center gap-2'>
                <input type='checkbox' className='toggle toggle-sm toggle-primary' checked={draft.shadows} onChange={(e) => update('shadows', e.target.checked)} />
                <span className='text-sm text-white/70'>Enable Shadows</span>
              </label>
              <SliderRow label='Shadow Quality' value={draft.shadowQuality} min={0} max={2} onChange={(v) => update('shadowQuality', v)} />
            </div>
          </div>
          <div>
            <h4 className='mb-2 text-sm font-medium text-white/50 uppercase'>Audio</h4>
            <div className='space-y-2'>
              <SliderRow label='Volume' value={draft.volume} min={0} max={100} unit='%' onChange={(v) => update('volume', v)} />
            </div>
          </div>
          <div>
            <h4 className='mb-2 text-sm font-medium text-white/50 uppercase'>Controls</h4>
            <div className='space-y-2'>
              <SliderRow label='Mouse Sensitivity' value={draft.mouseSensitivity} min={0.1} max={3} step={0.1} unit='x' onChange={(v) => update('mouseSensitivity', v)} />
            </div>
          </div>
          <div>
            <h4 className='mb-2 text-sm font-medium text-white/50 uppercase'>Display</h4>
            <div className='space-y-2'>
              <label className='flex cursor-pointer items-center gap-2'>
                <input type='checkbox' className='toggle toggle-sm toggle-primary' checked={draft.showCoords} onChange={(e) => update('showCoords', e.target.checked)} />
                <span className='text-sm text-white/70'>Show Coordinates</span>
              </label>
              <label className='flex cursor-pointer items-center gap-2'>
                <input type='checkbox' className='toggle toggle-sm toggle-primary' checked={draft.showFps} onChange={(e) => update('showFps', e.target.checked)} />
                <span className='text-sm text-white/70'>Show FPS</span>
              </label>
              <label className='flex cursor-pointer items-center gap-2'>
                <input type='checkbox' className='toggle toggle-sm toggle-primary' checked={draft.nativeHud} onChange={(e) => update('nativeHud', e.target.checked)} />
                <span className='text-sm text-white/70'>Native HUD</span>
              </label>
            </div>
          </div>
        </div>
        <div className='mt-5 flex gap-2'>
          <button type='button' className='btn btn-sm btn-outline flex-1' onClick={onReset}>Reset</button>
          <button type='button' className='btn btn-sm btn-primary flex-1' onClick={() => { onSave(draft); onClose(); }}>Save</button>
        </div>
        {(onNewGame || onQuitToMenu) && (
          <div className='mt-4 border-t border-white/10 pt-4'>
            <h4 className='mb-2 text-sm font-medium text-white/50 uppercase'>World</h4>
            <div className='flex gap-2'>
              {onQuitToMenu && (
                <button type='button' className='btn btn-sm btn-outline btn-warning flex-1' onClick={onQuitToMenu}>
                  Quit to Menu
                </button>
              )}
              {onNewGame && (
                <button type='button' className='btn btn-sm btn-outline btn-error flex-1' onClick={onNewGame}>
                  Reset World
                </button>
              )}
            </div>
          </div>
        )}
        <p className='mt-2 text-center text-xs text-white/40'>Press Escape to close</p>
      </div>
    </div>
  );
}
