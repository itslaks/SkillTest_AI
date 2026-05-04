/**
 * Maverick TMS — Email utility (Resend)
 * Uses RESEND_API_KEY env var. Falls back to console-logging in development.
 */
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  /** Defaults to "Maverick TMS <noreply@maverickplatform.app>" if not set */
  from?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const from = options.from ?? (process.env.EMAIL_FROM ?? 'Maverick TMS <noreply@maverickplatform.app>')

  if (!resend) {
    // Dev / no-key fallback: log to console so testing is unblocked
    console.log('[EMAIL — no RESEND_API_KEY]', {
      from,
      to: options.to,
      subject: options.subject,
    })
    return { success: true }
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    console.error('[EMAIL ERROR]', err)
    return { success: false, error: err.message }
  }
}

// ─── Template helpers ────────────────────────────────────────────────────────

export function buildAttendanceCutoffEmail(opts: {
  batchTitle: string
  sessionTitle: string
  sessionDate: string
  cutoffTime: string
  coordinatorName?: string
}): string {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
    <div style="background:#000;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:20px;">⚠️ Attendance Cut-off Missed</h1>
      <p style="color:#a1a1aa;margin:8px 0 0;font-size:14px;">Maverick Execution Platform — Training Management System</p>
    </div>
    <div style="border:1px solid #e4e4e7;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
      <p style="color:#18181b;font-size:15px;">Hi ${opts.coordinatorName ?? 'Training Coordinator'},</p>
      <p style="color:#3f3f46;">Attendance was not submitted for the session below before the <strong>${opts.cutoffTime}</strong> cut-off.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;border-radius:6px 0 0 0;width:40%;">Batch</td><td style="padding:8px;background:#fafafa;border-radius:0 6px 0 0;">${opts.batchTitle}</td></tr>
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;">Session</td><td style="padding:8px;background:#fafafa;">${opts.sessionTitle}</td></tr>
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;border-radius:0 0 0 6px;">Date</td><td style="padding:8px;background:#fafafa;border-radius:0 0 6px 0;">${opts.sessionDate}</td></tr>
      </table>
      <p style="color:#3f3f46;">Please log in and upload attendance immediately.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://maverickplatform.app'}/manager/operations" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Open Operations Console →</a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;margin-top:16px;text-align:center;">Maverick Execution Platform · Automated Governance Alert</p>
  </div>`
}

export function buildAbsenceStreakEmail(opts: {
  candidateName: string
  candidateEmail: string
  batchTitle: string
  absenceDays: number
  coordinatorName?: string
}): string {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
    <div style="background:#dc2626;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:20px;">🚨 Absence Alert — ${opts.absenceDays}-Day Streak</h1>
      <p style="color:#fecaca;margin:8px 0 0;font-size:14px;">Maverick Execution Platform — Training Management System</p>
    </div>
    <div style="border:1px solid #e4e4e7;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
      <p style="color:#18181b;font-size:15px;">Hi ${opts.coordinatorName ?? 'Training Coordinator'},</p>
      <p style="color:#3f3f46;">The following candidate has been absent for <strong>${opts.absenceDays} consecutive sessions</strong> and requires immediate follow-up.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;border-radius:6px 0 0 0;width:40%;">Candidate</td><td style="padding:8px;background:#fafafa;border-radius:0 6px 0 0;">${opts.candidateName}</td></tr>
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;">Email</td><td style="padding:8px;background:#fafafa;">${opts.candidateEmail}</td></tr>
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;border-radius:0 0 0 6px;">Batch</td><td style="padding:8px;background:#fafafa;border-radius:0 0 6px 0;">${opts.batchTitle}</td></tr>
      </table>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://maverickplatform.app'}/manager/operations" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Review Candidate →</a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;margin-top:16px;text-align:center;">Maverick Execution Platform · Automated Governance Alert</p>
  </div>`
}

export function buildAssessmentReminderEmail(opts: {
  assessmentTitle: string
  batchTitle: string
  scheduledAt: string
  candidateName?: string
}): string {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
    <div style="background:#1d4ed8;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:20px;">📋 Upcoming Assessment Reminder</h1>
      <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Maverick Execution Platform — Training Management System</p>
    </div>
    <div style="border:1px solid #e4e4e7;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
      <p style="color:#18181b;font-size:15px;">Hi ${opts.candidateName ?? 'Candidate'},</p>
      <p style="color:#3f3f46;">You have an upcoming assessment in your training program.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;border-radius:6px 0 0 0;width:40%;">Assessment</td><td style="padding:8px;background:#fafafa;border-radius:0 6px 0 0;">${opts.assessmentTitle}</td></tr>
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;">Batch</td><td style="padding:8px;background:#fafafa;">${opts.batchTitle}</td></tr>
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;border-radius:0 0 0 6px;">Scheduled</td><td style="padding:8px;background:#fafafa;border-radius:0 0 6px 0;">${opts.scheduledAt}</td></tr>
      </table>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://maverickplatform.app'}/employee/training" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">View Training Hub →</a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;margin-top:16px;text-align:center;">Maverick Execution Platform · Training Reminder</p>
  </div>`
}

export function buildFeedbackRequestEmail(opts: {
  batchTitle: string
  windowTitle: string
  closesAt: string
  candidateName?: string
}): string {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
    <div style="background:#059669;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:20px;">💬 Training Feedback Request</h1>
      <p style="color:#a7f3d0;margin:8px 0 0;font-size:14px;">Maverick Execution Platform — Training Management System</p>
    </div>
    <div style="border:1px solid #e4e4e7;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
      <p style="color:#18181b;font-size:15px;">Hi ${opts.candidateName ?? 'Candidate'},</p>
      <p style="color:#3f3f46;">Your feedback is requested for the training program <strong>${opts.batchTitle}</strong>.</p>
      <p style="color:#3f3f46;">Please complete your feedback before the window closes on <strong>${opts.closesAt}</strong>.</p>
      <p style="color:#3f3f46;">Your ratings on <em>training content quality</em> and <em>trainer effectiveness</em> help us continuously improve.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://maverickplatform.app'}/employee/training" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Submit Feedback →</a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;margin-top:16px;text-align:center;">Maverick Execution Platform · Feedback Request</p>
  </div>`
}

export function buildUploadConfirmationEmail(opts: {
  uploaderName: string
  uploadType: 'attendance' | 'assessment_scores' | 'project_evaluation' | 'candidates'
  batchTitle: string
  recordCount: number
  errorCount?: number
}): string {
  const typeLabel = {
    attendance: 'Attendance',
    assessment_scores: 'Assessment Scores',
    project_evaluation: 'Project Evaluation',
    candidates: 'Candidate Master',
  }[opts.uploadType]

  const statusColor = (opts.errorCount ?? 0) > 0 ? '#d97706' : '#059669'

  return `
  <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
    <div style="background:${statusColor};padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:20px;">✅ ${typeLabel} Upload Confirmed</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Maverick Execution Platform — Training Management System</p>
    </div>
    <div style="border:1px solid #e4e4e7;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
      <p style="color:#18181b;font-size:15px;">Hi ${opts.uploaderName},</p>
      <p style="color:#3f3f46;">Your <strong>${typeLabel}</strong> upload has been processed.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;border-radius:6px 0 0 0;width:40%;">Batch</td><td style="padding:8px;background:#fafafa;border-radius:0 6px 0 0;">${opts.batchTitle}</td></tr>
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;">Records Processed</td><td style="padding:8px;background:#fafafa;">${opts.recordCount}</td></tr>
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;border-radius:0 0 0 6px;">Errors / Skipped</td><td style="padding:8px;background:#fafafa;border-radius:0 0 6px 0;">${opts.errorCount ?? 0}</td></tr>
      </table>
      ${(opts.errorCount ?? 0) > 0 ? '<p style="color:#d97706;font-weight:600;">⚠️ Some records had validation errors. Please review in the Operations Console.</p>' : '<p style="color:#059669;font-weight:600;">All records imported successfully.</p>'}
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://maverickplatform.app'}/manager/operations" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Open Operations Console →</a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;margin-top:16px;text-align:center;">Maverick Execution Platform · Upload Notification</p>
  </div>`
}
