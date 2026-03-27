/**
 * Pure helpers for overlay / modal UI detection and keyboard IME state.
 * Keeps MineWebGame hotkey resolution aligned with a single definition of "GUI open".
 */

export function hasModalUiOpen(input: {
  showInventory: boolean;
  showCrafting: boolean;
  showChat: boolean;
  showSettings: boolean;
  furnaceOpen: boolean;
  chestOpen?: boolean;
}): boolean {
  return (
    input.showInventory
    || input.showCrafting
    || input.showChat
    || input.showSettings
    || input.furnaceOpen
    || !!input.chestOpen
  );
}

export function isComposingKeyboardEvent(e: { isComposing: boolean; keyCode: number }): boolean {
  return e.isComposing || e.keyCode === 229;
}

/** After dismissing the main overlay, emit `c2s:inventoryClose` only for player inventory — not when a furnace GUI was the reason for blur. */
export function shouldEmitInventoryCloseOnOverlayDismiss(input: {
  showInventory: boolean;
  furnaceOpen: boolean;
}): boolean {
  return input.showInventory && !input.furnaceOpen;
}
