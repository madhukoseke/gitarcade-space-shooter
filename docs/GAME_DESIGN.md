# Game design

All numbers live in `src/game/core/GameConfig.ts`.

## Player

| | |
| --- | --- |
| Hull | 100 |
| Shield | 50, absorbs damage first, slowly regenerates after 5 s without a hit |
| Lives | 3 |
| Speed | 13 units/s with a fast velocity response (little inertia) |
| Dash | Shift: 0.16 s burst, 0.28 s invulnerability, 1.2 s cooldown |

After any hit the ship is invulnerable for 0.8 s. Losing all hull spends a life, refills hull, clears enemy bullets and gives 2.2 s of invulnerability. No lives left ends the run.

## Weapons

| Weapon | Key | Behaviour |
| --- | --- | --- |
| Laser Cannon | Space | 10 damage, 0.14 s cooldown, fast |
| Plasma Blast | Q / F | 60 damage plus 30 to everything within 2.3 units, 2.4 s cooldown, slower shot |
| Code Storm | E | Needs 100 energy (7 per kill). 90 damage to every enemy within 9.5 units, 260 to the boss, clears bullets in range |

Projectiles use swept collision, so speed never lets them pass through a target.

## Enemies

| Class | Level | Health | Points | Behaviour |
| --- | --- | --- | --- | --- |
| Basic Drone | 1 | 20 | 100 | Slow straight shots |
| Scout Fighter | 2 | 40 | 200 | Aimed shots, dives at the player |
| Armored Fighter | 3 | 80 | 350 | Heavy aimed shots |
| Elite Fighter | 4 | 110 | 500 | Alternates a three-way spread with fast twin shots, dives |

State machine: `SPAWNING → FORMING → IDLE → ATTACKING → RETURNING → IDLE`, and `DESTROYED`. The formation sways together. Only the two lowest ships in each column fire. An attack director lets a bounded number of ships dive at once; the order they leave in is the sector's attack pattern (column, row zig-zag or distance-weighted random). A dive starts with a short upward wind-up so it can be read.

## Sectors and difficulty

Four weeks per sector. Difficulty depends only on the sector index: health ×1.00–1.50, fire rate ×1.0–1.8, bullet speed ×1.0–1.4, 1–4 simultaneous divers, 14–34 enemy bullets on screen. Every value is clamped. See [CONTRIBUTION_MAPPING.md](CONTRIBUTION_MAPPING.md) for how contribution volume is kept from deciding difficulty.

Clearing a sector gives 1,000 points, 20 shield and sometimes a power-up.

## Boss: Merge Conflict

4,200 health, built from "ours" and "theirs" code blocks around conflict markers.

1. **Phase 1 (100–66%)**: aimed five-shot fans and twelve-shot rings.
2. **Phase 2 (66–33%)**: adds a sweeping laser. A thin blinking line marks where it will fire for 1.1 s, then the beam sweeps for 1.8 s.
3. **Phase 3 (below 33%)**: adds summoned drones (up to six).

Each phase change staggers the boss for 1.3 s. Defeating it gives 5,000 points and victory.

## Scoring

Kill points × combo multiplier. The multiplier rises by one every three kills in a row (max ×8), expires after 2.6 s without a kill, and halves when the player is hit. A day's contribution count adds a small bonus (5 per contribution, capped at 50).

Tracked: score, enemies defeated, accuracy, damage taken, sectors completed, survival time, highest combo.

**Rating.** Raw score grows with the number of enemies, which depends on the calendar. The rating divides the score by *par*, the score a full clear earns with no combo. D < 0.6, C, B ≥ 1.2, A ≥ 2, S ≥ 3. Two players with very different calendars are compared on the same scale.

## Power-ups

| Power-up | Shape | Effect |
| --- | --- | --- |
| Rapid Fire | chevrons, yellow | Laser cooldown halved for 8 s |
| Shield Recharge | ring, blue | +50 shield |
| Double Laser | twin bars, magenta | Two streams from the wing emitters for 10 s |

Drop chance 6% (16% from elites), never more often than every 9 s.

## Accessibility

Keyboard-operable menus with visible focus, pause on Esc and when the tab is hidden, volume and mute, a reduced-effects switch (no shake, bloom or damage flash), `prefers-reduced-motion` support (intro and countdown are shortened, the landing preview is frozen), text labels and shapes alongside every colour cue.
