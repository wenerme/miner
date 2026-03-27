import type { RegisterCommandFn } from './commandTypes';

export function registerInventoryCommands(input: { registerCommand: RegisterCommandFn }) {
  const { registerCommand } = input;

  registerCommand('give', (ctx) => {
    const [itemIdStr, countStr] = ctx.args;
    const itemId = Number(itemIdStr);
    const count = Number(countStr) || 1;
    if (Number.isNaN(itemId)) {
      ctx.reply('§cUsage: /give <itemId> [count]');
      return;
    }
    ctx.server.inventory.addItem(itemId, count);
    ctx.server.syncInventory();
    ctx.reply(`§aGave ${count}x item ${itemId}`);
  });

  registerCommand('clear', (ctx) => {
    for (let i = 0; i < ctx.server.inventory.size; i++) {
      ctx.server.inventory.slots[i] = null;
    }
    ctx.server.syncInventory();
    ctx.reply('§aInventory cleared');
  });

  registerCommand('swaphand', (ctx) => {
    ctx.server.inventory.swapSelectedWithOffhand();
    ctx.server.syncInventory();
    ctx.reply('§aSwapped selected slot with offhand');
  });

  registerCommand('offhand', (ctx) => {
    const [itemIdStr, countStr] = ctx.args;
    if (!itemIdStr) {
      const current = ctx.server.inventory.offhand;
      if (!current) {
        ctx.reply('§7Offhand: empty');
        return;
      }
      ctx.reply(`§aOffhand: ${current.count}x item ${current.itemId}`);
      return;
    }
    if (itemIdStr === 'clear') {
      ctx.server.inventory.offhand = null;
      ctx.server.syncInventory();
      ctx.reply('§aOffhand cleared');
      return;
    }
    const itemId = Number(itemIdStr);
    const count = Number(countStr ?? '1');
    if (Number.isNaN(itemId) || Number.isNaN(count) || count <= 0) {
      ctx.reply('§cUsage: /offhand <itemId> [count] | /offhand clear');
      return;
    }
    ctx.server.inventory.offhand = { itemId, count: Math.floor(count) };
    ctx.server.syncInventory();
    ctx.reply(`§aOffhand set to ${Math.floor(count)}x item ${itemId}`);
  });
}
