# Contribution mapping

`generateWorld(username, weeks, arena)` in `src/game/generation/SectorGenerator.ts` turns a normalized calendar into sectors. It is deterministic: the same calendar and `GENERATOR_VERSION` always give the same world.

## Rules

| GitHub level | Result | Base health | Points |
| --- | --- | --- | --- |
| 0 | empty position | | |
| 1 | Basic Drone | 20 | 100 |
| 2 | Scout Fighter | 40 | 200 |
| 3 | Armored Fighter | 80 | 350 |
| 4 | Elite Fighter | 110 | 500 |

- **Position.** X is the week within the sector, Y is the weekday with Sunday on top, exactly as on the calendar. Z is a small visual offset by level.
- **Sectors.** Four weeks each (`CONFIG.sector.weeks`), so a 52–53 week calendar gives 13–14 sectors.
- **Health.** Class base × sector progress, capped at 1.5× base. The contribution count never affects health.
- **Count.** Adds a score bonus of 5 per contribution, capped at 50 per enemy.
- **Dense sectors.** More than 16 enemies: the first two weeks enter first and the last two follow when three or fewer ships remain. Every cell is kept.
- **Empty sectors.** A small drone patrol is generated, marked `synthetic: true`, and the HUD shows "NO ACTIVITY · GENERATED PATROL". Patrol ships carry no date and no contribution count.
- **Attack pattern and power-up.** Chosen per sector from the seeded stream.

## Seed

`seedFromCalendar` hashes (FNV-1a) the generator version, the lowercase username and every `date:count:level`. `mulberry32` turns the seed into the random stream. The engine derives its own gameplay stream from the same seed.

## Fairness

A developer with 2,000 contributions does not face a harder game than one with 200:

- at most 28 enemies per sector (the size of the grid), entering in waves
- capped health, attack frequency, diver count and bullet count
- difficulty scales with sector index only
- the rating is score ÷ par, so it does not reward calendar size

## Differences from gh-space-shooter

| | gh-space-shooter | GitArcade |
| --- | --- | --- |
| Output | GIF/WebP animation | Interactive WebGL game |
| Language | Python, Pillow | TypeScript, Three.js |
| Data | GraphQL calendar, last 52 weeks | Same query plus name and avatar, up to 53 weeks |
| Level mapping | 0–4 | Same |
| Grid | week → x, weekday → y, one screen | Same axes, split into four-week sectors |
| Enemy strength | health = level | Class by level, health scaled by sector and capped |
| Enemies | Static, never attack | Move, shoot, dive, state machine |
| Ship | Scripted by a strategy, X only | Player-controlled in X and Y |
| Strategies | column / row / random clearing order for the ship | Reused as the order enemies break formation, and for the preview autopilot |
| Not present there | | Health, shield, lives, power-ups, combos, boss, audio, touch controls, share card |

Verified by reading the reference source (`github_client.py`, `game_state.py`, `strategies/*`, `animator.py`); nothing above is assumed from its README.
