import type { Player } from '#/common/Player';
import { isComposingKeyboardEvent } from '#/common/overlayUiHelpers';
import type { Vec3, ViewMode } from '#/common/types';

export const FLY_TOGGLE_DOUBLE_SPACE_WINDOW_MS = 280;

export function resolveSpaceToggleFly(input: {
  isLocked: boolean;
  isRepeat: boolean;
  nowMs: number;
  lastSpaceDownAtMs: number;
  windowMs?: number;
}) {
  const {
    isLocked,
    isRepeat,
    nowMs,
    lastSpaceDownAtMs,
    windowMs = FLY_TOGGLE_DOUBLE_SPACE_WINDOW_MS,
  } = input;
  if (!isLocked || isRepeat) {
    return { toggleFly: false, nextLastSpaceDownAtMs: lastSpaceDownAtMs };
  }
  if (nowMs - lastSpaceDownAtMs <= windowMs) {
    return { toggleFly: true, nextLastSpaceDownAtMs: 0 };
  }
  return { toggleFly: false, nextLastSpaceDownAtMs: nowMs };
}

const SPRINT_DOUBLE_W_WINDOW_MS = 300;
const SPRINT_SPEED_MULTIPLIER = 1.3;

export class InputManager {
  keys = new Set<string>();
  yaw = 0;
  pitch = 0;
  isLocked = false;
  sensitivity = 1;
  viewMode: ViewMode = 'first-person';
  onLockChange: ((locked: boolean) => void) | null = null;
  onViewChange: ((mode: ViewMode) => void) | null = null;
  /** Left mouse down — start mining / attack */
  onBreakPress: (() => void) | null = null;
  /** Left mouse up — cancel mining */
  onBreakRelease: (() => void) | null = null;
  onPlace: (() => void) | null = null;
  /** True while left button held after mousedown on canvas (released on global mouseup). */
  leftBreakHeld = false;
  onToggleFly: (() => void) | null = null;
  /** Double-W sprint toggle (MC standard). Stays true until player stops moving forward. */
  sprintLocked = false;
  private _chatActive = false;

  private canvas: HTMLCanvasElement;
  private player: Player;
  private cleanups: (() => void)[] = [];
  private lastSpaceDownAt = 0;
  private lastWDownAt = 0;

  get chatActive() {
    return this._chatActive;
  }

  set chatActive(v: boolean) {
    this._chatActive = v;
    if (v) {
      this.clearMovementKeys();
    }
  }

  private clearMovementKeys() {
    this.keys.delete('w');
    this.keys.delete('a');
    this.keys.delete('s');
    this.keys.delete('d');
    this.keys.delete(' ');
    this.keys.delete('shift');
  }

  constructor(canvas: HTMLCanvasElement, player: Player) {
    this.canvas = canvas;
    this.player = player;
    this.setup();
  }

  private listen(el: EventTarget, ev: string, fn: EventListener, opts?: AddEventListenerOptions) {
    el.addEventListener(ev, fn, opts);
    this.cleanups.push(() => el.removeEventListener(ev, fn, opts));
  }

  private setup() {
    this.listen(this.canvas, 'click', () => {
      if (!this.isLocked) this.canvas.requestPointerLock();
    });
    this.listen(document, 'pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.canvas;
      if (!this.isLocked) {
        this.keys.clear();
        if (this.leftBreakHeld) {
          this.leftBreakHeld = false;
          this.onBreakRelease?.();
        }
      }
      this.onLockChange?.(this.isLocked);
    });
    this.listen(document, 'mousemove', ((e: MouseEvent) => {
      if (!this.isLocked) return;
      const s = 0.002 * this.sensitivity;
      this.yaw -= e.movementX * s;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch - e.movementY * s));
      this.player.look(this.yaw, this.pitch);
    }) as EventListener);
    this.listen(window, 'keydown', ((e: KeyboardEvent) => {
      if (this.chatActive) return;
      if (isComposingKeyboardEvent(e)) return;
      const k = e.key.toLowerCase();
      if (this.keys.has(k)) return;
      this.keys.add(k);
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
        this.keys.add('control');
      }
      if (k === 'w' && this.isLocked && !e.repeat) {
        const now = performance.now();
        if (now - this.lastWDownAt <= SPRINT_DOUBLE_W_WINDOW_MS) {
          this.sprintLocked = true;
        }
        this.lastWDownAt = now;
      }
      if (k >= '1' && k <= '9') this.player.selectSlot(parseInt(k, 10) - 1);
      if (k === ' ') {
        e.preventDefault();
        const { toggleFly, nextLastSpaceDownAtMs } = resolveSpaceToggleFly({
          isLocked: this.isLocked,
          isRepeat: e.repeat,
          nowMs: performance.now(),
          lastSpaceDownAtMs: this.lastSpaceDownAt,
        });
        this.lastSpaceDownAt = nextLastSpaceDownAtMs;
        if (toggleFly) {
          this.onToggleFly?.();
        }
        this.player.jump();
      }
      if (k === 'shift') this.player.sneak(true);
      if (k === 'f') { e.preventDefault(); this.player.swapOffhand(); }
      if (k === 'f5') { e.preventDefault(); this.cycleView(); }
    }) as EventListener);
    this.listen(window, 'keyup', ((e: KeyboardEvent) => {
      if (isComposingKeyboardEvent(e)) return;
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
        this.keys.delete('control');
      }
      if (k === 'shift') this.player.sneak(false);
    }) as EventListener);
    this.listen(window, 'blur', () => {
      this.keys.clear();
    });
    this.listen(document, 'visibilitychange', () => {
      if (document.visibilityState !== 'visible') {
        this.keys.clear();
      }
    });
    this.listen(this.canvas, 'mousedown', ((e: MouseEvent) => {
      if (!this.isLocked) return;
      e.preventDefault();
      if (e.button === 0) {
        this.leftBreakHeld = true;
        this.onBreakPress?.();
      } else if (e.button === 2) this.onPlace?.();
    }) as EventListener);
    this.listen(window, 'mouseup', ((e: MouseEvent) => {
      if (e.button !== 0) return;
      if (this.leftBreakHeld) {
        this.leftBreakHeld = false;
        this.onBreakRelease?.();
      }
    }) as EventListener);
    this.listen(this.canvas, 'contextmenu', ((e: Event) => e.preventDefault()) as EventListener);
    this.listen(this.canvas, 'wheel', ((e: WheelEvent) => {
      if (!this.isLocked) return;
      e.preventDefault();
      const dir = Math.sign(e.deltaY);
      const cur = this.player.selectedSlot;
      const next = ((cur + dir) % 9 + 9) % 9;
      this.player.selectSlot(next);
    }) as EventListener, { passive: false });
  }

  private cycleView() {
    const modes: ViewMode[] = ['first-person', 'third-back', 'third-front'];
    this.viewMode = modes[(modes.indexOf(this.viewMode) + 1) % modes.length];
    this.player.changeView(this.viewMode);
    this.onViewChange?.(this.viewMode);
  }

  get spaceHeld(): boolean { return this.keys.has(' '); }
  get shiftHeld(): boolean { return this.keys.has('shift'); }
  /** Sprint active — Ctrl held OR double-W locked while W is held. */
  get sprintHeld(): boolean { return this.keys.has('control') || this.sprintLocked; }

  getMovementVector(dt: number, speed: number): Vec3 {
    if (!this.isLocked || this.chatActive) return { x: 0, y: 0, z: 0 };
    const forward = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const right = { x: -forward.z, z: forward.x };
    let dx = 0, dz = 0;
    if (this.keys.has('w')) { dx += forward.x; dz += forward.z; }
    if (this.keys.has('s')) { dx -= forward.x; dz -= forward.z; }
    if (this.keys.has('a')) { dx -= right.x; dz -= right.z; }
    if (this.keys.has('d')) { dx += right.x; dz += right.z; }
    if (!this.keys.has('w') && this.sprintLocked) {
      this.sprintLocked = false;
    }
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) {
      const finalSpeed = this.sprintHeld ? speed * SPRINT_SPEED_MULTIPLIER : speed;
      dx = (dx / len) * finalSpeed * dt;
      dz = (dz / len) * finalSpeed * dt;
    }
    return { x: dx, y: 0, z: dz };
  }

  dispose() {
    for (const fn of this.cleanups) fn();
    this.cleanups.length = 0;
  }
}
