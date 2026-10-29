/**
 * Minimal in-process fixed-window rate limiter.
 *
 * Deliberately dependency-free. Limits are per server instance, so on a
 * multi-instance/serverless deployment the effective limit is
 * `limit × instances` — acceptable protection for login/AI endpoints, and
 * documented as a limitation (a shared Redis store is the production answer).
 */
interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

type LimiterStore = Record<string, Map<string, Bucket>>;

const globalForLimiters = globalThis as unknown as {
  __bookleafLimiters?: LimiterStore;
};
const store: LimiterStore = (globalForLimiters.__bookleafLimiters ??= {});

export function createRateLimiter(
  name: string,
  limit: number,
  windowMs: number,
): RateLimiter {
  const buckets = (store[name] ??= new Map<string, Bucket>());

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const bucket = buckets.get(key);

      if (!bucket || bucket.resetAt <= now) {
        // Opportunistically prune expired keys so the map cannot grow forever.
        if (buckets.size > 5_000) {
          for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
        }
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      if (bucket.count >= limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        };
      }

      bucket.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

/** Login: 10 attempts per 5 minutes per IP+email. */
export const loginLimiter = createRateLimiter("login", 10, 5 * 60 * 1000);

/** AI generation: 20 calls per 5 minutes per user. */
export const aiLimiter = createRateLimiter("ai", 20, 5 * 60 * 1000);
