export type BrdEmailEventType =
  | 'attendance_cutoff_missed'
  | 'absence_streak'
  | 'attendance_upload_success'
  | 'assessment_upload_success'
  | 'assessment_reminder'
  | 'feedback_request'
  | 'quiz_assigned'
  | 'quiz_result_analysis'
  | 'session_allocated'
  | 'email_configuration_test'

export type BrdEmailConfiguration = {
  valid: boolean
  provider: 'smtp' | 'resend' | 'none'
  errors: string[]
  warnings: string[]
}

export type BrdEmailTransport = (options: {
  to: string
  subject: string
  html: string
  text?: string
}) => Promise<{ success: boolean; error?: string }>

export type MandatoryBrdEmailInput = {
  admin: any
  eventType: BrdEmailEventType
  to: string
  recipientRole: string
  relatedBatchId?: string | null
  relatedNotificationId?: string | null
  subject: string
  html: string
  text?: string
  transport: BrdEmailTransport
  configuration: BrdEmailConfiguration
}

export async function sendMandatoryBrdEmailCore(input: MandatoryBrdEmailInput) {
  const admin = input.admin
  const config = input.configuration
  const provider = config.provider
  const { data: log, error: logError } = await admin
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
  if (logError || !logId) {
    return {
      success: false,
      error: `BRD email log insert failed: ${logError?.message || 'No log ID returned.'}`,
      logId,
    }
  }

  const fail = async (message: string) => {
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
    return { success: false, error: message, logId }
  }

  if (!config.valid) {
    return fail(config.errors.join(' '))
  }

  let result: Awaited<ReturnType<BrdEmailTransport>>
  try {
    result = await input.transport({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    })
  } catch (error: any) {
    result = { success: false, error: error?.message || 'Email provider threw an unexpected delivery error.' }
  }

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

  return { ...result, logId }
}
