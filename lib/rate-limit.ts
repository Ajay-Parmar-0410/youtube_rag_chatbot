/**
 * Simple in-memory token bucket rate limiter for API routes.
 *
 * Each IP gets `maxTokens` requests per `windowMs` period.
 * Not suitable for distributed deployments — use Redis-based
 * solution for multi-instance setups.
 */

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimiterConfig {
  readonly maxTokens: number;
  readonly windowMs: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxTokens: 30,
  windowMs: 60_000,
};

const buckets = new Map<string, TokenBucket>();

// Periodically clean up stale entries to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > windowMs * 2) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetMs: number;
}

export function checkRateLimit(
  ip: string,
  config: RateLimiterConfig = DEFAULT_CONFIG,
): RateLimitResult {
  const now = Date.now();
  cleanup(config.windowMs);

  let bucket = buckets.get(ip);

  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now };
    buckets.set(ip, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const refillRate = config.maxTokens / config.windowMs;
  const tokensToAdd = elapsed * refillRate;
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    const resetMs = Math.ceil((1 - bucket.tokens) / refillRate);
    return { allowed: false, remaining: 0, resetMs };
  }

  bucket.tokens -= 1;
  return {
    allowed: true,
    remaining: Math.floor(bucket.tokens),
    resetMs: 0,
  };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    ...(result.resetMs > 0
      ? { "Retry-After": String(Math.ceil(result.resetMs / 1000)) }
      : {}),
  };
}
