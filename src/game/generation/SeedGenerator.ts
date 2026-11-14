import { GENERATOR_VERSION } from "../core/GameConfig";
import type { ContributionWeek } from "../types/ContributionTypes";

/** FNV-1a 32-bit hash. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seed derived only from normalized data and the generator version. */
export function seedFromCalendar(
  username: string,
  weeks: ContributionWeek[],
  version: number = GENERATOR_VERSION,
): number {
  let key = `v${version}|${username.toLowerCase()}`;
  for (const week of weeks) {
    for (const day of week.days) key += `|${day.date}:${day.count}:${day.level}`;
  }
  return hashString(key);
}

export type Rng = () => number;

/** mulberry32: small deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
