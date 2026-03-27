# Miner

A voxel game running in the browser, built just for fun. Reuses Minecraft default assets for textures and models.

**Live**: [mine.wener.cc](https://mine.wener.cc)

## Tech Stack

- **Rendering**: Three.js with custom block/entity shaders
- **Framework**: Waku (React SSR) + Hono
- **Styling**: Tailwind CSS + daisyUI
- **Deploy**: Cloudflare Workers
- **Testing**: Vitest (node + browser with Playwright)

## Commands

```bash
pnpm dev              # dev server on :3060
pnpm build            # production build
pnpm deploy           # build + deploy to Cloudflare
pnpm typecheck        # type check
pnpm test:mineweb:node       # run node tests
pnpm test:mineweb:browser    # run browser tests
```

## License

MIT
