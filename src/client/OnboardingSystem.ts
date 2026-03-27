import { BlockTypes } from '#/block/BlockRegistry';
import { ItemTypes } from '#/common/ItemRegistry';
import type { GameContext, GameState } from '#/common/GameContext';

export type HintId =
  | 'move'
  | 'look'
  | 'break'
  | 'place'
  | 'inventory'
  | 'craft'
  | 'eat'
  | 'survive_night'
  | 'build_shelter'
  | 'punch_tree'
  | 'make_planks'
  | 'make_crafting_table'
  | 'make_pickaxe';

export type OnboardingHint = {
  id: HintId;
  title: string;
  message: string;
  icon?: string;
  condition: (state: GameState) => boolean;
  shown: boolean;
};

const LS_KEY_PREFIX = 'mineweb-onboarding-v1';

const HINT_PRIORITY: readonly HintId[] = [
  'move',
  'look',
  'punch_tree',
  'break',
  'make_planks',
  'place',
  'make_crafting_table',
  'inventory',
  'craft',
  'make_pickaxe',
  'eat',
  'survive_night',
  'build_shelter',
] as const;

const AIR_BLOCK_ID = 0;

const SLIDE_IN_S = 0.22;
const HOLD_S = 4.2;
const FADE_OUT_S = 0.58;

function lsKey(seed: number): string {
  return `${LS_KEY_PREFIX}:${seed}`;
}

function loadCompleted(seed: number): Set<HintId> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(lsKey(seed));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    const allowed = new Set<string>(HINT_PRIORITY);
    const next = new Set<HintId>();
    for (const id of arr) {
      if (typeof id === 'string' && allowed.has(id)) {
        next.add(id as HintId);
      }
    }
    return next;
  } catch {
    return new Set();
  }
}

function saveCompleted(seed: number, ids: Set<HintId>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(lsKey(seed), JSON.stringify([...ids]));
  } catch {
    /* ignore quota / private mode */
  }
}

function countInventoryItems(s: GameState): number {
  let n = 0;
  for (const slot of s.inventory.slots) {
    if (slot) n += slot.count;
  }
  if (s.inventory.offhand) n += s.inventory.offhand.count;
  return n;
}

function hasItem(s: GameState, itemId: number): boolean {
  return s.inventory.slots.some((slot) => slot?.itemId === itemId);
}

function isBarehands(s: GameState): boolean {
  return countInventoryItems(s) === 0;
}

function hintCopy(h: Omit<OnboardingHint, 'shown'> & { shown?: boolean }): OnboardingHint {
  return { ...h, shown: h.shown ?? false };
}

/**
 * Builds the static hint list (conditions close over runtime via `runtime` methods).
 * `shown` is kept in sync for API compatibility; persistence uses `completed` + localStorage.
 */
function createOnboardingHints(runtime: OnboardingRuntime): OnboardingHint[] {
  return [
    hintCopy({
      id: 'move',
      title: 'Movement',
      message: 'WASD to move, Space to jump',
      condition: (s) => s.ui.isLocked && runtime.getSessionTime() >= 0,
    }),
    hintCopy({
      id: 'look',
      title: 'Look around',
      message: 'Move mouse to look around',
      condition: (s) => s.ui.isLocked && runtime.getSessionTime() >= 2,
    }),
    hintCopy({
      id: 'punch_tree',
      title: 'Punch a tree!',
      message: 'Hold left click on a tree to get wood',
      condition: (s) =>
        s.ui.isLocked
        && runtime.getMoveDistance() >= 6
        && isBarehands(s)
        && !runtime.hasCompletedHint('break'),
    }),
    hintCopy({
      id: 'break',
      title: 'Mining',
      message: 'Left click to break blocks',
      condition: (s) => s.ui.isLocked && runtime.getMoveDistance() >= 10 && !isBarehands(s),
    }),
    hintCopy({
      id: 'make_planks',
      title: 'Make Planks',
      message: 'Press C to craft — turn logs into planks',
      condition: (s) =>
        hasItem(s, BlockTypes.OAK_LOG)
        && !hasItem(s, BlockTypes.OAK_PLANKS)
        && runtime.hasCompletedHint('punch_tree'),
    }),
    hintCopy({
      id: 'place',
      title: 'Building',
      message: 'Right click to place blocks',
      condition: () => runtime.getBlocksBroken() >= 1,
    }),
    hintCopy({
      id: 'make_crafting_table',
      title: 'Crafting Table',
      message: 'Craft a Crafting Table from 4 planks',
      condition: (s) =>
        hasItem(s, BlockTypes.OAK_PLANKS)
        && !hasItem(s, BlockTypes.CRAFTING_TABLE)
        && runtime.hasCompletedHint('make_planks'),
    }),
    hintCopy({
      id: 'inventory',
      title: 'Inventory',
      message: 'Press E to open inventory',
      condition: (s) => countInventoryItems(s) >= 3,
    }),
    hintCopy({
      id: 'craft',
      title: 'Crafting',
      message: 'Craft tools to mine faster',
      condition: (s) =>
        runtime.getInventoryOpenedOnce() &&
        !s.ui.showInventory &&
        runtime.hasCompletedHint('inventory'),
    }),
    hintCopy({
      id: 'make_pickaxe',
      title: 'Make a Pickaxe',
      message: 'Right-click a crafting table, craft a wooden pickaxe',
      condition: (s) =>
        hasItem(s, BlockTypes.CRAFTING_TABLE) || hasItem(s, ItemTypes.STICK)
        ? !hasItem(s, ItemTypes.WOODEN_PICKAXE) && runtime.hasCompletedHint('make_crafting_table')
        : false,
    }),
    hintCopy({
      id: 'eat',
      title: 'Food',
      message: 'Right click with food to eat',
      condition: (s) => s.player.hunger < 15,
    }),
    hintCopy({
      id: 'survive_night',
      title: 'Night is coming',
      message: 'Build shelter before nightfall!',
      condition: (s) => s.timeOfDay >= 0.7,
    }),
    hintCopy({
      id: 'build_shelter',
      title: 'Shelter',
      message: 'Stack blocks into walls and a roof to stay safe',
      condition: (s) => s.timeOfDay >= 0.83,
    }),
  ];
}

type OnboardingRuntime = {
  getSessionTime(): number;
  getMoveDistance(): number;
  getBlocksBroken(): number;
  getInventoryOpenedOnce(): boolean;
  hasCompletedHint(id: HintId): boolean;
  lastState: GameState;
};

export type OnboardingHudHint = {
  title: string;
  message: string;
  opacity: number;
  offsetY: number;
};

type ActiveToast = {
  id: HintId;
  title: string;
  message: string;
  t: number;
};

export class OnboardingSystem implements OnboardingRuntime {
  lastState: GameState;
  private ctx: GameContext;
  private seed = 0;
  private completed = new Set<HintId>();
  private unsub: (() => void) | null = null;

  private sessionTime = 0;
  private prevPos: { x: number; z: number } | null = null;
  private moveDistance = 0;
  private blocksBroken = 0;
  private prevShowInventory = false;
  private inventoryOpenedOnce = false;

  private queue: HintId[] = [];
  private queued = new Set<HintId>();
  private active: ActiveToast | null = null;

  private hints: OnboardingHint[];

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.lastState = ctx.state;
    this.hints = createOnboardingHints(this);
    this.unsub = ctx.s2c.on('s2c:blockChange', ({ blockId }) => {
      if (blockId === AIR_BLOCK_ID) {
        this.blocksBroken += 1;
      }
    });
  }

  getSessionTime(): number {
    return this.sessionTime;
  }

  getMoveDistance(): number {
    return this.moveDistance;
  }

  getBlocksBroken(): number {
    return this.blocksBroken;
  }

  getInventoryOpenedOnce(): boolean {
    return this.inventoryOpenedOnce;
  }

  hasCompletedHint(id: HintId): boolean {
    return this.completed.has(id);
  }

  setWorldSeed(seed: number): void {
    if (seed === this.seed) return;
    this.seed = seed;
    this.completed = loadCompleted(seed);
    this.queue = [];
    this.queued.clear();
    this.active = null;
    this.sessionTime = 0;
    this.prevPos = null;
    this.moveDistance = 0;
    this.blocksBroken = 0;
    this.prevShowInventory = false;
    this.inventoryOpenedOnce = false;
    for (const h of this.hints) {
      h.shown = false;
    }
  }

  tick(dt: number, state: GameState): void {
    this.lastState = state;
    if (state.ui.showInventory && !this.prevShowInventory) {
      this.inventoryOpenedOnce = true;
    }
    this.prevShowInventory = state.ui.showInventory;

    if (state.ui.loading || state.seed === 0) {
      return;
    }

    if (state.ui.isLocked) {
      this.sessionTime += dt;
      const { x, z } = state.player.position;
      if (this.prevPos) {
        const dx = x - this.prevPos.x;
        const dz = z - this.prevPos.z;
        this.moveDistance += Math.hypot(dx, dz);
      }
      this.prevPos = { x, z };
    } else {
      this.prevPos = null;
    }

    if (this.active) {
      this.active.t += dt;
      const total = SLIDE_IN_S + HOLD_S + FADE_OUT_S;
      if (this.active.t >= total) {
        this.finishActive();
      }
      if (this.active) {
        return;
      }
    }

    for (const id of HINT_PRIORITY) {
      if (this.completed.has(id) || this.queued.has(id)) continue;
      const hint = this.hints.find((h) => h.id === id);
      if (!hint) continue;
      if (hint.condition(state)) {
        hint.shown = true;
        this.queued.add(id);
        this.queue.push(id);
      }
    }

    if (this.queue.length === 0) return;
    const nextId = this.queue.shift()!;
    this.queued.delete(nextId);
    const meta = this.hints.find((h) => h.id === nextId);
    if (!meta) return;
    this.active = { id: nextId, title: meta.title, message: meta.message, t: 0 };
  }

  getHudHint(): OnboardingHudHint | undefined {
    if (!this.active) return undefined;
    const t = this.active.t;
    let opacity = 1;
    let offsetY = 0;
    if (t < SLIDE_IN_S) {
      const p = SLIDE_IN_S > 0 ? t / SLIDE_IN_S : 1;
      opacity = p;
      offsetY = (1 - p) * -40;
    } else if (t < SLIDE_IN_S + HOLD_S) {
      opacity = 1;
      offsetY = 0;
    } else {
      const ft = t - SLIDE_IN_S - HOLD_S;
      const p = FADE_OUT_S > 0 ? Math.min(1, ft / FADE_OUT_S) : 1;
      opacity = 1 - p;
      offsetY = 0;
    }
    if (opacity < 0.02) return undefined;
    return {
      title: this.active.title,
      message: this.active.message,
      opacity,
      offsetY,
    };
  }

  private finishActive(): void {
    if (!this.active) return;
    const id = this.active.id;
    this.active = null;
    this.completed.add(id);
    saveCompleted(this.seed, this.completed);
  }

  dispose(): void {
    if (this.unsub) {
      this.unsub();
      this.unsub = null;
    }
  }
}
