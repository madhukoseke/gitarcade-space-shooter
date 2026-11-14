import { CONFIG } from "../core/GameConfig";
import type { Sector } from "../types/ContributionTypes";
import type { Stats } from "../types/GameTypes";

export function createStats(parScore = 0): Stats {
  return {
    score: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    damageTaken: 0,
    sectorsCompleted: 0,
    time: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    multiplier: 1,
    parScore,
  };
}

export function multiplierForCombo(combo: number): number {
  return Math.min(
    CONFIG.combo.maxMultiplier,
    1 + Math.floor(Math.max(0, combo) / CONFIG.combo.killsPerStep),
  );
}

/** Registers a kill, extends the combo and returns the points awarded. */
export function registerKill(stats: Stats, basePoints: number, bonus = 0): number {
  stats.kills += 1;
  stats.combo += 1;
  stats.comboTimer = CONFIG.combo.window;
  stats.maxCombo = Math.max(stats.maxCombo, stats.combo);
  stats.multiplier = multiplierForCombo(stats.combo);
  const points = (basePoints + bonus) * stats.multiplier;
  stats.score += points;
  return points;
}

/** Combo expires after a period without kills. */
export function tickCombo(stats: Stats, dt: number): void {
  if (stats.combo <= 0) return;
  stats.comboTimer -= dt;
  if (stats.comboTimer <= 0) {
    stats.combo = 0;
    stats.comboTimer = 0;
    stats.multiplier = 1;
  }
}

/** Taking damage halves the combo. */
export function reduceComboOnDamage(stats: Stats): void {
  stats.combo = Math.floor(stats.combo / 2);
  stats.multiplier = multiplierForCombo(stats.combo);
  if (stats.combo === 0) stats.comboTimer = 0;
}

export function accuracy(stats: Stats): number {
  return stats.shotsFired > 0 ? Math.min(1, stats.shotsHit / stats.shotsFired) : 0;
}

/**
 * Par = what a full clear earns with no combo multiplier. Dividing the score by
 * par gives a rating that is comparable between developers whose calendars
 * produce very different numbers of enemies.
 */
export function computeParScore(sectors: Sector[]): number {
  let par = CONFIG.score.boss;
  for (const sector of sectors) {
    par += CONFIG.score.sectorClear;
    for (const e of sector.enemies) par += CONFIG.enemies[e.type].score + e.scoreBonus;
  }
  return par;
}

export function computeRating(score: number, par: number): "S" | "A" | "B" | "C" | "D" {
  const ratio = par > 0 ? score / par : 0;
  if (ratio >= 3) return "S";
  if (ratio >= 2) return "A";
  if (ratio >= 1.2) return "B";
  if (ratio >= 0.6) return "C";
  return "D";
}
