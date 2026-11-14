import type { GitHubErrorCode } from "./client";

export type ApiErrorCode = GitHubErrorCode | "TOO_MANY_REQUESTS" | "NETWORK";

interface ErrorInfo {
  status: number;
  message: string;
}

/** User-facing copy. Technical details stay in server logs. */
export const API_ERRORS: Record<ApiErrorCode, ErrorInfo> = {
  INVALID: { status: 400, message: "That doesn't look like a GitHub username." },
  NOT_FOUND: { status: 404, message: "We couldn't find that GitHub user. Check the spelling, or try the demo." },
  RATE_LIMITED: { status: 429, message: "GitHub is rate-limiting requests right now. Try again in a few minutes, or play the demo." },
  TOO_MANY_REQUESTS: { status: 429, message: "Too many requests from your connection. Wait a moment and try again." },
  NO_TOKEN: { status: 503, message: "Live GitHub data isn't configured on this server. You can still play the demo." },
  TIMEOUT: { status: 504, message: "GitHub took too long to respond. Try again, or play the demo." },
  UPSTREAM: { status: 502, message: "GitHub couldn't be reached. Try again, or play the demo." },
  MALFORMED: { status: 502, message: "GitHub sent data we couldn't read. Try again, or play the demo." },
  NETWORK: { status: 0, message: "Network problem. Check your connection, or play the demo." },
};
