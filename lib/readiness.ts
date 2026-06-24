import { createAdminClient } from '@/lib/supabase/server'
import { getEmailHealth, validateEmailConfiguration } from '@/lib/email'
import { isSupabaseAdminConfigured, isSupabaseConfigured } from '@/lib/security/env'

export async function getReadinessSnapshot() {
  const startedAt = Date.now()
  const emailConfig = validateEmailConfiguration()
  const emailHealth = await getEmailHealth()
  const checks: Record<string, { status: 'pass' | 'warn' | 'fail'; detail: string; latencyMs?: number }> = {
    environment: {
      status: isSupabaseConfigured() && isSupabaseAdminConfigured() ? 'pass' : 'fail',
      detail: isSupabaseConfigured() && isSupabaseAdminConfigured()
        ? 'Supabase URL, anon key, and service role key are configured.'
        : 'Supabase environment configuration is incomplete.',
    },
    email: {
      status: emailConfig.valid ? 'pass' : 'fail',
      detail: emailConfig.valid
        ? `${emailConfig.provider.toUpperCase()} configured. Test delivery can be sent from admin diagnostics or deployment smoke checks.`
        : emailConfig.errors.join(' '),
    },
  }

  try {
    const dbStarted = Date.now()
    const admin = createAdminClient()
    const { error } = await admin.from('profiles').select('id', { count: 'exact', head: true })
    checks.database = {
      status: error ? 'fail' : 'pass',
      detail: error?.message || 'Database connection and profile table are reachable.',
      latencyMs: Date.now() - dbStarted,
    }

    const storageStarted = Date.now()
    const storage = await admin.storage.listBuckets()
    checks.storage = {
      status: storage.error ? 'warn' : 'pass',
      detail: storage.error?.message || `${storage.data?.length || 0} storage bucket(s) reachable.`,
      latencyMs: Date.now() - storageStarted,
    }
  } catch (error: any) {
    checks.database = {
      status: 'fail',
      detail: error?.message || String(error),
    }
    checks.storage = {
      status: 'warn',
      detail: 'Storage check skipped because database/admin client is unavailable.',
    }
  }

  const status = Object.values(checks).some((check) => check.status === 'fail')
    ? 'unhealthy'
    : Object.values(checks).some((check) => check.status === 'warn')
      ? 'degraded'
      : 'healthy'

  return {
    status,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    mandatoryEmail: {
      provider: emailConfig.provider,
      status: emailHealth.status,
      warnings: emailConfig.warnings,
      lastError: emailHealth.lastError,
    },
    checks,
  }
}
