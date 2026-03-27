import type { Player } from './Player';

export interface TestStep {
  name: string;
  action: (player: Player) => void | Promise<void>;
  verify?: (player: Player) => boolean | Promise<boolean>;
  timeout?: number;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

export class GameTestRunner {
  private results: TestResult[] = [];

  async runTests(player: Player, tests: TestStep[]): Promise<TestResult[]> {
    this.results = [];
    for (const test of tests) {
      const start = performance.now();
      try {
        await test.action(player);
        if (test.verify) {
          const timeout = test.timeout ?? 2000;
          const passed = await this.waitFor(() => test.verify!(player), timeout);
          this.results.push({ name: test.name, passed, duration: performance.now() - start, error: passed ? undefined : 'Verification failed' });
        } else {
          this.results.push({ name: test.name, passed: true, duration: performance.now() - start });
        }
      } catch (e: unknown) {
        this.results.push({ name: test.name, passed: false, error: (e as Error).message, duration: performance.now() - start });
      }
    }
    return this.results;
  }

  private waitFor(fn: () => boolean | Promise<boolean>, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = async () => {
        try {
          if (await fn()) { resolve(true); return; }
        } catch { /* ignore */ }
        if (Date.now() - start > timeout) { resolve(false); return; }
        setTimeout(check, 50);
      };
      check();
    });
  }
}

export function createBasicTests(): TestStep[] {
  return [
    { name: 'Player spawns above ground', action: () => {}, verify: (p) => p.position.y > 0 },
    { name: 'Player can select slots', action: (p) => { p.selectSlot(0); p.selectSlot(4); p.selectSlot(8); }, verify: (p) => p.selectedSlot === 8 },
    { name: 'Player can look around', action: (p) => { p.look(Math.PI / 4, 0); }, verify: (p) => Math.abs(p.yaw - Math.PI / 4) < 0.01 },
    { name: 'Player can chat', action: (p) => { p.chat('Hello World'); }, verify: () => true },
    { name: 'Player can execute /help command', action: (p) => { p.chat('/help'); }, verify: () => true },
    { name: 'Player can toggle fly', action: (p) => { p.executeCommand('fly'); }, verify: (p) => p.isFlying },
    { name: 'Left is left, right is right', action: (p) => {
      p.look(Math.PI / 2, 0);
      const dir = p.getLookDirection();
      if (dir.x > -0.9) throw new Error(`Expected x~-1 got ${dir.x}`);
    }},
    { name: 'Forward is forward', action: (p) => {
      p.look(0, 0);
      const dir = p.getLookDirection();
      if (dir.z > -0.9) throw new Error(`Expected z~-1 got ${dir.z}`);
    }},
  ];
}
