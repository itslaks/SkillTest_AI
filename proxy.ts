/**
 * Global edge proxy (Next 16 convention, formerly middleware) — first line of defense (OWASP API4:2023).
 *
 * Applies IP-based rate limits to all public entry points:
 *  - /api/*       : generous per-IP ceiling for every API route
 *  - /auth/* POST : tighter backstop for credential flows (sign-in, sign-up,
 *                   password reset server actions all POST to /auth pages)
 *
 * These are deliberately coarse backstops; precise, user-friendly limits are
 * enforced inside the auth server actions (lib/actions/auth.ts) and the
 * authenticated API guards (lib/rbac.ts), so legitimate users see graceful
 * error messages before ever hitting these 429s.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  checkIpRateLimit,
  getClientIp,
  rateLimitResponse,
  type RateLimitConfig,
} from '@/lib/security/rate-limit'

// Per-IP ceiling for API routes (includes proctoring event bursts + exports).
const API_IP_LIMIT: RateLimitConfig = { maxRequests: 300, windowSeconds: 60 }

// Per-IP backstop for POSTs to auth pages (server actions: sign-in, sign-up,
// password reset, magic link). Tight in-action limits trigger first.
const AUTH_POST_IP_LIMIT: RateLimitConfig = { maxRequests: 40, windowSeconds: 300 }

export function proxy(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const path = request.nextUrl.pathname

  if (path.startsWith('/api/')) {
    const result = checkIpRateLimit(`api:${ip}`, API_IP_LIMIT)
    if (!result.allowed) return rateLimitResponse(result)
    return NextResponse.next()
  }

  // Only POSTs are limited on auth pages so normal page navigation is untouched.
  if (path.startsWith('/auth/') && request.method === 'POST') {
    const result = checkIpRateLimit(`authpost:${ip}`, AUTH_POST_IP_LIMIT)
    if (!result.allowed) return rateLimitResponse(result)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*', '/auth/:path*'],
}
