/**
 * Secure environment variable handling.
 *
 * - All secrets are loaded exclusively from environment variables.
 * - No hard-coded keys anywhere.
 * - Runtime validation ensures required env vars are present at startup.
 * - Server-only secrets are never exposed to the client bundle.
 */

// ─── Server-side env vars (never sent to client) ──────────────────────

/**
 * Returns the Supabase URL (public, safe for client).
 */
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. ' +
        'Set it in your .env.local file or deployment environment.'
    )
  }
  return url
}

/**
 * Returns the Supabase anon key (public, safe for client).
 */
export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. ' +
        'Set it in your .env.local file or deployment environment.'
    )
  }
  return key
}

/**
 * Returns the Supabase service role key (server-only, NEVER expose to client).
 * This key bypasses RLS and should only be used in server-side code.
 */
export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
        'This is required for server-side admin operations.'
    )
  }
  return key
}

/**
 * Returns the site URL, falling back to localhost in development.
 */
export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
  )
}

/**
 * Returns the auth callback redirect URL.
 */
export function getAuthRedirectUrl(): string {
  return (
    process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
    `${getSiteUrl()}/auth/callback`
  )
}

// ─── Validation at import time (server only) ──────────────────────────

/**
 * Call this function at server startup (e.g., in instrumentation.ts or
 * a top-level server module) to fail fast if required env vars are missing.
 */
export function validateRequiredEnvVars(): void {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    console.error(
      `❌ Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}\n` +
        'Please check your .env.local file or deployment environment.'
    )
    // Don't throw in production to avoid crashing builds,
    // but log clearly so the issue is noticed.
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
  }

  // Warn about optional but recommended vars
  const recommended = ['SUPABASE_SERVICE_ROLE_KEY']
  const missingRecommended = recommended.filter((key) => !process.env[key])
  if (missingRecommended.length > 0) {
    console.warn(
      `⚠️  Missing recommended environment variables:\n${missingRecommended.map((k) => `  - ${k}`).join('\n')}`
    )
  }
}
