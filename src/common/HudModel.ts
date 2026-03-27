import type { ChatMessage, EntityStateMap, InventorySlot, Vec3, ViewMode } from './types';
import { isMineWebDevEnv } from './runtimeEnv';

export interface HudTargetBlock {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  state?: EntityStateMap;
}

export interface HudViewport {
  width: number;
  height: number;
}

export interface CrosshairHudModel {
  visible: boolean;
  size: number;
  thickness: number;
}

export interface HotbarHudSlotModel {
  index: number;
  slot: InventorySlot | null;
  selected: boolean;
  x: number;
  y: number;
  size: number;
}

export interface OffhandHudSlotModel {
  slot: InventorySlot | null;
  x: number;
  y: number;
  size: number;
}

export interface HotbarHudModel {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  slotSize: number;
  gap: number;
  slots: HotbarHudSlotModel[];
  offhand: OffhandHudSlotModel | null;
}

export interface HudInfoPanelModel {
  visible: boolean;
  x: number;
  y: number;
  lines: string[];
}

export interface HudChatLineModel {
  text: string;
  opacity: number;
}

export interface HudChatFeedModel {
  visible: boolean;
  x: number;
  y: number;
  lines: HudChatLineModel[];
}

export interface SurvivalHudModel {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  iconW: number;
  iconH: number;
  gap: number;
  hp: number;
  maxHp: number;
  hunger: number;
  maxHunger: number;
}

export interface MiningBarHudModel {
  visible: boolean;
  /** 0–1 fill */
  progress: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Advancement-style onboarding toast (top-center). */
export type HudActiveHintModel = {
  title: string;
  message: string;
  opacity: number;
  /** Extra vertical offset in px (negative slides in from above). */
  offsetY?: number;
};

export interface HudModel {
  crosshair: CrosshairHudModel;
  hotbar: HotbarHudModel;
  survivalBars: SurvivalHudModel;
  infoPanel: HudInfoPanelModel;
  chatFeed: HudChatFeedModel;
  /** Centered above crosshair while mining; `null` when idle. */
  miningBar: MiningBarHudModel | null;
  activeHint?: HudActiveHintModel;
}

/** Collapse runs of identical consecutive chat lines (same sender + message). */
/** Gate used by the render loop: build `HudModel` only when settings allow native HUD and the pointer is locked. */
export function shouldBuildNativeHudModel(input: {
  nativeHudEnabledInSettings: boolean;
  pointerLocked: boolean;
}): boolean {
  return input.nativeHudEnabledInSettings && input.pointerLocked;
}

export function dedupeAdjacentChatMessages<T extends { sender: string; message: string }>(
  messages: readonly T[],
): T[] {
  const deduped: T[] = [];
  for (const m of messages) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.sender === m.sender && prev.message === m.message) {
      continue;
    }
    deduped.push(m);
  }
  return deduped;
}

function stripLegacyColorCodes(text: string): string {
  if (!text) return '';
  return text.replace(/§[0-9a-fk-or]/gi, '').replace(/§/g, '');
}

function faceFromNormal(nx: number, ny: number, nz: number): string {
  if (ny === 1) return '+Y';
  if (ny === -1) return '-Y';
  if (nx === 1) return '+X';
  if (nx === -1) return '-X';
  if (nz === 1) return '+Z';
  if (nz === -1) return '-Z';
  return '?';
}

function facingFromYaw(yaw: number): string {
  const deg = ((yaw * 180) / Math.PI + 360) % 360;
  if (deg >= 315 || deg < 45) return 'south';
  if (deg >= 45 && deg < 135) return 'west';
  if (deg >= 135 && deg < 225) return 'north';
  return 'east';
}

function viewModeLabel(viewMode: ViewMode) {
  return {
    'first-person': 'FP',
    'third-back': '3rd',
    'third-front': '3rd Front',
  }[viewMode];
}

function timeOfDayLabel(timeOfDay: number | undefined) {
  const tick = (((timeOfDay ?? 0) % 1 + 1) % 1) * 24_000;
  if (tick < 1000) return 'Dawn';
  if (tick < 12_000) return 'Day';
  if (tick < 13_000) return 'Dusk';
  return 'Night';
}

function buildInfoPanelLines(input: {
  showDebug?: boolean;
  showFps?: boolean;
  fps?: number;
  biome?: string;
  weather?: string;
  timeOfDay?: number;
  playerPos?: Vec3;
  hp?: number;
  maxHp?: number;
  airMs?: number;
  maxAirMs?: number;
  viewMode?: ViewMode;
  yaw?: number;
  targetBlock?: HudTargetBlock | null;
  chunkCount?: number;
  entityCount?: number;
  renderDistance?: number;
  fov?: number;
}) {
  const position = input.playerPos ?? { x: 0, y: 0, z: 0 };
  const yaw = input.yaw ?? 0;
  const chunkX = Math.floor(position.x / 16);
  const chunkY = Math.floor(position.y / 16);
  const chunkZ = Math.floor(position.z / 16);
  const lines = [
    `XYZ: ${position.x.toFixed(1)} / ${position.y.toFixed(1)} / ${position.z.toFixed(1)}`,
    input.showDebug
      ? `Block: ${Math.floor(position.x)} ${Math.floor(position.y)} ${Math.floor(position.z)}`
      : `Chunk: ${chunkX}, ${chunkZ} [${viewModeLabel(input.viewMode ?? 'first-person')}]`,
  ];
  const hp = input.hp ?? 20;
  const maxHp = input.maxHp ?? 20;
  const maxAirMs = Math.max(1, input.maxAirMs ?? 10_000);
  const airMs = Math.max(0, Math.min(maxAirMs, input.airMs ?? maxAirMs));
  const airPercent = Math.round((airMs / maxAirMs) * 100);

  if (input.showDebug) {
    lines.push(`Chunk: ${chunkX} ${chunkY} ${chunkZ}`);
    lines.push(`Facing: ${facingFromYaw(yaw)} (yaw: ${yaw.toFixed(2)})`);
    if (input.targetBlock) {
      lines.push(
        `Target: [${input.targetBlock.x}, ${input.targetBlock.y}, ${input.targetBlock.z}] face: ${faceFromNormal(
          input.targetBlock.nx,
          input.targetBlock.ny,
          input.targetBlock.nz,
        )}`,
      );
      if (input.targetBlock.state && Object.keys(input.targetBlock.state).length > 0) {
        lines.push(`Target state: ${JSON.stringify(input.targetBlock.state)}`);
      }
    }
    lines.push(`Weather: ${input.weather ?? 'clear'} | Time: ${timeOfDayLabel(input.timeOfDay)}`);
    lines.push(`Health: ${hp.toFixed(0)} / ${maxHp.toFixed(0)}`);
    if (airMs < maxAirMs) {
      lines.push(`Air: ${Math.round(airMs)} / ${Math.round(maxAirMs)}`);
    }
    lines.push('---');
    lines.push(`Chunks: ${input.chunkCount ?? 0} | Entities: ${input.entityCount ?? 0}`);
    lines.push(`Render: ${input.renderDistance ?? 6} chunks | FOV: ${input.fov ?? 75}`);
    lines.push(`FPS: ${input.fps ?? 0}`);
    lines.push(`Env: ${isMineWebDevEnv() ? 'DEV' : 'PROD'}`);
  } else if (input.showFps) {
    lines.push(`${input.fps ?? 0} FPS`);
  }
  if (!input.showDebug && input.targetBlock) {
    lines.push(
      `Target: [${input.targetBlock.x}, ${input.targetBlock.y}, ${input.targetBlock.z}] face: ${faceFromNormal(
        input.targetBlock.nx,
        input.targetBlock.ny,
        input.targetBlock.nz,
      )}`,
    );
    if (input.targetBlock.state && Object.keys(input.targetBlock.state).length > 0) {
      lines.push(`Target state: ${JSON.stringify(input.targetBlock.state)}`);
    }
  }

  if (input.biome) {
    lines.push(input.biome);
  }
  if (input.showDebug) {
    lines.push(viewModeLabel(input.viewMode ?? 'first-person'));
  } else {
    lines.push(`HP ${hp.toFixed(0)}/${maxHp.toFixed(0)}`);
    if (airMs < maxAirMs) {
      lines.push(`Air ${airPercent}%`);
    }
  }
  return lines;
}

export function buildHotbarHudModel(input: {
  slots: (InventorySlot | null)[];
  offhandSlot?: InventorySlot | null;
  selectedIndex: number;
  viewport: HudViewport;
  visible: boolean;
}): HotbarHudModel {
  const slotSize = Math.max(36, Math.min(48, Math.round(input.viewport.width / 28)));
  const gap = 2;
  const slotCount = Math.min(9, input.slots.length);
  const width = slotCount * slotSize + Math.max(0, slotCount - 1) * gap;
  const height = slotSize;
  const x = Math.round((input.viewport.width - width) / 2);
  const y = Math.max(12, input.viewport.height - slotSize - 16);

  return {
    visible: input.visible,
    x,
    y,
    width,
    height,
    slotSize,
    gap,
    slots: input.slots.slice(0, slotCount).map((slot, index) => ({
      index,
      slot,
      selected: index === input.selectedIndex,
      x: x + index * (slotSize + gap),
      y,
      size: slotSize,
    })),
    offhand: {
      slot: input.offhandSlot ?? null,
      x: x - slotSize - Math.max(8, gap * 3),
      y,
      size: slotSize,
    },
  };
}

export function buildSurvivalHudModel(input: {
  hotbar: HotbarHudModel;
  visible: boolean;
  hp: number;
  maxHp: number;
  hunger: number;
  maxHunger: number;
}): SurvivalHudModel {
  const paddingY = 4;
  const slotSize = input.hotbar.slotSize;
  const iconW = Math.max(7, Math.round(slotSize * 0.36));
  const iconH = Math.max(7, Math.round(slotSize * 0.34));
  const gap = 2;
  const rowH = iconH + paddingY * 2;
  const y = input.hotbar.y - rowH - 4;
  return {
    visible: input.visible,
    x: input.hotbar.x,
    y,
    width: input.hotbar.width,
    height: rowH,
    iconW,
    iconH,
    gap,
    hp: input.hp,
    maxHp: input.maxHp,
    hunger: input.hunger,
    maxHunger: input.maxHunger,
  };
}

export function buildHudModel(input: {
  viewport: HudViewport;
  isLocked: boolean;
  useNativeHud: boolean;
  hotbarSlots: (InventorySlot | null)[];
  offhandSlot?: InventorySlot | null;
  selectedIndex: number;
  showChat?: boolean;
  showDebug?: boolean;
  showFps?: boolean;
  fps?: number;
  biome?: string;
  weather?: string;
  timeOfDay?: number;
  playerPos?: Vec3;
  hp?: number;
  maxHp?: number;
  hunger?: number;
  maxHunger?: number;
  airMs?: number;
  maxAirMs?: number;
  viewMode?: ViewMode;
  yaw?: number;
  targetBlock?: HudTargetBlock | null;
  chunkCount?: number;
  entityCount?: number;
  renderDistance?: number;
  fov?: number;
  chatMessages?: ChatMessage[];
  nowMs?: number;
  chatFadeAfterMs?: number;
  chatMaxVisible?: number;
  /** 0–1 while breaking a block; omit or `null` when not mining. */
  miningProgress?: number | null;
  activeHint?: HudActiveHintModel;
}): HudModel {
  const nativeVisible = input.isLocked && input.useNativeHud;
  const chatMessages = input.chatMessages ?? [];
  const chatFadeAfterMs = input.chatFadeAfterMs ?? 7_000;
  const chatMaxVisible = input.chatMaxVisible ?? 8;
  const nowMs = input.nowMs ?? Date.now();
  const deduped = dedupeAdjacentChatMessages(chatMessages);
  const chatLines = deduped
    .slice(-chatMaxVisible)
    .map((message) => {
      const age = nowMs - (message.timestamp ?? nowMs);
      const opacity = age > chatFadeAfterMs
        ? Math.max(0, 1 - (age - chatFadeAfterMs) / 2_000)
        : 1;
      return {
        text: `${stripLegacyColorCodes(message.sender)}: ${stripLegacyColorCodes(message.message)}`,
        opacity,
      };
    })
    .filter((line) => line.opacity > 0);
  const chatLineHeight = 18;
  const chatHeight = chatMaxVisible * chatLineHeight;
  const hotbar = buildHotbarHudModel({
    slots: input.hotbarSlots,
    offhandSlot: input.offhandSlot,
    selectedIndex: input.selectedIndex,
    viewport: input.viewport,
    visible: nativeVisible,
  });
  const miningBarWidth = Math.min(180, Math.round(input.viewport.width * 0.42));
  const miningBarHeight = 5;
  const miningBarX = Math.round((input.viewport.width - miningBarWidth) / 2);
  const miningBarY = Math.round(input.viewport.height * 0.5 - 52);
  const miningProgress = input.miningProgress;
  const miningBar: MiningBarHudModel | null =
    nativeVisible && miningProgress != null
      ? {
          visible: true,
          progress: Math.min(1, Math.max(0, miningProgress)),
          x: miningBarX,
          y: miningBarY,
          width: miningBarWidth,
          height: miningBarHeight,
        }
      : null;
  const activeHint =
    nativeVisible && input.activeHint != null && input.activeHint.opacity > 0.001
      ? input.activeHint
      : undefined;
  return {
    crosshair: {
      visible: nativeVisible,
      size: Math.max(14, Math.round(input.viewport.width / 80)),
      thickness: Math.max(2, Math.round(input.viewport.width / 480)),
    },
    hotbar,
    survivalBars: buildSurvivalHudModel({
      hotbar,
      visible: nativeVisible,
      hp: input.hp ?? 20,
      maxHp: input.maxHp ?? 20,
      hunger: input.hunger ?? 20,
      maxHunger: input.maxHunger ?? 20,
    }),
    infoPanel: {
      visible: nativeVisible,
      x: 10,
      y: 10,
      lines: buildInfoPanelLines(input),
    },
    chatFeed: {
      visible: nativeVisible && !input.showChat && chatLines.length > 0,
      x: 8,
      y: Math.max(80, input.viewport.height - 96 - chatHeight),
      lines: chatLines,
    },
    miningBar,
    activeHint,
  };
}
