# Development

## Setup

```bash
pnpm install
cp .env.example .env.local   # then set GITHUB_TOKEN (optional for /demo)
pnpm dev
```

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Dev server with Turbopack |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm test` | Vitest unit and integration tests |
| `pnpm test:e2e` | Playwright end-to-end tests |

## Where things go

- A balance change: `src/game/core/GameConfig.ts`. Nothing else should hold gameplay numbers.
- A new gameplay rule: a function in `src/game/systems/`, called from `GameEngine.step`. Add a test in `src/tests/engine.test.ts`.
- A change to how calendars become enemies: `src/game/generation/`, and bump `GENERATOR_VERSION` so old seeds are not compared with new ones.
- A new visual: a component in `src/components/game/` that reads the engine in `useFrame`. Do not put game state in React state.

## Conventions

- `src/game/**` must not import React or Three.js.
- No allocation inside `step()` or `useFrame` callbacks. Reuse a scratch `Object3D`/`Color` and the pools.
- The lint rule `react-hooks/immutability` is on. Mutable scratch data goes in refs; engine, input and camera-rig changes go through their methods (`setFleetReveal`, `setEnabled`, `rig.set`).
- Next.js 16 with Cache Components: dynamic route params are read inside a `<Suspense>` boundary (see `src/app/play/[username]/page.tsx`).

## Debug handle

In dev builds, and in production builds made with `NEXT_PUBLIC_E2E=1`, the game page exposes `window.__GITARCADE__ = { engine, store }`. The end-to-end tests use it to read state and to end a run (`engine.debugKillPlayer()`). It is absent from normal production builds.

## Deployment

Vercel: import the repository, set `GITHUB_TOKEN` for Production and Preview, deploy. No other configuration is needed; the API route runs on the default Node.js runtime.

Other hosts: `pnpm build && pnpm start` behind HTTPS. Forward the client address in `X-Forwarded-For` so the rate limiter can tell clients apart. Do not set `NEXT_PUBLIC_E2E` in production.
