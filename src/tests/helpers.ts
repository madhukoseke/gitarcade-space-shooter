import { GameEngine } from "@/game/core/GameEngine";
import { generateWorld } from "@/game/generation/SectorGenerator";
import type { ContributionLevel, ContributionWeek } from "@/game/types/ContributionTypes";
import { createInput, type Arena, type InputState } from "@/game/types/GameTypes";

export const LANDSCAPE: Arena = { halfW: 13, halfH: 8, portrait: false };
export const PORTRAIT: Arena = { halfW: 7, halfH: 11, portrait: true };
export const DT = 1 / 60;

const DAY = 86_400_000;

/** Builds a calendar starting on Sunday 2025-11-02 from a level function. */
export function makeWeeks(
  weekCount: number,
  level: (week: number, weekday: number) => ContributionLevel,
  count: (level: ContributionLevel) => number = (l) => l * 3,
): ContributionWeek[] {
  const start = Date.UTC(2025, 10, 2);
  const weeks: ContributionWeek[] = [];
  for (let w = 0; w < weekCount; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const l = level(w, d);
      days.push({ date: new Date(start + (w * 7 + d) * DAY).toISOString().slice(0, 10), count: count(l), level: l });
    }
    weeks.push({ days });
  }
  return weeks;
}

export function makeEngine(weeks: ContributionWeek[], arena: Arena = LANDSCAPE, username = "tester"): GameEngine {
  const world = generateWorld(username, weeks, arena);
  return new GameEngine({ sectors: world.sectors, arena, seed: world.seed, particleCap: 64 });
}

export function stepFor(engine: GameEngine, seconds: number, input: InputState = createInput()): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) engine.step(DT, input);
}

/**
 * Simple test pilot: lines up with the lowest nearby enemy (or the boss),
 * holds fire, sidesteps incoming bullets and the boss beam, and uses the
 * special attack when charged. Deliberately imperfect: no frame-perfect play.
 */
export function botInput(engine: GameEngine, input: InputState): InputState {
  const p = engine.player;
  let targetX = 0;
  let found = false;
  let best = Infinity;
  for (const e of engine.enemies) {
    if (!e.active || e.state === "SPAWNING") continue;
    const key = Math.abs(e.x - p.x) * 2 + e.y;
    if (key < best) {
      best = key;
      targetX = e.x;
      found = true;
    }
  }
  if (!found && engine.boss.active) {
    targetX = engine.boss.x;
    found = true;
  }
  let moveX = found ? Math.max(-1, Math.min(1, (targetX - p.x) * 1.5)) : Math.max(-1, Math.min(1, -p.x));
  let dash = false;
  for (const b of engine.bullets) {
    if (!b.active) continue;
    const dy = b.y - p.y;
    if (dy > -0.3 && dy < 3.2 && Math.abs(b.x + b.vx * 0.25 - p.x) < 1) {
      moveX = b.x >= p.x ? -1 : 1;
      break;
    }
  }
  for (const e of engine.enemies) {
    if (e.active && e.state === "ATTACKING" && e.y - p.y < 4 && e.y > p.y - 1 && Math.abs(e.x - p.x) < 1.6) {
      moveX = e.x >= p.x ? -1 : 1;
      dash = true;
    }
  }
  const boss = engine.boss;
  if (boss.active && boss.beamState !== "off" && Math.abs(boss.beamX - p.x) < 2.2) {
    moveX = boss.beamX >= p.x ? -1 : 1;
    dash = boss.beamState === "fire";
  }
  input.moveX = moveX;
  input.moveY = 0;
  input.fire = found;
  input.plasma = found;
  input.dash = dash;
  input.special = p.energy >= 100 && found;
  return input;
}
