import { calendarRange, levelFromGitHub } from "@/game/generation/ContributionParser";
import type { ContributionProfile, ContributionWeek } from "@/game/types/ContributionTypes";
import { fetchContributionCalendar, type FetchOptions, type GitHubUser } from "./client";

/** GitHub returns up to 53 partial weeks for a rolling year. */
export const MAX_WEEKS = 53;
export const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

function safeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const ok = parsed.protocol === "https:" && parsed.hostname.endsWith("githubusercontent.com");
    return ok ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Converts the validated GraphQL user into the normalized shape the game uses. */
export function normalizeUser(user: GitHubUser): ContributionProfile {
  const calendar = user.contributionsCollection.contributionCalendar;
  const weeks: ContributionWeek[] = calendar.weeks
    .map((week) => ({
      days: week.contributionDays.map((day) => ({
        date: day.date,
        count: day.contributionCount,
        level: levelFromGitHub(day.contributionLevel),
      })),
    }))
    .filter((week) => week.days.length > 0)
    .slice(-MAX_WEEKS);
  return {
    username: user.login,
    displayName: user.name?.trim() || null,
    avatarUrl: safeAvatarUrl(user.avatarUrl),
    totalContributions: calendar.totalContributions,
    calendar: { ...calendarRange(weeks), weeks },
  };
}

interface CacheEntry {
  expires: number;
  profile: ContributionProfile;
}

const cache = new Map<string, CacheEntry>();

export function clearContributionCache(): void {
  cache.clear();
}

export interface GetOptions extends FetchOptions {
  now?: () => number;
}

/**
 * Returns a user's normalized contribution calendar. Successful results are
 * cached in memory for an hour; failures are never cached.
 */
export async function getContributions(username: string, options: GetOptions): Promise<ContributionProfile> {
  const now = options.now ?? Date.now;
  const key = username.toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.expires > now()) return hit.profile;

  const profile = normalizeUser(await fetchContributionCalendar(username, options));
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expires: now() + CACHE_TTL_MS, profile });
  return profile;
}
