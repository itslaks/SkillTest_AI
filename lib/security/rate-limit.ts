/**
 * In-memory rate limiter (OWASP API4:2023 Unrestricted Resource Consumption,
 * OWASP A07:2021 Identification and Authentication Failures).
 * Supports IP-based, user-based, and arbitrary-key (e.g. per-email) limits.
 * Returns standards-compliant 429 responses with Retry-After header.
 *
 * State is per server instance: on serverless each instance enforces limits
 * independently, which still throttles single-source brute force — the
 * primary threat model. Swap the Map stores for Redis/Upstash if a strict
 * global limit is ever needed; call sites stay unchanged.
 */

import { NextResponse } from 'next/server'

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

/** Generic keyed limit — e.g. per-email for password-reset mail bombing. */
export function checkKeyRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  return checkLimit(ipStore, `key:${key}`, config)
}

/**
 * Extracts the client IP from proxy headers. On Vercel, x-forwarded-for is
 * platform-set and its first entry is the real client address. Unidentifiable
 * traffic shares the 'unknown' bucket rather than bypassing limits.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip')?.trim() || 'unknown'
}

// ─── Default thresholds ───────────────────────────────────────────────
// These are sensible defaults; override per-route in middleware as needed.

/** Public/unauthenticated endpoints (login, sign-up, magic-link, callback) */
export const PUBLIC_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowSeconds: 60, // 20 requests per minute
}

/** Authenticated API / server-action endpoints (per user) */
export const AUTHENTICATED_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 120,
  windowSeconds: 60, // 120 requests per minute — headroom for export-heavy dashboards
}

/** Specifically tight limit for auth attempts (login, sign-up) */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowSeconds: 300, // 10 attempts per 5 minutes
}

/** Email-sending flows (password reset, verification resend, magic link), per target address */
export const EMAIL_FLOW_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowSeconds: 900, // 3 emails per address per 15 minutes (mail-bomb mitigation)
}

/** Human-readable message for graceful in-action (server action) rejections. */
export function rateLimitMessage(result: RateLimitResult): string {
  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
  const minutes = Math.ceil(retryAfterSeconds / 60)
  return `Too many attempts. Please try again in ${minutes <= 1 ? 'a minute' : `${minutes} minutes`}.`
}

/**
 * Utility: build a standard 429 JSON response with correct headers.
 * Returns NextResponse so `instanceof NextResponse` guard checks in API
 * routes treat it as a terminal response, not an auth success object.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))

  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        // IETF RateLimit header fields (draft) + legacy X- variants
        'RateLimit-Limit': String(result.limit),
        'RateLimit-Remaining': '0',
        'RateLimit-Reset': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  )
}
