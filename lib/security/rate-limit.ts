/**
 * In-memory rate limiter for Next.js middleware.
 * Supports both IP-based and user-based (via Supabase session cookie) limits.
 * Returns standards-compliant 429 responses with Retry-After header.
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number
  /** Time window in seconds */
  windowSeconds: number
}

interface RateLimitEntry {
  count: number
  resetAt: number // timestamp in ms
}

// In-memory stores (per-process; for horizontal scaling, swap with Redis)
const ipStore = new Map<string, RateLimitEntry>()
const userStore = new Map<string, RateLimitEntry>()

// Periodically clean up expired entries every 60 seconds
let cleanupScheduled = false
function scheduleCleanup() {
  if (cleanupScheduled) return
  cleanupScheduled = true
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of ipStore) {
      if (entry.resetAt <= now) ipStore.delete(key)
    }
    for (const [key, entry] of userStore) {
      if (entry.resetAt <= now) userStore.delete(key)
    }
  }, 60_000)
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // timestamp in ms
  limit: number
}

function checkLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  scheduleCleanup()

  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    // New window
    const resetAt = now + config.windowSeconds * 1000
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt, limit: config.maxRequests }
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt, limit: config.maxRequests }
  }

  entry.count++
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
    limit: config.maxRequests,
  }
}

export function checkIpRateLimit(ip: string, config: RateLimitConfig): RateLimitResult {
  return checkLimit(ipStore, `ip:${ip}`, config)
}

export function checkUserRateLimit(userId: string, config: RateLimitConfig): RateLimitResult {
  return checkLimit(userStore, `user:${userId}`, config)
}

// ─── Default thresholds ───────────────────────────────────────────────
// These are sensible defaults; override per-route in middleware as needed.

/** Public/unauthenticated endpoints (login, sign-up, magic-link, callback) */
export const PUBLIC_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowSeconds: 60, // 20 requests per minute
}

/** Authenticated API / server-action endpoints */
export const AUTHENTICATED_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowSeconds: 60, // 60 requests per minute
}

/** Specifically tight limit for auth attempts (login, sign-up) */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowSeconds: 300, // 10 attempts per 5 minutes
}

/**
 * Utility: build a standard 429 JSON response with correct headers.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000)

  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  )
}
