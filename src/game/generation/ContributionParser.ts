import type {
  ContributionDay,
  ContributionLevel,
  ContributionWeek,
} from "../types/ContributionTypes";
import type { EnemyType } from "../types/EnemyTypes";

/**
 * Level names used by GitHub's GraphQL `contributionLevel` field.
 * The 0-4 mapping follows the reference project (czl9707/gh-space-shooter, MIT).
 */
export const LEVEL_MAP: Record<string, ContributionLevel> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

export function levelFromGitHub(level: string): ContributionLevel {
  return LEVEL_MAP[level] ?? 0;
}

const TYPE_BY_LEVEL: Record<ContributionLevel, EnemyType | null> = {
  0: null,
  1: "drone",
  2: "scout",
  3: "armored",
  4: "elite",
};

/** Level 0 is an empty position; 1-4 map to the four enemy classes. */
export function enemyTypeForLevel(level: number): EnemyType | null {
  if (level < 0 || level > 4 || !Number.isInteger(level)) return null;
  return TYPE_BY_LEVEL[level as ContributionLevel];
}

/** Weekday (0 = Sunday) of an ISO date, independent of the local time zone. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export interface CalendarCell {
  week: number;
  weekday: number;
  day: ContributionDay;
}

/** Flattens weeks into cells, keeping the week (x) and weekday (y) structure. */
export function flattenCalendar(weeks: ContributionWeek[]): CalendarCell[] {
  const cells: CalendarCell[] = [];
  weeks.forEach((week, w) => {
    for (const day of week.days) {
      cells.push({ week: w, weekday: weekdayOf(day.date), day });
    }
  });
  return cells;
}

export function calendarRange(weeks: ContributionWeek[]): { startDate: string; endDate: string } {
  const first = weeks[0]?.days[0]?.date ?? "";
  const lastWeek = weeks[weeks.length - 1];
  const last = lastWeek?.days[lastWeek.days.length - 1]?.date ?? "";
  return { startDate: first, endDate: last };
}
