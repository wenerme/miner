import type { GameClient } from '#/client/GameClient';
import { appendChatMessage, type GameContext, type GameState } from '#/common/GameContext';
import { analyzeFrame } from '#/common/RenderRegression';
import type { ChatMessage, EntityInteractionAction, GameSettings, InventorySlot, Vec3, ViewMode } from '#/common/types';
import type { GameServer } from '#/server/GameServer';
import {
  buildRegressionScene,
  type RegressionSceneLayout,
  type RegressionSceneResult,
} from '#/server/RegressionScene';

function waitFor(
  check: () => boolean,
  timeoutMs: number,
): Promise<void> {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (check()) {
        resolve();
        return;
      }
      if (performance.now() - start > timeoutMs) {
        reject(new Error(`MineWeb test harness timed out after ${timeoutMs}ms`));
        return;
      }
      window.setTimeout(poll, 16);
    };
    poll();
  });
}

export interface MineWebTestController {
  setOverlay(
    overlay: 'inventory' | 'crafting' | 'chat' | 'settings' | null,
    options?: { chatPrefix?: string; inventoryMode?: 'inventory' | 'craftTable' },
  ): void;
  waitForRuntime(timeoutMs?: number): Promise<void>;
  waitUntilReady(timeoutMs?: number): Promise<void>;
  waitForChunkMeshes(minCount: number, timeoutMs?: number): Promise<void>;
  waitForRegressionScene(minChunkMeshes: number, minEntities: number, timeoutMs?: number): Promise<void>;
  buildRegressionScene(options?: {
    originX?: number;
    originZ?: number;
    chunkRadius?: number;
    layout?: RegressionSceneLayout;
  }): RegressionSceneResult;
  setPlayerPose(options: {
    position?: Vec3;
    yaw?: number;
    pitch?: number;
    viewMode?: ViewMode;
  }): void;
  setLocked(locked: boolean): void;
  mergeSettings(settings: Partial<GameSettings>): void;
  setWeather(weather: GameState['weather']): void;
  setTimeOfDay(timeOfDay: number): void;
  clearChatMessages(): void;
  pushChatMessage(message: Omit<ChatMessage, 'id'> & { id?: string }): void;
  inventoryClick(
    index: number,
    button?: 'left' | 'right',
    shift?: boolean,
    area?: 'player' | 'craftTable' | 'craftResult',
  ): void;
  inventoryCollect(index: number, area?: 'player' | 'craftTable'): void;
  setInventorySlot(index: number, slot: InventorySlot | null): void;
  setSelectedSlot(index: number): void;
  findEntityIdByType(type: string): number | null;
  interactEntity(id: number, action: EntityInteractionAction): void;
  startBreak(x: number, y: number, z: number): void;
  cancelBreak(): void;
  placeBlock(x: number, y: number, z: number, blockId: number): void;
  sendCommand(command: string): void;
  onBreakProgress(cb: (payload: { x: number; y: number; z: number; progress: number }) => void): () => void;
  pauseLoops(): void;
  resumeLoops(): void;
  stepSimulation(frames?: number, dt?: number): void;
  renderFrames(frames?: number, dt?: number): void;
  getCanvas(): HTMLCanvasElement | null;
  captureCanvasDataUrl(): string;
  analyzeCurrentFrame(options?: {
    centerRectPx?: { x: number; y: number; width: number; height: number };
    includeMagentaRatio?: boolean;
  }): {
    avgLuma: number;
    uniqueBuckets: number;
    nonSkyRatio: number;
    signature: string;
    centerContrast: number;
    magentaRatio?: number;
  };
  getStats(): {
    chunkMeshes: number;
    entities: number;
    itemDrops: number;
    messages: number;
  };
  getState(): GameState | null;
  /** Snapshot for browser tests simulating pointer lock (headless has no real lock). */
  getInputLockTestSnapshot(): {
    uiIsLocked: boolean;
    everLocked: boolean;
    inputIsLocked: boolean;
    heldKeyCount: number;
  };
  benchmarkPerformance(options?: { warmupFrames?: number; sampleFrames?: number }): Promise<{
    stepSimulation: { avgMs: number; p50Ms: number; p95Ms: number; p99Ms: number; maxMs: number };
    realFrames: { avgMs: number; estimatedFps: number; p50Ms: number; p95Ms: number; maxMs: number; framesAbove16ms: number; framesAbove33ms: number };
    entityCount: number;
    chunkMeshes: number;
  }>;
}

export function createMineWebTestController(deps: {
  getCtx: () => GameContext | null;
  getClient: () => GameClient | null;
  getServer: () => GameServer | null;
  getCanvas: () => HTMLCanvasElement | null;
}): MineWebTestController {
  const getCtx = () => deps.getServer()?.ctx ?? deps.getCtx();

  const getRequiredRefs = () => {
    const server = deps.getServer();
    const ctx = server?.ctx ?? deps.getCtx();
    const client = deps.getClient();
    const canvas = deps.getCanvas();
    if (!ctx || !client || !server || !canvas) {
      throw new Error('MineWeb test harness is not ready');
    }
    return { ctx, client, server, canvas };
  };

  return {
    setOverlay(overlay, options) {
      const { ctx, client } = getRequiredRefs();
      const ui = ctx.state.ui;
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

      if (typeof document !== 'undefined' && document.pointerLockElement) {
        document.exitPointerLock();
      }
      if (overlay !== null) {
        client.input.isLocked = false;
      }
      client.input.chatActive = overlay === 'chat';
    },

    async waitForRuntime(timeoutMs = 15_000) {
      await waitFor(() => {
        const server = deps.getServer();
        const ctx = server?.ctx ?? deps.getCtx();
        const client = deps.getClient();
        const canvas = deps.getCanvas();
        return !!ctx && !!client && !!server && !!canvas;
      }, timeoutMs);
    },

    async waitUntilReady(timeoutMs = 15_000) {
      await waitFor(() => {
        const server = deps.getServer();
        const ctx = server?.ctx ?? deps.getCtx();
        const client = deps.getClient();
        const canvas = deps.getCanvas();
        return !!ctx && !!client && !!server && !!canvas && !ctx.state.ui.loading;
      }, timeoutMs);
    },

    async waitForChunkMeshes(minCount, timeoutMs = 15_000) {
      await waitFor(() => {
        const client = deps.getClient();
        return (client?.chunkMeshes.size ?? 0) >= minCount;
      }, timeoutMs);
    },

    async waitForRegressionScene(minChunkMeshes, minEntities, timeoutMs = 15_000) {
      await waitFor(() => {
        try {
          const { ctx, client } = getRequiredRefs();
          return client.chunkMeshes.size >= minChunkMeshes && Object.keys(ctx.state.entities).length >= minEntities;
        } catch {
          return false;
        }
      }, timeoutMs);
    },

    buildRegressionScene(options) {
      const { server } = getRequiredRefs();
      return buildRegressionScene(server, options);
    },

    setPlayerPose(options) {
      const { ctx, client } = getRequiredRefs();
      if (options.position) ctx.state.player.position = { ...options.position };
      if (options.yaw != null) {
        ctx.state.player.yaw = options.yaw;
        client.input.yaw = options.yaw;
      }
      if (options.pitch != null) {
        ctx.state.player.pitch = options.pitch;
        client.input.pitch = options.pitch;
      }
      if (options.viewMode != null) {
        ctx.state.player.viewMode = options.viewMode;
        client.input.viewMode = options.viewMode;
        client.renderer.viewMode = options.viewMode;
      }
    },

    setLocked(locked) {
      const { ctx, client } = getRequiredRefs();
      ctx.state.ui.isLocked = locked;
      if (locked) ctx.state.ui.everLocked = true;
      client.input.isLocked = locked;
      if (!locked && typeof document !== 'undefined' && document.pointerLockElement) {
        document.exitPointerLock();
      }
      if (!locked) {
        client.input.chatActive = false;
        client.input.keys.clear();
        if (client.input.leftBreakHeld) {
          client.input.leftBreakHeld = false;
          client.input.onBreakRelease?.();
        }
      }
    },

    mergeSettings(settings) {
      const { ctx, client } = getRequiredRefs();
      const merged = { ...ctx.state.settings, ...settings };
      ctx.state.settings = merged;
      client.applySettings(merged);
    },

    setWeather(weather) {
      const { ctx } = getRequiredRefs();
      ctx.state.weather = weather;
    },

    setTimeOfDay(timeOfDay) {
      const { ctx } = getRequiredRefs();
      ctx.state.timeOfDay = timeOfDay;
    },

    clearChatMessages() {
      const { ctx } = getRequiredRefs();
      ctx.state.chat.messages.length = 0;
    },

    pushChatMessage(message) {
      const { ctx } = getRequiredRefs();
      appendChatMessage(ctx.state, {
        sender: message.sender,
        message: message.message,
        id: message.id,
        timestamp: message.timestamp,
      });
    },

    inventoryClick(index, button = 'left', shift = false, area) {
      const { ctx } = getRequiredRefs();
      ctx.c2s.emit('c2s:inventoryClick', { index, button, shift, ...(area ? { area } : {}) });
    },

    inventoryCollect(index, area) {
      const { ctx } = getRequiredRefs();
      ctx.c2s.emit('c2s:inventoryCollect', { index, ...(area ? { area } : {}) });
    },

    setInventorySlot(index, slot) {
      const { server, ctx } = getRequiredRefs();
      if (index < 0 || index >= server.inventory.size) {
        throw new Error(`Inventory slot out of range: ${index}`);
      }
      server.inventory.slots[index] = slot ? { ...slot } : null;
      server.syncInventory();
      ctx.state.inventory.slots[index] = slot ? { ...slot } : null;
    },

    setSelectedSlot(index) {
      const { server, ctx } = getRequiredRefs();
      if (index < 0 || index >= server.inventory.size) {
        throw new Error(`Selected slot out of range: ${index}`);
      }
      server.inventory.selectedIndex = index;
      ctx.state.inventory.selectedIndex = index;
      server.syncInventory();
    },

    findEntityIdByType(type) {
      const { ctx } = getRequiredRefs();
      for (const [idText, entity] of Object.entries(ctx.state.entities)) {
        if (entity.type === type) return Number(idText);
      }
      return null;
    },

    interactEntity(id, action) {
      const { ctx } = getRequiredRefs();
      ctx.c2s.emit('c2s:interactEntity', { id, action });
    },

    startBreak(x, y, z) {
      const { ctx } = getRequiredRefs();
      ctx.c2s.emit('c2s:startBreak', { x, y, z });
    },

    cancelBreak() {
      const { ctx } = getRequiredRefs();
      ctx.c2s.emit('c2s:cancelBreak', {});
    },

    placeBlock(x, y, z, blockId) {
      const { ctx } = getRequiredRefs();
      ctx.c2s.emit('c2s:placeBlock', { x, y, z, blockId });
    },

    sendCommand(command) {
      const { ctx } = getRequiredRefs();
      ctx.c2s.emit('c2s:command', { command });
    },

    onBreakProgress(cb) {
      const { ctx } = getRequiredRefs();
      ctx.s2c.on('s2c:breakProgress', cb as any);
      return () => ctx.s2c.off('s2c:breakProgress', cb as any);
    },

    pauseLoops() {
      const { client, server } = getRequiredRefs();
      client.pause();
      server.pause();
    },

    resumeLoops() {
      const { client, server } = getRequiredRefs();
      server.start();
      client.start();
    },

    stepSimulation(frames = 1, dt = 1 / 60) {
      const { client, server } = getRequiredRefs();
      for (let i = 0; i < frames; i++) {
        server.tick(dt);
        client.stepFrame(dt);
      }
    },

    renderFrames(frames = 1, dt = 1 / 60) {
      const { client } = getRequiredRefs();
      for (let i = 0; i < frames; i++) {
        client.stepFrame(dt);
      }
    },

    getCanvas() {
      return deps.getCanvas();
    },

    captureCanvasDataUrl() {
      const { canvas } = getRequiredRefs();
      return canvas.toDataURL('image/png');
    },

    analyzeCurrentFrame(options) {
      const { canvas } = getRequiredRefs();
      const readback = document.createElement('canvas');
      readback.width = canvas.width;
      readback.height = canvas.height;
      const ctx = readback.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        throw new Error('2D readback context unavailable');
      }
      ctx.drawImage(canvas, 0, 0, readback.width, readback.height);
      const frame = ctx.getImageData(0, 0, readback.width, readback.height);
      const base = analyzeFrame({
        width: frame.width,
        height: frame.height,
        data: frame.data,
      });

      const centerRect = options?.centerRectPx ?? {
        x: Math.max(0, Math.floor(frame.width / 2 - 120)),
        y: Math.max(0, Math.floor(frame.height / 2 - 100)),
        width: Math.max(1, Math.min(240, frame.width)),
        height: Math.max(1, Math.min(260, frame.height)),
      };
      const center = ctx.getImageData(
        Math.max(0, centerRect.x),
        Math.max(0, centerRect.y),
        Math.max(1, Math.min(centerRect.width, frame.width)),
        Math.max(1, Math.min(centerRect.height, frame.height)),
      );
      let centerMin = 255;
      let centerMax = 0;
      for (let i = 0; i < center.data.length; i += 4) {
        const luma = center.data[i] * 0.2126 + center.data[i + 1] * 0.7152 + center.data[i + 2] * 0.0722;
        centerMin = Math.min(centerMin, luma);
        centerMax = Math.max(centerMax, luma);
      }

      let magentaRatio: number | undefined;
      if (options?.includeMagentaRatio) {
        let magentaPixels = 0;
        const totalPixels = Math.max(1, frame.width * frame.height);
        for (let i = 0; i < frame.data.length; i += 4) {
          const r = frame.data[i];
          const g = frame.data[i + 1];
          const b = frame.data[i + 2];
          if (r > 190 && b > 190 && g < 140) {
            magentaPixels++;
          }
        }
        magentaRatio = magentaPixels / totalPixels;
      }

      return {
        ...base,
        centerContrast: centerMax - centerMin,
        ...(magentaRatio == null ? {} : { magentaRatio }),
      };
    },

    getStats() {
      const { ctx, client } = getRequiredRefs();
      return {
        chunkMeshes: client.chunkMeshes.size,
        entities: Object.keys(ctx.state.entities).length,
        itemDrops: ctx.state.itemDrops.length,
        messages: ctx.state.chat.messages.length,
      };
    },

    getState() {
      return getCtx()?.state ?? null;
    },

    getInputLockTestSnapshot() {
      const { ctx, client } = getRequiredRefs();
      const ui = ctx.state.ui;
      return {
        uiIsLocked: ui.isLocked,
        everLocked: ui.everLocked,
        inputIsLocked: client.input.isLocked,
        heldKeyCount: client.input.keys.size,
      };
    },

    async benchmarkPerformance(options) {
      const { client, server, ctx } = getRequiredRefs();
      const warmup = options?.warmupFrames ?? 200;
      const sampleCount = options?.sampleFrames ?? 300;

      client.pause();
      server.pause();

      for (let i = 0; i < warmup; i++) {
        server.tick(1 / 60);
        client.stepFrame(1 / 60);
      }

      const simTimes: number[] = [];
      for (let i = 0; i < sampleCount; i++) {
        const t0 = performance.now();
        server.tick(1 / 60);
        client.stepFrame(1 / 60);
        simTimes.push(performance.now() - t0);
      }

      const sorted = [...simTimes].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      const pct = (p: number) => sorted[Math.floor(sorted.length * p)] ?? 0;

      server.start();
      client.start();
      await new Promise((r) => setTimeout(r, 2000));

      const rafTimes: number[] = [];
      let lastTime = performance.now();
      await new Promise<void>((resolve) => {
        let count = 0;
        function measure() {
          const now = performance.now();
          rafTimes.push(now - lastTime);
          lastTime = now;
          count++;
          if (count < sampleCount) {
            requestAnimationFrame(measure);
          } else {
            client.pause();
            server.pause();
            resolve();
          }
        }
        requestAnimationFrame(measure);
      });

      const rafSorted = [...rafTimes].sort((a, b) => a - b);
      const rafSum = rafSorted.reduce((a, b) => a + b, 0);
      const rpct = (p: number) => rafSorted[Math.floor(rafSorted.length * p)] ?? 0;

      return {
        stepSimulation: {
          avgMs: +(sum / sampleCount).toFixed(2),
          p50Ms: +pct(0.5).toFixed(2),
          p95Ms: +pct(0.95).toFixed(2),
          p99Ms: +pct(0.99).toFixed(2),
          maxMs: +sorted[sorted.length - 1].toFixed(2),
        },
        realFrames: {
          avgMs: +(rafSum / sampleCount).toFixed(2),
          estimatedFps: +(1000 / (rafSum / sampleCount)).toFixed(1),
          p50Ms: +rpct(0.5).toFixed(2),
          p95Ms: +rpct(0.95).toFixed(2),
          maxMs: +rafSorted[rafSorted.length - 1].toFixed(2),
          framesAbove16ms: rafSorted.filter((t) => t > 16.7).length,
          framesAbove33ms: rafSorted.filter((t) => t > 33.3).length,
        },
        entityCount: Object.keys(ctx.state.entities).length,
        chunkMeshes: client.chunkMeshes.size,
      };
    },
  };
}
