import { CONFIG } from "../core/GameConfig";
import type { SectorDifficulty } from "../types/ContributionTypes";
import type { EnemyType } from "../types/EnemyTypes";

/**
 * Difficulty depends only on how far the player has progressed, never on how
 * many contributions the developer has. Every value is clamped.
 */
export function difficultyForSector(index: number): SectorDifficulty {
  const i = Math.max(0, index);
  return {
    healthMul: Math.min(CONFIG.enemyHealthCapMul, 1 + 0.04 * i),
    fireRateMul: Math.min(1.8, 1 + 0.06 * i),
    bulletSpeedMul: Math.min(1.4, 1 + 0.03 * i),
    attackInterval: Math.max(1.2, 3.4 - 0.2 * i),
    maxAttackers: Math.min(4, 1 + Math.floor(i / 2)),
    maxEnemyBullets: Math.min(34, Math.round(14 + 1.6 * i)),
  };
}

/** Health comes from the enemy class and sector progress, capped at base * cap. */
export function enemyHealth(type: EnemyType, difficulty: SectorDifficulty): number {
  const base = CONFIG.enemies[type].health;
  const cap = base * CONFIG.enemyHealthCapMul;
  return Math.min(cap, Math.round(base * difficulty.healthMul));
}

/** Small capped score bonus from the day's contribution count. */
export function contributionBonus(count: number): number {
  const c = Math.max(0, Math.floor(count));
  return Math.min(CONFIG.sector.contributionBonusCap, c * CONFIG.sector.contributionBonusPerCount);
}
