import { createAdminClient } from '@/lib/supabase/server'
import { getEmailHealth, validateEmailConfiguration } from '@/lib/email'
import { isSupabaseAdminConfigured, isSupabaseConfigured } from '@/lib/security/env'

type CheckStatus = 'PASS' | 'FAIL'

export type DiagnosticCheck = {
  name: string
  status: CheckStatus
  detail: string
}

export type OperationalHealth = {
  email: Record<string, number>
  reminders: Record<string, number>
  attendanceAlerts: Record<string, number>
  smtp: Awaited<ReturnType<typeof getEmailHealth>>
  lastError: string | null
}

async function safeCount(table: string, filter?: (query: any) => any) {
  try {
    const admin = createAdminClient()
    let query = admin.from(table).select('id', { count: 'exact', head: true })
    if (filter) query = filter(query)
    const { count, error } = await query
    if (error) return { count: 0, error: error.message }
    return { count: count || 0, error: null }
  } catch (error: any) {
    return { count: 0, error: error?.message || String(error) }
  }
}

async function safeLatest(table: string, select = '*', orderColumn = 'created_at') {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from(table)
      .select(select)
      .order(orderColumn, { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (error: any) {
    return { data: null, error: error?.message || String(error) }
  }
}

export async function getOperationalHealth(): Promise<OperationalHealth> {
  const [queued, sent, failed, logged, pendingReminders, deliveredReminders, failedReminders, attendanceGenerated, attendanceDelivered, attendanceFailed, latestDispatch, smtp] = await Promise.all([
    safeCount('training_notifications', (q) => q.eq('delivery_status', 'queued')),
    safeCount('training_notifications', (q) => q.eq('delivery_status', 'sent')),
    safeCount('training_notifications', (q) => q.eq('delivery_status', 'failed')),
    safeCount('training_notifications', (q) => q.eq('delivery_status', 'logged')),
    safeCount('training_notifications', (q) => q.in('delivery_status', ['queued', 'scheduled']).in('metadata->>category', ['assessment_reminder', 'feedback_reminder', 'quiz_reminder', 'ai_command_reminder'])),
    safeCount('training_notifications', (q) => q.eq('delivery_status', 'sent').in('metadata->>category', ['assessment_reminder', 'feedback_reminder', 'quiz_reminder', 'ai_command_reminder'])),
    safeCount('training_notifications', (q) => q.eq('delivery_status', 'failed').in('metadata->>category', ['assessment_reminder', 'feedback_reminder', 'quiz_reminder', 'ai_command_reminder'])),
    safeCount('training_notifications', (q) => q.in('metadata->>category', ['attendance_cutoff', 'absence_streak'])),
    safeCount('training_notifications', (q) => q.eq('delivery_status', 'sent').in('metadata->>category', ['attendance_cutoff', 'absence_streak'])),
    safeCount('training_notifications', (q) => q.eq('delivery_status', 'failed').in('metadata->>category', ['attendance_cutoff', 'absence_streak'])),
    safeLatest('training_notification_dispatch_log', 'provider_status, provider_message, created_at'),
    getEmailHealth(),
  ])

  return {
    email: {
      queued: queued.count,
      sent: sent.count,
      failed: failed.count,
      logged: logged.count,
    },
    reminders: {
      pending: pendingReminders.count,
      delivered: deliveredReminders.count,
      failed: failedReminders.count,
    },
    attendanceAlerts: {
      generated: attendanceGenerated.count,
      delivered: attendanceDelivered.count,
      failed: attendanceFailed.count,
    },
    smtp,
    lastError: (latestDispatch.data as any)?.provider_status === 'failed'
      ? (latestDispatch.data as any).provider_message
      : smtp.lastError || latestDispatch.error || null,
  }
}

export async function getSystemDiagnostics(): Promise<DiagnosticCheck[]> {
  const emailConfig = validateEmailConfiguration()
  const [profiles, notifications, automationRuns, attendance, sessions, aiSchedules] = await Promise.all([
    safeCount('profiles'),
    safeCount('training_notifications'),
    safeLatest('training_automation_runs', 'run_type, status, created_at'),
    safeCount('session_attendance'),
    safeCount('training_sessions'),
    safeCount('ai_command_schedules'),
  ])

  return [
    {
      name: 'Auth: signup/login/verification config',
      status: isSupabaseConfigured() && isSupabaseAdminConfigured() ? 'PASS' : 'FAIL',
      detail: isSupabaseConfigured() && isSupabaseAdminConfigured()
        ? 'Supabase anon and service-role configuration is present.'
        : 'Supabase auth environment is incomplete.',
    },
    {
      name: 'Auth: profile linkage',
      status: profiles.error ? 'FAIL' : 'PASS',
      detail: profiles.error || `${profiles.count} profile record(s) reachable.`,
    },
    {
      name: 'Email: provider configuration',
      status: emailConfig.valid ? 'PASS' : 'FAIL',
      detail: emailConfig.valid ? `${emailConfig.provider.toUpperCase()} configured.` : emailConfig.errors.join(' '),
    },
    {
      name: 'Notifications: queue table',
      status: notifications.error ? 'FAIL' : 'PASS',
      detail: notifications.error || `${notifications.count} notification record(s) reachable.`,
    },
    {
      name: 'Scheduler: governance automation',
      status: automationRuns.error ? 'FAIL' : 'PASS',
      detail: automationRuns.error || (automationRuns.data ? `Latest run: ${(automationRuns.data as any).run_type} (${(automationRuns.data as any).status}).` : 'No automation runs logged yet.'),
    },
    {
      name: 'Database: training tables',
      status: attendance.error || sessions.error ? 'FAIL' : 'PASS',
      detail: attendance.error || sessions.error || `${sessions.count} session(s), ${attendance.count} attendance row(s).`,
    },
    {
      name: 'Attendance: alert engine',
      status: automationRuns.error ? 'FAIL' : 'PASS',
      detail: 'Cutoff and absence sweeps use active member counts and past attendance-required sessions.',
    },
    {
      name: 'AI Command: operational',
      status: aiSchedules.error ? 'FAIL' : 'PASS',
      detail: aiSchedules.error || `${aiSchedules.count} AI command schedule(s) reachable.`,
    },
  ]
}
