import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest } from 'next/server'
import {
  checkIpRateLimit,
  rateLimitResponse,
  PUBLIC_RATE_LIMIT,
  AUTH_RATE_LIMIT,
  AUTHENTICATED_RATE_LIMIT,
} from '@/lib/security/rate-limit'

/**
 * Resolve the client IP from the request.
 * Respects X-Forwarded-For (set by reverse proxies / Vercel) with fallback.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // Take the first (leftmost) IP – that's the original client
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') ?? '127.0.0.1'
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const clientIp = getClientIp(request)

  // ─── Rate limiting ──────────────────────────────────────────────────
  const isAuthRoute =
    pathname.startsWith('/auth/login') ||
    pathname.startsWith('/auth/sign-up') ||
    pathname.startsWith('/auth/callback')

  const isProtectedRoute =
    pathname.startsWith('/manager') ||
    pathname.startsWith('/employee') ||
    pathname.startsWith('/admin')

  // Choose the appropriate rate-limit config
  const rateLimitConfig = isAuthRoute
    ? AUTH_RATE_LIMIT
    : isProtectedRoute
      ? AUTHENTICATED_RATE_LIMIT
      : PUBLIC_RATE_LIMIT

  const ipResult = checkIpRateLimit(clientIp, rateLimitConfig)
  if (!ipResult.allowed) {
    return rateLimitResponse(ipResult)
  }

  // ─── Session handling (existing logic) ──────────────────────────────
  const response = await updateSession(request)

  // Attach rate-limit headers to the successful response for transparency
  response.headers.set('X-RateLimit-Limit', String(ipResult.limit))
  response.headers.set('X-RateLimit-Remaining', String(ipResult.remaining))
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(ipResult.resetAt / 1000)))

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
