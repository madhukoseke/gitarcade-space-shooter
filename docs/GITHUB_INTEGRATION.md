# GitHub integration

## Endpoint

`GET /api/github/contributions?username=<username or github.com profile URL>`

Success (200):

```json
{
  "username": "example",
  "displayName": "Example Developer",
  "avatarUrl": null,
  "totalContributions": 250,
  "calendar": {
    "startDate": "2025-11-02",
    "endDate": "2026-11-01",
    "weeks": [{ "days": [{ "date": "2025-11-02", "count": 3, "level": 2 }] }]
  }
}
```

(Illustrative values.) Errors return `{ "error": { "code", "message" } }` with `Cache-Control: no-store`.

| Code | Status | Cause |
| --- | --- | --- |
| `INVALID` | 400 | Input is not a username or profile URL |
| `NOT_FOUND` | 404 | No such user (including deleted accounts) |
| `RATE_LIMITED` | 429 | GitHub's API limit was reached |
| `TOO_MANY_REQUESTS` | 429 | This server's per-client limit (30/minute), with `Retry-After` |
| `NO_TOKEN` | 503 | `GITHUB_TOKEN` missing or rejected |
| `TIMEOUT` | 504 | GitHub did not answer within 8 s |
| `UPSTREAM` / `MALFORMED` | 502 | GitHub error, or a response that failed validation |

Messages are written for players. Technical detail goes to the server log only.

## How it works

1. `normalizeUsername` (`src/lib/github/validation.ts`) accepts a login or a `github.com/<login>` URL and rejects repository URLs, other hosts, reserved paths and malformed input.
2. `fetchContributionCalendar` (`client.ts`) posts one GraphQL query with the server token, an 8 s `AbortController` timeout and `cache: "no-store"`.
3. The response is validated with Zod before use.
4. `normalizeUser` (`contributions.ts`) maps `contributionLevel` to 0–4, keeps the raw count, keeps at most 53 weeks, and drops avatar URLs that are not HTTPS on `githubusercontent.com`.
5. The client validates the route's response again with `profileSchema`.

Only the official GraphQL API is used. No HTML is scraped.

## Token

`GITHUB_TOKEN` is read from `process.env` inside the route handler. It is never sent to the browser, never given a `NEXT_PUBLIC_` prefix and never stored in local storage. Public profiles need no user login.

## Caching and rate limiting

- Successful responses are cached in memory for one hour per lowercase username (500 entries at most). Failures are never cached.
- Successful responses also carry `Cache-Control: public, s-maxage=3600, stale-while-revalidate=600`, so a CDN such as Vercel's can serve repeats without invoking the function.
- A fixed-window limiter allows 30 requests a minute per client address.

Both the memory cache and the limiter are per server instance. That is a deliberate choice to avoid adding a database; it is a best-effort guard, not a global quota.

## Demo mode

`/demo` never calls GitHub. `createDemoProfile` builds a seeded calendar with `simulated: true`, and the briefing, HUD, result screen and share card all label it "SIMULATED DATA".

## Empty calendars

A user with no contributions still gets a playable run: every sector becomes a generated patrol, and the briefing says so.
