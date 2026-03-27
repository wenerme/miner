import { describe, expect, it } from 'vitest';
import { dedupeAdjacentChatMessages, shouldBuildNativeHudModel } from './HudModel';

describe('shouldBuildNativeHudModel', () => {
  it('requires both settings native HUD and pointer lock', () => {
    expect(
      shouldBuildNativeHudModel({ nativeHudEnabledInSettings: true, pointerLocked: true }),
    ).toBe(true);
    expect(
      shouldBuildNativeHudModel({ nativeHudEnabledInSettings: true, pointerLocked: false }),
    ).toBe(false);
    expect(
      shouldBuildNativeHudModel({ nativeHudEnabledInSettings: false, pointerLocked: true }),
    ).toBe(false);
    expect(
      shouldBuildNativeHudModel({ nativeHudEnabledInSettings: false, pointerLocked: false }),
    ).toBe(false);
  });
});

describe('dedupeAdjacentChatMessages', () => {
  it('returns empty for empty input', () => {
    expect(dedupeAdjacentChatMessages([])).toEqual([]);
  });

  it('keeps a single message', () => {
    const m = { sender: 'A', message: 'hi', id: '1', timestamp: 1 };
    expect(dedupeAdjacentChatMessages([m])).toEqual([m]);
  });

  it('drops only adjacent duplicates with same sender and message', () => {
    const a = { sender: 'Sys', message: 'x', id: '1', timestamp: 1 };
    const b = { sender: 'Sys', message: 'x', id: '2', timestamp: 2 };
    const c = { sender: 'Sys', message: 'y', id: '3', timestamp: 3 };
    const d = { sender: 'Sys', message: 'x', id: '4', timestamp: 4 };
    expect(dedupeAdjacentChatMessages([a, b, c, d])).toEqual([a, c, d]);
  });

  it('does not collapse non-adjacent duplicates', () => {
    const x = { sender: 'P', message: 'same', id: '1', timestamp: 1 };
    const y = { sender: 'Q', message: 'other', id: '2', timestamp: 2 };
    expect(dedupeAdjacentChatMessages([x, y, x])).toEqual([x, y, x]);
  });
});
