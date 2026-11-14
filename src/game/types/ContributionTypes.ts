import type { EnemyType } from "./EnemyTypes";

export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

export interface ContributionDay {
  /** ISO date, YYYY-MM-DD */
  date: string;
  /** Raw contribution count reported by GitHub for that day. */
  count: number;
  /** GitHub quartile level, 0 (none) to 4 (fourth quartile). */
  level: ContributionLevel;
}

export interface ContributionWeek {
  days: ContributionDay[];
}

export interface ContributionCalendar {
  startDate: string;
  endDate: string;
  weeks: ContributionWeek[];
}

export interface ContributionProfile {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  totalContributions: number;
  calendar: ContributionCalendar;
  /** True when the calendar was generated locally (demo mode), never for GitHub data. */
  simulated?: boolean;
}

export type PowerUpType = "rapid" | "shield" | "double";
export type AttackPattern = "column" | "row" | "random";

export interface GeneratedEnemy {
  id: string;
  /** ISO date of the contribution day; empty for synthetic filler enemies. */
  date: string;
  contributionCount: number;
  level: number;
  type: EnemyType;
  health: number;
  position: { x: number; y: number; z: number };
  /** Week column within the sector (0-based). */
  col: number;
  /** Weekday row (0 = Sunday). */
  row: number;
  /** Wave the enemy enters in (dense sectors are split into waves). */
  wave: number;
  /** Small capped score bonus derived from the contribution count. */
  scoreBonus: number;
  /** True for filler enemies that do not correspond to GitHub activity. */
  synthetic: boolean;
}

export interface SectorDifficulty {
  healthMul: number;
  fireRateMul: number;
  bulletSpeedMul: number;
  attackInterval: number;
  maxAttackers: number;
  maxEnemyBullets: number;
}

export interface Sector {
  index: number;
  weekStart: number;
  weekEnd: number;
  startDate: string;
  endDate: string;
  /** Sum of contribution counts in the sector's weeks. */
  contributionTotal: number;
  /** True when the sector had no contributions and holds a generated patrol. */
  synthetic: boolean;
  enemies: GeneratedEnemy[];
  waveCount: number;
  attackPattern: AttackPattern;
  difficulty: SectorDifficulty;
  powerUp: PowerUpType | null;
}
