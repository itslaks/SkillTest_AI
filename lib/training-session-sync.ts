import type { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

type AdminClient = ReturnType<typeof createAdminClient>

type SyncSessionInput = {
  batchId: string
  sessionId: string
  title: string
  sessionDate: string
  mode: string
  meetingUrl?: string | null
  trainerId?: string | null
  actorId: string
  attendanceRequired: boolean
}

const ACTIVE_MEMBER_STATUSES = ['invited', 'active', 'onboarded', 'offered']

export async function syncTrainingSessionVisibility(admin: AdminClient, input: SyncSessionInput) {
  const warnings: string[] = []

  if (input.trainerId) {
    const { error: trainerError } = await admin
      .from('training_batch_trainers')
      .upsert({
        batch_id: input.batchId,
        trainer_id: input.trainerId,
        role_label: 'Session Trainer',
        assigned_by: input.actorId,
      }, { onConflict: 'batch_id,trainer_id' })

    if (trainerError) warnings.push(`trainer assignment: ${trainerError.message}`)
  }

  const { data: members, error: memberError } = await admin
    .from('batch_members')
    .select('user_id, enrollment_status')
    .eq('batch_id', input.batchId)
    .in('enrollment_status', ACTIVE_MEMBER_STATUSES)

  if (memberError) {
    warnings.push(`member lookup: ${memberError.message}`)
  }

  const activeMembers = members || []
  const recipientIds = Array.from(new Set([
    ...activeMembers.map((member: any) => member.user_id).filter(Boolean),
    input.trainerId || '',
  ].filter(Boolean)))
  const { data: recipientProfiles } = recipientIds.length
    ? await admin.from('profiles').select('id, full_name, email, role').in('id', recipientIds)
    : { data: [] }
  const recipientsById = new Map((recipientProfiles || []).map((profile: any) => [profile.id, profile]))

  if (input.attendanceRequired && activeMembers.length > 0) {
    const attendanceRows = activeMembers.map((member: any) => ({
      session_id: input.sessionId,
      user_id: member.user_id,
      status: 'absent',
      updated_by: input.actorId,
    }))

    for (let i = 0; i < attendanceRows.length; i += 500) {
      const { error } = await admin
        .from('session_attendance')
        .upsert(attendanceRows.slice(i, i + 500), { onConflict: 'session_id,user_id' })

      if (error) {
        warnings.push(`attendance roster: ${error.message}`)
        break
      }
    }
  }

  const sessionWhen = new Date(input.sessionDate)
  const readableDate = Number.isNaN(sessionWhen.getTime()) ? input.sessionDate : sessionWhen.toLocaleString()
  const title = `New session scheduled: ${input.title}`
  const meetingUrl = input.meetingUrl?.trim() || null
  const message = [
    `You have been allocated to a ${input.mode} training session.`,
    `Session: ${input.title}`,
    `Date and time: ${readableDate}`,
    meetingUrl ? `Join link: ${meetingUrl}` : 'Join link: Not set yet. The admin or trainer can add it before the session.',
  ].join('\n')

  const notificationRows: any[] = [{
    batch_id: input.batchId,
    session_id: input.sessionId,
    recipient_user_id: null,
    title,
    message,
    audience: 'batch',
    channel: 'in_app',
    delivery_status: 'sent',
    sent_at: new Date().toISOString(),
    created_by: input.actorId,
    metadata: { category: 'session_scheduled', source: 'training_ops', meeting_url: meetingUrl },
  }]

  for (const member of activeMembers) {
    notificationRows.push({
      batch_id: input.batchId,
      session_id: input.sessionId,
      recipient_user_id: member.user_id,
      title,
      message,
      audience: 'individual',
      channel: 'email',
      delivery_status: 'queued',
      sent_at: null,
      created_by: input.actorId,
      metadata: { category: 'session_scheduled', source: 'training_ops', recipient_role: 'employee', meeting_url: meetingUrl },
    })
  }

  if (input.trainerId) {
    notificationRows.push({
      batch_id: input.batchId,
      session_id: input.sessionId,
      recipient_user_id: input.trainerId,
      title,
      message,
      audience: 'individual',
      channel: 'email',
      delivery_status: 'queued',
      sent_at: null,
      created_by: input.actorId,
      metadata: { category: 'session_scheduled', source: 'training_ops', recipient_role: 'trainer', meeting_url: meetingUrl },
    })
  }

  const insertedNotifications: any[] = []
  for (let i = 0; i < notificationRows.length; i += 500) {
    const { data, error } = await admin.from('training_notifications').insert(notificationRows.slice(i, i + 500)).select('id, recipient_user_id, title, message, metadata')
    if (error) {
      warnings.push(`session notification: ${error.message}`)
      break
    }
    insertedNotifications.push(...(data || []))
  }

  for (const notification of insertedNotifications.filter((row) => row.recipient_user_id)) {
    const profile = recipientsById.get(notification.recipient_user_id) as any
    if (!profile?.email) {
      warnings.push(`email delivery: missing email for ${notification.recipient_user_id}`)
      continue
    }

    const email = buildSessionAllocationEmail({
      recipientName: profile.full_name || profile.email,
      sessionTitle: input.title,
      sessionDate: readableDate,
      mode: input.mode,
      meetingUrl,
    })
    const result = await sendEmail({
      to: profile.email,
      subject: `Training session allocated: ${input.title}`,
      html: email.html,
      text: email.text,
    })
    await admin.from('training_notifications').update({
      delivery_status: result.success ? 'sent' : 'failed',
      sent_at: result.success ? new Date().toISOString() : null,
    }).eq('id', notification.id)
    await admin.from('training_notification_dispatch_log').insert({
      notification_id: notification.id,
      recipient_email: profile.email,
      channel: 'email',
      provider_status: result.success ? 'sent' : 'failed',
      provider_message: result.error || 'Training session allocation email processed.',
    })
    if (!result.success) warnings.push(`email delivery: ${profile.email}: ${result.error || 'failed'}`)
  }

  return {
    memberCount: activeMembers.length,
    notificationCount: notificationRows.length,
    warnings,
  }
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildSessionAllocationEmail(input: {
  recipientName: string
  sessionTitle: string
  sessionDate: string
  mode: string
  meetingUrl: string | null
}) {
  const safeName = escapeHtml(input.recipientName)
  const safeTitle = escapeHtml(input.sessionTitle)
  const safeDate = escapeHtml(input.sessionDate)
  const safeMode = escapeHtml(input.mode)
  const safeUrl = input.meetingUrl ? escapeHtml(input.meetingUrl) : ''
  const joinText = input.meetingUrl
    ? `Join link: ${input.meetingUrl}`
    : 'Join link: Not set yet. The admin or trainer will add it before the session.'

  return {
    text: [
      `Hello ${input.recipientName},`,
      '',
      'You have been allocated to a training session.',
      '',
      `Session: ${input.sessionTitle}`,
      `Date and time: ${input.sessionDate}`,
      `Mode: ${input.mode}`,
      joinText,
      '',
      'Please be available on time and use SkillTest_AI to track attendance and follow-up actions.',
      '',
      'Regards,',
      'SkillTest_AI Training Team',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;padding:28px;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
          <div style="background:#111827;color:#ffffff;padding:24px 28px;">
            <p style="margin:0;color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Training Session Allocation</p>
            <h1 style="margin:10px 0 0;font-size:22px;line-height:1.25;">${safeTitle}</h1>
          </div>
          <div style="padding:26px 28px;color:#1f2937;">
            <p style="margin:0 0 18px;">Hello ${safeName},</p>
            <p style="margin:0 0 18px;line-height:1.6;">You have been allocated to the following training session.</p>
            <table style="width:100%;border-collapse:collapse;margin:0 0 22px;">
              <tr><td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Session</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:700;">${safeTitle}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Date and time</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;">${safeDate}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Mode</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${safeMode}</td></tr>
            </table>
            ${input.meetingUrl
              ? `<a href="${safeUrl}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700;">Join training session</a>
                 <p style="margin:14px 0 0;color:#6b7280;font-size:13px;word-break:break-all;">${safeUrl}</p>`
              : '<p style="margin:0;padding:14px 16px;border-radius:12px;background:#fff7ed;color:#9a3412;">The join link is not set yet. The admin or trainer will add it before the session.</p>'}
            <p style="margin:24px 0 0;color:#4b5563;line-height:1.6;">Please be available on time and use SkillTest_AI to track attendance and follow-up actions.</p>
          </div>
        </div>
      </div>
    `,
  }
}

export async function backfillAttendanceForBatchMembers(
  admin: AdminClient,
  batchId: string,
  userIds: string[],
  actorId: string
) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  if (!uniqueUserIds.length) return { rows: 0, warnings: [] as string[] }

  const { data: sessions, error: sessionError } = await admin
    .from('training_sessions')
    .select('id')
    .eq('batch_id', batchId)
    .eq('attendance_required', true)
    .neq('status', 'cancelled')

  if (sessionError) return { rows: 0, warnings: [`session lookup: ${sessionError.message}`] }
  if (!sessions?.length) return { rows: 0, warnings: [] as string[] }

  const rows = sessions.flatMap((session: any) => uniqueUserIds.map((userId) => ({
    session_id: session.id,
    user_id: userId,
    status: 'absent',
    updated_by: actorId,
  })))

  const warnings: string[] = []
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin
      .from('session_attendance')
      .upsert(rows.slice(i, i + 500), { onConflict: 'session_id,user_id' })

    if (error) {
      warnings.push(`attendance backfill: ${error.message}`)
      break
    }
  }

  return { rows: warnings.length ? 0 : rows.length, warnings }
}
