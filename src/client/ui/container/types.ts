import type { InventorySlot } from '#/common/types';

/** Slot click event — all container UIs emit the same shape. */
export type SlotClickEvent = {
  index: number;
  button: 'left' | 'right';
  shift: boolean;
};

/** Shared contract for any container-style UI panel (inventory, furnace, crafting table, future chest, etc.). */
export type ContainerScreenProps = {
  slots: (InventorySlot | null)[];
  cursorSlot: InventorySlot | null;
  selectedIndex: number;
  onSlotClick: (index: number, button: 'left' | 'right', shift: boolean) => void;
  onSlotCollect: (index: number) => void;
  onClose: () => void;
};
