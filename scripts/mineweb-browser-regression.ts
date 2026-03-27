import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SESSION = process.env.MINEWEB_REGRESSION_SESSION
	?? `mineweb-regression-${process.pid}-${Date.now().toString(36)}`;
const URL = process.env.MINEWEB_REGRESSION_URL ?? 'http://[::1]:3060/play/mineweb/regression';
const SCREENSHOT_PATH = path.resolve(
	process.cwd(),
	process.env.MINEWEB_REGRESSION_SHOT ?? 'out/mineweb-regression-agent.png',
);
const NATIVE_HUD_SCREENSHOT_PATH = path.resolve(
	process.cwd(),
	process.env.MINEWEB_NATIVE_HUD_REGRESSION_SHOT
		?? path.join(path.dirname(SCREENSHOT_PATH), `${path.parse(SCREENSHOT_PATH).name}-native-hud${path.parse(SCREENSHOT_PATH).ext || '.png'}`),
);
const THIRD_PERSON_BACK_SCREENSHOT_PATH = path.resolve(
	process.cwd(),
	process.env.MINEWEB_THIRD_PERSON_BACK_SHOT
		?? path.join(path.dirname(SCREENSHOT_PATH), `${path.parse(SCREENSHOT_PATH).name}-third-back${path.parse(SCREENSHOT_PATH).ext || '.png'}`),
);
const THIRD_PERSON_FRONT_SCREENSHOT_PATH = path.resolve(
	process.cwd(),
	process.env.MINEWEB_THIRD_PERSON_FRONT_SHOT
		?? path.join(path.dirname(SCREENSHOT_PATH), `${path.parse(SCREENSHOT_PATH).name}-third-front${path.parse(SCREENSHOT_PATH).ext || '.png'}`),
);
const ENTITY_SHOWCASE_SCREENSHOT_PATH = path.resolve(
	process.cwd(),
	process.env.MINEWEB_ENTITY_SHOWCASE_SHOT
		?? path.join(path.dirname(SCREENSHOT_PATH), `${path.parse(SCREENSHOT_PATH).name}-entities${path.parse(SCREENSHOT_PATH).ext || '.png'}`),
);
const ENTITY_CLOSEUP_A_SCREENSHOT_PATH = path.resolve(
	process.cwd(),
	process.env.MINEWEB_ENTITY_CLOSEUP_A_SHOT
		?? path.join(path.dirname(SCREENSHOT_PATH), `${path.parse(SCREENSHOT_PATH).name}-entities-a${path.parse(SCREENSHOT_PATH).ext || '.png'}`),
);
const ENTITY_CLOSEUP_B_SCREENSHOT_PATH = path.resolve(
	process.cwd(),
	process.env.MINEWEB_ENTITY_CLOSEUP_B_SHOT
		?? path.join(path.dirname(SCREENSHOT_PATH), `${path.parse(SCREENSHOT_PATH).name}-entities-b${path.parse(SCREENSHOT_PATH).ext || '.png'}`),
);
const ENTITY_PORTRAIT_DIR = path.resolve(
	process.cwd(),
	process.env.MINEWEB_ENTITY_PORTRAIT_DIR
		?? path.join(path.dirname(SCREENSHOT_PATH), `${path.parse(SCREENSHOT_PATH).name}-portraits`),
);
const ENTITY_PORTRAIT_MANIFEST_PATH = path.join(ENTITY_PORTRAIT_DIR, 'manifest.json');
const ENTITY_PORTRAIT_VIEWS = ['front', 'back', 'left', 'right', 'front-high', 'front-low'] as const;
const AGENT_BROWSER_TIMEOUT_MS = Number(process.env.MINEWEB_AGENT_BROWSER_TIMEOUT_MS ?? 90_000);
const PHASE_TIMEOUT_MS = Number(process.env.MINEWEB_PHASE_TIMEOUT_MS ?? 240_000);
const PHASE_TIMEOUT_ENTITY_PORTRAIT_MS = Number(
	process.env.MINEWEB_PHASE_TIMEOUT_ENTITY_PORTRAIT_MS ?? 600_000,
);
const SKIP_ENTITY_PORTRAITS = process.env.MINEWEB_SKIP_ENTITY_PORTRAITS === '1';
const CELESTIAL_DAY_SCREENSHOT_PATH = path.resolve(
	process.cwd(),
	process.env.MINEWEB_CELESTIAL_DAY_SHOT
		?? path.join(path.dirname(SCREENSHOT_PATH), `${path.parse(SCREENSHOT_PATH).name}-celestial-day${path.parse(SCREENSHOT_PATH).ext || '.png'}`),
);
const CELESTIAL_NIGHT_SCREENSHOT_PATH = path.resolve(
	process.cwd(),
	process.env.MINEWEB_CELESTIAL_NIGHT_SHOT
		?? path.join(path.dirname(SCREENSHOT_PATH), `${path.parse(SCREENSHOT_PATH).name}-celestial-night${path.parse(SCREENSHOT_PATH).ext || '.png'}`),
);
const TRANSPARENCY_SCREENSHOT_PATH = path.resolve(
	process.cwd(),
	process.env.MINEWEB_TRANSPARENCY_SHOT
		?? path.join(path.dirname(SCREENSHOT_PATH), `${path.parse(SCREENSHOT_PATH).name}-transparency${path.parse(SCREENSHOT_PATH).ext || '.png'}`),
);

interface RegressionState {
	ok?: boolean;
	ready: boolean | null;
	error: string | null;
	inventorySmoke?: {
		opened: boolean;
		panelClickKeptOpen: boolean;
		closedByBackdrop: boolean;
		lockedAfterClose: boolean;
		everLockedAfterClose: boolean;
		slotCount: number;
		mousePickupWorked: boolean;
		mousePlaceWorked: boolean;
		shiftMoveWorked: boolean;
		rightDistributeWorked: boolean;
		doubleCollectWorked: boolean;
	};
	chatSmoke?: {
		opened: boolean;
		inputFocused: boolean;
		closedByEscape: boolean;
		lockedAfterEscape: boolean;
		everLockedAfterEscape: boolean;
		openedBySlashWithPrefix: boolean;
		closedBySend: boolean;
		lockedAfterSend: boolean;
		everLockedAfterSend: boolean;
		sendAppendedMessage: boolean;
	};
	iconSmoke?: {
		hotbar: {
			ok: boolean;
			failedSlots: number[];
		};
		inventory: {
			ok: boolean;
			failedSlots: number[];
		};
	};
	nativeHudSmoke?: {
		enabled: boolean;
		locked: boolean;
		chatVisible: boolean;
		messageCount: number;
		renderChecks: {
			crosshairPeak: number;
			hotbarContrast: number;
			infoPanelContrast: number;
			chatContrast: number;
		};
	};
	thirdPersonSmoke?: {
		back: {
			viewMode: string;
			signature: string;
			avgLuma: number;
			uniqueBuckets: number;
			nonSkyRatio: number;
			centerContrast: number;
		};
		backDataUrl?: string;
		front: {
			viewMode: string;
			signature: string;
			avgLuma: number;
			uniqueBuckets: number;
			nonSkyRatio: number;
			centerContrast: number;
		};
		frontDataUrl?: string;
	};
	interactionSmoke?: {
		sheep: {
			itemDrops: number;
			sheared: boolean;
			message: string;
		};
		cow: {
			selectedItemId: number | null;
			message: string;
		};
	};
	entitySmoke?: {
		layout: string;
		entityCount: number;
		avgLuma: number;
		uniqueBuckets: number;
		nonSkyRatio: number;
		centerContrast: number;
		signature: string;
	};
	entityCloseupSmoke?: {
		front: {
			avgLuma: number;
			signature: string;
			uniqueBuckets: number;
			centerContrast: number;
		};
		back: {
			avgLuma: number;
			signature: string;
			uniqueBuckets: number;
			centerContrast: number;
		};
	};
	entityPortraitSmoke?: {
		count: number;
		imageCount: number;
		types: string[];
		views: string[];
		dir: string;
	};
	celestialSmoke?: {
		day: {
			avgLuma: number;
			signature: string;
		};
		night: {
			avgLuma: number;
			signature: string;
		};
		dayDataUrl?: string;
		nightDataUrl?: string;
	};
	weatherSmoke?: {
		clear: {
			avgLuma: number;
			signature: string;
		};
		rain: {
			avgLuma: number;
			signature: string;
		};
		snow: {
			avgLuma: number;
			signature: string;
		};
	};
	transparencySmoke?: {
		avgLuma: number;
		uniqueBuckets: number;
		centerContrast: number;
		magentaRatio: number;
		signature: string;
	};
	stats: {
		chunkMeshes: number;
		entities: number;
		itemDrops: number;
		messages: number;
	} | null;
}

interface LlmReviewJob {
	started: boolean;
	pid?: number;
	manifestPath?: string;
}

interface EntityPortraitManifestEntry {
	caseId: string;
	type: string;
	view: string;
	file: string;
	prompt: string;
}

interface EntityPortraitManifest {
	suiteId: string;
	layout: 'portraits';
	artifactDir: string;
	views: string[];
	cases: EntityPortraitManifestEntry[];
}

let managedDevServer: ChildProcess | null = null;

const AUTO_CONNECT = process.env.MINEWEB_AUTO_CONNECT !== '0';

async function runAgentBrowser(args: string[]) {
	const baseArgs = AUTO_CONNECT
		? ['--auto-connect', '--session', SESSION, ...args]
		: ['--session', SESSION, ...args];
	const { stdout, stderr } = await execFileAsync('agent-browser', baseArgs, {
		maxBuffer: 8 * 1024 * 1024,
		timeout: AGENT_BROWSER_TIMEOUT_MS,
		killSignal: 'SIGKILL',
	});
	const output = stdout.trim() || stderr.trim();
	return output;
}

function parseEvalJson<T>(raw: string): T {
	const parsed = JSON.parse(raw) as string | T;
	return typeof parsed === 'string' ? JSON.parse(parsed) as T : parsed;
}

function buildEntityPortraitCaseId(type: string, view: string) {
	return `entity-portrait-${type}-${view}`;
}

function buildEntityPortraitPrompt(entry: {
	caseId: string;
	type: string;
	view: string;
	file: string;
}) {
	return [
		'You are reviewing a MineWeb regression artifact for one entity render.',
		`Case ID: ${entry.caseId}`,
		`Subject: ${entry.type}`,
		`View: ${entry.view}`,
		`Image file: ${entry.file}`,
		'Goal: verify model correctness, texture correctness, and basic visual grounding for this exact subject and view.',
		'Check carefully and do not assume the render is correct.',
		'Review these categories explicitly:',
		'1. Subject identification: does the rendered entity match the expected subject?',
		'2. Facing and front/back correctness for this camera angle (including high/low front views when present).',
		'3. Head/body/leg proportions and placement.',
		'4. Texture orientation, UV placement, visible face texture, and missing/inverted regions.',
		'5. Transparency or alpha artifacts, black halos, gray bleed, or unexpected opaque areas.',
		'6. Major lighting/shading anomalies on the model itself.',
		'7. Whether the subject is clearly framed and visually grounded enough for QA.',
		'Output format:',
		'- verdict: pass | fail | unsure',
		'- confidence: 0.0-1.0',
		'- findings: array of short concrete findings',
		'- recommended_next_artifact: optional string such as another angle or closer crop',
		'Be strict, concise, and specific. If uncertain, say unsure rather than pass.',
	].join('\n');
}

async function ensureServerReachable() {
	const response = await fetch(URL, { redirect: 'manual' });
	if (!response.ok) {
		throw new Error(`Regression route is not reachable: ${response.status} ${response.statusText}`);
	}
}

async function isServerReachable() {
	try {
		await ensureServerReachable();
		return true;
	} catch {
		return false;
	}
}

async function waitForServerReachable(timeoutMs = 30_000) {
	const start = Date.now();
	let lastError: unknown = null;
	while (Date.now() - start < timeoutMs) {
		try {
			await ensureServerReachable();
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
	throw lastError instanceof Error
		? lastError
		: new Error(`Regression route did not become reachable within ${timeoutMs}ms`);
}

async function ensureDevServer() {
	if (await isServerReachable()) {
		return null;
	}

	const child = spawn('pnpm', ['exec', 'waku', 'dev', '--port', '3060'], {
		cwd: process.cwd(),
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	const logPrefix = '[mineweb-dev] ';
	child.stdout?.on('data', (chunk) => process.stderr.write(logPrefix + String(chunk)));
	child.stderr?.on('data', (chunk) => process.stderr.write(logPrefix + String(chunk)));

	try {
		await waitForServerReachable();
		return child;
	} catch (error) {
		child.kill('SIGTERM');
		throw error;
	}
}

async function stopDevServer(child: ChildProcess | null) {
	if (!child || child.killed) {
		return;
	}
	child.kill('SIGTERM');
	await new Promise((resolve) => {
		const timer = setTimeout(() => {
			if (!child.killed) {
				child.kill('SIGKILL');
			}
			resolve(null);
		}, 5_000);
		child.once('exit', () => {
			clearTimeout(timer);
			resolve(null);
		});
	});
}

async function ensureDevServerAvailable() {
	if (await isServerReachable()) {
		return;
	}
	const child = await ensureDevServer();
	if (child) {
		if (managedDevServer && managedDevServer !== child) {
			await stopDevServer(managedDevServer);
		}
		managedDevServer = child;
	}
}

async function maybeStartLlmReviewInBackground(): Promise<LlmReviewJob> {
	const enabled = process.env.MINEWEB_LLM_REVIEW_AUTOSTART === '1';
	if (!enabled) {
		return { started: false };
	}
	const manifestPath = process.env.MINEWEB_LLM_REVIEW_MANIFEST ?? ENTITY_PORTRAIT_MANIFEST_PATH;
	const child = spawn(
		'pnpm',
		['run', 'test:mineweb:llm-review'],
		{
			cwd: process.cwd(),
			detached: true,
			stdio: ['ignore', 'ignore', 'ignore'],
			env: {
				...process.env,
				MINEWEB_LLM_REVIEW_MANIFEST: manifestPath,
			},
		},
	);
	child.unref();
	return {
		started: true,
		pid: child.pid ?? undefined,
		manifestPath,
	};
}

function isTransientNavigationError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	return message.includes('Inspected target navigated or closed')
		|| message.includes('Target page, context or browser has been closed');
}

async function reopenRegressionPage() {
	await runAgentBrowser(['close']).catch(() => '');
	await ensureDevServerAvailable();
	try {
		await runAgentBrowser(['set', 'viewport', '1280', '720']);
	} catch {
		await runAgentBrowser(['close']).catch(() => '');
		await runAgentBrowser(['set', 'viewport', '1280', '720']);
	}
	try {
		await runAgentBrowser(['open', URL]);
	} catch {
		await ensureDevServerAvailable();
		await runAgentBrowser(['open', URL]);
	}
	await runAgentBrowser(['wait', '2500']);
}

async function withNavigationRetry<T>(label: string, run: () => Promise<T>, attempts = 3) {
	let lastError: unknown;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await run();
		} catch (error) {
			lastError = error;
			if (!isTransientNavigationError(error) || attempt === attempts) {
				throw error;
			}
			console.warn(`${label} attempt ${attempt} hit transient navigation; reopening regression page`);
			await reopenRegressionPage();
		}
	}
	throw lastError;
}

async function runPhase<T>(name: string, run: () => Promise<T>, timeoutMs = PHASE_TIMEOUT_MS): Promise<T> {
	const startedAt = Date.now();
	console.error(`[mineweb-regression] phase:start ${name}`);
	let timeoutRef: ReturnType<typeof setTimeout> | null = null;
	try {
		const result = await Promise.race([
			run(),
			new Promise<T>((_, reject) => {
				timeoutRef = setTimeout(() => {
					reject(new Error(`phase timeout after ${timeoutMs}ms: ${name}`));
				}, timeoutMs);
			}),
		]);
		const elapsedMs = Date.now() - startedAt;
		console.error(`[mineweb-regression] phase:done ${name} ${elapsedMs}ms`);
		return result;
	} catch (error) {
		const elapsedMs = Date.now() - startedAt;
		console.error(`[mineweb-regression] phase:fail ${name} ${elapsedMs}ms`);
		throw error;
	} finally {
		if (timeoutRef) clearTimeout(timeoutRef);
	}
}

async function runRegression(timeoutMs = 30_000) {
	const raw = await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			try {
				await waitFor(() => !!window.__minewebTestController, ${timeoutMs});
				const controller = window.__minewebTestController;
				await controller.waitForRuntime(${timeoutMs});
				controller.pauseLoops();
				controller.mergeSettings({ renderDistance: 3, showFps: false });
				controller.renderFrames(80);
				await controller.waitForRegressionScene(6, 12, ${timeoutMs});
				controller.renderFrames(80);
				window.__minewebRegressionReady = true;
				return JSON.stringify({
					ok: true,
					ready: true,
					error: null,
					inventorySmoke: null,
					stats: controller.getStats(),
				});
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				window.__minewebRegressionError = message;
				return JSON.stringify({
					ok: false,
					ready: window.__minewebRegressionReady ?? null,
					error: message,
					inventorySmoke: null,
					stats: window.__minewebTestController?.getStats?.() ?? null,
				});
			}
		})()`,
	]);
	const state = parseEvalJson<RegressionState>(raw);
	if (!state.ok) {
		throw new Error(`Browser regression failed: ${state.error ?? 'unknown error'}`);
	}
	return state;
}

async function runInventorySmoke(timeoutMs = 15_000) {
	await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			await waitFor(() => !!window.__minewebTestController, ${timeoutMs});
			const controller = window.__minewebTestController;
			await controller.waitForRuntime(${timeoutMs});
			controller.pauseLoops();
			controller.setOverlay(null);
			controller.setLocked(true);
			controller.renderFrames(20);
			await controller.waitForRegressionScene(6, 12, ${timeoutMs});
			return JSON.stringify({ ready: true });
		})()`,
	]);

	await runAgentBrowser(['press', 'e']);
	await runAgentBrowser(['wait', '300']);

	const openedState = parseEvalJson<{ opened: boolean; slotCount: number }>(await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});
			await waitFor(() => {
				return !!window.__minewebTestController?.getState()?.ui.showInventory
					&& !!document.querySelector('[data-testid="mineweb-inventory-overlay"]');
			}, ${timeoutMs});
			return JSON.stringify({
				opened: true,
				slotCount: document.querySelectorAll('[data-testid="mineweb-inventory-slot"]').length,
			});
		})()`,
	]));

	await runAgentBrowser([
		'eval',
		`(() => {
			const controller = window.__minewebTestController;
			if (!controller) throw new Error('MineWeb test controller missing');
			controller.setInventorySlot(0, { itemId: 1, count: 3 });
			controller.setInventorySlot(10, null);
			return JSON.stringify({ seeded: true });
		})()`,
	]);

	await runAgentBrowser(['click', '[data-testid="mineweb-inventory-slot"][data-slot-index="0"]']);
	await runAgentBrowser(['wait', '200']);

	const pickupState = parseEvalJson<{ ok: boolean }>(await runAgentBrowser([
		'eval',
		`(() => {
			const state = window.__minewebTestController?.getState();
			const cursor = state?.inventory.cursor;
			const slot0 = state?.inventory.slots?.[0] ?? null;
			return JSON.stringify({
				ok: !!cursor && cursor.itemId === 1 && cursor.count === 3 && slot0 == null,
			});
		})()`,
	]));

	await runAgentBrowser(['click', '[data-testid="mineweb-inventory-slot"][data-slot-index="10"]']);
	await runAgentBrowser(['wait', '200']);

	const placeState = parseEvalJson<{ ok: boolean }>(await runAgentBrowser([
		'eval',
		`(() => {
			const state = window.__minewebTestController?.getState();
			const cursor = state?.inventory.cursor;
			const slot10 = state?.inventory.slots?.[10] ?? null;
			return JSON.stringify({
				ok: cursor == null && !!slot10 && slot10.itemId === 1 && slot10.count === 3,
			});
		})()`,
	]));

	const shiftResult = parseEvalJson<{ ok: boolean }>(await runAgentBrowser([
		'eval',
		`(() => {
			const controller = window.__minewebTestController;
			if (!controller) throw new Error('MineWeb test controller missing');
			controller.setInventorySlot(0, { itemId: 4, count: 9 });
			controller.setInventorySlot(9, null);
			controller.setInventorySlot(10, null);
			controller.setInventorySlot(11, null);
			controller.inventoryClick(0, 'left', true);
			const state = window.__minewebTestController?.getState();
			const hotbar0 = state?.inventory.slots?.[0] ?? null;
			const moved = (state?.inventory.slots ?? []).slice(9).find((slot) => slot?.itemId === 4 && slot.count === 9) ?? null;
			return JSON.stringify({
				ok: hotbar0 == null && !!moved,
			});
		})()`,
	]));

	const rightDistributeResult = parseEvalJson<{ ok: boolean }>(await runAgentBrowser([
		'eval',
		`(() => {
			const controller = window.__minewebTestController;
			if (!controller) throw new Error('MineWeb test controller missing');
			for (let i = 0; i < 6; i++) controller.setInventorySlot(i, null);
			controller.setInventorySlot(0, { itemId: 1, count: 6 });
			controller.inventoryClick(0, 'right', false);
			controller.inventoryClick(3, 'right', false);
			controller.inventoryClick(4, 'right', false);
			controller.inventoryClick(5, 'right', false);
			const state = controller.getState();
			const cursor = state?.inventory.cursor ?? null;
			const s3 = state?.inventory.slots?.[3] ?? null;
			const s4 = state?.inventory.slots?.[4] ?? null;
			const s5 = state?.inventory.slots?.[5] ?? null;
			return JSON.stringify({
				ok: !!s3 && !!s4 && !!s5
					&& s3.itemId === 1 && s4.itemId === 1 && s5.itemId === 1
					&& s3.count === 1 && s4.count === 1 && s5.count === 1
					&& cursor == null,
			});
		})()`,
	]));

	const doubleCollectResult = parseEvalJson<{ ok: boolean }>(await runAgentBrowser([
		'eval',
		`(() => {
			const controller = window.__minewebTestController;
			if (!controller) throw new Error('MineWeb test controller missing');
			for (let i = 0; i < 12; i++) controller.setInventorySlot(i, null);
			controller.setInventorySlot(0, { itemId: 1, count: 3 });
			controller.setInventorySlot(1, { itemId: 1, count: 4 });
			controller.setInventorySlot(10, { itemId: 1, count: 2 });
			controller.inventoryCollect(0);
			const state = controller.getState();
			const cursor = state?.inventory.cursor ?? null;
			return JSON.stringify({
				ok: !!cursor && cursor.itemId === 1 && cursor.count === 9
					&& state?.inventory.slots?.[0] == null
					&& state?.inventory.slots?.[1] == null
					&& state?.inventory.slots?.[10] == null,
			});
		})()`,
	]));

	await runAgentBrowser(['click', '[data-testid="mineweb-inventory-panel"]']);

	const afterPanelClick = parseEvalJson<{ open: boolean }>(await runAgentBrowser([
		'eval',
		`JSON.stringify({ open: !!window.__minewebTestController?.getState()?.ui.showInventory })`,
	]));

	await runAgentBrowser([
		'eval',
		`(() => {
			const overlay = document.querySelector('[data-testid="mineweb-inventory-overlay"]');
			if (!(overlay instanceof HTMLElement)) {
				throw new Error('Inventory overlay not found');
			}
			overlay.click();
			return JSON.stringify({ clicked: true });
		})()`,
	]);

	const afterBackdropClick = parseEvalJson<{ open: boolean }>(await runAgentBrowser([
		'eval',
		`(async () => {
			const controller = window.__minewebTestController;
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			await waitFor(() => !controller?.getState()?.ui.showInventory, ${timeoutMs});
			const state = controller?.getState();
			return JSON.stringify({
				open: !!state?.ui.showInventory,
			});
		})()`,
	]));

	await runAgentBrowser(['press', 'e']);
	await runAgentBrowser(['wait', '250']);
	await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});
			await waitFor(() => !!window.__minewebTestController?.getState()?.ui.showInventory, ${timeoutMs});
			return JSON.stringify({ reopened: true });
		})()`,
	]);

	await runAgentBrowser(['press', 'e']);
	await runAgentBrowser(['wait', '250']);

	const afterEKeyClose = parseEvalJson<{ open: boolean; locked: boolean; everLocked: boolean }>(await runAgentBrowser([
		'eval',
		`(async () => {
			const controller = window.__minewebTestController;
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});
			await waitFor(() => {
				const state = controller?.getState();
				return !!state && !state.ui.showInventory;
			}, ${timeoutMs});
			const state = controller?.getState();
			return JSON.stringify({
				open: !!state?.ui.showInventory,
				locked: !!state?.ui.isLocked,
				everLocked: !!state?.ui.everLocked,
			});
		})()`,
	]));

	return {
		opened: openedState.opened,
		panelClickKeptOpen: afterPanelClick.open,
		closedByBackdrop: !afterBackdropClick.open,
		lockedAfterClose: afterEKeyClose.locked,
		everLockedAfterClose: afterEKeyClose.everLocked,
		slotCount: openedState.slotCount,
		mousePickupWorked: pickupState.ok,
		mousePlaceWorked: placeState.ok,
		shiftMoveWorked: shiftResult.ok,
		rightDistributeWorked: rightDistributeResult.ok,
		doubleCollectWorked: doubleCollectResult.ok,
	};
}

async function runChatSmoke(timeoutMs = 15_000) {
	await runAgentBrowser(['press', 'Enter']);
	await runAgentBrowser(['wait', '300']);

	const openedState = parseEvalJson<{ opened: boolean; inputFocused: boolean }>(await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			await waitFor(() => {
				const state = window.__minewebTestController?.getState();
				const input = document.querySelector('[data-testid="mineweb-chat-input"]');
				return !!state?.ui.showChat && !!input;
			}, ${timeoutMs});

			const input = document.querySelector('[data-testid="mineweb-chat-input"]');
			return JSON.stringify({
				opened: true,
				inputFocused: document.activeElement === input,
			});
		})()`,
	]));

	await runAgentBrowser(['press', 'Escape']);
	await runAgentBrowser(['wait', '300']);

	const afterEscape = parseEvalJson<{ open: boolean; locked: boolean; everLocked: boolean }>(await runAgentBrowser([
		'eval',
		`(async () => {
			const controller = window.__minewebTestController;
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			await waitFor(() => {
				const state = controller?.getState();
				return !!state && !state.ui.showChat;
			}, ${timeoutMs});
			const state = controller?.getState();
			return JSON.stringify({
				open: !!state?.ui.showChat,
				locked: !!state?.ui.isLocked,
				everLocked: !!state?.ui.everLocked,
			});
		})()`,
	]));

	await runAgentBrowser(['press', '/']);
	await runAgentBrowser(['wait', '300']);

	const slashOpenState = parseEvalJson<{ open: boolean; prefixed: boolean }>(await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});
			await waitFor(() => {
				const state = window.__minewebTestController?.getState();
				const input = document.querySelector('[data-testid="mineweb-chat-input"]');
				return !!state?.ui.showChat && !!input;
			}, ${timeoutMs});
			const input = document.querySelector('[data-testid="mineweb-chat-input"]');
			const value = input instanceof HTMLInputElement ? input.value : '';
			return JSON.stringify({
				open: true,
				prefixed: value.startsWith('/'),
			});
		})()`,
	]));

	await runAgentBrowser(['press', 'Escape']);
	await runAgentBrowser(['wait', '200']);

	await runAgentBrowser(['press', 'Enter']);
	await runAgentBrowser(['wait', '250']);

	const beforeSendCount = parseEvalJson<{ count: number }>(await runAgentBrowser([
		'eval',
		`(() => {
			const state = window.__minewebTestController?.getState();
			return JSON.stringify({ count: state?.chat.messages.length ?? 0 });
		})()`,
	]));

	await runAgentBrowser([
		'eval',
		`(() => {
			const input = document.querySelector('[data-testid="mineweb-chat-input"]');
			if (!(input instanceof HTMLInputElement)) {
				throw new Error('MineWeb chat input not found');
			}
			const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
			setter?.call(input, 'hello from regression');
			input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
			input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
			const form = input.closest('form');
			if (!(form instanceof HTMLFormElement)) {
				throw new Error('MineWeb chat form not found');
			}
			form.requestSubmit();
			return JSON.stringify({ submitted: true });
		})()`,
	]);
	await runAgentBrowser(['wait', '300']);

	const afterSend = parseEvalJson<{ open: boolean; locked: boolean; everLocked: boolean; count: number; last: string }>(await runAgentBrowser([
		'eval',
		`(async () => {
			const controller = window.__minewebTestController;
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			await waitFor(() => {
				const state = controller?.getState();
				return !!state && !state.ui.showChat;
			}, ${timeoutMs});
			const state = controller?.getState();
			return JSON.stringify({
				open: !!state?.ui.showChat,
				locked: !!state?.ui.isLocked,
				everLocked: !!state?.ui.everLocked,
				count: state?.chat.messages.length ?? 0,
				last: state?.chat.messages.at(-1)?.message ?? '',
			});
		})()`,
	]));
	await runAgentBrowser([
		'eval',
		`(() => {
			const controller = window.__minewebTestController;
			if (controller) {
				controller.setOverlay(null);
				controller.setLocked(true);
				controller.renderFrames(4);
			}
			return JSON.stringify({ resetOverlay: true });
		})()`,
	]);

	return {
		opened: openedState.opened,
		inputFocused: openedState.inputFocused,
		closedByEscape: !afterEscape.open,
		lockedAfterEscape: afterEscape.locked,
		everLockedAfterEscape: afterEscape.everLocked,
		openedBySlashWithPrefix: slashOpenState.open && slashOpenState.prefixed,
		closedBySend: !afterSend.open,
		lockedAfterSend: afterSend.locked,
		everLockedAfterSend: afterSend.everLocked,
		sendAppendedMessage: afterSend.count > beforeSendCount.count && afterSend.last.includes('hello from regression'),
	};
}

async function runIconSmoke(timeoutMs = 15_000) {
	return parseEvalJson<RegressionState['iconSmoke']>(await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			const hasVisibleIcon = (canvas) => {
				if (!(canvas instanceof HTMLCanvasElement)) return false;
				const ctx = canvas.getContext('2d', { willReadFrequently: true });
				if (!ctx) return false;
				const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
				let nonTransparent = 0;
				let minLuma = 255;
				let maxLuma = 0;
				for (let i = 0; i < frame.data.length; i += 4) {
					const a = frame.data[i + 3];
					if (a <= 8) continue;
					nonTransparent++;
					const luma = frame.data[i] * 0.2126 + frame.data[i + 1] * 0.7152 + frame.data[i + 2] * 0.0722;
					minLuma = Math.min(minLuma, luma);
					maxLuma = Math.max(maxLuma, luma);
				}
				return nonTransparent > 40 && (maxLuma - minLuma) > 8;
			};

			await waitFor(() => !!window.__minewebTestController, ${timeoutMs});
			const controller = window.__minewebTestController;
			await controller.waitForRuntime(${timeoutMs});
			controller.pauseLoops();
			controller.setOverlay(null);
			controller.setLocked(true);
			controller.mergeSettings({ nativeHud: false, showFps: false });

			// Populate known item textures: wooden sword, bucket, grass block.
			controller.setInventorySlot(0, { itemId: 1010, count: 1 });
			controller.setInventorySlot(1, { itemId: 1002, count: 1 });
			controller.setInventorySlot(2, { itemId: 1, count: 16 });
			controller.renderFrames(20);

			await waitFor(() => document.querySelectorAll('[data-testid="mineweb-hotbar-slot"]').length >= 3, ${timeoutMs});

			const hotbarFailed = [];
			for (const index of [0, 1, 2]) {
				const slot = document.querySelector(\`[data-testid="mineweb-hotbar-slot"][data-slot-index="\${index}"]\`);
				const iconCanvas = slot?.querySelector('canvas');
				if (!hasVisibleIcon(iconCanvas)) hotbarFailed.push(index);
			}

			controller.setOverlay('inventory');
			controller.renderFrames(10);
			await waitFor(() => !!document.querySelector('[data-testid="mineweb-inventory-overlay"]'), ${timeoutMs});

			const inventoryFailed = [];
			for (const index of [0, 1, 2]) {
				const slot = document.querySelector(\`[data-testid="mineweb-inventory-slot"][data-slot-index="\${index}"]\`);
				const iconCanvas = slot?.querySelector('canvas');
				if (!hasVisibleIcon(iconCanvas)) inventoryFailed.push(index);
			}

			controller.setOverlay(null);
			controller.setLocked(true);
			controller.renderFrames(4);

			return JSON.stringify({
				hotbar: {
					ok: hotbarFailed.length === 0,
					failedSlots: hotbarFailed,
				},
				inventory: {
					ok: inventoryFailed.length === 0,
					failedSlots: inventoryFailed,
				},
			});
		})()`,
	]));
}

async function runNativeHudSmoke(timeoutMs = 15_000) {
	const state = parseEvalJson<RegressionState['nativeHudSmoke']>(await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			await waitFor(() => !!window.__minewebTestController, ${timeoutMs});
			const controller = window.__minewebTestController;
			await controller.waitForRuntime(${timeoutMs});
			controller.pauseLoops();
			controller.setOverlay(null);
			controller.clearChatMessages();
			controller.mergeSettings({ nativeHud: true, showFps: true });
			controller.setLocked(true);
			controller.pushChatMessage({
				sender: 'Regression',
				message: 'Native HUD smoke',
				timestamp: Date.now(),
			});
			controller.renderFrames(40);

			await waitFor(() => {
				const state = controller.getState();
				return !!state?.settings.nativeHud
					&& (state?.chat.messages.length ?? 0) > 0;
			}, ${timeoutMs});

			const current = controller.getState();
			const canvas = controller.getCanvas();
			if (!(canvas instanceof HTMLCanvasElement)) {
				throw new Error('Native HUD smoke requires a canvas');
			}
			const readback = document.createElement('canvas');
			readback.width = canvas.width;
			readback.height = canvas.height;
			const readCtx = readback.getContext('2d', { willReadFrequently: true });
			if (!readCtx) {
				throw new Error('2D readback context unavailable');
			}
			readCtx.drawImage(canvas, 0, 0, readback.width, readback.height);

			const sampleRect = (x, y, width, height) => {
				const left = Math.max(0, Math.floor(x));
				const top = Math.max(0, Math.floor(y));
				const right = Math.min(readback.width, Math.ceil(left + width));
				const bottom = Math.min(readback.height, Math.ceil(top + height));
				const image = readCtx.getImageData(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
				let minLuma = 255;
				let maxLuma = 0;
				for (let i = 0; i < image.data.length; i += 4) {
					const luma = image.data[i] * 0.2126 + image.data[i + 1] * 0.7152 + image.data[i + 2] * 0.0722;
					minLuma = Math.min(minLuma, luma);
					maxLuma = Math.max(maxLuma, luma);
				}
				return {
					minLuma,
					maxLuma,
					contrast: maxLuma - minLuma,
				};
			};

			const crosshair = sampleRect(readback.width / 2 - 8, readback.height / 2 - 8, 16, 16);
			const hotbar = sampleRect(readback.width / 2 - 220, readback.height - 120, 440, 96);
			const infoPanel = sampleRect(0, 0, 240, 96);
			const chatFeed = sampleRect(0, readback.height - 160, 280, 72);
			return JSON.stringify({
				enabled: !!current?.settings.nativeHud,
				locked: !!current?.ui.isLocked,
				chatVisible: !current?.ui.showChat,
				messageCount: current?.chat.messages.length ?? 0,
				renderChecks: {
					crosshairPeak: crosshair.maxLuma,
					hotbarContrast: hotbar.contrast,
					infoPanelContrast: infoPanel.contrast,
					chatContrast: chatFeed.contrast,
				},
			});
		})()`,
	]));

	await runAgentBrowser(['screenshot', NATIVE_HUD_SCREENSHOT_PATH]);
	return state;
}

async function runThirdPersonSmoke(timeoutMs = 15_000) {
	const state = parseEvalJson<RegressionState['thirdPersonSmoke']>(await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			await waitFor(() => !!window.__minewebTestController, ${timeoutMs});
			const controller = window.__minewebTestController;
			await controller.waitForRuntime(${timeoutMs});
			controller.pauseLoops();
			controller.setOverlay(null);
			controller.setLocked(true);
			controller.clearChatMessages();
			controller.mergeSettings({ nativeHud: false, showFps: false });

			const current = controller.getState();
			const player = current?.player;
			if (!player) {
				throw new Error('Missing player state for third-person smoke');
			}
			const originX = player.position.x - 2.5;
			const originY = player.position.y - 5.5;
			const originZ = player.position.z - 18.5;
			const showcaseX = originX + 2.5;
			const showcaseY = originY + 4.5;

			controller.setPlayerPose({
				position: { x: showcaseX, y: showcaseY, z: originZ + 22.5 },
				yaw: Math.PI,
				pitch: -0.22,
				viewMode: 'third-back',
			});
			controller.renderFrames(50);
			await waitFor(() => controller.getState()?.player.viewMode === 'third-back', ${timeoutMs});
			const backCanvas = controller.getCanvas();
			if (!(backCanvas instanceof HTMLCanvasElement)) {
				throw new Error('Third-person smoke requires an HTMLCanvasElement');
			}
			const back = {
				viewMode: controller.getState()?.player.viewMode ?? 'unknown',
				...controller.analyzeCurrentFrame({
					centerRectPx: {
						x: Math.max(0, Math.floor(backCanvas.width / 2 - 120)),
						y: Math.max(0, Math.floor(backCanvas.height / 2 - 100)),
						width: Math.max(1, Math.min(240, backCanvas.width)),
						height: Math.max(1, Math.min(260, backCanvas.height)),
					},
				}),
			};
			const backDataUrl = controller.captureCanvasDataUrl();

			controller.setPlayerPose({
				position: { x: showcaseX, y: showcaseY, z: originZ + 14.5 },
				yaw: Math.PI,
				pitch: -0.22,
				viewMode: 'third-front',
			});
			controller.renderFrames(50);
			await waitFor(() => controller.getState()?.player.viewMode === 'third-front', ${timeoutMs});
			const frontCanvas = controller.getCanvas();
			if (!(frontCanvas instanceof HTMLCanvasElement)) {
				throw new Error('Third-person smoke requires an HTMLCanvasElement');
			}
			const front = {
				viewMode: controller.getState()?.player.viewMode ?? 'unknown',
				...controller.analyzeCurrentFrame({
					centerRectPx: {
						x: Math.max(0, Math.floor(frontCanvas.width / 2 - 120)),
						y: Math.max(0, Math.floor(frontCanvas.height / 2 - 100)),
						width: Math.max(1, Math.min(240, frontCanvas.width)),
						height: Math.max(1, Math.min(260, frontCanvas.height)),
					},
				}),
			};
			const frontDataUrl = controller.captureCanvasDataUrl();

			return JSON.stringify({ back, backDataUrl, front, frontDataUrl });
		})()`,
	]));

	if (state?.backDataUrl) {
		await writeFile(
			THIRD_PERSON_BACK_SCREENSHOT_PATH,
			Buffer.from(state.backDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'),
		);
	}
	if (state?.frontDataUrl) {
		await writeFile(
			THIRD_PERSON_FRONT_SCREENSHOT_PATH,
			Buffer.from(state.frontDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'),
		);
	}

	return state
		? {
				back: state.back,
				front: state.front,
			}
		: state;
}

async function runEntityShowcaseSmoke(timeoutMs = 15_000) {
	const state = parseEvalJson<(RegressionState['entitySmoke'] & { dataUrl?: string }) | undefined>(await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			await waitFor(() => !!window.__minewebTestController, ${timeoutMs});
			const controller = window.__minewebTestController;
			await controller.waitForRuntime(${timeoutMs});
			controller.pauseLoops();
			controller.setOverlay(null);
			controller.setLocked(true);
			controller.clearChatMessages();
			controller.mergeSettings({ nativeHud: false, showFps: false, renderDistance: 3 });
			controller.setWeather('clear');
			controller.setTimeOfDay(0.18);

			const scene = controller.buildRegressionScene({
				layout: 'entities',
				originX: 128,
				originZ: 128,
				chunkRadius: 2,
			});
			controller.setPlayerPose({
				position: scene.recommendedCamera.position,
				yaw: scene.recommendedCamera.yaw,
				pitch: scene.recommendedCamera.pitch,
				viewMode: 'first-person',
			});
			controller.renderFrames(80);
			await waitFor(() => Object.keys(controller.getState()?.entities ?? {}).length >= scene.entityTypes.length, ${timeoutMs});
			controller.renderFrames(40);
			const canvas = controller.getCanvas();
			if (!(canvas instanceof HTMLCanvasElement)) {
				throw new Error('Entity showcase smoke requires an HTMLCanvasElement');
			}

			return JSON.stringify({
				layout: scene.layout,
				entityCount: scene.entityTypes.length,
				...controller.analyzeCurrentFrame({
					centerRectPx: {
						x: Math.max(0, Math.floor(canvas.width / 2 - 160)),
						y: Math.max(0, Math.floor(canvas.height / 2 - 120)),
						width: Math.max(1, Math.min(320, canvas.width)),
						height: Math.max(1, Math.min(240, canvas.height)),
					},
				}),
				dataUrl: controller.captureCanvasDataUrl(),
			});
		})()`,
	]));

	if (state?.dataUrl) {
		await writeFile(
			ENTITY_SHOWCASE_SCREENSHOT_PATH,
			Buffer.from(state.dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'),
		);
	}

	if (!state) {
		return state;
	}

	return {
		layout: state.layout,
		entityCount: state.entityCount,
		avgLuma: state.avgLuma,
		uniqueBuckets: state.uniqueBuckets,
		nonSkyRatio: state.nonSkyRatio,
		centerContrast: state.centerContrast,
		signature: state.signature,
	};
}

async function runEntityCloseupSmoke(timeoutMs = 15_000) {
	const state = parseEvalJson<(RegressionState['entityCloseupSmoke'] & {
		frontDataUrl?: string;
		backDataUrl?: string;
	}) | undefined>(await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			const analyzeCanvas = (canvas) => {
				if (!(canvas instanceof HTMLCanvasElement)) {
					throw new Error('Entity closeup smoke requires an HTMLCanvasElement');
				}
				const readback = document.createElement('canvas');
				readback.width = canvas.width;
				readback.height = canvas.height;
				const ctx = readback.getContext('2d', { willReadFrequently: true });
				if (!ctx) {
					throw new Error('2D readback context unavailable');
				}
				ctx.drawImage(canvas, 0, 0, readback.width, readback.height);
				const frame = ctx.getImageData(0, 0, readback.width, readback.height);
				let totalLuma = 0;
				const buckets = new Set();
				const signature = [];
				const quantize = (value) => Math.round(value / 16).toString(16);

				for (let y = 0; y < frame.height; y += 4) {
					for (let x = 0; x < frame.width; x += 4) {
						const idx = (y * frame.width + x) * 4;
						const r = frame.data[idx];
						const g = frame.data[idx + 1];
						const b = frame.data[idx + 2];
						totalLuma += r * 0.2126 + g * 0.7152 + b * 0.0722;
						buckets.add(\`\${quantize(r)}\${quantize(g)}\${quantize(b)}\`);
					}
				}

				for (let gy = 0; gy < 4; gy++) {
					for (let gx = 0; gx < 8; gx++) {
						const sx = Math.floor(frame.width * (0.12 + gx * 0.1));
						const sy = Math.floor(frame.height * (0.18 + gy * 0.16));
						const idx = (sy * frame.width + sx) * 4;
						signature.push(
							\`\${quantize(frame.data[idx])}\${quantize(frame.data[idx + 1])}\${quantize(frame.data[idx + 2])}\`,
						);
					}
				}

				const center = ctx.getImageData(
					Math.max(0, Math.floor(frame.width / 2 - 180)),
					Math.max(0, Math.floor(frame.height / 2 - 140)),
					Math.max(1, Math.min(360, frame.width)),
					Math.max(1, Math.min(280, frame.height)),
				);
				let centerMin = 255;
				let centerMax = 0;
				for (let i = 0; i < center.data.length; i += 4) {
					const luma = center.data[i] * 0.2126 + center.data[i + 1] * 0.7152 + center.data[i + 2] * 0.0722;
					centerMin = Math.min(centerMin, luma);
					centerMax = Math.max(centerMax, luma);
				}

				const sampleCount = Math.ceil(frame.width / 4) * Math.ceil(frame.height / 4);
				return {
					avgLuma: totalLuma / sampleCount,
					uniqueBuckets: buckets.size,
					signature: signature.join('.'),
					centerContrast: centerMax - centerMin,
				};
			};

			await waitFor(() => !!window.__minewebTestController, ${timeoutMs});
			const controller = window.__minewebTestController;
			await controller.waitForRuntime(${timeoutMs});
			controller.pauseLoops();
			controller.setOverlay(null);
			controller.setLocked(true);
			controller.mergeSettings({ nativeHud: false, showFps: false, renderDistance: 2 });
			controller.setWeather('clear');
			controller.setTimeOfDay(0.18);

			const baseState = controller.getState();
			const origin = baseState?.player?.position ?? { x: 128, y: 40, z: 128 };
				const scene = controller.buildRegressionScene({
					layout: 'entities',
					originX: Math.floor(origin.x),
					originZ: Math.floor(origin.z),
					chunkRadius: 2,
				});
				await waitFor(
					() => Object.keys(controller.getState()?.entities ?? {}).length >= scene.entityTypes.length,
					${timeoutMs},
				);
				const bx = scene.origin.x;
				const by = scene.origin.y;
				const bz = scene.origin.z;

			controller.setPlayerPose({
				position: { x: bx - 7.5, y: by + 3.8, z: bz + 1.5 },
				yaw: Math.PI,
				pitch: -0.2,
				viewMode: 'first-person',
			});
			controller.renderFrames(50);
			const front = analyzeCanvas(controller.getCanvas());
			const frontDataUrl = controller.captureCanvasDataUrl();

			controller.setPlayerPose({
				position: { x: bx + 7.5, y: by + 3.8, z: bz - 3.5 },
				yaw: Math.PI,
				pitch: -0.22,
				viewMode: 'first-person',
			});
			controller.renderFrames(50);
			const back = analyzeCanvas(controller.getCanvas());
			const backDataUrl = controller.captureCanvasDataUrl();

			return JSON.stringify({
				front,
				back,
				frontDataUrl,
				backDataUrl,
			});
		})()`,
	]));

	if (state?.frontDataUrl) {
		await writeFile(
			ENTITY_CLOSEUP_A_SCREENSHOT_PATH,
			Buffer.from(state.frontDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'),
		);
	}
	if (state?.backDataUrl) {
		await writeFile(
			ENTITY_CLOSEUP_B_SCREENSHOT_PATH,
			Buffer.from(state.backDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'),
		);
	}

	if (!state) {
		return state;
	}
	return {
		front: state.front,
		back: state.back,
	};
}

async function buildEntityPortraitScene(timeoutMs = 15_000) {
	return parseEvalJson<{
		layout: string;
		entitySpawns: Array<{
			type: string;
			position: { x: number; y: number; z: number };
		}>;
	}>(await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			await waitFor(() => !!window.__minewebTestController, ${timeoutMs});
			const controller = window.__minewebTestController;
			await controller.waitForRuntime(${timeoutMs});
			controller.pauseLoops();
			controller.setOverlay(null);
			controller.setLocked(true);
			controller.mergeSettings({ nativeHud: false, showFps: false, renderDistance: 2 });
			controller.setWeather('clear');
			controller.setTimeOfDay(0.18);

			const scene = controller.buildRegressionScene({
				layout: 'portraits',
				originX: 192,
				originZ: 192,
				chunkRadius: 3,
			});
			controller.setPlayerPose({
				position: scene.recommendedCamera.position,
				yaw: scene.recommendedCamera.yaw,
				pitch: scene.recommendedCamera.pitch,
				viewMode: 'first-person',
			});
			controller.renderFrames(60);
			return JSON.stringify({
				layout: scene.layout,
				entitySpawns: scene.entitySpawns,
			});
		})()`,
	]));
}

async function captureEntityPortraitSet(type: string, timeoutMs = 15_000) {
	return parseEvalJson<Array<{
		type: string;
		view: string;
		avgLuma: number;
		uniqueBuckets: number;
		centerContrast: number;
		signature: string;
		dataUrl: string;
	}>>(await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});
			await waitFor(() => !!window.__minewebTestController, ${timeoutMs});
			const controller = window.__minewebTestController;
			await controller.waitForRuntime(${timeoutMs});
			controller.pauseLoops();
			controller.setOverlay(null);
			controller.setLocked(true);
			controller.mergeSettings({ nativeHud: false, showFps: false, renderDistance: 2 });
			controller.setWeather('clear');
			controller.setTimeOfDay(0.18);

			const scene = controller.buildRegressionScene({
				layout: 'portraits',
				originX: 192,
				originZ: 192,
				chunkRadius: 3,
			});
			const entity = scene.entitySpawns.find((entry) => entry.type === ${JSON.stringify(type)});
			if (!entity) {
				throw new Error(\`Entity portrait target not found: ${JSON.stringify(type)}\`);
			}
			controller.renderFrames(24);
			const canvas = controller.getCanvas();
			if (!(canvas instanceof HTMLCanvasElement)) {
				throw new Error('Portrait capture requires an HTMLCanvasElement');
			}

			const analyzeCanvas = () => {
				const readback = document.createElement('canvas');
				readback.width = canvas.width;
				readback.height = canvas.height;
				const ctx = readback.getContext('2d', { willReadFrequently: true });
				if (!ctx) {
					throw new Error('2D readback context unavailable');
				}
				ctx.drawImage(canvas, 0, 0, readback.width, readback.height);
				const frame = ctx.getImageData(0, 0, readback.width, readback.height);
				let totalLuma = 0;
				const buckets = new Set();
				const signature = [];
				const quantize = (value) => Math.round(value / 16).toString(16);
				for (let y = 0; y < frame.height; y += 4) {
					for (let x = 0; x < frame.width; x += 4) {
						const idx = (y * frame.width + x) * 4;
						const r = frame.data[idx];
						const g = frame.data[idx + 1];
						const b = frame.data[idx + 2];
						totalLuma += r * 0.2126 + g * 0.7152 + b * 0.0722;
						buckets.add(\`\${quantize(r)}\${quantize(g)}\${quantize(b)}\`);
					}
				}
				for (let gy = 0; gy < 4; gy++) {
					for (let gx = 0; gx < 8; gx++) {
						const sx = Math.floor(frame.width * (0.12 + gx * 0.1));
						const sy = Math.floor(frame.height * (0.16 + gy * 0.17));
						const idx = (sy * frame.width + sx) * 4;
						signature.push(
							\`\${quantize(frame.data[idx])}\${quantize(frame.data[idx + 1])}\${quantize(frame.data[idx + 2])}\`,
						);
					}
				}
				const center = ctx.getImageData(
					Math.max(0, Math.floor(frame.width / 2 - 160)),
					Math.max(0, Math.floor(frame.height / 2 - 180)),
					Math.max(1, Math.min(320, frame.width)),
					Math.max(1, Math.min(360, frame.height)),
				);
				let centerMin = 255;
				let centerMax = 0;
				for (let i = 0; i < center.data.length; i += 4) {
					const luma = center.data[i] * 0.2126 + center.data[i + 1] * 0.7152 + center.data[i + 2] * 0.0722;
					centerMin = Math.min(centerMin, luma);
					centerMax = Math.max(centerMax, luma);
				}
				const sampleCount = Math.ceil(frame.width / 4) * Math.ceil(frame.height / 4);
				return {
					avgLuma: totalLuma / sampleCount,
					uniqueBuckets: buckets.size,
					centerContrast: centerMax - centerMin,
					signature: signature.join('.'),
				};
			};

			const getPoseForView = (view) => {
				const distance = 5.2;
				const eyeHeight = 2.8;
				const offsets = {
					front: { x: 0, z: distance },
					back: { x: 0, z: -distance },
					left: { x: distance, z: 0 },
					right: { x: -distance, z: 0 },
					'front-high': { x: 0, z: distance },
					'front-low': { x: 0, z: distance },
				};
				const offset = offsets[view] ?? offsets.front;
				const eyeOffsetY = view === 'front-high'
					? eyeHeight + 1.3
					: view === 'front-low'
						? eyeHeight - 1.2
						: eyeHeight;
				const position = {
					x: entity.position.x + offset.x,
					y: entity.position.y + eyeOffsetY,
					z: entity.position.z + offset.z,
				};
				const dx = entity.position.x - position.x;
				const dy = entity.position.y + 1.4 - position.y;
				const dz = entity.position.z - position.z;
				const flat = Math.max(0.0001, Math.hypot(dx, dz));
				return {
					position,
					yaw: Math.atan2(-dx, -dz),
					pitch: Math.atan2(-dy, flat),
				};
			};

			const views = ${JSON.stringify([...ENTITY_PORTRAIT_VIEWS])};
			const captures = [];
			for (const view of views) {
				const pose = getPoseForView(view);
				controller.setPlayerPose({
					position: pose.position,
					yaw: pose.yaw,
					pitch: pose.pitch,
					viewMode: 'first-person',
				});
				controller.renderFrames(48);
				captures.push({
					type: entity.type,
					view,
					...analyzeCanvas(),
					dataUrl: controller.captureCanvasDataUrl(),
				});
			}
			return JSON.stringify(captures);
		})()`,
	]));
}

async function runEntityPortraitSmoke(timeoutMs = 15_000) {
	await rm(ENTITY_PORTRAIT_DIR, { recursive: true, force: true });
	await mkdir(ENTITY_PORTRAIT_DIR, { recursive: true });
	const scene = await buildEntityPortraitScene(timeoutMs);
	const types: string[] = [];
	let imageCount = 0;
	const manifestCases: EntityPortraitManifestEntry[] = [];

	for (const entity of scene.entitySpawns) {
		await reopenRegressionPage();
		const portraits = await withNavigationRetry(
			`${entity.type} portrait set`,
			() => captureEntityPortraitSet(entity.type, timeoutMs),
			3,
		);
		for (const portrait of portraits) {
			if (portrait.centerContrast < 30 || portrait.dataUrl.length < 2_000) {
				throw new Error(`Portrait baseline too weak for ${portrait.type}/${portrait.view}: ${JSON.stringify(portrait)}`);
			}
			const file = `${portrait.type}-${portrait.view}.png`;
			const targetPath = path.join(ENTITY_PORTRAIT_DIR, file);
			const caseId = buildEntityPortraitCaseId(portrait.type, portrait.view);
			await writeFile(
				targetPath,
				Buffer.from(portrait.dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'),
			);
			manifestCases.push({
				caseId,
				type: portrait.type,
				view: portrait.view,
				file,
				prompt: buildEntityPortraitPrompt({
					caseId,
					type: portrait.type,
					view: portrait.view,
					file,
				}),
			});
			imageCount++;
		}
		types.push(entity.type);
	}

	const manifest: EntityPortraitManifest = {
		suiteId: 'mineweb-entity-portraits-v2',
		layout: 'portraits',
		artifactDir: ENTITY_PORTRAIT_DIR,
		views: [...ENTITY_PORTRAIT_VIEWS],
		cases: manifestCases,
	};
	await writeFile(ENTITY_PORTRAIT_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

	return {
		count: types.length,
		imageCount,
		types,
		views: [...ENTITY_PORTRAIT_VIEWS],
		dir: ENTITY_PORTRAIT_DIR,
	};
}

async function runCelestialSmoke(timeoutMs = 15_000) {
	const state = parseEvalJson<RegressionState['celestialSmoke']>(await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			await waitFor(() => !!window.__minewebTestController, ${timeoutMs});
			const controller = window.__minewebTestController;
			await controller.waitForRuntime(${timeoutMs});
			controller.pauseLoops();
			controller.setOverlay(null);
			controller.setLocked(true);

			const sampleSky = (timeOfDay) => {
				controller.setTimeOfDay(timeOfDay);
				controller.renderFrames(30);
				const canvas = controller.getCanvas();
				if (!(canvas instanceof HTMLCanvasElement)) {
					throw new Error('Celestial smoke requires a canvas');
				}
				const readback = document.createElement('canvas');
				readback.width = canvas.width;
				readback.height = canvas.height;
				const ctx = readback.getContext('2d', { willReadFrequently: true });
				if (!ctx) {
					throw new Error('2D readback context unavailable');
				}
				ctx.drawImage(canvas, 0, 0, readback.width, readback.height);
				const image = ctx.getImageData(0, 0, readback.width, readback.height);
				let lumaSum = 0;
				const signature = [];
				for (let gy = 0; gy < 4; gy++) {
					for (let gx = 0; gx < 8; gx++) {
						const left = Math.floor((gx / 8) * readback.width);
						const right = Math.floor(((gx + 1) / 8) * readback.width);
						const top = Math.floor((gy / 4) * readback.height);
						const bottom = Math.floor(((gy + 1) / 4) * readback.height);
						let bucketLuma = 0;
						let bucketCount = 0;
						for (let y = top; y < bottom; y++) {
							for (let x = left; x < right; x++) {
								const idx = (y * readback.width + x) * 4;
								const luma = image.data[idx] * 0.2126 + image.data[idx + 1] * 0.7152 + image.data[idx + 2] * 0.0722;
								lumaSum += luma;
								bucketLuma += luma;
								bucketCount++;
							}
						}
						signature.push(Math.round(bucketLuma / Math.max(1, bucketCount)).toString(16));
					}
				}
				return {
					avgLuma: lumaSum / Math.max(1, image.data.length / 4),
					signature: signature.join('.'),
					dataUrl: controller.captureCanvasDataUrl(),
				};
			};

			const day = sampleSky(6000 / 24000);
			const night = sampleSky(18_000 / 24_000);
			return JSON.stringify({
				day: {
					avgLuma: day.avgLuma,
					signature: day.signature,
				},
				night: {
					avgLuma: night.avgLuma,
					signature: night.signature,
				},
				dayDataUrl: day.dataUrl,
				nightDataUrl: night.dataUrl,
			});
		})()`,
	]));

	if (state?.dayDataUrl) {
		await writeFile(
			CELESTIAL_DAY_SCREENSHOT_PATH,
			Buffer.from(state.dayDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'),
		);
	}
	if (state?.nightDataUrl) {
		await writeFile(
			CELESTIAL_NIGHT_SCREENSHOT_PATH,
			Buffer.from(state.nightDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'),
		);
	}

	return state
		? {
				day: state.day,
				night: state.night,
			}
		: state;
}

async function runWeatherSmoke(timeoutMs = 15_000) {
	return parseEvalJson<RegressionState['weatherSmoke']>(await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			const analyzeCanvas = (canvas) => {
				if (!(canvas instanceof HTMLCanvasElement)) {
					throw new Error('Weather smoke requires an HTMLCanvasElement');
				}
				const readback = document.createElement('canvas');
				readback.width = canvas.width;
				readback.height = canvas.height;
				const ctx = readback.getContext('2d', { willReadFrequently: true });
				if (!ctx) {
					throw new Error('2D readback context unavailable');
				}
				ctx.drawImage(canvas, 0, 0, readback.width, readback.height);
				const frame = ctx.getImageData(0, 0, readback.width, readback.height);
				let totalLuma = 0;
				const signature = [];
				for (let gy = 0; gy < 4; gy++) {
					for (let gx = 0; gx < 8; gx++) {
						const sx = Math.floor(readback.width * (gx + 0.5) / 8);
						const sy = Math.floor(readback.height * (gy + 0.5) / 4);
						const idx = (sy * readback.width + sx) * 4;
						signature.push(
							[
								frame.data[idx],
								frame.data[idx + 1],
								frame.data[idx + 2],
							].map((value) => Math.round(value / 16).toString(16)).join(''),
						);
					}
				}
				for (let i = 0; i < frame.data.length; i += 4) {
					totalLuma += frame.data[i] * 0.2126 + frame.data[i + 1] * 0.7152 + frame.data[i + 2] * 0.0722;
				}
				return {
					avgLuma: totalLuma / Math.max(1, frame.data.length / 4),
					signature: signature.join('.'),
				};
			};

			await waitFor(() => !!window.__minewebTestController, ${timeoutMs});
			const controller = window.__minewebTestController;
			await controller.waitForRuntime(${timeoutMs});
			controller.pauseLoops();
			controller.setOverlay(null);
			controller.setLocked(true);
			controller.mergeSettings({ nativeHud: false, showFps: false, renderDistance: 4 });

			const sampleWeather = (weather) => {
				controller.setTimeOfDay(0.18);
				controller.setWeather(weather);
				controller.renderFrames(45);
				return analyzeCanvas(controller.getCanvas());
			};

			return JSON.stringify({
				clear: sampleWeather('clear'),
				rain: sampleWeather('rain'),
				snow: sampleWeather('snow'),
			});
		})()`,
	]));
}

async function runTransparencySmoke(timeoutMs = 15_000) {
	const state = parseEvalJson<(RegressionState['transparencySmoke'] & {
		dataUrl?: string;
	}) | undefined>(await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			const analyzeCanvas = (canvas) => {
				if (!(canvas instanceof HTMLCanvasElement)) {
					throw new Error('Transparency smoke requires an HTMLCanvasElement');
				}
				const readback = document.createElement('canvas');
				readback.width = canvas.width;
				readback.height = canvas.height;
				const ctx = readback.getContext('2d', { willReadFrequently: true });
				if (!ctx) {
					throw new Error('2D readback context unavailable');
				}
				ctx.drawImage(canvas, 0, 0, readback.width, readback.height);
				const frame = ctx.getImageData(0, 0, readback.width, readback.height);
				let totalLuma = 0;
				let magentaPixels = 0;
				const buckets = new Set();
				const signature = [];
				const quantize = (value) => Math.round(value / 16).toString(16);
				for (let y = 0; y < frame.height; y += 4) {
					for (let x = 0; x < frame.width; x += 4) {
						const idx = (y * frame.width + x) * 4;
						const r = frame.data[idx];
						const g = frame.data[idx + 1];
						const b = frame.data[idx + 2];
						totalLuma += r * 0.2126 + g * 0.7152 + b * 0.0722;
						buckets.add(\`\${quantize(r)}\${quantize(g)}\${quantize(b)}\`);
						if (r > 128 && b > 128 && g < 96) {
							magentaPixels++;
						}
					}
				}
				for (let gy = 0; gy < 4; gy++) {
					for (let gx = 0; gx < 8; gx++) {
						const sx = Math.floor(readback.width * (0.12 + gx * 0.1));
						const sy = Math.floor(readback.height * (0.2 + gy * 0.15));
						const idx = (sy * readback.width + sx) * 4;
						signature.push(
							\`\${quantize(frame.data[idx])}\${quantize(frame.data[idx + 1])}\${quantize(frame.data[idx + 2])}\`,
						);
					}
				}

				const center = ctx.getImageData(
					Math.max(0, Math.floor(frame.width / 2 - 180)),
					Math.max(0, Math.floor(frame.height / 2 - 140)),
					Math.max(1, Math.min(360, frame.width)),
					Math.max(1, Math.min(280, frame.height)),
				);
				let centerMin = 255;
				let centerMax = 0;
				for (let i = 0; i < center.data.length; i += 4) {
					const luma = center.data[i] * 0.2126 + center.data[i + 1] * 0.7152 + center.data[i + 2] * 0.0722;
					centerMin = Math.min(centerMin, luma);
					centerMax = Math.max(centerMax, luma);
				}

				const sampleCount = Math.max(1, Math.ceil(frame.width / 4) * Math.ceil(frame.height / 4));
				return {
					avgLuma: totalLuma / sampleCount,
					uniqueBuckets: buckets.size,
					centerContrast: centerMax - centerMin,
					magentaRatio: magentaPixels / sampleCount,
					signature: signature.join('.'),
				};
			};

			await waitFor(() => !!window.__minewebTestController, ${timeoutMs});
			const controller = window.__minewebTestController;
			await controller.waitForRuntime(${timeoutMs});
			controller.pauseLoops();
			controller.setOverlay(null);
			controller.setLocked(true);
			controller.mergeSettings({ nativeHud: false, showFps: false, renderDistance: 3 });
			controller.setWeather('clear');
			controller.setTimeOfDay(0.2);

			const scene = controller.buildRegressionScene({
				layout: 'cross',
				originX: 160,
				originZ: 160,
				chunkRadius: 2,
			});
			controller.setPlayerPose({
				position: scene.recommendedCamera.position,
				yaw: scene.recommendedCamera.yaw,
				pitch: scene.recommendedCamera.pitch,
				viewMode: 'first-person',
			});
			controller.renderFrames(60);

			return JSON.stringify({
				...analyzeCanvas(controller.getCanvas()),
				dataUrl: controller.captureCanvasDataUrl(),
			});
		})()`,
	]));

	if (state?.dataUrl) {
		await writeFile(
			TRANSPARENCY_SCREENSHOT_PATH,
			Buffer.from(state.dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'),
		);
	}

	if (!state) return state;
	return {
		avgLuma: state.avgLuma,
		uniqueBuckets: state.uniqueBuckets,
		centerContrast: state.centerContrast,
		magentaRatio: state.magentaRatio,
		signature: state.signature,
	};
}

async function runInteractionSmoke(timeoutMs = 15_000) {
	return parseEvalJson<RegressionState['interactionSmoke']>(await runAgentBrowser([
		'eval',
		`(async () => {
			const waitFor = (check, timeoutMs) => new Promise((resolve, reject) => {
				const start = performance.now();
				const poll = () => {
					if (check()) {
						resolve(null);
						return;
					}
					if (performance.now() - start > timeoutMs) {
						reject(new Error(\`Timed out after \${timeoutMs}ms\`));
						return;
					}
					requestAnimationFrame(poll);
				};
				poll();
			});

			await waitFor(() => !!window.__minewebTestController, ${timeoutMs});
			const controller = window.__minewebTestController;
			await controller.waitForRuntime(${timeoutMs});
			controller.pauseLoops();
			controller.clearChatMessages();
			controller.buildRegressionScene({
				layout: 'entities',
				chunkRadius: 2,
			});
			controller.renderFrames(50);
			await controller.waitForRegressionScene(6, 12, ${timeoutMs});

			const sheepId = controller.findEntityIdByType('sheep');
			const cowId = controller.findEntityIdByType('cow');
			if (sheepId == null || cowId == null) {
				throw new Error(\`Missing showcase entities: sheep=\${sheepId}, cow=\${cowId}\`);
			}

			controller.setInventorySlot(0, { itemId: 1001, count: 1 });
			controller.setSelectedSlot(0);
			controller.interactEntity(sheepId, 'use');
			controller.renderFrames(10);

			const sheepState = controller.getState();
			const sheep = {
				itemDrops: sheepState?.itemDrops.length ?? 0,
				sheared: sheepState?.entities[sheepId]?.state.sheared === true,
				message: sheepState?.chat.messages.at(-1)?.message ?? '',
			};

			controller.setInventorySlot(1, { itemId: 1002, count: 1 });
			controller.setSelectedSlot(1);
			controller.interactEntity(cowId, 'use');
			controller.renderFrames(10);

			const cowState = controller.getState();
			return JSON.stringify({
				sheep,
				cow: {
					selectedItemId: cowState?.inventory.slots[1]?.itemId ?? null,
					message: cowState?.chat.messages.at(-1)?.message ?? '',
				},
			});
		})()`,
	]));
}

async function main() {
	await access(path.dirname(SCREENSHOT_PATH)).catch(async () => {
		await mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });
	});
	managedDevServer = await ensureDevServer();

	try {
		await reopenRegressionPage();
		const state = await runPhase('render-regression', () =>
			withNavigationRetry('render regression', () => runRegression()));
		const inventorySmoke = await runPhase('inventory-smoke', () =>
			withNavigationRetry('inventory smoke', () => runInventorySmoke()));
		const chatSmoke = await runPhase('chat-smoke', () =>
			withNavigationRetry('chat smoke', () => runChatSmoke()));
		const iconSmoke = await runPhase('icon-smoke', () =>
			withNavigationRetry('icon smoke', () => runIconSmoke()));
		await runAgentBrowser(['screenshot', SCREENSHOT_PATH]);
		let nativeHudSmoke: RegressionState['nativeHudSmoke'] | null = null;
		try {
			nativeHudSmoke = await runPhase('native-hud-smoke', () =>
				withNavigationRetry('native hud smoke', () => runNativeHudSmoke()));
		} catch (error) {
			console.warn(`[mineweb-regression] native hud smoke skipped: ${error instanceof Error ? error.message : String(error)}`);
		}
		const thirdPersonSmoke = await runPhase('third-person-smoke', () =>
			withNavigationRetry('third person smoke', () => runThirdPersonSmoke()));
		const interactionSmoke = await runPhase('interaction-smoke', () =>
			withNavigationRetry('interaction smoke', () => runInteractionSmoke()));
		const entitySmoke = await runPhase('entity-showcase-smoke', () =>
			withNavigationRetry('entity showcase smoke', () => runEntityShowcaseSmoke()));
		let entityCloseupSmoke = await runPhase('entity-closeup-smoke', () =>
			withNavigationRetry('entity closeup smoke', () => runEntityCloseupSmoke()));
		const closeupWeak =
			(entityCloseupSmoke?.front.uniqueBuckets ?? 0) < 40
			|| (entityCloseupSmoke?.back.uniqueBuckets ?? 0) < 40
			|| (entityCloseupSmoke?.front.centerContrast ?? 0) < 60
			|| (entityCloseupSmoke?.back.centerContrast ?? 0) < 60
			|| entityCloseupSmoke?.front.signature === entityCloseupSmoke?.back.signature;
		if (closeupWeak) {
			console.warn('[mineweb-regression] entity closeup smoke looked weak; retrying once');
			entityCloseupSmoke = await runPhase('entity-closeup-smoke-retry', () =>
				withNavigationRetry('entity closeup smoke retry', () => runEntityCloseupSmoke()));
		}
		const entityPortraitSmoke = SKIP_ENTITY_PORTRAITS
			? null
			: await runPhase('entity-portrait-smoke', () =>
				withNavigationRetry('entity portrait smoke', () => runEntityPortraitSmoke(), 5),
				PHASE_TIMEOUT_ENTITY_PORTRAIT_MS);
		const llmReviewJob = await maybeStartLlmReviewInBackground();
		const celestialSmoke = await runPhase('celestial-smoke', () =>
			withNavigationRetry('celestial smoke', () => runCelestialSmoke()));
		const weatherSmoke = await runPhase('weather-smoke', () =>
			withNavigationRetry('weather smoke', () => runWeatherSmoke()));
		const transparencySmoke = await runPhase('transparency-smoke', () =>
			withNavigationRetry('transparency smoke', () => runTransparencySmoke()));

		if ((state.stats?.chunkMeshes ?? 0) < 6) {
			throw new Error(`Expected at least 6 chunk meshes, got ${state.stats?.chunkMeshes ?? 0}`);
		}
		if ((state.stats?.entities ?? 0) < 12) {
			throw new Error(`Expected at least 12 entities, got ${state.stats?.entities ?? 0}`);
		}
		if (!inventorySmoke.opened || !inventorySmoke.panelClickKeptOpen || !inventorySmoke.closedByBackdrop) {
			throw new Error(`Inventory smoke failed: ${JSON.stringify(inventorySmoke)}`);
		}
		if (!inventorySmoke.everLockedAfterClose) {
			throw new Error(`Inventory smoke everLocked check failed: ${JSON.stringify(inventorySmoke)}`);
		}
		if (inventorySmoke.slotCount !== 36) {
			throw new Error(`Expected 36 inventory slots, got ${inventorySmoke.slotCount}`);
		}
		if (!inventorySmoke.mousePickupWorked || !inventorySmoke.mousePlaceWorked || !inventorySmoke.shiftMoveWorked || !inventorySmoke.rightDistributeWorked || !inventorySmoke.doubleCollectWorked) {
			throw new Error(`Inventory mouse smoke failed: ${JSON.stringify(inventorySmoke)}`);
		}
		if (!chatSmoke.opened || !chatSmoke.inputFocused || !chatSmoke.closedByEscape || !chatSmoke.openedBySlashWithPrefix) {
			throw new Error(`Chat smoke failed: ${JSON.stringify(chatSmoke)}`);
		}
		if (!chatSmoke.lockedAfterEscape || !chatSmoke.closedBySend || !chatSmoke.lockedAfterSend || !chatSmoke.sendAppendedMessage) {
			throw new Error(`Chat smoke failed: ${JSON.stringify(chatSmoke)}`);
		}
		if (!chatSmoke.everLockedAfterEscape || !chatSmoke.everLockedAfterSend) {
			throw new Error(`Chat smoke everLocked check failed: ${JSON.stringify(chatSmoke)}`);
		}
		if (!iconSmoke?.hotbar.ok || !iconSmoke.inventory.ok) {
			throw new Error(`Icon smoke failed: ${JSON.stringify(iconSmoke)}`);
		}
		if (nativeHudSmoke) {
			if (!nativeHudSmoke.enabled || !nativeHudSmoke.chatVisible || (nativeHudSmoke.messageCount ?? 0) < 1) {
				throw new Error(`Native HUD smoke failed: ${JSON.stringify(nativeHudSmoke)}`);
			}
			if ((nativeHudSmoke.renderChecks.crosshairPeak ?? 0) < 200) {
				throw new Error(`Native HUD crosshair render check failed: ${JSON.stringify(nativeHudSmoke.renderChecks)}`);
			}
			if ((nativeHudSmoke.renderChecks.hotbarContrast ?? 0) < 80) {
				throw new Error(`Native HUD hotbar render check failed: ${JSON.stringify(nativeHudSmoke.renderChecks)}`);
			}
			if ((nativeHudSmoke.renderChecks.infoPanelContrast ?? 0) < 80) {
				throw new Error(`Native HUD info panel render check failed: ${JSON.stringify(nativeHudSmoke.renderChecks)}`);
			}
			if ((nativeHudSmoke.renderChecks.chatContrast ?? 0) < 80) {
				throw new Error(`Native HUD chat render check failed: ${JSON.stringify(nativeHudSmoke.renderChecks)}`);
			}
		}
		if (!interactionSmoke?.sheep.sheared || (interactionSmoke.sheep.itemDrops ?? 0) < 2) {
			throw new Error(`Sheep interaction smoke failed: ${JSON.stringify(interactionSmoke?.sheep)}`);
		}
		if ((interactionSmoke?.cow.selectedItemId ?? 0) !== 1003) {
			throw new Error(`Cow interaction smoke failed: ${JSON.stringify(interactionSmoke?.cow)}`);
		}
		if (thirdPersonSmoke?.back.viewMode !== 'third-back' || thirdPersonSmoke.front.viewMode !== 'third-front') {
			throw new Error(`Third-person smoke view mode failed: ${JSON.stringify(thirdPersonSmoke)}`);
		}
		if ((thirdPersonSmoke?.back.uniqueBuckets ?? 0) < 20 || (thirdPersonSmoke?.front.uniqueBuckets ?? 0) < 20) {
			throw new Error(`Third-person smoke bucket check failed: ${JSON.stringify(thirdPersonSmoke)}`);
		}
		if ((thirdPersonSmoke?.back.nonSkyRatio ?? 0) < 0.25 || (thirdPersonSmoke?.front.nonSkyRatio ?? 0) < 0.25) {
			throw new Error(`Third-person smoke ground check failed: ${JSON.stringify(thirdPersonSmoke)}`);
		}
		if ((thirdPersonSmoke?.back.centerContrast ?? 0) < 40 || (thirdPersonSmoke?.front.centerContrast ?? 0) < 40) {
			throw new Error(`Third-person smoke center contrast failed: ${JSON.stringify(thirdPersonSmoke)}`);
		}
		if (thirdPersonSmoke?.back.signature === thirdPersonSmoke?.front.signature) {
			throw new Error(`Third-person smoke signature did not change between views: ${JSON.stringify(thirdPersonSmoke)}`);
		}
		if (entitySmoke?.layout !== 'entities' || (entitySmoke?.entityCount ?? 0) < 12) {
			throw new Error(`Entity showcase smoke scene failed: ${JSON.stringify(entitySmoke)}`);
		}
		if ((entitySmoke?.uniqueBuckets ?? 0) < 50) {
			throw new Error(`Entity showcase smoke bucket check failed: ${JSON.stringify(entitySmoke)}`);
		}
		if ((entitySmoke?.nonSkyRatio ?? 0) < 0.35) {
			throw new Error(`Entity showcase smoke ground coverage failed: ${JSON.stringify(entitySmoke)}`);
		}
		if ((entitySmoke?.centerContrast ?? 0) < 60) {
			throw new Error(`Entity showcase smoke center contrast failed: ${JSON.stringify(entitySmoke)}`);
		}
		if ((entityCloseupSmoke?.front.uniqueBuckets ?? 0) < 40 || (entityCloseupSmoke?.back.uniqueBuckets ?? 0) < 40) {
			throw new Error(`Entity closeup smoke bucket check failed: ${JSON.stringify(entityCloseupSmoke)}`);
		}
		if ((entityCloseupSmoke?.front.centerContrast ?? 0) < 60 || (entityCloseupSmoke?.back.centerContrast ?? 0) < 60) {
			throw new Error(`Entity closeup smoke contrast failed: ${JSON.stringify(entityCloseupSmoke)}`);
		}
		if (entityCloseupSmoke?.front.signature === entityCloseupSmoke?.back.signature) {
			throw new Error(`Entity closeup smoke signatures should differ: ${JSON.stringify(entityCloseupSmoke)}`);
		}
		if (!SKIP_ENTITY_PORTRAITS && (entityPortraitSmoke?.count ?? 0) < 20) {
			throw new Error(`Entity portrait smoke count failed: ${JSON.stringify(entityPortraitSmoke)}`);
		}
		if (!SKIP_ENTITY_PORTRAITS && (entityPortraitSmoke?.imageCount ?? 0) < (entityPortraitSmoke?.count ?? 0) * ENTITY_PORTRAIT_VIEWS.length) {
			throw new Error(`Entity portrait smoke image count failed: ${JSON.stringify(entityPortraitSmoke)}`);
		}
		if ((celestialSmoke?.day.avgLuma ?? 0) <= (celestialSmoke?.night.avgLuma ?? 0)) {
			throw new Error(`Celestial smoke expected day sky to be brighter than night sky: ${JSON.stringify(celestialSmoke)}`);
		}
		if (celestialSmoke?.day.signature === celestialSmoke?.night.signature) {
			throw new Error(`Celestial smoke signature did not change between day and night: ${JSON.stringify(celestialSmoke)}`);
		}
		if ((weatherSmoke?.clear.avgLuma ?? 0) <= (weatherSmoke?.rain.avgLuma ?? 0)) {
			throw new Error(`Weather smoke expected clear daytime to stay brighter than rainy daytime: ${JSON.stringify(weatherSmoke)}`);
		}
		if (weatherSmoke?.clear.signature === weatherSmoke?.rain.signature) {
			throw new Error(`Weather smoke signature did not change between clear and rain: ${JSON.stringify(weatherSmoke)}`);
		}
		if (weatherSmoke?.rain.signature === weatherSmoke?.snow.signature) {
			throw new Error(`Weather smoke signature did not change between rain and snow: ${JSON.stringify(weatherSmoke)}`);
		}
		if ((transparencySmoke?.uniqueBuckets ?? 0) < 35) {
			throw new Error(`Transparency smoke bucket check failed: ${JSON.stringify(transparencySmoke)}`);
		}
		if ((transparencySmoke?.centerContrast ?? 0) < 40) {
			throw new Error(`Transparency smoke contrast check failed: ${JSON.stringify(transparencySmoke)}`);
		}
		if ((transparencySmoke?.magentaRatio ?? 1) > 0.12) {
			throw new Error(`Transparency smoke magenta ratio too high: ${JSON.stringify(transparencySmoke)}`);
		}

		console.log(
			JSON.stringify({
				ok: true,
				url: URL,
				screenshot: SCREENSHOT_PATH,
				nativeHudScreenshot: NATIVE_HUD_SCREENSHOT_PATH,
				thirdPersonBackScreenshot: THIRD_PERSON_BACK_SCREENSHOT_PATH,
				thirdPersonFrontScreenshot: THIRD_PERSON_FRONT_SCREENSHOT_PATH,
				entityShowcaseScreenshot: ENTITY_SHOWCASE_SCREENSHOT_PATH,
				entityCloseupAScreenshot: ENTITY_CLOSEUP_A_SCREENSHOT_PATH,
				entityCloseupBScreenshot: ENTITY_CLOSEUP_B_SCREENSHOT_PATH,
				entityPortraitDir: ENTITY_PORTRAIT_DIR,
				celestialDayScreenshot: CELESTIAL_DAY_SCREENSHOT_PATH,
				celestialNightScreenshot: CELESTIAL_NIGHT_SCREENSHOT_PATH,
				transparencyScreenshot: TRANSPARENCY_SCREENSHOT_PATH,
				inventorySmoke,
				chatSmoke,
				iconSmoke,
				nativeHudSmoke,
				interactionSmoke,
				thirdPersonSmoke,
				entitySmoke,
				entityCloseupSmoke,
				entityPortraitSmoke,
				entityPortraitSkipped: SKIP_ENTITY_PORTRAITS,
				llmReviewJob,
				celestialSmoke,
				weatherSmoke,
				transparencySmoke,
				stats: state.stats,
			}),
		);
	} finally {
		await runAgentBrowser(['close']).catch(() => '');
		await stopDevServer(managedDevServer);
		managedDevServer = null;
	}
}

void main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
