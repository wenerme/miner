export type TickDriver = {
  start(callback: (dt: number) => void, intervalMs: number): void;
  stop(): void;
};

export function createBrowserTickDriver(): TickDriver {
  let handle: ReturnType<typeof globalThis.setInterval> | null = null;
  let lastTime = 0;
  return {
    start(callback, intervalMs) {
      lastTime = globalThis.performance.now();
      handle = globalThis.setInterval(() => {
        const now = globalThis.performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        callback(dt);
      }, intervalMs);
    },
    stop() {
      if (handle != null) {
        globalThis.clearInterval(handle);
        handle = null;
      }
    },
  };
}

export function createManualTickDriver(): TickDriver {
  return {
    start() {
      /* no-op, caller uses tick() directly */
    },
    stop() {},
  };
}
