/**
 * SkillTest_AI TMS email utility (Resend).
 * Uses RESEND_API_KEY env var. Falls back to console logging in development.
 */
import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { PRODUCT_EMAIL_FROM, PRODUCT_NAME, PRODUCT_TMS_LABEL } from '@/lib/branding'
import { getSiteUrl } from '@/lib/security/env'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  /** Defaults to SkillTest_AI sender if not set */
  from?: string
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const from = options.from ?? (process.env.EMAIL_FROM ?? PRODUCT_EMAIL_FROM)

  if (smtpConfigured) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })

      await transporter.sendMail({
        from,
        to: Array.isArray(options.to) ? options.to.join(',') : options.to,
        subject: options.subject,
        html: options.html,
      })
      return { success: true }
    } catch (err: any) {
      console.error('[SMTP EMAIL ERROR]', err)
      return { success: false, error: err.message }
    }
  }

  if (!resend) {
    // Dev / no-key fallback: log to console so testing is unblocked
    console.log('[EMAIL - no RESEND_API_KEY]', {
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
      <p style="color:#a1a1aa;margin:8px 0 0;font-size:14px;">${PRODUCT_TMS_LABEL}</p>
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
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://skilltest.ai'}/manager/operations" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Open Operations Console</a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;margin-top:16px;text-align:center;">${PRODUCT_NAME} | Automated Governance Alert</p>
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
      <p style="color:#fecaca;margin:8px 0 0;font-size:14px;">${PRODUCT_TMS_LABEL}</p>
    </div>
    <div style="border:1px solid #e4e4e7;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
      <p style="color:#18181b;font-size:15px;">Hi ${opts.coordinatorName ?? 'Training Coordinator'},</p>
      <p style="color:#3f3f46;">The following candidate has been absent for <strong>${opts.absenceDays} consecutive sessions</strong> and requires immediate follow-up.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;border-radius:6px 0 0 0;width:40%;">Candidate</td><td style="padding:8px;background:#fafafa;border-radius:0 6px 0 0;">${opts.candidateName}</td></tr>
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;">Email</td><td style="padding:8px;background:#fafafa;">${opts.candidateEmail}</td></tr>
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;border-radius:0 0 0 6px;">Batch</td><td style="padding:8px;background:#fafafa;border-radius:0 0 6px 0;">${opts.batchTitle}</td></tr>
      </table>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://skilltest.ai'}/manager/operations" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Review Candidate</a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;margin-top:16px;text-align:center;">${PRODUCT_NAME} | Automated Governance Alert</p>
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
      <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">${PRODUCT_TMS_LABEL}</p>
    </div>
    <div style="border:1px solid #e4e4e7;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
      <p style="color:#18181b;font-size:15px;">Hi ${opts.candidateName ?? 'Candidate'},</p>
      <p style="color:#3f3f46;">You have an upcoming assessment in your training program.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;border-radius:6px 0 0 0;width:40%;">Assessment</td><td style="padding:8px;background:#fafafa;border-radius:0 6px 0 0;">${opts.assessmentTitle}</td></tr>
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;">Batch</td><td style="padding:8px;background:#fafafa;">${opts.batchTitle}</td></tr>
        <tr><td style="padding:8px;background:#f4f4f5;font-weight:600;border-radius:0 0 0 6px;">Scheduled</td><td style="padding:8px;background:#fafafa;border-radius:0 0 6px 0;">${opts.scheduledAt}</td></tr>
      </table>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://skilltest.ai'}/employee/training" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">View Training Hub</a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;margin-top:16px;text-align:center;">${PRODUCT_NAME} | Training Reminder</p>
  </div>`
}

export function buildFeedbackRequestEmail(opts: {
  batchTitle: string
  windowTitle: string
  closesAt: string
  windowId?: string
  candidateName?: string
}): string {
  const feedbackHref = opts.windowId
    ? `${getSiteUrl()}/employee/training/feedback/${opts.windowId}`
    : `${getSiteUrl()}/employee/training`

  return `
  <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
    <div style="background:#059669;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:20px;">💬 Training Feedback Request</h1>
      <p style="color:#a7f3d0;margin:8px 0 0;font-size:14px;">${PRODUCT_TMS_LABEL}</p>
    </div>
    <div style="border:1px solid #e4e4e7;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
      <p style="color:#18181b;font-size:15px;">Hi ${opts.candidateName ?? 'Candidate'},</p>
      <p style="color:#3f3f46;">Your feedback is requested for the training program <strong>${opts.batchTitle}</strong>.</p>
      <p style="color:#3f3f46;">Please complete your feedback before the window closes on <strong>${opts.closesAt}</strong>.</p>
      <p style="color:#3f3f46;">Your ratings on <em>training content quality</em> and <em>trainer effectiveness</em> help us continuously improve.</p>
      <a href="${feedbackHref}" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Submit Feedback</a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;margin-top:16px;text-align:center;">${PRODUCT_NAME} | Feedback Request</p>
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
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">${PRODUCT_TMS_LABEL}</p>
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
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://skilltest.ai'}/manager/operations" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Open Operations Console</a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;margin-top:16px;text-align:center;">${PRODUCT_NAME} | Upload Notification</p>
  </div>`
}

export function buildQuizAssignedEmail(opts: {
  employeeName?: string | null
  quizTitle: string
  topic: string
  difficulty: string
  dueDate?: string | null
}) {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:620px;margin:0 auto;padding:24px;background:#f8fafc;">
    <div style="background:#050505;color:#fff;padding:24px;border-radius:18px 18px 0 0;">
      <p style="margin:0;color:#8b5cf6;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">SkillTest_AI Assignment</p>
      <h1 style="margin:10px 0 0;font-size:24px;">New quiz assigned</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 18px 18px;">
      <p>Hi ${opts.employeeName || 'Learner'},</p>
      <p>You have been assigned <strong>${opts.quizTitle}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0;">
        <tr><td style="padding:10px;background:#f3f4f6;font-weight:700;">Topic</td><td style="padding:10px;background:#fafafa;">${opts.topic}</td></tr>
        <tr><td style="padding:10px;background:#f3f4f6;font-weight:700;">Difficulty</td><td style="padding:10px;background:#fafafa;">${opts.difficulty}</td></tr>
        <tr><td style="padding:10px;background:#f3f4f6;font-weight:700;">Due</td><td style="padding:10px;background:#fafafa;">${opts.dueDate || 'As scheduled by your trainer'}</td></tr>
      </table>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/employee/quizzes" style="display:inline-block;background:#000;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700;">Open Quiz</a>
    </div>
  </div>`
}

export function buildEmployeeWelcomeEmail(opts: {
  employeeName?: string | null
  setupLink: string
}) {
  const employeeName = escapeHtml(opts.employeeName || 'Learner')
  const setupLink = escapeHtml(opts.setupLink)

  return `
  <div style="font-family:system-ui,sans-serif;max-width:620px;margin:0 auto;padding:24px;background:#f8fafc;">
    <div style="background:#050505;color:#fff;padding:24px;border-radius:18px 18px 0 0;">
      <p style="margin:0;color:#22c55e;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">SkillTest_AI Account</p>
      <h1 style="margin:10px 0 0;font-size:24px;">Set up your learning account</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 18px 18px;">
      <p>Hi ${employeeName},</p>
      <p>Your SkillTest_AI learner account has been created. Set your password to access assigned quizzes, training sessions, leaderboards, badges, and certificates.</p>
      <a href="${setupLink}" style="display:inline-block;background:#000;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700;margin:12px 0;">Set Password</a>
      <p style="color:#64748b;font-size:13px;">If the button does not work, open this link in your browser:</p>
      <p style="word-break:break-all;color:#334155;font-size:13px;">${setupLink}</p>
    </div>
  </div>`
}

export function buildQuizCompletedEmail(opts: {
  employeeName?: string | null
  quizTitle: string
  score: number
  points: number
  badgesEarned?: number
  certificateIssued?: boolean
}) {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:620px;margin:0 auto;padding:24px;background:#f8fafc;">
    <div style="background:#111827;color:#fff;padding:24px;border-radius:18px 18px 0 0;">
      <p style="margin:0;color:#22c55e;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">SkillTest_AI Result</p>
      <h1 style="margin:10px 0 0;font-size:24px;">Quiz completed</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 18px 18px;">
      <p>Hi ${opts.employeeName || 'Learner'},</p>
      <p>Your result for <strong>${opts.quizTitle}</strong> is ready.</p>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:18px 0;">
        <div style="padding:16px;border-radius:14px;background:#ecfdf5;color:#065f46;"><strong style="font-size:24px;">${opts.score}%</strong><br/>Score</div>
        <div style="padding:16px;border-radius:14px;background:#eef2ff;color:#3730a3;"><strong style="font-size:24px;">${opts.points}</strong><br/>Points</div>
      </div>
      <p>${opts.badgesEarned ? `You unlocked ${opts.badgesEarned} badge(s).` : 'Keep going to unlock more badges.'}</p>
      ${opts.certificateIssued ? '<p style="color:#b45309;font-weight:700;">A certificate has been issued for this result.</p>' : ''}
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/employee/quizzes" style="display:inline-block;background:#000;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700;">View Result</a>
    </div>
  </div>`
}
