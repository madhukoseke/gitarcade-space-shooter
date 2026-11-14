# Architecture

The simulation is plain TypeScript. React and Three.js only draw it.

```
GitHub GraphQL ─► /api/github/contributions ─► ContributionProfile
                                                     │
                              generation/ (pure) ────┤  generateWorld()
                                                     ▼
                                              Sector[] + seed
                                                     │
                         core/GameEngine (pure) ◄────┘
                           ▲            │ events, hud()
              InputManager │            ▼
                           │     stores/gameStore (Zustand) ─► HTML overlays (HUD, menus)
                           │
        components/game (React Three Fiber) reads engine pools every frame
```

## Layers

| Folder | Role | May import |
| --- | --- | --- |
| `src/game/types` | Shared data shapes | nothing |
| `src/game/generation` | Calendar → sectors → formations. Deterministic, no rendering | types, config |
| `src/game/core` | `GameEngine`, config, collisions, phase table, input | types, systems |
| `src/game/systems` | One file per concern: movement, shooting, enemy AI, spawning, damage, scoring, boss, autopilot | engine, config |
| `src/lib/github` | Validation, GraphQL client, cache, rate limit, demo data | generation types |
| `src/stores` | UI state and persisted preferences | types |
| `src/components/game` | R3F scene, one component per visual system | engine (read), stores |
| `src/components/ui`, `landing` | HTML overlays and the landing page | stores, lib |

`src/game/**` has no React or Three.js imports, so the unit tests run it in Node and other game modes could reuse the generation layer.

## The engine

- **Fixed timestep.** `engine.update(dt)` accumulates real time and runs `step(1/60)` at most five times per frame, then drops the remainder. Same inputs give the same run.
- **Pools.** Enemies, player shots, enemy bullets, particles and power-ups are preallocated arrays with an `active` flag. Nothing is allocated during play; particles recycle the oldest slot.
- **Randomness.** Gameplay uses a seeded `mulberry32` stream derived from the calendar. Particle scatter uses `Math.random` because it is cosmetic and must not shift the gameplay stream.
- **Events.** The engine emits small events (`enemyDown`, `sectorClear`, `gameOver`, …). `GameClient` turns them into sounds, banners and phase changes.

## Rendering

- One `useFrame` (`Simulation` in `GameScene.tsx`) advances the engine before any renderer runs.
- Each visual system copies pool state into an `InstancedMesh`: four meshes for the fleet (one per class), three for projectiles, one for particles, one for the intro cubes. Geometries and materials are created once and disposed on unmount.
- The camera is fixed. It fits the arena to the viewport, follows the intro rig and applies a small shake.
- Bloom is the only post-processing pass and is off on the low preset and in reduced-effects mode.
- The HUD is HTML. The engine's `hud()` snapshot is pushed to the store ten times a second and only when a value changed, so React never re-renders per frame.

## Game phases

`IDLE → LOADING_GITHUB → GENERATING_WORLD → INTRO → READY → PLAYING ⇄ PAUSED`, with `PLAYING → GAME_OVER | VICTORY` and restart going back to `READY`. The table lives in `core/GamePhase.ts`; `gameStore.setPhase` rejects anything not in it. The engine is stepped only in `PLAYING` (and for end-of-run particles), so pausing stops the simulation outright.

## Cleanup

`GameClient` owns the session. On unmount it aborts the fetch, removes the engine listener and HUD timer, detaches keyboard and visibility listeners, disposes the audio context and resets the store. R3F stops its own loop when the canvas unmounts.
