'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { CRAFTING_RECIPES } from '#/common/CraftingRegistry';
import { appendChatMessage, GameContext } from '#/common/GameContext';
import { hasModalUiOpen, isComposingKeyboardEvent, shouldEmitInventoryCloseOnOverlayDismiss } from '#/common/overlayUiHelpers';
import { clampGameSettings, DEFAULT_SETTINGS, type GameSettings, type WorldPreset } from '#/common/types';
import { GameClient } from '#/client/GameClient';
import { GameWsTransport } from '#/client/net/GameWsTransport';
import {
  createMineWebTestController,
  type MineWebTestController,
} from './MineWebTestController';
// preset-based inventory is now handled by GameServer constructor
import { GameServer } from '#/server/GameServer';
import { buildRegressionScene } from '#/server/RegressionScene';
import { WorldStorage, type SaveProfile, type SavedPlayerState } from '#/server/WorldStorage';
import { MineWebUI } from '#/client/ui/MineWebUI';
import { StartMenu } from '#/client/ui/StartMenu';

function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem('mineweb:settings');
    return raw
      ? clampGameSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) })
      : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(s: GameSettings) {
  localStorage.setItem('mineweb:settings', JSON.stringify(clampGameSettings(s)));
}

type GamePhase = 'menu' | 'loading' | 'playing';
export type OverlayMode = 'inventory' | 'crafting' | 'chat' | 'settings' | null;

export interface MineWebAutoStartOptions {
  slotId?: string;
  name?: string;
  seed?: number;
  resetStorage?: boolean;
  scene?: 'regression';
}

export interface MineWebTestHarnessOptions {
  autoStart?: MineWebAutoStartOptions;
  manualLoop?: boolean;
  preserveDrawingBuffer?: boolean;
  onReady?: (controller: MineWebTestController) => void;
}

export function applyOverlayState(
  ui: GameContext['state']['ui'],
  overlay: OverlayMode,
  options?: { chatPrefix?: string; inventoryMode?: 'inventory' | 'craftTable' },
) {
  const wasLocked = ui.isLocked;
  const wasEverLocked = ui.everLocked;
  ui.showInventory = overlay === 'inventory';
  if (overlay === 'inventory') {
    ui.inventoryMode = options?.inventoryMode ?? 'inventory';
  } else {
    ui.inventoryMode = 'inventory';
  }
  ui.showCrafting = overlay === 'crafting';
  ui.showChat = overlay === 'chat';
  ui.showSettings = overlay === 'settings';
  ui.chatPrefix = overlay === 'chat' ? options?.chatPrefix : undefined;
  if (wasLocked || wasEverLocked) {
    ui.everLocked = true;
  }
  if (overlay !== null) {
    ui.isLocked = false;
  }
}

export function shouldBlockPrelockGameplayKey(input: {
  everLocked: boolean;
  hasOverlay: boolean;
  furnaceOpen: boolean;
  chestOpen?: boolean;
  key: string;
}) {
  if (input.everLocked || input.hasOverlay || input.furnaceOpen || input.chestOpen) return false;
  return input.key === 'e'
    || input.key === 'c'
    || input.key === 't'
    || input.key === 'enter'
    || input.key === '/'
    || input.key === 'f3'
    || input.key === 'f2';
}

export type OverlayHotkeyAction =
  | { type: 'ignore' }
  | { type: 'blocked-prelock' }
  | { type: 'toggle-inventory' }
  | { type: 'toggle-crafting' }
  | { type: 'open-chat'; prefix?: string }
  | { type: 'toggle-settings-or-close-overlay' }
  | { type: 'toggle-debug' }
  | { type: 'screenshot' }
  | { type: 'none' };

export function resolveOverlayHotkeyAction(input: {
  key: string;
  isComposing: boolean;
  everLocked: boolean;
  showInventory: boolean;
  showCrafting: boolean;
  showChat: boolean;
  showSettings: boolean;
  furnaceOpen: boolean;
  chestOpen?: boolean;
}): OverlayHotkeyAction {
  if (input.isComposing) return { type: 'ignore' };
  const k = input.key.toLowerCase();
  const hasOverlay = hasModalUiOpen(input);

  if (shouldBlockPrelockGameplayKey({ everLocked: input.everLocked, hasOverlay, furnaceOpen: input.furnaceOpen, chestOpen: input.chestOpen ?? false, key: k })) {
    return { type: 'blocked-prelock' };
  }

  if (input.showChat && k !== 'escape') return { type: 'ignore' };

  if (k === 'e') {
    if (input.furnaceOpen || input.chestOpen || input.showInventory || !hasOverlay) return { type: 'toggle-inventory' };
    return { type: 'ignore' };
  }
  if (k === 'c') {
    if (input.showCrafting || !hasOverlay) return { type: 'toggle-crafting' };
    return { type: 'ignore' };
  }
  if ((k === 't' || k === 'enter') && !hasOverlay) {
    return { type: 'open-chat' };
  }
  if (k === '/' && !hasOverlay) {
    return { type: 'open-chat', prefix: '/' };
  }
  if (k === 'escape') {
    return { type: 'toggle-settings-or-close-overlay' };
  }
  if (k === 'f3') {
    return { type: 'toggle-debug' };
  }
  if (k === 'f2') {
    return { type: 'screenshot' };
  }
  return { type: 'none' };
}

export type OverlayHotkeyUiSnapshot = {
  chestOpen: boolean;
  furnaceOpen: boolean;
  showInventory: boolean;
  showCrafting: boolean;
  showChat: boolean;
  showSettings: boolean;
  showDebug: boolean;
};

export type OverlayHotkeyHandling =
  | { type: 'none'; preventDefault: false }
  | { type: 'blocked-prelock'; preventDefault: true }
  | { type: 'close-chest'; preventDefault: true }
  | { type: 'close-overlay'; preventDefault: true }
  | { type: 'open-inventory-overlay'; preventDefault: true }
  | { type: 'open-crafting-overlay'; preventDefault: true }
  | { type: 'open-chat'; prefix?: string; preventDefault: true }
  | { type: 'open-settings-overlay'; preventDefault: true }
  | { type: 'set-show-debug'; showDebug: boolean; preventDefault: true }
  | { type: 'screenshot'; preventDefault: true };

/** Maps resolved hotkey + current UI to imperative handling (keyboard layer → overlay/HUD actions). */
export function resolveOverlayHotkeyHandling(
  action: OverlayHotkeyAction,
  ui: OverlayHotkeyUiSnapshot,
): OverlayHotkeyHandling {
  switch (action.type) {
    case 'ignore':
    case 'none':
      return { type: 'none', preventDefault: false };
    case 'blocked-prelock':
      return { type: 'blocked-prelock', preventDefault: true };
    case 'toggle-inventory':
      if (ui.chestOpen) return { type: 'close-chest', preventDefault: true };
      if (ui.furnaceOpen || ui.showInventory) return { type: 'close-overlay', preventDefault: true };
      return { type: 'open-inventory-overlay', preventDefault: true };
    case 'toggle-crafting':
      if (ui.showCrafting) return { type: 'close-overlay', preventDefault: true };
      return { type: 'open-crafting-overlay', preventDefault: true };
    case 'open-chat':
      return { type: 'open-chat', prefix: action.prefix, preventDefault: true };
    case 'toggle-settings-or-close-overlay':
      if (ui.chestOpen) return { type: 'close-chest', preventDefault: true };
      if (ui.showInventory || ui.showCrafting || ui.showChat || ui.showSettings || ui.furnaceOpen) {
        return { type: 'close-overlay', preventDefault: true };
      }
      return { type: 'open-settings-overlay', preventDefault: true };
    case 'toggle-debug':
      return { type: 'set-show-debug', showDebug: !ui.showDebug, preventDefault: true };
    case 'screenshot':
      return { type: 'screenshot', preventDefault: true };
  }
}

export function reconcileOverlayPauseState(input: {
  overlay: OverlayMode;
  furnaceOpen: boolean;
  chestOpen?: boolean;
  serverRunning: boolean;
  pausedForOverlay: boolean;
}) {
  const guiOpen = input.overlay !== null || input.furnaceOpen || input.chestOpen;
  if (guiOpen && input.serverRunning) {
    return {
      shouldPause: true,
      shouldResume: false,
      nextPausedForOverlay: true,
    };
  }
  if (!guiOpen && input.pausedForOverlay && !input.serverRunning) {
    return {
      shouldPause: false,
      shouldResume: true,
      nextPausedForOverlay: false,
    };
  }
  return {
    shouldPause: false,
    shouldResume: false,
    nextPausedForOverlay: input.pausedForOverlay,
  };
}

export function MineWebGame({
  className,
  style,
  testHarness,
}: {
  className?: string;
  style?: CSSProperties;
  testHarness?: MineWebTestHarnessOptions;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<GameContext | null>(null);
  const clientRef = useRef<GameClient | null>(null);
  const serverRef = useRef<GameServer | null>(null);
  const storageRef = useRef<WorldStorage | null>(null);
  const fpsRef = useRef({ frames: 0, lastTime: performance.now() });
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const testControllerRef = useRef<MineWebTestController | null>(null);
  const autoStartDoneRef = useRef(false);
  const wsTransportRef = useRef<GameWsTransport | null>(null);
  const flushSaveRef = useRef<((st: WorldStorage, srv: GameServer, context: GameContext) => void) | null>(null);

  const [phase, setPhase] = useState<GamePhase>('menu');
  const [saves, setSaves] = useState<SaveProfile[]>([]);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [, setCtxVersion] = useState(0);

  useEffect(() => {
    WorldStorage.migrateDefaultSave().then(() => {
      setSaves(WorldStorage.listSaves());
    });
  }, []);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new GameContext();
    }
    return ctxRef.current;
  }, []);

  if (!testControllerRef.current) {
    testControllerRef.current = createMineWebTestController({
      getCtx: () => ctxRef.current,
      getClient: () => clientRef.current,
      getServer: () => serverRef.current,
      getCanvas: () => canvasRef.current,
    });
  }

  const cleanupGame = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    autoStartDoneRef.current = false;
    wsTransportRef.current?.disconnect();
    wsTransportRef.current = null;
    clientRef.current?.dispose();
    clientRef.current = null;
    serverRef.current?.stop();
    serverRef.current = null;
    storageRef.current?.close();
    storageRef.current = null;
    if (ctxRef.current) {
      ctxRef.current.dispose();
      ctxRef.current = null;
    }
  }, []);

  const startGame = useCallback(async (
    slotId: string,
    seed?: number,
    options?: { wsUrl?: string; preset?: WorldPreset },
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    cleanupGame();
    const ctx = getCtx();
    setCtxVersion((value) => value + 1);
    setPhase('loading');
    setActiveSlotId(slotId);

    const storage = new WorldStorage(slotId);
    storageRef.current = storage;
    await storage.init();

    const savedSeed = await storage.loadSeed();
    const effectiveSeed = seed ?? savedSeed ?? undefined;
    const saveList = WorldStorage.listSaves();
    const currentSave = saveList.find((s) => s.id === slotId);
    const effectivePreset = options?.preset ?? currentSave?.preset ?? 'demo';
    const server = new GameServer(ctx, effectiveSeed, undefined, effectivePreset);
    server.reachDistance = 6;
    serverRef.current = server;

    if (!savedSeed) {
      storage.saveSeed(server.seed);
    }

    const savedChunks = await storage.loadAllChunks();
    if (savedChunks.size > 0) {
      server.world.loadSavedChunks(savedChunks);
    }
    const savedBlockStates = await storage.loadBlockStates();
    if (savedBlockStates.size > 0) {
      server.world.loadSavedBlockStates(savedBlockStates);
    }

    const savedInv = await storage.loadInventory();
    if (savedInv) {
      server.inventory.slots = savedInv;
    }
    server.syncInventory();
    const savedOffhand = await storage.loadOffhand();
    if (savedOffhand) {
      server.inventory.offhand = savedOffhand;
      server.syncInventory();
    }
    const savedCursor = await storage.loadCursor();
    if (savedCursor) {
      server.inventory.cursor = savedCursor;
      server.syncInventory();
    }

    const savedMilestones = await storage.loadMilestones();
    if (savedMilestones.length > 0) {
      server.milestones.load(savedMilestones as any);
    }

    const savedTileEntities = await storage.loadTileEntities();
    if (savedTileEntities) {
      server.loadTileEntities(savedTileEntities);
    }

    const savedPlayer = await storage.loadPlayerState();
    if (savedPlayer) {
      ctx.state.player.position = { ...savedPlayer.position };
      server.inventory.selectedIndex = savedPlayer.selectedSlot;
      if (savedPlayer.armor) {
        const a = savedPlayer.armor;
        server.inventory.armor = {
          helmet: a.helmet ? { ...a.helmet } : null,
          chestplate: a.chestplate ? { ...a.chestplate } : null,
          leggings: a.leggings ? { ...a.leggings } : null,
          boots: a.boots ? { ...a.boots } : null,
        };
      }
      if (savedPlayer.health != null) ctx.state.player.hp = Math.max(1, savedPlayer.health);
      if (savedPlayer.hunger != null) ctx.state.player.hunger = Math.max(0, savedPlayer.hunger);
      if (savedPlayer.saturation != null) ctx.state.player.saturation = Math.max(0, savedPlayer.saturation);
      if (savedPlayer.airMs != null) ctx.state.player.airMs = Math.max(0, savedPlayer.airMs);
      server.syncInventory();
    }

    let client: GameClient;
    try {
      client = new GameClient(canvas, ctx, {
        preserveDrawingBuffer: testHarness?.preserveDrawingBuffer,
      });
    } catch {
      ctx.state.ui.webglError = true;
      setPhase('playing');
      return;
    }
    clientRef.current = client;
    client.server = {
      applyMovement: (dx, dz) => server.applyMovement(dx, dz),
      getSpeedMultiplier: () => server.getSpeedMultiplier(),
      handleJump: () => server.handleJump(),
      get isFlying() { return server.isFlying; },
    };
    client.applySettings(loadSettings());

    const wsUrl = options?.wsUrl?.trim();
    if (wsUrl) {
      ctx.state.network.mode = 'multiplayer';
      ctx.state.network.wsUrl = wsUrl;
      const transport = new GameWsTransport(ctx);
      wsTransportRef.current = transport;
      transport.connect(wsUrl);
    } else {
      ctx.state.network.mode = 'local';
      ctx.state.network.wsUrl = undefined;
    }

    let saveCounter = 0;
    const flushSave = (st: typeof storage, srv: typeof server, context: typeof ctx) => {
      srv.inventory.stowCraftTableGrid(srv.craftTableGrid);
      srv.inventory.stowCursor();
      srv.syncInventory();
      const ps = context.state.player;
      const playerState: SavedPlayerState = {
        position: ps.position,
        selectedSlot: context.state.inventory.selectedIndex,
        armor: srv.inventory.snapshotArmor(),
        health: ps.hp,
        hunger: ps.hunger,
        saturation: ps.saturation,
        airMs: ps.airMs,
      };
      st.savePlayerState(playerState);
      st.saveInventory(srv.inventory.snapshot());
      st.saveOffhand(srv.inventory.snapshotOffhand());
      st.saveCursor(srv.inventory.snapshotCursor());
      st.saveMilestones(srv.milestones.snapshot());
      st.saveTileEntities(srv.snapshotTileEntities());
      for (const [, chunk] of srv.world.chunks) {
        if (chunk.dirty) {
          st.saveChunk(chunk.cx, chunk.cz, chunk.blocks);
          chunk.dirty = false;
        }
      }
      if (srv.world.blockStateDirty) {
        st.saveBlockStates(srv.world.getBlockStateEntries());
        srv.world.blockStateDirty = false;
      }
      WorldStorage.updateSaveTimestamp(slotId);
    };
    flushSaveRef.current = flushSave;
    const autoSave = () => {
      saveCounter++;
      if (saveCounter % 300 === 0) {
        flushSave(storage, server, ctx);
      }
    };

    if (!testHarness?.manualLoop) {
      tickerRef.current = setInterval(() => {
        autoSave();
        fpsRef.current.frames++;
        const now = performance.now();
        if (now - fpsRef.current.lastTime >= 1000) {
          ctx.state.stats.fps = fpsRef.current.frames;
          fpsRef.current.frames = 0;
          fpsRef.current.lastTime = now;
        }
      }, 16);
    }

    try {
      await client.init();
    } catch (e) {
      console.warn('MineWeb init failed:', e);
    }

    if (testHarness?.autoStart?.scene === 'regression') {
      const scene = buildRegressionScene(server);
      ctx.state.player.position = { ...scene.recommendedCamera.position };
      ctx.state.player.yaw = scene.recommendedCamera.yaw;
      ctx.state.player.pitch = scene.recommendedCamera.pitch;
      ctx.state.player.viewMode = 'first-person';
      ctx.state.timeOfDay = 0.18;
      ctx.state.weather = 'clear';
    }

    ctx.state.ui.loading = false;

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) client.resize(rect.width, rect.height);

    if (testHarness?.manualLoop) {
      server.primeWorld(3);
      client.stepFrame(0);
    } else {
      server.start();
      client.start();
    }

    setPhase('playing');
  }, [cleanupGame, getCtx, testHarness]);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) clientRef.current?.resize(width, height);
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      cleanupGame();
    };
  }, [cleanupGame]);

  useEffect(() => {
    if (!testHarness?.onReady || !testControllerRef.current) return;
    testHarness.onReady(testControllerRef.current);
  }, [testHarness]);

  useEffect(() => {
    const autoStart = testHarness?.autoStart;
    if (!autoStart || autoStartDoneRef.current) return;
    autoStartDoneRef.current = true;

    const slotId = autoStart.slotId ?? 'mineweb-test-harness';
    const seed = autoStart.seed ?? 12345;
    const profile: SaveProfile = {
      id: slotId,
      name: autoStart.name ?? 'Regression World',
      seed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (autoStart.resetStorage !== false) {
      WorldStorage.removeSave(slotId);
    }
    WorldStorage.addSave(profile);
    setSaves(WorldStorage.listSaves());
    void startGame(slotId, seed);
  }, [startGame, testHarness]);

  const handleNewGame = useCallback((name: string, seed?: number, preset?: WorldPreset) => {
    const id = `${Date.now()}`;
    const effectiveSeed = seed ?? Math.floor(Math.random() * 100000);
    const effectivePreset = preset ?? 'demo';
    const profile: SaveProfile = {
      id,
      name,
      seed: effectiveSeed,
      preset: effectivePreset,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    WorldStorage.addSave(profile);
    setSaves(WorldStorage.listSaves());
    startGame(id, effectiveSeed, { preset: effectivePreset });
  }, [startGame]);

  const handleContinue = useCallback((saveId: string) => {
    startGame(saveId);
  }, [startGame]);

  const handleJoinServer = useCallback((wsUrl: string) => {
    const id = `mp-${Date.now()}`;
    const seed = Math.floor(Math.random() * 100_000);
    const profile: SaveProfile = {
      id,
      name: 'Multiplayer',
      seed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    WorldStorage.addSave(profile);
    setSaves(WorldStorage.listSaves());
    void startGame(id, seed, { wsUrl });
  }, [startGame]);

  const handleDeleteSave = useCallback((saveId: string) => {
    WorldStorage.removeSave(saveId);
    setSaves(WorldStorage.listSaves());
  }, []);

  const handleResetWorld = useCallback(() => {
    if (!activeSlotId) return;
    const save = saves.find((s) => s.id === activeSlotId);
    const name = save?.name ?? 'World';
    const preset = save?.preset ?? 'demo';
    WorldStorage.removeSave(activeSlotId);
    const newId = `${Date.now()}`;
    const newSeed = Math.floor(Math.random() * 100000);
    const profile: SaveProfile = {
      id: newId,
      name,
      seed: newSeed,
      preset,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    WorldStorage.addSave(profile);
    setSaves(WorldStorage.listSaves());
    startGame(newId, newSeed, { preset });
  }, [activeSlotId, saves, startGame]);

  const handleQuitToMenu = useCallback(() => {
    const storage = storageRef.current;
    const server = serverRef.current;
    const ctx = ctxRef.current;
    if (storage && server && ctx) {
      flushSaveRef.current?.(storage, server, ctx);
    }
    cleanupGame();
    setSaves(WorldStorage.listSaves());
    setPhase('menu');
    setActiveSlotId(null);
  }, [cleanupGame, activeSlotId]);

  const runtimeCtx = serverRef.current?.ctx ?? ctxRef.current;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      data-testid='mineweb-root'
      style={style}
    >
      <canvas ref={canvasRef} className='h-full w-full' data-testid='mineweb-canvas' />
      {phase === 'menu' && (
        <StartMenu
          saves={saves}
          onNewGame={handleNewGame}
          onContinue={handleContinue}
          onDeleteSave={handleDeleteSave}
          onJoinServer={handleJoinServer}
        />
      )}
      {phase !== 'menu' && runtimeCtx && (
        <MineWebGameOverlay
          ctx={runtimeCtx}
          clientRef={clientRef}
          serverRef={serverRef}
          canvasRef={canvasRef}
          onResetWorld={handleResetWorld}
          onQuitToMenu={handleQuitToMenu}
        />
      )}
    </div>
  );
}

function MineWebGameOverlay({
  ctx,
  clientRef,
  serverRef,
  canvasRef,
  onResetWorld,
  onQuitToMenu,
}: {
  ctx: GameContext;
  clientRef: React.RefObject<GameClient | null>;
  serverRef: React.RefObject<GameServer | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onResetWorld: () => void;
  onQuitToMenu: () => void;
}) {
  const snap = useSnapshot(ctx.state);
  const pausedForOverlayRef = useRef(false);

  const setOverlay = useCallback((overlay: OverlayMode, options?: { chatPrefix?: string; inventoryMode?: 'inventory' | 'craftTable' }) => {
    if (overlay !== null && ctx.state.ui.furnaceOpen) {
      ctx.c2s.emit('c2s:furnaceClose', {});
    }
    if (overlay !== null && ctx.state.ui.chestOpen) {
      ctx.c2s.emit('c2s:chestClose', {});
      ctx.state.ui.chestOpen = false;
    }
    applyOverlayState(ctx.state.ui, overlay, options);

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    if (clientRef.current) {
      if (overlay !== null) {
        clientRef.current.input.isLocked = false;
      }
      clientRef.current.input.chatActive = overlay === 'chat';
    }

    const server = serverRef.current;
    if (server) {
      const pauseState = reconcileOverlayPauseState({
        overlay,
        furnaceOpen: ctx.state.ui.furnaceOpen,
        chestOpen: ctx.state.ui.chestOpen,
        serverRunning: server.isRunning,
        pausedForOverlay: pausedForOverlayRef.current,
      });
      if (pauseState.shouldPause) {
        server.pause();
      } else if (pauseState.shouldResume) {
        server.start();
      }
      pausedForOverlayRef.current = pauseState.nextPausedForOverlay;
    }
  }, [ctx, clientRef, serverRef]);

  const openChat = useCallback((prefix?: string) => {
    setOverlay('chat', prefix ? { chatPrefix: prefix } : undefined);
  }, [setOverlay]);

  useEffect(() => {
    const sig = snap.ui.craftTableOpenSignal;
    if (sig === 0) return;
    setOverlay('inventory', { inventoryMode: 'craftTable' });
  }, [snap.ui.craftTableOpenSignal, setOverlay]);

  const closeOverlay = useCallback(() => {
    const closingInventory = ctx.state.ui.showInventory;
    const closingFurnace = ctx.state.ui.furnaceOpen;
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
    if (closingFurnace) {
      ctx.c2s.emit('c2s:furnaceClose', {});
    }
    setOverlay(null);
    if (shouldEmitInventoryCloseOnOverlayDismiss({ showInventory: closingInventory, furnaceOpen: closingFurnace })) {
      ctx.c2s.emit('c2s:inventoryClose', {});
    }
    const client = clientRef.current;
    if (client) {
      client.input.chatActive = false;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    requestAnimationFrame(() => {
      const maybe = canvas.requestPointerLock();
      if (maybe && typeof maybe === 'object' && 'catch' in maybe) {
        void (maybe as Promise<void>).catch(() => {});
      }
    });
  }, [setOverlay, canvasRef, ctx, clientRef]);

  useEffect(() => {
    const server = serverRef.current;
    if (snap.ui.furnaceOpen) {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      if (clientRef.current) {
        clientRef.current.input.isLocked = false;
      }
      if (server) {
        const pauseState = reconcileOverlayPauseState({
          overlay: null,
          furnaceOpen: true,
          chestOpen: ctx.state.ui.chestOpen,
          serverRunning: server.isRunning,
          pausedForOverlay: pausedForOverlayRef.current,
        });
        if (pauseState.shouldPause) {
          server.pause();
        }
        pausedForOverlayRef.current = pauseState.nextPausedForOverlay;
      }
      return;
    }
    if (server) {
      const pauseState = reconcileOverlayPauseState({
        overlay: null,
        furnaceOpen: false,
        chestOpen: ctx.state.ui.chestOpen,
        serverRunning: server.isRunning,
        pausedForOverlay: pausedForOverlayRef.current,
      });
      if (pauseState.shouldResume) {
        server.start();
      }
      pausedForOverlayRef.current = pauseState.nextPausedForOverlay;
    }
  }, [snap.ui.furnaceOpen, clientRef, serverRef, ctx]);

  useEffect(() => {
    const server = serverRef.current;
    if (snap.ui.chestOpen) {
      if (document.pointerLockElement) document.exitPointerLock();
      if (clientRef.current) clientRef.current.input.isLocked = false;
      if (server) {
        const ps = reconcileOverlayPauseState({ overlay: null, furnaceOpen: ctx.state.ui.furnaceOpen, chestOpen: true, serverRunning: server.isRunning, pausedForOverlay: pausedForOverlayRef.current });
        if (ps.shouldPause) server.pause();
        pausedForOverlayRef.current = ps.nextPausedForOverlay;
      }
      return;
    }
    if (server) {
      const ps = reconcileOverlayPauseState({ overlay: null, furnaceOpen: ctx.state.ui.furnaceOpen, chestOpen: false, serverRunning: server.isRunning, pausedForOverlay: pausedForOverlayRef.current });
      if (ps.shouldResume) server.start();
      pausedForOverlayRef.current = ps.nextPausedForOverlay;
    }
  }, [snap.ui.chestOpen, clientRef, serverRef, ctx]);

  const handleScreenshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mineweb-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
    appendChatMessage(ctx.state, { sender: 'System', message: '§aScreenshot saved' });
  }, [ctx, canvasRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = ctx.state;
      const action = resolveOverlayHotkeyAction({
        key: e.key,
        isComposing: isComposingKeyboardEvent(e),
        everLocked: s.ui.everLocked,
        showInventory: s.ui.showInventory,
        showCrafting: s.ui.showCrafting,
        showChat: s.ui.showChat,
        showSettings: s.ui.showSettings,
        furnaceOpen: s.ui.furnaceOpen,
        chestOpen: s.ui.chestOpen,
      });
      const handling = resolveOverlayHotkeyHandling(action, {
        chestOpen: s.ui.chestOpen,
        furnaceOpen: s.ui.furnaceOpen,
        showInventory: s.ui.showInventory,
        showCrafting: s.ui.showCrafting,
        showChat: s.ui.showChat,
        showSettings: s.ui.showSettings,
        showDebug: s.ui.showDebug,
      });
      if (handling.preventDefault) e.preventDefault();
      switch (handling.type) {
        case 'none':
          return;
        case 'blocked-prelock':
          return;
        case 'close-chest':
          ctx.c2s.emit('c2s:chestClose', {});
          ctx.state.ui.chestOpen = false;
          return;
        case 'close-overlay':
          closeOverlay();
          return;
        case 'open-inventory-overlay':
          setOverlay('inventory');
          return;
        case 'open-crafting-overlay':
          setOverlay('crafting');
          return;
        case 'open-chat':
          openChat(handling.prefix);
          return;
        case 'open-settings-overlay':
          setOverlay('settings');
          return;
        case 'set-show-debug':
          s.ui.showDebug = handling.showDebug;
          return;
        case 'screenshot':
          handleScreenshot();
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ctx, openChat, closeOverlay, setOverlay, handleScreenshot]);

  const handleCraft = useCallback((index: number) => {
    ctx.c2s.emit('c2s:craft', { recipeIndex: index });
  }, [ctx]);

  const handleSlotSelect = useCallback((i: number) => {
    ctx.state.inventory.selectedIndex = i;
  }, [ctx]);

  const handleInventorySlotClick = useCallback((index: number, button: 'left' | 'right', shift: boolean) => {
    ctx.c2s.emit('c2s:inventoryClick', { index, button, shift });
    if (index < 9) {
      ctx.state.inventory.selectedIndex = index;
    }
  }, [ctx]);

  const handleInventorySlotCollect = useCallback((index: number) => {
    ctx.c2s.emit('c2s:inventoryCollect', { index });
  }, [ctx]);

  const handleCraftTableSlotClick = useCallback((index: number, button: 'left' | 'right', shift: boolean) => {
    ctx.c2s.emit('c2s:inventoryClick', { index, button, shift, area: 'craftTable' });
  }, [ctx]);

  const handleCraftTableSlotCollect = useCallback((index: number) => {
    ctx.c2s.emit('c2s:inventoryCollect', { index, area: 'craftTable' });
  }, [ctx]);

  const handleCraftResultClick = useCallback((button: 'left' | 'right', shift: boolean) => {
    ctx.c2s.emit('c2s:inventoryClick', { index: 0, button, shift, area: 'craftResult' });
  }, [ctx]);

  const handleFurnaceSlotClick = useCallback((slot: 'input' | 'fuel' | 'output', button: 'left' | 'right', shift: boolean) => {
    ctx.c2s.emit('c2s:furnaceClick', { slot, button, shift });
  }, [ctx]);

  const handleChatSend = useCallback((msg: string) => {
    const client = clientRef.current;
    client?.player.chat(msg);
    closeOverlay();
  }, [clientRef, closeOverlay]);

  const handleCloseChat = useCallback(() => {
    closeOverlay();
  }, [closeOverlay]);

  const handleSaveSettings = useCallback((s: GameSettings) => {
    saveSettings(s);
    clientRef.current?.applySettings(s);
  }, [clientRef]);

  const handleResetSettings = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    clientRef.current?.applySettings(DEFAULT_SETTINGS);
  }, [clientRef]);

  if (snap.ui.webglError) {
    return (
      <div className='absolute inset-0 flex items-center justify-center'>
        <div className='text-center'>
          <h2 className='text-xl font-bold text-error'>WebGL Error</h2>
          <p className='text-base-content/60'>Your browser does not support WebGL.</p>
        </div>
      </div>
    );
  }

  const server = serverRef.current;
  const recipes = server ? CRAFTING_RECIPES.map((r, i) => ({
    ...r,
    craftable: r.inputs.every((inp) => server.inventory.hasItem(inp.itemId, inp.count)),
    index: i,
  })) : [];

  return (
    <MineWebUI
      isLocked={snap.ui.isLocked}
      loading={snap.ui.loading}
      showInventory={snap.ui.showInventory}
      showFurnace={snap.ui.furnaceOpen}
      inventoryMode={snap.ui.inventoryMode}
      showCrafting={snap.ui.showCrafting}
      showChat={snap.ui.showChat}
      showSettings={snap.ui.showSettings}
      showClickToPlayPrompt={!snap.ui.everLocked}
      showDebug={snap.ui.showDebug}
      selectedSlot={snap.inventory.selectedIndex}
      hotbarSlots={snap.inventory.slots.slice(0, 9) as any}
      inventorySlots={[...snap.inventory.slots] as any}
      armorSlots={snap.player.armor as any}
      furnaceInputSlot={snap.furnace.inputSlot as any}
      furnaceFuelSlot={snap.furnace.fuelSlot as any}
      furnaceOutputSlot={snap.furnace.outputSlot as any}
      furnaceBurnTimeLeft={snap.furnace.burnTimeLeft}
      furnaceBurnTimeTotal={snap.furnace.burnTimeTotal}
      furnaceCookProgress={snap.furnace.cookProgress}
      furnaceCookTimeTotal={snap.furnace.cookTimeTotal}
      craftTableSlots={[...snap.inventory.craftTableSlots] as any}
      offhandSlot={snap.inventory.offhand as any}
      inventoryCursor={snap.inventory.cursor as any}
      playerPos={snap.player.position}
      playerHp={snap.player.hp}
      playerMaxHp={snap.player.maxHp}
      viewMode={snap.player.viewMode}
      yaw={snap.player.yaw}
      targetBlock={snap.player.targetBlock as any}
      chunkCount={clientRef.current?.chunkMeshes?.size ?? 0}
      entityCount={Object.keys(snap.entities).length}
      biome={snap.stats.biome}
      chatMessages={snap.chat.messages as any}
      recipes={recipes}
      settings={snap.settings as any}
      fps={snap.stats.fps}
      onCraft={handleCraft}
      onSlotSelect={handleSlotSelect}
      onInventorySlotClick={handleInventorySlotClick}
      onInventorySlotCollect={handleInventorySlotCollect}
      onCraftTableSlotClick={handleCraftTableSlotClick}
      onCraftTableSlotCollect={handleCraftTableSlotCollect}
      onCraftResultClick={handleCraftResultClick}
      onFurnaceSlotClick={handleFurnaceSlotClick}
      showChest={snap.ui.chestOpen}
      chestSlots={[...(snap.chest.slots)] as any}
      onChestSlotClick={(index, button, shift) => ctx.c2s.emit('c2s:chestClick', { slotIndex: index, button, shift })}
      onCloseChest={() => {
        ctx.c2s.emit('c2s:chestClose', {});
        ctx.state.ui.chestOpen = false;
      }}
      onChatSend={handleChatSend}
      chatPrefix={snap.ui.chatPrefix}
      onChatOpened={() => { ctx.state.ui.chatPrefix = undefined; }}
      onCloseInventory={closeOverlay}
      onCloseFurnace={closeOverlay}
      onCloseCrafting={closeOverlay}
      onCloseChat={handleCloseChat}
      onCloseSettings={closeOverlay}
      onSaveSettings={handleSaveSettings}
      onResetSettings={handleResetSettings}
      onClickToPlay={() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const maybe = canvas.requestPointerLock();
        if (maybe && typeof maybe === 'object' && 'catch' in maybe) {
          void (maybe as Promise<void>).catch(() => {});
        }
      }}
      onNewGame={onResetWorld}
      onQuitToMenu={onQuitToMenu}
    />
  );
}
