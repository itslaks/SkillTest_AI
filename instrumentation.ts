/**
 * Next.js instrumentation hook — runs once at server startup.
 *
 * Wires up the previously-unused env validation so missing/placeholder
 * Supabase credentials are surfaced loudly at boot instead of failing
 * silently on the first request (production-readiness: environment validation).
 */
export async function register() {
  // Only meaningful on the Node.js server runtime, not the edge runtime.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateRequiredEnvVars } = await import('@/lib/security/env')
    validateRequiredEnvVars()
  }
}
