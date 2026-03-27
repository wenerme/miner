import { execSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_PORT = 63315;
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_IDLE_TIMEOUT_MS = 60_000;
const DEFAULT_HEARTBEAT_MS = 15_000;
const LOCK_FILE = path.resolve(process.cwd(), '.tmp/mineweb-vitest-browser-run.lock');

type RunnerLock = {
  pid: number;
  runId: string;
  startedAt: number;
  args: string[];
};

function listListeningPids(port: number): number[] {
  try {
    const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    if (!output) return [];
    return output
      .split('\n')
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

function killPids(pids: number[], signal: NodeJS.Signals = 'SIGTERM') {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      // ignore
    }
  }
}

function waitMs(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isPidAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock(args: string[]) {
  const runId = `${process.pid}-${Date.now()}`;
  mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  try {
    const raw = readFileSync(LOCK_FILE, 'utf8');
    const existing = JSON.parse(raw) as Partial<RunnerLock>;
    if (typeof existing.pid === 'number' && existing.pid > 0 && isPidAlive(existing.pid)) {
      throw new Error(
        `MineWeb Vitest browser runner already active (pid=${existing.pid}, runId=${existing.runId ?? 'unknown'})`,
      );
    }
    rmSync(LOCK_FILE, { force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      throw error;
    }
  }

  const lock: RunnerLock = {
    pid: process.pid,
    runId,
    startedAt: Date.now(),
    args,
  };
  writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2));
  return runId;
}

function releaseLock(runId: string) {
  try {
    const raw = readFileSync(LOCK_FILE, 'utf8');
    const lock = JSON.parse(raw) as Partial<RunnerLock>;
    if (lock.runId !== runId || lock.pid !== process.pid) {
      return;
    }
    rmSync(LOCK_FILE, { force: true });
  } catch {
    // ignore
  }
}

async function freePort(port: number) {
  const pids = listListeningPids(port);
  if (pids.length === 0) return;
  killPids(pids, 'SIGTERM');
  await waitMs(500);
  const stillListening = listListeningPids(port);
  if (stillListening.length > 0) {
    killPids(stillListening, 'SIGKILL');
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: tsx scripts/mineweb-vitest-browser-run.ts <test-file...>');
    process.exit(2);
  }

  const port = Number(process.env.MINEWEB_VITEST_BROWSER_PORT ?? DEFAULT_PORT);
  const timeoutMs = Number(process.env.MINEWEB_VITEST_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const idleTimeoutMs = Number(process.env.MINEWEB_VITEST_IDLE_TIMEOUT_MS ?? DEFAULT_IDLE_TIMEOUT_MS);
  const heartbeatMs = Number(process.env.MINEWEB_VITEST_HEARTBEAT_MS ?? DEFAULT_HEARTBEAT_MS);
  const runId = acquireLock(args);
  let finalized = false;
  let forcedExitCode: number | null = null;

  await freePort(port);

  const child = spawn(
    'pnpm',
    ['exec', 'vitest', 'run', '-c', 'vitest.browser.config.ts', ...args],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    },
  );
  let lastOutputAt = Date.now();
  const startedAt = Date.now();

  child.stdout?.on('data', (chunk) => {
    lastOutputAt = Date.now();
    process.stdout.write(chunk);
  });
  child.stderr?.on('data', (chunk) => {
    lastOutputAt = Date.now();
    process.stderr.write(chunk);
  });

  const timeout = setTimeout(() => {
    forcedExitCode = 124;
    console.error(`MineWeb Vitest browser run timed out after ${timeoutMs}ms (runId=${runId})`);
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
    setTimeout(async () => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      await finalize(forcedExitCode ?? 124);
    }, 2000);
  }, timeoutMs);

  const idleInterval = idleTimeoutMs > 0
    ? setInterval(() => {
        const idleMs = Date.now() - lastOutputAt;
        if (idleMs < idleTimeoutMs) return;
        forcedExitCode = 125;
        console.error(`MineWeb Vitest browser run idle timeout after ${idleMs}ms (runId=${runId})`);
        try {
          child.kill('SIGTERM');
        } catch {
          // ignore
        }
        setTimeout(async () => {
          try {
            child.kill('SIGKILL');
          } catch {
            // ignore
          }
          await finalize(forcedExitCode ?? 125);
        }, 2000);
      }, 1000)
    : null;

  const heartbeat = heartbeatMs > 0
    ? setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const idle = Date.now() - lastOutputAt;
        console.error(`[mineweb-vitest-browser-run] runId=${runId} elapsed=${elapsed}ms idle=${idle}ms`);
      }, heartbeatMs)
    : null;

  const finalize = async (code: number) => {
    if (finalized) return;
    finalized = true;
    clearTimeout(timeout);
    if (idleInterval) clearInterval(idleInterval);
    if (heartbeat) clearInterval(heartbeat);
    await freePort(port);
    releaseLock(runId);
    process.exit(code);
  };

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`Vitest browser process terminated by signal: ${signal}`);
      void finalize(forcedExitCode ?? 1);
      return;
    }
    void finalize(forcedExitCode ?? (code ?? 1));
  });

  child.on('error', (error) => {
    console.error(error);
    void finalize(1);
  });

  const signalHandler = (signal: NodeJS.Signals) => {
    forcedExitCode = 130;
    console.error(`MineWeb Vitest browser runner got ${signal}, shutting down...`);
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
    setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      void finalize(forcedExitCode ?? 130);
    }, 1500);
  };
  process.on('SIGINT', signalHandler);
  process.on('SIGTERM', signalHandler);
}

void main();
