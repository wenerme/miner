import type { GameServer } from '../GameServer';

export interface CommandContext {
  server: GameServer;
  args: string[];
  reply: (message: string) => void;
}

export type CommandFn = (ctx: CommandContext) => void;

export type RegisterCommandFn = (
  name: string,
  fn: CommandFn,
  options?: { devOnly?: boolean },
) => void;
