import { calendarRange } from "@/game/generation/ContributionParser";
import { hashString, mulberry32 } from "@/game/generation/SeedGenerator";
import type { ContributionLevel, ContributionProfile, ContributionWeek } from "@/game/types/ContributionTypes";

export const DEMO_USERNAME = "demo-pilot";

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Builds a SIMULATED calendar for demo mode. It is never presented as GitHub
 * data: the profile is flagged `simulated` and the UI labels it everywhere.
 * Fixed dates and a fixed seed keep the demo identical on every run.
 */
export function createDemoProfile(seedText = "gitarcade-demo"): ContributionProfile {
  const rng = mulberry32(hashString(seedText));
  const DAY = 86_400_000;
  const start = Date.UTC(2025, 10, 2); // a Sunday
  const weeks: ContributionWeek[] = [];
  let total = 0;
  for (let w = 0; w < 52; w++) {
    // Busy and quiet stretches, including one fully empty sector.
    const season = w >= 20 && w < 24 ? 0 : 0.35 + 0.45 * Math.abs(Math.sin(w * 0.37));
    const days = [];
    for (let d = 0; d < 7; d++) {
      const weekend = d === 0 || d === 6;
      const active = rng() < season * (weekend ? 0.45 : 1);
      let count = 0;
      if (active) count = 1 + Math.floor(Math.pow(rng(), 2.2) * 18);
      const level: ContributionLevel = count === 0 ? 0 : count <= 3 ? 1 : count <= 7 ? 2 : count <= 12 ? 3 : 4;
      total += count;
      days.push({ date: isoDate(start + (w * 7 + d) * DAY), count, level });
    }
    weeks.push({ days });
  }
  return {
    username: DEMO_USERNAME,
    displayName: "Demo Pilot",
    avatarUrl: null,
    totalContributions: total,
    calendar: { ...calendarRange(weeks), weeks },
    simulated: true,
  };
}
