import { z } from "zod";

/** GitHub login rules: 1-39 chars, alphanumeric or single hyphens, no leading/trailing hyphen. */
export const USERNAME_PATTERN = /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/;

export const usernameSchema = z.string().regex(USERNAME_PATTERN);

/** First path segments on github.com that are site pages, not profiles. */
const RESERVED = new Set([
  "about", "apps", "collections", "contact", "customer-stories", "enterprise", "events", "explore",
  "features", "issues", "join", "login", "logout", "marketplace", "new", "notifications", "orgs",
  "organizations", "pricing", "pulls", "search", "security", "sessions", "settings", "signup",
  "site", "sponsors", "team", "topics", "trending",
]);

export type NormalizeResult =
  | { ok: true; username: string }
  | { ok: false; reason: "empty" | "invalid" | "unsupported_url" | "repo_url"; message: string };

const fail = (reason: Exclude<NormalizeResult, { ok: true }>["reason"], message: string): NormalizeResult => ({
  ok: false,
  reason,
  message,
});

/**
 * Accepts a GitHub username or a github.com profile URL and returns the
 * username. Everything else is rejected with a message safe to show to users.
 */
export function normalizeUsername(raw: unknown): NormalizeResult {
  if (typeof raw !== "string") return fail("empty", "Enter a GitHub username.");
  let input = raw.trim();
  if (!input) return fail("empty", "Enter a GitHub username.");
  if (input.length > 200) return fail("invalid", "That doesn't look like a GitHub username.");

  if (/^[\w.-]+\/[\w.-]+\/?$/.test(input) && !/^(www\.)?github\.com\//i.test(input)) {
    return fail("repo_url", "That looks like a repository (owner/name). Enter just the username.");
  }

  const looksLikeUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(input) || /^(www\.)?github\.com(\/|$)/i.test(input);
  if (looksLikeUrl || input.includes("/")) {
    const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`;
    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      return fail("invalid", "That doesn't look like a GitHub username or profile URL.");
    }
    const host = url.hostname.toLowerCase();
    if ((url.protocol !== "https:" && url.protocol !== "http:") || (host !== "github.com" && host !== "www.github.com")) {
      return fail("unsupported_url", "Only github.com profile URLs are supported.");
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return fail("invalid", "That URL has no username. Try github.com/your-name.");
    if (segments.length > 1) {
      return fail("repo_url", "That looks like a repository or page URL. Paste a profile URL such as github.com/your-name.");
    }
    input = segments[0];
  }

  if (input.startsWith("@")) input = input.slice(1);
  if (!USERNAME_PATTERN.test(input)) {
    return fail("invalid", "GitHub usernames use letters, numbers and single hyphens (max 39 characters).");
  }
  if (RESERVED.has(input.toLowerCase())) {
    return fail("unsupported_url", "That is a GitHub page, not a user profile.");
  }
  return { ok: true, username: input };
}

const levelSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

/** Shape of a successful /api/github/contributions response, validated on the client too. */
export const profileSchema = z.object({
  username: z.string().regex(USERNAME_PATTERN),
  displayName: z.string().max(300).nullable(),
  avatarUrl: z.string().url().nullable(),
  totalContributions: z.number().int().nonnegative(),
  calendar: z.object({
    startDate: z.string(),
    endDate: z.string(),
    weeks: z
      .array(
        z.object({
          days: z
            .array(
              z.object({
                date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                count: z.number().int().nonnegative(),
                level: levelSchema,
              }),
            )
            .max(7),
        }),
      )
      .max(60),
  }),
});
