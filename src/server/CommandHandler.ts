import { isMineWebDevEnv } from '#/common/runtimeEnv';
import type { GameServer } from './GameServer';
import { CommandRegistry } from './commands/CommandRegistry';
import type { CommandContext } from './commands/commandTypes';
import { registerInventoryCommands } from './commands/registerInventoryCommands';
import { registerEntityCommands } from './commands/registerEntityCommands';
import { registerPlayerCommands } from './commands/registerPlayerCommands';
import { registerWorldCommands } from './commands/registerWorldCommands';

function parseStateValue(raw: string): string | number | boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  return Number.isNaN(num) ? raw : num;
}

function createCommandRegistry() {
  const registry = new CommandRegistry();
  const registerCommand = (name: string, fn: (ctx: CommandContext) => void, options?: { devOnly?: boolean }) => {
    registry.register(name, fn, options);
  };

  registerEntityCommands({
    registerCommand,
    parseStateValue,
  });
  registerPlayerCommands({ registerCommand });
  registerInventoryCommands({ registerCommand });
  registerWorldCommands({
    registerCommand,
    parseStateValue,
  });
  registerCommand('help', (ctx) => {
    const cmds = registry.listVisibleCommandNames(isMineWebDevEnv())
      .sort()
      .join(', ');
    ctx.reply(`§aCommands: /${cmds}`);
  });

  return registry;
}

const commands = createCommandRegistry();

export function registerMineWebCommand(
  name: string,
  fn: (ctx: CommandContext) => void,
  options?: { devOnly?: boolean },
) {
  commands.register(name, fn, options);
}

export function handleCommand(cmd: string, server: GameServer): void {
  const parts = cmd.trim().split(/\s+/);
  const name = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  const reply = (message: string) => {
    server.addChatMessage('§7[Server]', message);
  };

  const commandName = name ?? '';
  const result = commands.run(commandName, { server, args, reply }, { isDevEnv: isMineWebDevEnv() });
  if (result.ok) {
    return;
  }
  if (result.reason === 'dev-only') {
    reply(`§c/${name} is only available in dev mode`);
    return;
  }
  if (result.reason === 'missing') {
    reply(`§cUnknown command: /${name}. Type /help for commands.`);
  }
}
