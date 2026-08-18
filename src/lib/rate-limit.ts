/**
 * In-memory sliding window rate limiter.
 * Suitable for single-instance deployments.
 * For multi-instance, swap with Redis-based solution.
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterOptions {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private maxRequests: number;
  private windowMs: number;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;

    // Periodic cleanup of expired entries every 60s
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  /**
   * Check if a request from the given key is allowed.
   * Returns { allowed, remaining, resetMs }
   */
  check(key: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    if (entry.timestamps.length >= this.maxRequests) {
      const oldestInWindow = entry.timestamps[0];
      const resetMs = oldestInWindow + this.windowMs - now;
      return { allowed: false, remaining: 0, resetMs };
    }

    entry.timestamps.push(now);
    return {
      allowed: true,
      remaining: this.maxRequests - entry.timestamps.length,
      resetMs: this.windowMs,
    };
  }

  private cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [key, entry] of this.store) {
      entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }
}

// ─── PRE-CONFIGURED LIMITERS ────────────────────────────────────────────────

// Persist across hot reloads
const globalForRateLimit = globalThis as unknown as {
  loginLimiter?: RateLimiter;
  portalLimiter?: RateLimiter;
  uploadLimiter?: RateLimiter;
};

/** Login: 5 attempts per 15 minutes per IP */
if (!globalForRateLimit.loginLimiter) {
  globalForRateLimit.loginLimiter = new RateLimiter({
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
  });
}

/** Portal access: 30 requests per minute per IP */
if (!globalForRateLimit.portalLimiter) {
  globalForRateLimit.portalLimiter = new RateLimiter({
    maxRequests: 30,
    windowMs: 60 * 1000,
  });
}

/** Upload: 10 uploads per 5 minutes per IP */
if (!globalForRateLimit.uploadLimiter) {
  globalForRateLimit.uploadLimiter = new RateLimiter({
    maxRequests: 10,
    windowMs: 5 * 60 * 1000,
  });
}

export const loginLimiter = globalForRateLimit.loginLimiter;
export const portalLimiter = globalForRateLimit.portalLimiter;
export const uploadLimiter = globalForRateLimit.uploadLimiter;

/**
 * Extract client IP from request headers.
 * Works with proxies (x-forwarded-for) and direct connections.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
