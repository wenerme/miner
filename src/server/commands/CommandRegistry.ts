import type { CommandContext, CommandFn } from './commandTypes';

export interface RegisteredCommand {
  run: CommandFn;
  devOnly: boolean;
}

export class CommandRegistry {
  private readonly commands = new Map<string, RegisteredCommand>();

  register(name: string, fn: CommandFn, options?: { devOnly?: boolean }) {
    this.commands.set(name, {
      run: fn,
      devOnly: options?.devOnly === true,
    });
  }

  get(name: string) {
    return this.commands.get(name);
  }

  listVisibleCommandNames(isDevEnv: boolean) {
    return Array.from(this.commands.entries())
      .filter(([, info]) => !info.devOnly || isDevEnv)
      .map(([name]) => name)
      .sort();
  }

  run(name: string, ctx: CommandContext, options: { isDevEnv: boolean }) {
    const handler = this.commands.get(name);
    if (!handler) return { ok: false, reason: 'missing' as const };
    if (handler.devOnly && !options.isDevEnv) return { ok: false, reason: 'dev-only' as const };
    handler.run(ctx);
    return { ok: true, reason: 'ok' as const };
  }
}
