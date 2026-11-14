import { NextResponse, type NextRequest } from "next/server";
import { GitHubError } from "@/lib/github/client";
import { getContributions } from "@/lib/github/contributions";
import { API_ERRORS, type ApiErrorCode } from "@/lib/github/errors";
import { createRateLimiter } from "@/lib/github/rateLimit";
import { normalizeUsername } from "@/lib/github/validation";

const limiter = createRateLimiter(30, 60_000);

function errorResponse(code: ApiErrorCode, headers?: Record<string, string>) {
  const info = API_ERRORS[code];
  return NextResponse.json(
    { error: { code, message: info.message } },
    { status: info.status || 500, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

/** GET /api/github/contributions?username=<username or profile URL> */
export async function GET(request: NextRequest) {
  const limit = limiter.check(clientKey(request));
  if (!limit.allowed) {
    return errorResponse("TOO_MANY_REQUESTS", { "Retry-After": String(limit.retryAfterSeconds) });
  }

  const normalized = normalizeUsername(request.nextUrl.searchParams.get("username"));
  if (!normalized.ok) {
    return NextResponse.json(
      { error: { code: "INVALID", message: normalized.message } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    // The token is read on the server only and is never sent to the client.
    const profile = await getContributions(normalized.username, { token: process.env.GITHUB_TOKEN });
    return NextResponse.json(profile, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" },
    });
  } catch (error) {
    if (error instanceof GitHubError) {
      console.error(`[github] ${error.code}: ${error.message}`);
      return errorResponse(error.code);
    }
    console.error("[github] unexpected error", error);
    return errorResponse("UPSTREAM");
  }
}
