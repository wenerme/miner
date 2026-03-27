import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const browserWsEndpoint = process.env.MINEWEB_VITEST_BROWSER_WS_ENDPOINT;
const browserProvider = playwright(
	browserWsEndpoint
		? {
				connectOptions: {
					wsEndpoint: browserWsEndpoint,
				},
			}
		: {},
) as any;

export default defineConfig({
	plugins: [
		react(),
		{
			name: 'mineweb-mc-assets',
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					const url = req.url || '';
					if (!url.startsWith('/mc/')) {
						next();
						return;
					}

					try {
						const mcPath = path.resolve(
							process.env.HOME || '',
							'gits/PixiGeko/Minecraft-default-assets',
							url.slice(4),
						);
						const stat = statSync(mcPath);
						const ext = mcPath.split('.').pop()?.toLowerCase() || '';
						const mimeTypes: Record<string, string> = {
							png: 'image/png',
							json: 'application/json',
							mcmeta: 'application/json',
						};
						res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
						res.setHeader('Content-Length', stat.size);
						res.setHeader('Cache-Control', 'public, max-age=604800');
						res.statusCode = 200;
						createReadStream(mcPath).pipe(res);
						return;
					} catch {
						next();
					}
				});
			},
		},
	],
	define: {
		'process.env.NODE_ENV': JSON.stringify('test'),
		'process.env': JSON.stringify({}),
	},
	test: {
		include: ['src/**/*.browser.test.{ts,tsx}'],
		browser: {
			enabled: true,
			api: {
				host: '127.0.0.1',
				port: 63315,
				strictPort: true,
			},
			headless: true,
			ui: false,
			fileParallelism: false,
			connectTimeout: 30_000,
			provider: browserProvider,
			instances: [{ browser: 'chromium' }],
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'#': path.resolve(__dirname, './src'),
		},
		extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
	},
});
