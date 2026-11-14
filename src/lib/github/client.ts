import { z } from "zod";

export type GitHubErrorCode =
  | "INVALID"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "NO_TOKEN"
  | "TIMEOUT"
  | "UPSTREAM"
  | "MALFORMED";

/** Error with a stable code. The message is for server logs, never for users. */
export class GitHubError extends Error {
  constructor(
    readonly code: GitHubErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

/**
 * Same calendar fields as czl9707/gh-space-shooter (MIT), plus the profile
 * fields the game shows. Uses the official GraphQL API; no HTML scraping.
 */
export const CONTRIBUTIONS_QUERY = /* GraphQL */ `
  query GitArcadeContributions($username: String!) {
    user(login: $username) {
      login
      name
      avatarUrl
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
    }
  }
`;

const daySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contributionCount: z.number().int().nonnegative(),
  contributionLevel: z.string(),
});

const userSchema = z.object({
  login: z.string(),
  name: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  contributionsCollection: z.object({
    contributionCalendar: z.object({
      totalContributions: z.number().int().nonnegative(),
      weeks: z.array(z.object({ contributionDays: z.array(daySchema) })),
    }),
  }),
});

const responseSchema = z.object({
  data: z.object({ user: userSchema.nullable() }).nullable().optional(),
  errors: z.array(z.object({ type: z.string().optional(), message: z.string().optional() })).optional(),
});

export type GitHubUser = z.infer<typeof userSchema>;

export interface FetchOptions {
  token: string | undefined;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Fetches and validates one user's contribution calendar. Throws GitHubError. */
export async function fetchContributionCalendar(username: string, options: FetchOptions): Promise<GitHubUser> {
  const { token, timeoutMs = 8000, fetchImpl = fetch } = options;
  if (!token) throw new GitHubError("NO_TOKEN", "GITHUB_TOKEN is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "contribution-arcade-game",
      },
      body: JSON.stringify({ query: CONTRIBUTIONS_QUERY, variables: { username } }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (controller.signal.aborted) throw new GitHubError("TIMEOUT", "GitHub request timed out");
    throw new GitHubError("UPSTREAM", `Network error: ${error instanceof Error ? error.message : "unknown"}`);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) throw new GitHubError("NO_TOKEN", "GitHub rejected the configured token");
  if (response.status === 429 || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")) {
    throw new GitHubError("RATE_LIMITED", "GitHub API rate limit reached");
  }
  if (!response.ok) throw new GitHubError("UPSTREAM", `GitHub responded with ${response.status}`);

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new GitHubError("MALFORMED", "GitHub returned a non-JSON body");
  }
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) throw new GitHubError("MALFORMED", "GitHub response did not match the expected shape");

  const { data, errors } = parsed.data;
  if (errors?.some((e) => e.type === "RATE_LIMITED")) throw new GitHubError("RATE_LIMITED", "GitHub API rate limit reached");
  if (errors?.some((e) => e.type === "NOT_FOUND") || (data && data.user === null)) {
    throw new GitHubError("NOT_FOUND", `No GitHub user named ${username}`);
  }
  if (errors?.length || !data?.user) throw new GitHubError("UPSTREAM", "GitHub GraphQL returned errors");
  return data.user;
}
