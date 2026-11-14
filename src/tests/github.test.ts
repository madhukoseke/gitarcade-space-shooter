import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GameEngine } from "@/game/core/GameEngine";
import { generateWorld } from "@/game/generation/SectorGenerator";
import { fetchContributionCalendar, GitHubError } from "@/lib/github/client";
import { clearContributionCache, getContributions, normalizeUser } from "@/lib/github/contributions";
import { createDemoProfile } from "@/lib/github/demo";
import { createRateLimiter } from "@/lib/github/rateLimit";
import { profileSchema } from "@/lib/github/validation";
import { LANDSCAPE } from "./helpers";

const LEVELS = ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"];

function graphqlUser(counts: (week: number, day: number) => number = (w, d) => (w + d) % 5) {
  const weeks = Array.from({ length: 53 }, (_, w) => ({
    contributionDays: Array.from({ length: 7 }, (_, d) => {
      const n = counts(w, d);
      const date = new Date(Date.UTC(2025, 10, 2) + (w * 7 + d) * 86_400_000).toISOString().slice(0, 10);
      return { date, contributionCount: n, contributionLevel: LEVELS[Math.min(4, n)] };
    }),
  }));
  const total = weeks.flatMap((w) => w.contributionDays).reduce((s, d) => s + d.contributionCount, 0);
  return {
    login: "Octocat",
    name: "The Octocat",
    avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
    contributionsCollection: { contributionCalendar: { totalContributions: total, weeks } },
  };
}

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" }, ...init });

const mockFetch = (response: () => Response | Promise<Response>) => vi.fn(async () => response()) as unknown as typeof fetch;

beforeEach(() => {
  clearContributionCache();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GitHub contribution client", () => {
  it("returns normalized data on success", async () => {
    const fetchImpl = mockFetch(() => json({ data: { user: graphqlUser() } }));
    const profile = await getContributions("octocat", { token: "t", fetchImpl });
    expect(profile.username).toBe("Octocat");
    expect(profile.displayName).toBe("The Octocat");
    expect(profile.avatarUrl).toContain("avatars.githubusercontent.com");
    expect(profile.calendar.weeks).toHaveLength(53);
    expect(profile.calendar.startDate).toBe("2025-11-02");
    expect(profile.calendar.weeks[0].days[1]).toEqual({ date: "2025-11-03", count: 1, level: 1 });
    expect(profile.simulated).toBeUndefined();
    expect(profileSchema.safeParse(profile).success).toBe(true);
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer t");
    expect(JSON.parse(init.body).variables).toEqual({ username: "octocat" });
  });

  it("drops avatar URLs that are not GitHub-hosted https", () => {
    const user = { ...graphqlUser(), avatarUrl: "http://evil.example/a.png" };
    expect(normalizeUser(user).avatarUrl).toBeNull();
  });

  it("caches successes for an hour and never caches failures", async () => {
    let now = 1_000;
    let fail = true;
    const fetchImpl = mockFetch(() => (fail ? json({}, { status: 500 }) : json({ data: { user: graphqlUser() } })));
    const options = { token: "t", fetchImpl, now: () => now };
    await expect(getContributions("octocat", options)).rejects.toMatchObject({ code: "UPSTREAM" });
    fail = false;
    await getContributions("octocat", options);
    await getContributions("OCTOCAT", options);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    now += 61 * 60 * 1000;
    await getContributions("octocat", options);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["unknown user (null)", () => json({ data: { user: null } }), "NOT_FOUND"],
    ["unknown user (error)", () => json({ data: { user: null }, errors: [{ type: "NOT_FOUND", message: "x" }] }), "NOT_FOUND"],
    ["GraphQL rate limit", () => json({ errors: [{ type: "RATE_LIMITED", message: "x" }] }), "RATE_LIMITED"],
    ["HTTP 429", () => json({}, { status: 429 }), "RATE_LIMITED"],
    ["HTTP 403 with exhausted quota", () => json({}, { status: 403, headers: { "x-ratelimit-remaining": "0" } }), "RATE_LIMITED"],
    ["bad token", () => json({}, { status: 401 }), "NO_TOKEN"],
    ["server error", () => json({}, { status: 502 }), "UPSTREAM"],
    ["non-JSON body", () => new Response("<html>", { status: 200 }), "MALFORMED"],
    ["malformed shape", () => json({ data: { user: { login: "x", contributionsCollection: { contributionCalendar: { weeks: "nope" } } } } }), "MALFORMED"],
    ["partial day", () => json({ data: { user: { ...graphqlUser(), contributionsCollection: { contributionCalendar: { totalContributions: 1, weeks: [{ contributionDays: [{ date: "tomorrow" }] }] } } } } }), "MALFORMED"],
  ])("maps %s to a stable error code", async (_name, response, code) => {
    await expect(fetchContributionCalendar("octocat", { token: "t", fetchImpl: mockFetch(response) })).rejects.toMatchObject({ code });
  });

  it("fails without a token before making any request", async () => {
    const fetchImpl = mockFetch(() => json({}));
    await expect(fetchContributionCalendar("octocat", { token: undefined, fetchImpl })).rejects.toMatchObject({ code: "NO_TOKEN" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("times out slow requests", async () => {
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })) as unknown as typeof fetch;
    const promise = fetchContributionCalendar("octocat", { token: "t", fetchImpl, timeoutMs: 20 });
    await expect(promise).rejects.toBeInstanceOf(GitHubError);
    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("an empty contribution history still produces a playable world", async () => {
    const fetchImpl = mockFetch(() => json({ data: { user: graphqlUser(() => 0) } }));
    const profile = await getContributions("octocat", { token: "t", fetchImpl });
    expect(profile.totalContributions).toBe(0);
    const world = generateWorld(profile.username, profile.calendar.weeks, LANDSCAPE);
    expect(world.contributionEnemies).toBe(0);
    expect(world.sectors.every((s) => s.synthetic)).toBe(true);
    const engine = new GameEngine({ sectors: world.sectors, arena: LANDSCAPE, seed: world.seed });
    expect(engine.enemies.some((e) => e.active)).toBe(true);
  });
});

describe("demo fallback", () => {
  it("is flagged as simulated, deterministic and playable", () => {
    const demo = createDemoProfile();
    expect(demo.simulated).toBe(true);
    expect(demo).toEqual(createDemoProfile());
    expect(demo.calendar.weeks).toHaveLength(52);
    const world = generateWorld(demo.username, demo.calendar.weeks, LANDSCAPE);
    expect(world.contributionEnemies).toBeGreaterThan(50);
    expect(world.sectors.some((s) => s.synthetic)).toBe(true);
  });
});

describe("rate limiter", () => {
  it("blocks after the limit and recovers after the window", () => {
    let now = 0;
    const limiter = createRateLimiter(2, 1000, () => now);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    const blocked = limiter.check("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(limiter.check("b").allowed).toBe(true);
    now = 1001;
    expect(limiter.check("a").allowed).toBe(true);
  });
});

describe("GET /api/github/contributions", () => {
  const call = async (query: string, ip = "10.0.0.1") => {
    const { GET } = await import("@/app/api/github/contributions/route");
    return GET(new NextRequest(`http://localhost/api/github/contributions${query}`, { headers: { "x-forwarded-for": ip } }));
  };

  it("returns the normalized profile and cache headers", async () => {
    vi.stubEnv("GITHUB_TOKEN", "server-secret");
    vi.stubGlobal("fetch", mockFetch(() => json({ data: { user: graphqlUser() } })));
    const response = await call("?username=https://github.com/octocat");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
    const text = await response.text();
    expect(text).not.toContain("server-secret");
    expect(profileSchema.safeParse(JSON.parse(text)).success).toBe(true);
  });

  it("rejects invalid usernames without calling GitHub", async () => {
    vi.stubEnv("GITHUB_TOKEN", "t");
    const fetchImpl = mockFetch(() => json({}));
    vi.stubGlobal("fetch", fetchImpl);
    for (const query of ["", "?username=", "?username=bad%20name", "?username=owner/repo"]) {
      const response = await call(query);
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("INVALID");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown user", () => json({ data: { user: null } }), 404, "NOT_FOUND"],
    ["rate limited", () => json({}, { status: 429 }), 429, "RATE_LIMITED"],
    ["invalid response", () => new Response("oops"), 502, "MALFORMED"],
  ])("returns a safe error for %s", async (_name, upstream, status, code) => {
    vi.stubEnv("GITHUB_TOKEN", "server-secret");
    vi.stubGlobal("fetch", mockFetch(upstream));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await call("?username=ghost-user");
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.error.code).toBe(code);
    expect(body.error.message).not.toMatch(/server-secret|GraphQL|stack|Error:/);
  });

  it("reports a missing server token as demo-able", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await call("?username=octocat");
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("NO_TOKEN");
    expect(body.error.message).toMatch(/demo/i);
  });

  it("rate-limits a single client", async () => {
    vi.stubEnv("GITHUB_TOKEN", "t");
    vi.stubGlobal("fetch", mockFetch(() => json({ data: { user: graphqlUser() } })));
    let last = await call("?username=octocat", "10.9.9.9");
    for (let i = 0; i < 31; i++) last = await call("?username=octocat", "10.9.9.9");
    expect(last.status).toBe(429);
    expect(last.headers.get("Retry-After")).toBeTruthy();
    expect((await last.json()).error.code).toBe("TOO_MANY_REQUESTS");
  });
});
