/**
 * Cloudflare Worker entry point.
 * Routes /api/* to Hono, everything else to Waku SSR/static.
 * 
 * Usage: After `waku build`, replace wrangler.toml `main` with this entry,
 * or use `scripts/build-worker.ts` to auto-compose.
 */
import { app as honoApp } from './hono-app';

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/mine/')) {
      return honoApp.fetch(request, env, ctx);
    }

    // Delegate to Waku's built output (imported dynamically to avoid build-time coupling)
    try {
      const wakuModule = await import('../waku.server');
      const waku = wakuModule.default;
      if (typeof waku?.fetch === 'function') {
        return waku.fetch(request, env, ctx);
      }
    } catch {
      // Waku module not available in dev
    }

    return new Response('Not found', { status: 404 });
  },
};
