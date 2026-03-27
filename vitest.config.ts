import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		exclude: ['src/**/*.browser.test.ts'],
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'#': path.resolve(__dirname, './src'),
		},
		extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
	},
});
