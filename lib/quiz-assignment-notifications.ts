import { sendMandatoryBrdEmail } from '@/lib/brd-notifications'
import { createAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createAdminClient>

export type QuizAssignmentEmailRecipient = {
  id: string
  email: string
  full_name?: string | null
}

export type QuizAssignmentEmailInput = {
  admin: AdminClient
  quiz: {
    id: string
    title?: string | null
    batch_id?: string | null
  }
  recipients: QuizAssignmentEmailRecipient[]
  assignedBy: {
    id: string
    name?: string | null
    email?: string | null
  }
  dueDate?: string | null
}

export type QuizAssignmentEmailSummary = {
  attempted: number
  sent: number
  failed: number
  failures: Array<{ email: string; error: string }>
  logIds: string[]
}

export async function notifyQuizAssigned(input: QuizAssignmentEmailInput): Promise<QuizAssignmentEmailSummary> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
  const quizTitle = input.quiz.title || 'SkillTest_AI Assessment'
  const dueDate = input.dueDate || 'Not set'
  const assignedBy = input.assignedBy.name || input.assignedBy.email || 'SkillTest_AI admin'
  const summary: QuizAssignmentEmailSummary = {
    attempted: 0,
    sent: 0,
    failed: 0,
    failures: [],
    logIds: [],
  }

  for (const recipient of input.recipients) {
    if (!recipient.email) {
      summary.failed += 1
      summary.failures.push({ email: recipient.id, error: 'Recipient email is missing.' })
      continue
    }

    summary.attempted += 1
    const employeeName = recipient.full_name || recipient.email
    const text = [
      `Hello ${employeeName},`,
      '',
      'A new quiz has been assigned to you.',
      '',
      `Quiz: ${quizTitle}`,
      `Due date: ${dueDate}`,
      `Assigned by: ${assignedBy}`,
      '',
      'Please log in to Skilltest_AI to complete it.',
      '',
      appUrl,
      '',
      'Regards,',
      'Skilltest_AI Training Team',
    ].join('\n')

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
        <p>Hello ${escapeHtml(employeeName)},</p>
        <p>A new quiz has been assigned to you.</p>
        <p>
          <strong>Quiz:</strong> ${escapeHtml(quizTitle)}<br/>
          <strong>Due date:</strong> ${escapeHtml(dueDate)}<br/>
          <strong>Assigned by:</strong> ${escapeHtml(assignedBy)}
        </p>
        <p>Please log in to Skilltest_AI to complete it.</p>
        <p><a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a></p>
        <p>Regards,<br/>Skilltest_AI Training Team</p>
      </div>
    `

    const result = await sendMandatoryBrdEmail({
      admin: input.admin,
      eventType: 'quiz_assigned',
      to: recipient.email,
      recipientRole: 'employee',
      relatedBatchId: input.quiz.batch_id || null,
      subject: `New quiz assigned: ${quizTitle}`,
      html,
      text,
    })

    if (result.logId) summary.logIds.push(result.logId)
    if (result.success) summary.sent += 1
    else {
      summary.failed += 1
      summary.failures.push({ email: recipient.email, error: result.error || 'Email delivery failed.' })
    }
  }

  return summary
}

export function formatQuizAssignmentEmailSummary(summary: QuizAssignmentEmailSummary) {
  if (!summary.attempted && !summary.failed) return 'No assignment emails were attempted.'
  const base = `Assignment emails: ${summary.sent} sent, ${summary.failed} failed.`
  if (!summary.failures.length) return base
  const sample = summary.failures.slice(0, 3).map((failure) => `${failure.email}: ${failure.error}`).join('; ')
  return `${base} ${sample}`
}

function escapeHtml(value: string | null | undefined) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
