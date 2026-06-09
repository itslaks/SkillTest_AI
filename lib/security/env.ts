/**
 * Secure environment variable handling.
 *
 * - All secrets are loaded exclusively from environment variables.
 * - No hard-coded keys anywhere.
 * - Runtime validation ensures required env vars are present at startup.
 * - Server-only secrets are never exposed to the client bundle.
 */

// ─── Server-side env vars (never sent to client) ──────────────────────

const PLACEHOLDER_VALUES = new Set([
  'your-supabase-url',
  'your_supabase_project_url_here',
  'your-supabase-anon-key',
  'your_supabase_anon_key_here',
  'your-supabase-service-role-key',
  'your_service_role_key_here',
])

function isHttpUrl(value: string | undefined): value is string {
  if (!value || PLACEHOLDER_VALUES.has(value.trim())) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function normalizeHttpUrl(value: string | undefined): string | null {
  if (!isHttpUrl(value)) return null
  return value.trim().replace(/\/+$/, '')
}

function isLocalSiteUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(url.hostname)
  } catch {
    return false
  }
}

function isRealKey(value: string | undefined): value is string {
  return Boolean(value && !PLACEHOLDER_VALUES.has(value.trim()))
}

export function isSupabaseConfigured(): boolean {
  return isHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) && isRealKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function isSupabaseAdminConfigured(): boolean {
  return isSupabaseConfigured() && isRealKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/**
 * Returns the Supabase URL (public, safe for client).
 */
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!isHttpUrl(url)) {
    throw new Error(
      'Invalid NEXT_PUBLIC_SUPABASE_URL environment variable. ' +
        'Set it to a real http(s) Supabase project URL in .env.local.'
    )
  }
  return url
}

/**
 * Returns the Supabase anon key (public, safe for client).
 */
export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!isRealKey(key)) {
    throw new Error(
      'Invalid NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. ' +
        'Set it to a real Supabase anon key in .env.local.'
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
  if (!isRealKey(key)) {
    throw new Error(
      'Invalid SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
        'This is required for server-side admin operations.'
    )
  }
  return key
}

/**
 * Returns the public site URL for links in emails, auth redirects, and callbacks.
 * Localhost is allowed only during local development.
 */
export function getSiteUrl(): string {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  const candidates = [
    normalizeHttpUrl(process.env.NEXT_PUBLIC_APP_URL),
    normalizeHttpUrl(process.env.NEXT_PUBLIC_SITE_URL),
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? normalizeHttpUrl(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) : null,
    process.env.VERCEL_URL ? normalizeHttpUrl(`https://${process.env.VERCEL_URL}`) : null,
  ].filter(Boolean) as string[]

  const siteUrl = candidates.find((candidate) => !isProduction || !isLocalSiteUrl(candidate))
  if (siteUrl) return siteUrl

  if (!isProduction) return 'http://localhost:3000'

  throw new Error(
    'Invalid public app URL for production. Set NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL to your deployed https URL; localhost cannot be used in production emails.'
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

  const missing = required.filter((key) => key === 'NEXT_PUBLIC_SUPABASE_URL' ? !isHttpUrl(process.env[key]) : !isRealKey(process.env[key]))

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
