'use client';

import { useEffect, useRef, useState } from 'react';
import type { WorldPreset } from '#/common/types';
import { WORLD_PRESETS } from '#/common/types';
import type { SaveProfile } from '#/server/WorldStorage';

function getDefaultWsUrl() {
  if (typeof window === 'undefined') return 'wss://mine.wener.workers.dev/mine/ws';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/mine/ws`;
}

interface StartMenuProps {
  saves: SaveProfile[];
  onNewGame: (name: string, seed?: number, preset?: WorldPreset) => void;
  onContinue: (saveId: string) => void;
  onDeleteSave: (saveId: string) => void;
  onJoinServer: (wsUrl: string) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function StartMenu({
  saves,
  onNewGame,
  onContinue,
  onDeleteSave,
  onJoinServer,
}: StartMenuProps) {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState(`World ${saves.length + 1}`);
  const [seedInput, setSeedInput] = useState('');
  const [preset, setPreset] = useState<WorldPreset>('demo');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [serverUrlInput, setServerUrlInput] = useState(() => getDefaultWsUrl());
  const worldNameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!showNew) return;
    worldNameInputRef.current?.focus();
  }, [showNew]);

  const handleCreate = () => {
    const seed = seedInput.trim() ? Number(seedInput.trim()) || hashString(seedInput.trim()) : undefined;
    onNewGame(name.trim() || `World ${saves.length + 1}`, seed, preset);
  };

  const handleJoinServer = () => {
    const url = serverUrlInput.trim() || getDefaultWsUrl();
    onJoinServer(url);
  };

  return (
    <div className='absolute inset-0 flex items-center justify-center overflow-hidden font-mono'>
      <div className='absolute inset-0 bg-[#0d0d0f]' />
      <div
        className='absolute inset-0 opacity-[0.12]'
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='16' height='16' fill='%23222'/%3E%3Crect x='0' y='0' width='8' height='8' fill='%23333'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%23333'/%3E%3C/svg%3E")`,
          backgroundSize: '16px 16px',
          imageRendering: 'pixelated',
        }}
      />
      <div className='relative z-10 w-full max-w-lg px-4'>
        <h1
          className='mb-1 text-center text-5xl font-bold tracking-tight text-[#dcdcdc] drop-shadow-md'
          style={{ textShadow: '2px 2px 0 #1a1a1a', imageRendering: 'pixelated' }}
        >
          MineWeb
        </h1>
        <p className='mb-6 text-center text-xs uppercase tracking-[0.2em] text-[#6a6a6a]'>A voxel sandbox in your browser</p>

        {!showNew ? (
          <div className='space-y-4'>
            <div
              className='rounded border-2 border-[#3f3f3f] bg-[#1a1a1c] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
              style={{ imageRendering: 'pixelated' }}
            >
              <p className='mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-[#8b8b8b]'>Multiplayer <span className='rounded bg-amber-700/60 px-1.5 py-0.5 text-[9px] text-amber-200'>EXPERIMENTAL</span></p>
              <div className='flex flex-col gap-2 sm:flex-row sm:items-stretch'>
                <input
                  type='text'
                  spellCheck={false}
                  className='min-w-0 flex-1 rounded border border-[#2a2a2a] bg-black/50 px-3 py-2.5 text-sm text-[#c6c6c6] outline-none ring-0 placeholder:text-[#4a4a4a] focus:border-[#5a9e5a] focus:ring-1 focus:ring-[#5a9e5a]/40'
                  style={{ imageRendering: 'pixelated' }}
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder='ws://localhost:3060/mine/ws'
                  onKeyDown={(e) => { if (e.key === 'Enter') handleJoinServer(); }}
                  aria-label='Server WebSocket URL'
                />
                <button
                  type='button'
                  className='shrink-0 rounded border-2 border-[#3a3a3a] bg-gradient-to-b from-[#6b6b6b] to-[#4a4a4a] px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:from-[#7a7a7a] hover:to-[#555] active:translate-y-px'
                  style={{ imageRendering: 'pixelated' }}
                  onClick={handleJoinServer}
                >
                  Join Server
                </button>
              </div>
            </div>

            <div className='space-y-3'>
              <button
                type='button'
                className='w-full rounded border-2 border-[#3a3a3a] bg-gradient-to-b from-[#6b6b6b] to-[#4a4a4a] py-3 text-lg font-bold uppercase tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:from-[#7a7a7a] hover:to-[#555] active:translate-y-px'
                style={{ imageRendering: 'pixelated' }}
                onClick={() => setShowNew(true)}
              >
                Play
              </button>

              {saves.length > 0 && (
                <div className='mt-4 space-y-2'>
                  <h3 className='text-[11px] font-bold uppercase tracking-wider text-[#6a6a6a]'>Saved worlds</h3>
                  <div className='max-h-64 space-y-1.5 overflow-y-auto'>
                    {saves.map((save) => (
                      <div
                        key={save.id}
                        className='group flex items-center gap-3 rounded border border-[#333] bg-black/35 px-3 py-2.5 transition-colors hover:border-[#555] hover:bg-black/50'
                      >
                        <div className='flex-1 cursor-pointer' onClick={() => onContinue(save.id)}>
                          <div className='flex items-center gap-2 font-medium text-[#d0d0d0]'>
                            {save.name}
                            {save.preset && save.preset !== 'demo' && (
                              <span className={`rounded px-1 py-0.5 text-[8px] uppercase ${
                                save.preset === 'survival' ? 'bg-green-800/60 text-green-300' : 'bg-blue-800/60 text-blue-300'
                              }`}>{save.preset}</span>
                            )}
                          </div>
                          <div className='text-[10px] text-[#5c5c5c]'>
                            Seed: {save.seed} · {formatDate(save.updatedAt)}
                          </div>
                        </div>
                        <button
                          type='button'
                          className='btn btn-ghost btn-xs text-[#555] hover:text-error'
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(save.id); }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className='rounded-xl border-2 border-[#3f3f3f] bg-[#1a1a1c] p-6'>
            <h3 className='mb-4 text-lg font-bold text-[#dcdcdc]'>Create world</h3>
            <div className='space-y-3'>
              <div>
                <label className='mb-1 block text-xs uppercase tracking-wide text-[#7a7a7a]'>World name</label>
                <input
                  type='text'
                  ref={worldNameInputRef}
                  className='input input-bordered w-full border-[#333] bg-black/40 text-[#e0e0e0] placeholder:text-[#4a4a4a]'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='My World'
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                />
              </div>
              <div>
                <label className='mb-1 block text-xs uppercase tracking-wide text-[#7a7a7a]'>Game mode</label>
                <div className='space-y-1.5'>
                  {(Object.keys(WORLD_PRESETS) as WorldPreset[]).map((key) => {
                    const info = WORLD_PRESETS[key];
                    const selected = preset === key;
                    return (
                      <button
                        key={key}
                        type='button'
                        className={`w-full rounded border-2 px-3 py-2 text-left transition-colors ${
                          selected
                            ? 'border-[#5a9e5a] bg-[#5a9e5a]/15 text-[#c6c6c6]'
                            : 'border-[#333] bg-black/30 text-[#888] hover:border-[#555] hover:bg-black/40'
                        }`}
                        style={{ imageRendering: 'pixelated' }}
                        onClick={() => setPreset(key)}
                      >
                        <span className='text-sm font-bold'>{info.label}</span>
                        <span className='ml-2 text-[10px] text-[#666]'>{info.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className='mb-1 block text-xs uppercase tracking-wide text-[#7a7a7a]'>Seed (optional)</label>
                <input
                  type='text'
                  className='input input-bordered w-full border-[#333] bg-black/40 text-[#e0e0e0] placeholder:text-[#4a4a4a]'
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  placeholder='Leave blank for random'
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                />
                <p className='mt-1 text-[10px] text-[#555]'>Number or text — same seed = same world</p>
              </div>
            </div>
            <div className='mt-5 flex gap-2'>
              <button type='button' className='btn btn-ghost flex-1 text-[#888]' onClick={() => setShowNew(false)}>Cancel</button>
              <button type='button' className='btn flex-1 border-[#3a3a3a] bg-[#4a7c4a] text-white hover:bg-[#558f55]' onClick={handleCreate}>Create</button>
            </div>
          </div>
        )}

        <div className='mt-6 text-center text-[10px] text-[#404040]'>
          <kbd className='rounded border border-[#333] bg-black/40 px-1.5 py-0.5'>WASD</kbd> Move ·
          <kbd className='rounded border border-[#333] bg-black/40 px-1.5 py-0.5'>Space</kbd> Jump ·
          <kbd className='rounded border border-[#333] bg-black/40 px-1.5 py-0.5'>LMB</kbd> Break ·
          <kbd className='rounded border border-[#333] bg-black/40 px-1.5 py-0.5'>RMB</kbd> Place
        </div>
      </div>

      {deleteConfirm && (
        <div className='absolute inset-0 z-20 flex items-center justify-center bg-black/70' onClick={() => setDeleteConfirm(null)}>
          <div className='rounded-xl border-2 border-[#444] bg-[#1e1e22] p-6 shadow-2xl' onClick={(e) => e.stopPropagation()}>
            <h3 className='mb-2 text-lg font-bold text-[#e0e0e0]'>Delete world?</h3>
            <p className='mb-4 text-sm text-[#888]'>
              This will permanently delete "{saves.find((s) => s.id === deleteConfirm)?.name}".
            </p>
            <div className='flex gap-2'>
              <button type='button' className='btn btn-ghost flex-1' onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button type='button' className='btn btn-error flex-1' onClick={() => { onDeleteSave(deleteConfirm); setDeleteConfirm(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
