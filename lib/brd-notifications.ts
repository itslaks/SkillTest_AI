import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail, validateEmailConfiguration } from '@/lib/email'

export type BrdEmailEventType =
  | 'attendance_cutoff_missed'
  | 'absence_streak'
  | 'attendance_upload_success'
  | 'assessment_upload_success'
  | 'assessment_reminder'
  | 'feedback_request'
  | 'email_configuration_test'

type AdminClient = ReturnType<typeof createAdminClient>

type MandatoryEmailInput = {
  admin?: AdminClient
  eventType: BrdEmailEventType
  to: string
  recipientRole: string
  relatedBatchId?: string | null
  relatedNotificationId?: string | null
  subject: string
  html: string
  text?: string
}

export async function sendMandatoryBrdEmail(input: MandatoryEmailInput) {
  const admin = input.admin || createAdminClient()
  const config = validateEmailConfiguration()
  const provider = config.provider
  const { data: log } = await admin
    .from('brd_email_notification_logs')
    .insert({
      event_type: input.eventType,
      recipient_email: input.to,
      recipient_role: input.recipientRole,
      related_batch_id: input.relatedBatchId || null,
      related_notification_id: input.relatedNotificationId || null,
      status: 'pending',
      provider,
      subject: input.subject,
      html_body: input.html,
      text_body: input.text || null,
    })
    .select('id')
    .maybeSingle()

  const logId = log?.id
  const fail = async (message: string) => {
    if (logId) {
      await admin
        .from('brd_email_notification_logs')
        .update({
          status: 'failed',
          provider,
          error_message: message,
          attempt_count: 1,
          last_attempted_at: new Date().toISOString(),
        })
        .eq('id', logId)
    }
    return { success: false, error: message, logId }
  }

  if (!config.valid) {
    return fail(config.errors.join(' '))
  }

  const result = await sendEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  })

  if (logId) {
    await admin
      .from('brd_email_notification_logs')
      .update({
        status: result.success ? 'sent' : 'failed',
        provider,
        error_message: result.error || null,
        attempt_count: 1,
        last_attempted_at: new Date().toISOString(),
        sent_at: result.success ? new Date().toISOString() : null,
      })
      .eq('id', logId)
  }

  return { ...result, logId }
}

export async function retryFailedBrdEmailNotifications(limit = 50) {
  const admin = createAdminClient()
  const { data: failedRows, error } = await admin
    .from('brd_email_notification_logs')
    .select('*')
    .eq('status', 'failed')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) return { error: error.message, retried: 0, sent: 0, failed: 0 }

  let sent = 0
  let failed = 0
  for (const row of failedRows || []) {
    const config = validateEmailConfiguration()
    if (!config.valid) {
      failed++
      await admin
        .from('brd_email_notification_logs')
        .update({
          provider: config.provider,
          error_message: config.errors.join(' '),
          attempt_count: Number(row.attempt_count || 0) + 1,
          last_attempted_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      continue
    }

    const result = await sendEmail({
      to: row.recipient_email,
      subject: row.subject,
      html: row.html_body,
      text: row.text_body || undefined,
    })

    if (result.success) sent++
    else failed++

    await admin
      .from('brd_email_notification_logs')
      .update({
        status: result.success ? 'sent' : 'failed',
        provider: config.provider,
        error_message: result.error || null,
        attempt_count: Number(row.attempt_count || 0) + 1,
        last_attempted_at: new Date().toISOString(),
        sent_at: result.success ? new Date().toISOString() : row.sent_at,
      })
      .eq('id', row.id)
  }

  return { retried: failedRows?.length || 0, sent, failed }
}
