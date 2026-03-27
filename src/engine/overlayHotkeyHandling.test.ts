import { describe, expect, it } from 'vitest';
import {
  resolveOverlayHotkeyHandling,
  type OverlayHotkeyAction,
  type OverlayHotkeyUiSnapshot,
} from './MineWebGame';

const baseUi = (): OverlayHotkeyUiSnapshot => ({
  chestOpen: false,
  furnaceOpen: false,
  showInventory: false,
  showCrafting: false,
  showChat: false,
  showSettings: false,
  showDebug: false,
});

describe('resolveOverlayHotkeyHandling', () => {
  it('does not prevent default for ignore/none', () => {
    const ui = baseUi();
    expect(resolveOverlayHotkeyHandling({ type: 'ignore' } as OverlayHotkeyAction, ui)).toEqual({
      type: 'none',
      preventDefault: false,
    });
    expect(resolveOverlayHotkeyHandling({ type: 'none' }, ui)).toEqual({
      type: 'none',
      preventDefault: false,
    });
  });

  it('maps toggle-inventory by chest / furnace / inventory state', () => {
    const ui = baseUi();
    expect(resolveOverlayHotkeyHandling({ type: 'toggle-inventory' }, { ...ui, chestOpen: true })).toEqual({
      type: 'close-chest',
      preventDefault: true,
    });
    expect(resolveOverlayHotkeyHandling({ type: 'toggle-inventory' }, { ...ui, furnaceOpen: true })).toEqual({
      type: 'close-overlay',
      preventDefault: true,
    });
    expect(resolveOverlayHotkeyHandling({ type: 'toggle-inventory' }, { ...ui, showInventory: true })).toEqual({
      type: 'close-overlay',
      preventDefault: true,
    });
    expect(resolveOverlayHotkeyHandling({ type: 'toggle-inventory' }, ui)).toEqual({
      type: 'open-inventory-overlay',
      preventDefault: true,
    });
  });

  it('maps toggle-crafting to close or open overlay', () => {
    const ui = baseUi();
    expect(resolveOverlayHotkeyHandling({ type: 'toggle-crafting' }, { ...ui, showCrafting: true })).toEqual({
      type: 'close-overlay',
      preventDefault: true,
    });
    expect(resolveOverlayHotkeyHandling({ type: 'toggle-crafting' }, ui)).toEqual({
      type: 'open-crafting-overlay',
      preventDefault: true,
    });
  });

  it('passes chat prefix from open-chat action', () => {
    expect(
      resolveOverlayHotkeyHandling({ type: 'open-chat', prefix: '/' }, baseUi()),
    ).toEqual({ type: 'open-chat', prefix: '/', preventDefault: true });
    expect(resolveOverlayHotkeyHandling({ type: 'open-chat' }, baseUi())).toEqual({
      type: 'open-chat',
      prefix: undefined,
      preventDefault: true,
    });
  });

  it('maps escape-style action to close chest, dismiss modals, or open settings', () => {
    const ui = baseUi();
    expect(
      resolveOverlayHotkeyHandling({ type: 'toggle-settings-or-close-overlay' }, { ...ui, chestOpen: true }),
    ).toEqual({ type: 'close-chest', preventDefault: true });
    expect(
      resolveOverlayHotkeyHandling({ type: 'toggle-settings-or-close-overlay' }, { ...ui, showChat: true }),
    ).toEqual({ type: 'close-overlay', preventDefault: true });
    expect(resolveOverlayHotkeyHandling({ type: 'toggle-settings-or-close-overlay' }, ui)).toEqual({
      type: 'open-settings-overlay',
      preventDefault: true,
    });
  });

  it('toggles debug flag from current showDebug', () => {
    expect(
      resolveOverlayHotkeyHandling({ type: 'toggle-debug' }, { ...baseUi(), showDebug: false }),
    ).toEqual({ type: 'set-show-debug', showDebug: true, preventDefault: true });
    expect(
      resolveOverlayHotkeyHandling({ type: 'toggle-debug' }, { ...baseUi(), showDebug: true }),
    ).toEqual({ type: 'set-show-debug', showDebug: false, preventDefault: true });
  });

  it('maps screenshot and blocked-prelock', () => {
    expect(resolveOverlayHotkeyHandling({ type: 'screenshot' }, baseUi())).toEqual({
      type: 'screenshot',
      preventDefault: true,
    });
    expect(resolveOverlayHotkeyHandling({ type: 'blocked-prelock' }, baseUi())).toEqual({
      type: 'blocked-prelock',
      preventDefault: true,
    });
  });
});
