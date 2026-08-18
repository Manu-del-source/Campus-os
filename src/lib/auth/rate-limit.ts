/**
 * In-process sliding-window limiter for authentication endpoints.
 * A single Node process is enough for development and a single-instance
 * production deploy; a shared store can replace this later without changing callers.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key) ?? { timestamps: [] };
  const recent = existing.timestamps.filter((stamp) => now - stamp < windowMs);

  if (recent.length >= limit) {
    buckets.set(key, { timestamps: recent });
    const oldest = recent[0] ?? now;
    return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (now - oldest)) / 1000) };
  }

  recent.push(now);
  buckets.set(key, { timestamps: recent });
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test helper. */
export function resetRateLimitStore(): void {
  buckets.clear();
}
