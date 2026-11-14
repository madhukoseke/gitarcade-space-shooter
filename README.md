# GitArcade: Space Shooter

**Your contributions. Your battlefield.**

A browser 3D arcade shooter generated from a GitHub contribution calendar. Enter a username, watch the contribution graph turn into an enemy fleet, then fight through it sector by sector and face the boss, *Merge Conflict*.

- Every active day on the calendar becomes one enemy ship, placed where its square sits on the graph (week on X, weekday on Y).
- Contribution level decides the enemy class: drone, scout, armored fighter, elite.
- The year is split into four-week sectors (about 13), followed by a three-phase boss.
- Laser, Plasma Blast, dash, the Code Storm special, shields, lives, power-ups, combos, pause, restart, share card.
- Keyboard on desktop, virtual joystick and buttons on touch devices.

GitHub's calendar counts qualifying activity. It is not a record of everything a developer has built, and the game does not present it as one.

## Requirements

- Node.js 22 or newer
- pnpm 10 (`corepack enable` provides it)

## Install

```bash
pnpm install
```

## Configure the GitHub token

Real profiles need a server-side token for GitHub's GraphQL API.

1. Create a token at <https://github.com/settings/tokens>: a classic token with the `read:user` scope, or a fine-grained token with no extra permissions.
2. Copy `.env.example` to `.env.local` and set `GITHUB_TOKEN`.

The token is read only in the API route on the server. Never rename it with a `NEXT_PUBLIC_` prefix. Without a token the app still runs: `/demo` works, and real usernames show a friendly error that links to the demo.

## Run locally

```bash
pnpm dev
```

Open <http://localhost:3000>. `/demo` plays with simulated data (labelled as such) and needs no token.

## Tests

```bash
pnpm test        # Vitest: generation, scoring, collisions, engine, GitHub route (mocked)
pnpm test:e2e    # Playwright: builds, starts the app, plays through a session
pnpm lint
pnpm typecheck
```

The end-to-end suite needs Chromium once: `pnpm exec playwright install chromium`. See [docs/TESTING.md](docs/TESTING.md).

## Production build

```bash
pnpm build
pnpm start
```

## Deploy

The app is a standard Next.js App Router project and deploys to Vercel without extra configuration:

1. Import the repository in Vercel (or run `vercel` from the project folder).
2. Add `GITHUB_TOKEN` as a server environment variable for Production and Preview.
3. Deploy.

Any Node host that can run `pnpm build && pnpm start` also works. Details in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrow keys | Move |
| Space | Laser Cannon (hold) |
| Q (or F) | Plasma Blast |
| Shift | Dash |
| E | Code Storm (needs full energy) |
| Esc (or P) | Pause |

## Known limitations

- **Real GitHub data has not been exercised against the live API in this repository's test runs.** The route, client and normalisation are covered with mocked responses; add a token and try a username to confirm on your machine.
- **Frame rate has not been profiled on real GPUs.** Automated runs use software WebGL, which is far slower than a real device. The renderer uses instancing and pooling throughout, but the 60 FPS desktop and 30 FPS mobile targets are unverified.
- **Touch controls are verified in an emulated mobile browser only**, not on physical phones.
- The API rate limit and response cache are in memory per server instance. On serverless hosts each instance has its own counters; the CDN `Cache-Control` header does the shared caching.
- Sound effects are synthesised. There is no music.
- One boss, no leaderboards, no accounts, no score verification. Results are local.
- Rotating a phone mid-run keeps the arena chosen at launch and letterboxes it.
- React Three Fiber logs a `THREE.Clock` deprecation warning with current Three.js; it comes from the library, not this code.

## Attribution

Concept and contribution-mapping ideas come from [czl9707/gh-space-shooter](https://github.com/czl9707/gh-space-shooter) by Zane Chen (MIT), which renders a contribution graph as a GIF. The GraphQL query shape, the 0-4 level mapping, the week/weekday grid mapping and the column/row/random orderings were adapted to TypeScript; the interactive game is new. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [docs/CONTRIBUTION_MAPPING.md](docs/CONTRIBUTION_MAPPING.md).

This is a fan project and is not affiliated with GitHub.
