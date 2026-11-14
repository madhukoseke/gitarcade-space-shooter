interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  check: (key: string) => { allowed: boolean; retryAfterSeconds: number };
  reset: () => void;
}

/**
 * Fixed-window in-memory limiter. It protects a single server instance; on
 * serverless platforms each instance keeps its own counts, so treat it as a
 * best-effort guard rather than a global quota.
 */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now): RateLimiter {
  const buckets = new Map<string, Bucket>();
  return {
    check(key) {
      const t = now();
      if (buckets.size > 5000) {
        for (const [k, b] of buckets) if (b.resetAt <= t) buckets.delete(k);
      }
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= t) {
        bucket = { count: 0, resetAt: t + windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      const allowed = bucket.count <= limit;
      return { allowed, retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((bucket.resetAt - t) / 1000)) };
    },
    reset() {
      buckets.clear();
    },
  };
}
