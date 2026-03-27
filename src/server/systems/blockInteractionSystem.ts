import { BLOCK_DEFS, BlockTypes } from '#/block/BlockRegistry';
import { getItemToolType } from '#/common/ItemRegistry';
import { blockRuleEngine } from '../BlockRules';
import type { GameServer } from '../GameServer';

const B = BlockTypes;

export function interactBlock(
  server: GameServer,
  cancelEating: () => void,
  x: number,
  y: number,
  z: number,
  action: 'use',
): void {
  cancelEating();
  if (action !== 'use') return;
  const blockId = server.world.getBlock(x, y, z);
  if (blockId === B.AIR) return;
  const info = BLOCK_DEFS[blockId];
  if (!info) return;

  const selectedItemId = server.inventory.getSelectedItem();
  const activeTool = getItemToolType(selectedItemId) ?? server.ctx.state.player.tool;
  if (blockRuleEngine.applyOnInteract(server, { x, y, z, blockId, selectedItemId, activeTool })) {
    return;
  }
  if (blockId === B.CRAFTING_TABLE) {
    server.ctx.s2c.emit('s2c:openCraftTable', {});
    return;
  }
  if (blockId === B.FURNACE) {
    server.furnaceSystem.openFurnace(server, x, y, z);
    return;
  }
  if (blockId === B.CHEST) {
    server.chestSystem.tryOpen(x, y, z);
    return;
  }
}
