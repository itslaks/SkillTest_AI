import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest } from 'next/server'

/**
 * Proxy – handles session refresh only.
 *
 * Rate limiting has been removed to support 1000+ concurrent users
 * without hitting in-memory per-process limits. For production-grade
 * throttling at scale, use an external solution (e.g. Cloudflare,
 * Vercel Edge Config, or Redis-backed rate limiting at the infrastructure level).
 */
export async function proxy(request: NextRequest) {
  // ─── Session handling ───────────────────────────────────────────────
  const response = await updateSession(request)
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
