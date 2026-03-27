import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'waku/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	vite: {
		resolve: {
			alias: {
				'@': path.resolve(__dirname, './src'),
				'#': path.resolve(__dirname, './src'),
			},
		},
		plugins: [
			tailwindcss(),
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
	},
});
