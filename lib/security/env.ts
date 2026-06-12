/**
 * Secure environment variable handling.
 *
 * Server-only secrets stay in server modules. Public values are validated
 * before they are used in auth links, email links, or Supabase clients.
 */

const PLACEHOLDER_VALUES = new Set([
  'your-supabase-url',
  'your_supabase_project_url_here',
  'your-supabase-anon-key',
  'your_supabase_anon_key_here',
  'your-supabase-service-role-key',
  'your_service_role_key_here',
])

const ADMIN_ALERT_EMAIL_FALLBACK = 'skilltestai01@gmail.com'

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

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
}

function isVercelPreviewUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname
    return hostname.endsWith('.vercel.app') && process.env.VERCEL_ENV === 'preview'
  } catch {
    return false
  }
}

function isRealKey(value: string | undefined): value is string {
  return Boolean(value && !PLACEHOLDER_VALUES.has(value.trim()))
}

function isValidEmail(value: string | undefined): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
}

export function isSupabaseConfigured(): boolean {
  return isHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) && isRealKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function isSupabaseAdminConfigured(): boolean {
  return isSupabaseConfigured() && isRealKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!isHttpUrl(url)) {
    throw new Error(
      'Invalid NEXT_PUBLIC_SUPABASE_URL environment variable. Set it to a real http(s) Supabase project URL in .env.local.'
    )
  }
  return url
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!isRealKey(key)) {
    throw new Error(
      'Invalid NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Set it to a real Supabase anon key in .env.local.'
    )
  }
  return key
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!isRealKey(key)) {
    throw new Error('Invalid SUPABASE_SERVICE_ROLE_KEY environment variable. This is required for server-side admin operations.')
  }
  return key
}

/**
 * Returns the public app URL for links in emails and auth redirects.
 * Production must use NEXT_PUBLIC_APP_URL explicitly so mail never points at
 * localhost, a preview deployment, or an inferred host.
 */
export function getSiteUrl(): string {
  const appUrl = normalizeHttpUrl(process.env.NEXT_PUBLIC_APP_URL)

  if (isProductionRuntime()) {
    if (!appUrl || isLocalSiteUrl(appUrl) || isVercelPreviewUrl(appUrl)) {
      throw new Error(
        'Invalid NEXT_PUBLIC_APP_URL for production. Set it to the stable deployed https URL used in Supabase auth emails.'
      )
    }
    return appUrl
  }

  const siteUrl = appUrl || normalizeHttpUrl(process.env.NEXT_PUBLIC_SITE_URL)
  if (siteUrl) return siteUrl

  const vercelPreviewUrl = process.env.VERCEL_URL ? normalizeHttpUrl(`https://${process.env.VERCEL_URL}`) : null
  return vercelPreviewUrl || 'http://localhost:3000'
}

export function getAuthRedirectUrl(): string {
  if (!isProductionRuntime() && process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL) {
    return process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL.replace(/\/+$/, '')
  }
  return `${getSiteUrl()}/auth/callback`
}

export function getPasswordResetRedirectUrl(): string {
  return `${getSiteUrl()}/auth/update-password`
}

export function getAdminAlertEmail(): string {
  const configured = process.env.ADMIN_ALERT_EMAIL?.trim()
  if (isValidEmail(configured)) return configured
  if (isProductionRuntime()) {
    throw new Error('Missing ADMIN_ALERT_EMAIL. Set it to skilltestai01@gmail.com for production alert delivery.')
  }
  return ADMIN_ALERT_EMAIL_FALLBACK
}

export function getAdminLoginEmail(): string {
  const configured = process.env.ADMIN_LOGIN_EMAIL?.trim()
  if (isValidEmail(configured)) return configured
  return getAdminAlertEmail()
}

export function validateRequiredEnvVars(): void {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
  if (isProductionRuntime()) required.push('NEXT_PUBLIC_APP_URL', 'ADMIN_ALERT_EMAIL')

  const missing = required.filter((key) => {
    if (key === 'NEXT_PUBLIC_SUPABASE_URL' || key === 'NEXT_PUBLIC_APP_URL') return !normalizeHttpUrl(process.env[key])
    if (key === 'ADMIN_ALERT_EMAIL') return !isValidEmail(process.env[key])
    return !isRealKey(process.env[key])
  })

  if (missing.length > 0) {
    console.error(
      `Missing required environment variables:\n${missing.map((key) => `  - ${key}`).join('\n')}\n` +
        'Please check your .env.local file or deployment environment.'
    )
    if (process.env.NODE_ENV === 'development' || isProductionRuntime()) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
  }

  const missingRecommended = ['SUPABASE_SERVICE_ROLE_KEY'].filter((key) => !process.env[key])
  if (missingRecommended.length > 0) {
    console.warn(`Missing recommended environment variables:\n${missingRecommended.map((key) => `  - ${key}`).join('\n')}`)
  }

  if (isProductionRuntime()) {
    getSiteUrl()
    if (!process.env.RESEND_API_KEY && !(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)) {
      throw new Error('Production email delivery is not configured. Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS.')
    }
  }
}
