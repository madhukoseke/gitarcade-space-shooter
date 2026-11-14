# Testing

## Unit and integration (Vitest)

```bash
pnpm test
```

90 tests in `src/tests/`, all running in Node with no browser:

| File | Covers |
| --- | --- |
| `validation.test.ts` | Username and profile-URL normalisation, rejected inputs |
| `generation.test.ts` | Level mapping, formation layout, sectors, waves, patrols, difficulty caps, seed reproducibility |
| `systems.test.ts` | Swept collisions, scoring and combos, rating, phase transitions |
| `engine.test.ts` | Movement and bounds, dash, shooting, plasma, Code Storm, damage rules, lives, power-ups, determinism, fixed step, restart, an idle loss, and bot playthroughs to victory in landscape and portrait |
| `github.test.ts` | Client and route with mocked `fetch`: success, unknown user, rate limits, bad token, timeout, malformed and partial responses, empty history, caching, missing token, per-client limit, demo fallback |

The playthrough tests use a simple scripted pilot (`botInput` in `helpers.ts`) that aims, sidesteps and uses the special. It is not frame-perfect, so a win shows the game can be finished without perfect play.

## End-to-end (Playwright)

```bash
pnpm exec playwright install chromium   # once
pnpm test:e2e
```

The suite builds the app with `NEXT_PUBLIC_E2E=1`, starts it on port 3311 and runs four tests in `e2e/game.spec.ts`:

1. Landing page validation and the How to play dialog.
2. Unknown user → friendly error → demo.
3. A full session: enter a profile URL, generate, load the battlefield, start, move, fire, destroy enemies, pause and resume, restart, reach game over, share (copy text, download image), play again.
4. Touch layout: joystick and buttons visible, fire button works, pause works, the page does not scroll.

GitHub is mocked with `page.route` (`e2e/fixtures.ts`), so the run is deterministic and needs no token.

## Limitations

- WebGL runs on SwiftShader (software rendering) at roughly 10 frames a second. That is enough to prove the game works, and says nothing about real performance.
- Game over is forced through the debug handle rather than by losing three lives through play. The lives logic itself is covered in `engine.test.ts`.
- The live GitHub API is never called by the tests.
- Audio output is not asserted.
- Touch is emulated; no physical devices are used.
