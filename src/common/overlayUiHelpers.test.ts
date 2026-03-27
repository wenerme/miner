import { describe, expect, it } from 'vitest';
import { hasModalUiOpen, isComposingKeyboardEvent, shouldEmitInventoryCloseOnOverlayDismiss } from './overlayUiHelpers';

describe('hasModalUiOpen', () => {
  const closed = {
    showInventory: false,
    showCrafting: false,
    showChat: false,
    showSettings: false,
    furnaceOpen: false,
  };

  it('returns false when no modal UI is open', () => {
    expect(hasModalUiOpen(closed)).toBe(false);
    expect(hasModalUiOpen({ ...closed, chestOpen: false })).toBe(false);
  });

  it('returns true when any overlay or block GUI flag is set', () => {
    expect(hasModalUiOpen({ ...closed, showInventory: true })).toBe(true);
    expect(hasModalUiOpen({ ...closed, showCrafting: true })).toBe(true);
    expect(hasModalUiOpen({ ...closed, showChat: true })).toBe(true);
    expect(hasModalUiOpen({ ...closed, showSettings: true })).toBe(true);
    expect(hasModalUiOpen({ ...closed, furnaceOpen: true })).toBe(true);
    expect(hasModalUiOpen({ ...closed, chestOpen: true })).toBe(true);
  });

  it('treats omitted chestOpen as closed', () => {
    expect(hasModalUiOpen(closed)).toBe(false);
  });
});

describe('shouldEmitInventoryCloseOnOverlayDismiss', () => {
  it('is true only when inventory overlay was open without furnace GUI', () => {
    expect(shouldEmitInventoryCloseOnOverlayDismiss({ showInventory: true, furnaceOpen: false })).toBe(true);
    expect(shouldEmitInventoryCloseOnOverlayDismiss({ showInventory: false, furnaceOpen: false })).toBe(false);
    expect(shouldEmitInventoryCloseOnOverlayDismiss({ showInventory: true, furnaceOpen: true })).toBe(false);
    expect(shouldEmitInventoryCloseOnOverlayDismiss({ showInventory: false, furnaceOpen: true })).toBe(false);
  });
});

describe('isComposingKeyboardEvent', () => {
  it('returns true when composing or IME keyCode 229', () => {
    expect(isComposingKeyboardEvent({ isComposing: true, keyCode: 0 })).toBe(true);
    expect(isComposingKeyboardEvent({ isComposing: false, keyCode: 229 })).toBe(true);
  });

  it('returns false otherwise', () => {
    expect(isComposingKeyboardEvent({ isComposing: false, keyCode: 65 })).toBe(false);
  });
});
