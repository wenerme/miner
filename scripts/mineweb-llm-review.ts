import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const VISION_API = process.env.MINEWEB_VISION_API ?? 'http://127.0.0.1:31235/v1/chat/completions';
const MODEL = process.env.MINEWEB_VISION_MODEL ?? 'qwen3.5-35b-a3b';
const DEFAULT_MANIFEST = path.resolve(
	process.cwd(),
	'out/mineweb-regression-agent-portraits/manifest.json',
);
const MANIFEST_PATH = path.resolve(
	process.cwd(),
	process.env.MINEWEB_LLM_REVIEW_MANIFEST ?? DEFAULT_MANIFEST,
);
const LIMIT = Number(process.env.MINEWEB_LLM_REVIEW_LIMIT ?? '0') || null;
const CONCURRENCY = Math.max(1, Number(process.env.MINEWEB_LLM_REVIEW_CONCURRENCY ?? '2') || 2);

interface ManifestCase {
	caseId: string;
	type: string;
	view: string;
	file: string;
	prompt: string;
}

interface Manifest {
	suiteId: string;
	artifactDir: string;
	cases: ManifestCase[];
}

interface ReviewRecord {
	caseId: string;
	type: string;
	view: string;
	file: string;
	imageHash: string;
	imageSize: number;
	model: string;
	api: string;
	prompt: string;
	rawResponse: string;
	parsed: {
		verdict: 'pass' | 'fail' | 'unsure';
		confidence: number | null;
		findings: string[];
		recommendedNextArtifact: string | null;
	};
	reviewedAt: string;
}

function hashBuffer(buffer: Buffer) {
	return createHash('sha1').update(buffer).digest('hex').slice(0, 6);
}

function hashText(text: string) {
	return createHash('sha1').update(text).digest('hex').slice(0, 8);
}

function extractJsonObject(text: string) {
	const match = text.match(/\{[\s\S]*\}/);
	if (!match) return null;
	try {
		return JSON.parse(match[0]) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function normalizeVerdict(value: unknown): 'pass' | 'fail' | 'unsure' {
	return value === 'pass' || value === 'fail' || value === 'unsure' ? value : 'unsure';
}

function normalizeConfidence(value: unknown): number | null {
	if (typeof value !== 'number' || Number.isNaN(value)) return null;
	return Math.max(0, Math.min(1, value));
}

function normalizeFindings(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
}

async function askVision(imageBase64: string, prompt: string) {
	const response = await fetch(VISION_API, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: MODEL,
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'image_url',
							image_url: { url: `data:image/png;base64,${imageBase64}` },
						},
						{ type: 'text', text: prompt },
					],
				},
			],
			max_tokens: 700,
			temperature: 0.1,
		}),
	});

	if (!response.ok) {
		throw new Error(`Vision API error: ${response.status} ${response.statusText}`);
	}

	const data = (await response.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	return data.choices?.[0]?.message?.content ?? '';
}

async function main() {
	const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as Manifest;
	const artifactDir = manifest.artifactDir;
	const reviewDir = path.join(artifactDir, 'reviews');
	await mkdir(reviewDir, { recursive: true });
	const lockPath = path.join(reviewDir, '.runner.lock');
	const runId = `${process.pid}-${Date.now()}`;
	const modelKey = MODEL.replace(/[^a-zA-Z0-9._-]/g, '_');
	const apiKey = hashText(VISION_API);
	const latestIndexPath = path.join(reviewDir, 'latest-index.json');

	let lockRaw = '';
	try {
		lockRaw = await readFile(lockPath, 'utf8');
	} catch {
		lockRaw = '';
	}
	if (lockRaw.trim()) {
		const lock = JSON.parse(lockRaw) as { pid?: number; runId?: string };
		if (typeof lock.pid === 'number' && lock.pid > 0) {
			try {
				process.kill(lock.pid, 0);
				throw new Error(`LLM review runner already active (pid=${lock.pid}, runId=${lock.runId ?? 'unknown'})`);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (!message.includes('ESRCH')) {
					throw error;
				}
			}
		}
	}

	await writeFile(lockPath, JSON.stringify({
		pid: process.pid,
		runId,
		startedAt: new Date().toISOString(),
		model: MODEL,
		api: VISION_API,
	}, null, 2));

	const selectedCases = LIMIT ? manifest.cases.slice(0, LIMIT) : manifest.cases;
	const latestIndex: Record<string, { reviewFile: string; imageHash: string; reviewedAt: string; model: string; apiHash: string }> = {};
	try {
		Object.assign(latestIndex, JSON.parse(await readFile(latestIndexPath, 'utf8')) as typeof latestIndex);
	} catch {
		// start with empty index
	}
	const pending: Array<{
		entry: ManifestCase;
		imagePath: string;
		imageHash: string;
		imageSize: number;
		outputPath: string;
	}> = [];

	for (const entry of selectedCases) {
		const imagePath = path.join(artifactDir, entry.file);
		const imageBuffer = await readFile(imagePath);
		const imageHash = hashBuffer(imageBuffer);
		const promptHash = hashText(entry.prompt);
		const imageInfo = await stat(imagePath);
		const outputPath = path.join(reviewDir, `${entry.caseId}-${imageHash}-${promptHash}-${modelKey}-${apiKey}.json`);
		try {
			await stat(outputPath);
		} catch {
			pending.push({
				entry,
				imagePath,
				imageHash,
				imageSize: imageInfo.size,
				outputPath,
			});
		}
	}

	let cursor = 0;
	const completed: string[] = [];

	async function worker() {
		while (cursor < pending.length) {
			const current = pending[cursor++];
			const imageBuffer = await readFile(current.imagePath);
			const rawResponse = await askVision(imageBuffer.toString('base64'), current.entry.prompt);
			const json = extractJsonObject(rawResponse);
			const record: ReviewRecord = {
				caseId: current.entry.caseId,
				type: current.entry.type,
				view: current.entry.view,
				file: current.entry.file,
				imageHash: current.imageHash,
				imageSize: current.imageSize,
				model: MODEL,
				api: VISION_API,
				prompt: current.entry.prompt,
				rawResponse,
				parsed: {
					verdict: normalizeVerdict(json?.verdict),
					confidence: normalizeConfidence(json?.confidence),
					findings: normalizeFindings(json?.findings),
					recommendedNextArtifact: typeof json?.recommended_next_artifact === 'string'
						? json.recommended_next_artifact
						: null,
				},
				reviewedAt: new Date().toISOString(),
			};
			await writeFile(current.outputPath, `${JSON.stringify(record, null, 2)}\n`);
			latestIndex[current.entry.caseId] = {
				reviewFile: path.basename(current.outputPath),
				imageHash: current.imageHash,
				reviewedAt: record.reviewedAt,
				model: MODEL,
				apiHash: apiKey,
			};
			completed.push(path.basename(current.outputPath));
			console.log(`reviewed ${current.entry.caseId} -> ${path.basename(current.outputPath)}`);
		}
	}

	try {
		await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, pending.length)) }, () => worker()));
		await writeFile(latestIndexPath, `${JSON.stringify(latestIndex, null, 2)}\n`);

		const reviewFiles = (await readdir(reviewDir))
			.filter((name) => name.endsWith('.json'))
			.sort();
		const summary = {
			suiteId: manifest.suiteId,
			manifest: MANIFEST_PATH,
			reviewDir,
			model: MODEL,
			api: VISION_API,
			totalCases: manifest.cases.length,
			selectedCases: selectedCases.length,
			pendingCasesProcessed: pending.length,
			completedThisRun: completed.length,
			reviewFiles,
			updatedAt: new Date().toISOString(),
		};
		await writeFile(path.join(reviewDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
		console.log(JSON.stringify(summary));
	} finally {
		await rm(lockPath, { force: true });
	}
}

void main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
