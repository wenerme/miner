export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  default: boolean;
  command?: string;
}

const BUILTIN_ABILITIES: AbilityDef[] = [
  { id: 'fly', name: 'Fly', description: 'Free movement without gravity', default: false, command: 'fly' },
  { id: 'fast', name: 'Fast', description: 'Move at increased speed', default: false, command: 'fast' },
  { id: 'noclip', name: 'Noclip', description: 'Pass through solid blocks', default: false, command: 'noclip' },
  { id: 'creative', name: 'Creative', description: 'Unlimited blocks, no breaking delay', default: false, command: 'gamemode' },
];

export class AbilityManager {
  private defs = new Map<string, AbilityDef>();
  private state = new Map<string, boolean>();

  constructor() {
    for (const def of BUILTIN_ABILITIES) {
      this.register(def);
    }
  }

  register(def: AbilityDef) {
    this.defs.set(def.id, def);
    if (!this.state.has(def.id)) {
      this.state.set(def.id, def.default);
    }
  }

  has(id: string): boolean {
    return this.state.get(id) ?? false;
  }

  set(id: string, enabled: boolean) {
    this.state.set(id, enabled);
  }

  toggle(id: string): boolean {
    const next = !this.has(id);
    this.state.set(id, next);
    return next;
  }

  getAll(): Array<{ id: string; name: string; enabled: boolean }> {
    return Array.from(this.defs.values()).map((def) => ({
      id: def.id,
      name: def.name,
      enabled: this.has(def.id),
    }));
  }

  findByCommand(command: string): AbilityDef | undefined {
    for (const def of this.defs.values()) {
      if (def.command === command) return def;
    }
    return undefined;
  }

  snapshot(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const [id, val] of this.state) out[id] = val;
    return out;
  }

  restore(data: Record<string, boolean>) {
    for (const [id, val] of Object.entries(data)) {
      this.state.set(id, val);
    }
  }
}
