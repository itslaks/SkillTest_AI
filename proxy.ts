/**
 * Global edge proxy (Next 16 convention, formerly middleware).
 * Centralized first line of defense for the whole app:
 *
 *  1. Rate limiting (OWASP API4:2023)
 *     - /api/*       : per-IP ceiling for every API route
 *     - /auth/* POST : tighter backstop for credential flows
 *
 *  2. Centralized session validation (OWASP A01/A07)
 *     - Every protected path (/manager, /employee, /profile(s), /certificates)
 *       verifies the Supabase session BEFORE the page renders. Unauthenticated
 *       requests are redirected to /auth/login?redirect=<original-path>.
 *     - Page/layout guards (lib/rbac.ts) remain as defense-in-depth and
 *       enforce fine-grained roles; this layer guarantees no protected route
 *       can ever render for an anonymous visitor, even if a page forgets
 *       its own guard.
 *     - supabase.auth.getUser() also refreshes expiring tokens; refreshed
 *       cookies are written back on the response, keeping sessions stable
 *       across page reloads.
 *
 *  3. Auth-page redirects
 *     - Already-authenticated users opening /auth/login or /auth/sign-up are
 *       sent to their role's dashboard. A wrong role guess self-corrects:
 *       the destination layout's RBAC guard re-routes to the proper area.
 *
 *  4. Browser-back / cache hardening (OWASP A05)
 *     - All protected responses carry Cache-Control: no-store (+ Pragma /
 *       Expires) so the browser never serves a protected page from cache
 *       after logout — pressing Back forces revalidation and redirects to
 *       login.
 */

import { createServerClient } from '@supabase/ssr'
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

/** Route prefixes that must never render without a valid session. */
const PROTECTED_PREFIXES = ['/manager', '/employee', '/profile', '/profiles', '/certificates']

/** Auth entry pages that authenticated users should be bounced away from. */
const AUTH_ENTRY_PAGES = ['/auth/login', '/auth/sign-up']

const STAFF_ROLES = new Set(['admin', 'manager', 'training_coordinator', 'trainer'])
const EMAIL_VERIFIED_ROLES = new Set(['employee', 'trainer'])

type ProxyUser = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
}

function isProtectedPath(path: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

function applyNoStoreHeaders(response: NextResponse): NextResponse {
  // Prevent the browser and intermediaries from caching protected content,
  // so Back after logout cannot reveal previously rendered pages.
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  return response
}

function getUserRole(user: ProxyUser): string {
  return String(user.user_metadata?.role || user.app_metadata?.role || 'employee')
}

function requiresVerifiedEmail(user: ProxyUser): boolean {
  return EMAIL_VERIFIED_ROLES.has(getUserRole(user)) && !user.email_confirmed_at
}

function clearSupabaseAuthCookies(response: NextResponse, request: NextRequest): NextResponse {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-')) response.cookies.delete(cookie.name)
  }
  return response
}

function redirectUnverifiedUser(request: NextRequest, user: ProxyUser): NextResponse {
  const loginUrl = new URL('/auth/login', request.url)
  loginUrl.searchParams.set('verified', 'required')
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
  if (user.email) loginUrl.searchParams.set('email', user.email)
  return clearSupabaseAuthCookies(applyNoStoreHeaders(NextResponse.redirect(loginUrl)), request)
}

function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return Boolean(url && key && /^https?:\/\//.test(url))
}

export async function proxy(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const path = request.nextUrl.pathname

  // ── 1. Rate limiting ───────────────────────────────────────────────────────
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

  const protectedPath = isProtectedPath(path)
  const authEntryPage = AUTH_ENTRY_PAGES.includes(path)

  // Nothing session-related to do for other matched paths.
  if (!protectedPath && !authEntryPage) return NextResponse.next()

  // Without Supabase configured (fresh local setup), fall through — the
  // server-side page guards surface their own configuration errors.
  if (!supabaseConfigured()) {
    const response = NextResponse.next()
    return protectedPath ? applyNoStoreHeaders(response) : response
  }

  // ── 2. Session validation with token refresh ──────────────────────────────
  // Standard @supabase/ssr cookie bridge: refreshed auth cookies written by
  // getUser() are propagated onto the response we return.
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  let user: ProxyUser | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null // fail closed: verification errors are treated as no session
  }

  if (protectedPath) {
    if (!user) {
      // Page-equivalent of 401: redirect to login, preserving the intended
      // destination so sign-in can return the user where they were going.
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('redirect', path)
      return applyNoStoreHeaders(NextResponse.redirect(loginUrl))
    }
    if (requiresVerifiedEmail(user)) {
      return redirectUnverifiedUser(request, user)
    }
    return applyNoStoreHeaders(response)
  }

  // ── 3. Auth entry pages: bounce already-authenticated users ───────────────
  if (authEntryPage && user) {
    if (requiresVerifiedEmail(user)) {
      return clearSupabaseAuthCookies(applyNoStoreHeaders(response), request)
    }
    const home = STAFF_ROLES.has(getUserRole(user)) ? '/manager' : '/employee'
    return NextResponse.redirect(new URL(home, request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/api/:path*',
    '/auth/:path*',
    '/manager/:path*',
    '/employee/:path*',
    '/profile/:path*',
    '/profiles/:path*',
    '/certificates/:path*',
  ],
}
