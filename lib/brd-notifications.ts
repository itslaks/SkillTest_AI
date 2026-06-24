import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail, validateEmailConfiguration } from '@/lib/email'
import { sendMandatoryBrdEmailCore, type BrdEmailConfiguration, type BrdEmailEventType, type BrdEmailTransport } from '@/lib/brd-notifications-core'

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
  transport?: BrdEmailTransport
  configuration?: BrdEmailConfiguration
}

export async function sendMandatoryBrdEmail(input: MandatoryEmailInput) {
  const admin = input.admin || createAdminClient()
  const config = input.configuration || validateEmailConfiguration()
  return sendMandatoryBrdEmailCore({
    admin,
    eventType: input.eventType,
    to: input.to,
    recipientRole: input.recipientRole,
    relatedBatchId: input.relatedBatchId,
    relatedNotificationId: input.relatedNotificationId,
    subject: input.subject,
    html: input.html,
    text: input.text,
    transport: input.transport || sendEmail,
    configuration: config,
  })
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
