/**
 * SkillTest_AI TMS email utility (Resend).
 * Uses RESEND_API_KEY env var. Falls back to console logging in development.
 */
import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { PRODUCT_EMAIL_FROM, PRODUCT_NAME, PRODUCT_TMS_LABEL } from '@/lib/branding'
import { getSiteUrl } from '@/lib/security/env'

let resendClient: Resend | null | undefined
let smtpTransporter: nodemailer.Transporter | null = null
let smtpCooldownUntil = 0
let smtpLastError: string | null = null
let smtpLastCheckedAt: string | null = null
let emailLastProvider: 'smtp' | 'resend' | 'none' = 'none'
let emailLastStatus: 'connected' | 'failing' | 'rate_limited' | 'not_configured' = 'not_configured'

const SMTP_INVALID_AUTH_COOLDOWN_MS = 15 * 60 * 1000
const SMTP_RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000
const SMTP_RETRY_DELAYS_MS = [750, 2000]

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
}

function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null
  if (resendClient === undefined) resendClient = new Resend(process.env.RESEND_API_KEY)
  return resendClient
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function getSmtpTransporter() {
  if (!smtpConfigured()) return null
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      pool: true,
      maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 2),
      maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 40),
      rateDelta: Number(process.env.SMTP_RATE_DELTA_MS || 1000),
      rateLimit: Number(process.env.SMTP_RATE_LIMIT || 4),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }
  return smtpTransporter
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function smtpErrorKind(error: any): 'invalid_auth' | 'rate_limited' | 'transient' {
  const message = String(error?.message || error?.response || '')
  const code = String(error?.code || '')
  const responseCode = Number(error?.responseCode || 0)
  if (responseCode === 535 || code === 'EAUTH' || /invalid login|authentication failed|username and password not accepted/i.test(message)) {
    return 'invalid_auth'
  }
  if (responseCode === 454 || /too many login attempts|rate limit|temporarily rejected|try again later/i.test(message)) {
    return 'rate_limited'
  }
  return 'transient'
}

function rememberEmailFailure(provider: 'smtp' | 'resend' | 'none', error: string, status: typeof emailLastStatus = 'failing') {
  emailLastProvider = provider
  emailLastStatus = status
  smtpLastError = error
  smtpLastCheckedAt = new Date().toISOString()
}

function rememberEmailSuccess(provider: 'smtp' | 'resend') {
  emailLastProvider = provider
  emailLastStatus = 'connected'
  smtpLastError = null
  smtpLastCheckedAt = new Date().toISOString()
}

export function validateEmailConfiguration(): { valid: boolean; provider: 'smtp' | 'resend' | 'none'; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const hasResend = Boolean(process.env.RESEND_API_KEY)
  const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'] as const
  const missingSmtp = smtpKeys.filter((key) => !process.env[key])

  if (smtpConfigured()) {
    const port = Number(process.env.SMTP_PORT || 587)
    if (!Number.isInteger(port) || port <= 0 || port > 65535) errors.push('SMTP_PORT must be a valid TCP port.')
    if (!process.env.EMAIL_FROM) warnings.push('EMAIL_FROM is missing; default product sender will be used.')
    if (/gmail\.com$/i.test(String(process.env.SMTP_HOST)) && !/app password|xxxx| /i.test(String(process.env.SMTP_PASS)) && String(process.env.SMTP_PASS).length < 16) {
      warnings.push('Gmail SMTP should use a Google App Password, not the account password.')
    }
    return { valid: errors.length === 0, provider: 'smtp', errors, warnings }
  }

  if (hasResend) {
    if (!process.env.EMAIL_FROM) warnings.push('EMAIL_FROM is missing; Resend may reject unverified default sender domains.')
    return { valid: true, provider: 'resend', errors, warnings }
  }

  errors.push(`Email provider is not configured. Set RESEND_API_KEY or ${missingSmtp.join(', ')}.`)
  return { valid: false, provider: 'none', errors, warnings }
}

export async function getEmailHealth() {
  const config = validateEmailConfiguration()
  if (!config.valid) {
    return {
      provider: config.provider,
      status: 'not_configured' as const,
      lastError: config.errors.join(' '),
      lastCheckedAt: smtpLastCheckedAt,
      warnings: config.warnings,
    }
  }
  if (config.provider === 'smtp' && Date.now() < smtpCooldownUntil) {
    return {
      provider: 'smtp' as const,
      status: 'rate_limited' as const,
      lastError: smtpLastError,
      lastCheckedAt: smtpLastCheckedAt,
      cooldownUntil: new Date(smtpCooldownUntil).toISOString(),
      warnings: config.warnings,
    }
  }
  return {
    provider: config.provider,
    status: emailLastProvider === config.provider ? emailLastStatus : 'connected',
    lastError: smtpLastError,
    lastCheckedAt: smtpLastCheckedAt,
    warnings: config.warnings,
  }
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  headers?: Record<string, string>
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
  const text = options.text ?? htmlToText(options.html)
  const replyTo = options.replyTo ?? process.env.EMAIL_REPLY_TO
  const config = validateEmailConfiguration()

  if (!config.valid) {
    rememberEmailFailure('none', config.errors.join(' '), 'not_configured')
    if (isProductionRuntime()) {
      console.error('[EMAIL CONFIG ERROR]', config.errors.join(' '))
      return { success: false, error: config.errors.join(' ') }
    }

    console.log('[EMAIL - no provider]', {
      from,
      to: options.to,
      subject: options.subject,
    })
    return { success: true }
  }

  if (config.provider === 'smtp') {
    if (Date.now() < smtpCooldownUntil) {
      const error = `SMTP is cooling down after a previous authentication/rate-limit failure until ${new Date(smtpCooldownUntil).toISOString()}.`
      rememberEmailFailure('smtp', error, 'rate_limited')
      return { success: false, error }
    }

    const transporter = getSmtpTransporter()
    if (!transporter) return { success: false, error: 'SMTP transporter is not configured.' }

    for (let attempt = 0; attempt <= SMTP_RETRY_DELAYS_MS.length; attempt++) {
      try {
        await transporter.sendMail({
          from,
          to: Array.isArray(options.to) ? options.to.join(',') : options.to,
          subject: options.subject,
          text,
          html: options.html,
          replyTo,
          headers: options.headers,
        })
        rememberEmailSuccess('smtp')
        return { success: true }
      } catch (err: any) {
        const kind = smtpErrorKind(err)
        const message = err?.message || 'SMTP delivery failed.'
        console.error('[SMTP EMAIL ERROR]', message)

        if (kind === 'invalid_auth' || kind === 'rate_limited') {
          smtpTransporter?.close()
          smtpTransporter = null
          smtpCooldownUntil = Date.now() + (kind === 'invalid_auth' ? SMTP_INVALID_AUTH_COOLDOWN_MS : SMTP_RATE_LIMIT_COOLDOWN_MS)
          rememberEmailFailure('smtp', message, 'rate_limited')
          return { success: false, error: message }
        }

        if (attempt < SMTP_RETRY_DELAYS_MS.length) {
          await sleep(SMTP_RETRY_DELAYS_MS[attempt])
          continue
        }

        rememberEmailFailure('smtp', message)
        return { success: false, error: message }
      }
    }
  }

  const resend = getResendClient()
  if (!resend) {
    rememberEmailFailure('none', 'Email provider is not configured.', 'not_configured')
    return { success: false, error: 'Email provider is not configured.' }
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      text,
      html: options.html,
      replyTo,
      headers: options.headers,
    } as any)
    if (error) {
      rememberEmailFailure('resend', error.message)
      return { success: false, error: error.message }
    }
    rememberEmailSuccess('resend')
    return { success: true }
  } catch (err: any) {
    console.error('[EMAIL ERROR]', err)
    rememberEmailFailure('resend', err.message)
    return { success: false, error: err.message }
  }
}

function appLink(path: string) {
  const baseUrl = getSiteUrl().replace(/\/$/, '')
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/(?:div|tr|table|h1|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
      <a href="${appLink('/manager/operations')}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Open Operations Console</a>
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
      <a href="${appLink('/manager/operations')}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Review Candidate</a>
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
      <a href="${appLink('/employee/training')}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">View Training Hub</a>
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
      <a href="${appLink('/manager/operations')}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Open Operations Console</a>
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
      <a href="${getSiteUrl().replace(/\/$/, '')}/employee/quizzes" style="display:inline-block;background:#000;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700;">Open Quiz</a>
    </div>
  </div>`
}

export function buildEmployeeWelcomeEmail(opts: {
  employeeName?: string | null
  setupLink: string
  signUpLink?: string | null
}) {
  const employeeName = escapeHtml(opts.employeeName || 'Learner')
  const setupLink = escapeHtml(opts.setupLink)
  const signUpLink = opts.signUpLink ? escapeHtml(opts.signUpLink) : null

  return `
  <div style="font-family:system-ui,sans-serif;max-width:620px;margin:0 auto;padding:24px;background:#f8fafc;">
    <div style="background:#050505;color:#fff;padding:24px;border-radius:18px 18px 0 0;">
      <p style="margin:0;color:#22c55e;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">SkillTest_AI Account</p>
      <h1 style="margin:10px 0 0;font-size:24px;">Set up your learning account</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 18px 18px;">
      <p>Hi ${employeeName},</p>
      <p>Your SkillTest_AI employee record has been created by your admin. Verify this email first, then set your password so your sign-in stays synced with assigned quizzes, training sessions, leaderboards, badges, and certificates.</p>
      <a href="${setupLink}" style="display:inline-block;background:#000;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700;margin:12px 0;">Verify Email &amp; Set Password</a>
      ${signUpLink ? `<p style="color:#64748b;font-size:13px;">If you open the sign-up page first, use this synced sign-up path:</p><p style="word-break:break-all;color:#334155;font-size:13px;">${signUpLink}</p>` : ''}
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
  passingScore?: number
  badgesEarned?: number
  certificateIssued?: boolean
  certificateUrl?: string
  resultUrl?: string
  analysis?: {
    areasToImprove?: string[]
    strengths?: string[]
    feedback?: string
    suggestion?: string
    weakTopics?: Array<{ topic: string; accuracy: number; wrong: number; total: number }>
    strongTopics?: Array<{ topic: string; accuracy: number }>
  }
}) {
  const baseUrl = getSiteUrl().replace(/\/$/, '')
  const resultUrl = escapeHtml(opts.resultUrl || `${baseUrl}/employee/quizzes`)
  const certificateUrl = opts.certificateUrl ? escapeHtml(opts.certificateUrl) : null
  const isPassing = opts.score >= (opts.passingScore ?? 60)
  const weakTopics = opts.analysis?.weakTopics || []
  const strongTopics = opts.analysis?.strongTopics || []
  const areasToImprove = opts.analysis?.areasToImprove || []
  const strengths = opts.analysis?.strengths || []
  const coachingRows = [
    ...weakTopics.slice(0, 3).map((topic) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #fee2e2;font-weight:700;color:#991b1b;">${escapeHtml(topic.topic)}</td>
        <td style="padding:10px;border-bottom:1px solid #fee2e2;color:#7f1d1d;">${topic.accuracy}% accuracy (${topic.wrong}/${topic.total} missed)</td>
      </tr>`),
    ...strongTopics.slice(0, 2).map((topic) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #dcfce7;font-weight:700;color:#166534;">${escapeHtml(topic.topic)}</td>
        <td style="padding:10px;border-bottom:1px solid #dcfce7;color:#166534;">Strong area at ${topic.accuracy}% accuracy</td>
      </tr>`),
  ].join('')
  return `
  <div style="font-family:system-ui,sans-serif;max-width:620px;margin:0 auto;padding:24px;background:#f8fafc;">
    <div style="background:#111827;color:#fff;padding:24px;border-radius:18px 18px 0 0;">
      <p style="margin:0;color:#22c55e;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">SkillTest_AI Result</p>
      <h1 style="margin:10px 0 0;font-size:24px;">${isPassing ? '🎉 Quiz Passed!' : 'Quiz Completed'}</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 18px 18px;">
      <p>Hi ${escapeHtml(opts.employeeName || 'Learner')},</p>
      <p>Your result for <strong>${escapeHtml(opts.quizTitle)}</strong> is ready.</p>
      <div style="display:flex;gap:12px;margin:18px 0;">
        <div style="flex:1;padding:20px;border-radius:14px;background:${isPassing ? '#ecfdf5' : '#fff7ed'};color:${isPassing ? '#065f46' : '#9a3412'};text-align:center;">
          <strong style="font-size:32px;">${opts.score}%</strong><br/><span style="font-size:13px;">Your Score</span>
        </div>
        <div style="flex:1;padding:20px;border-radius:14px;background:#eef2ff;color:#3730a3;text-align:center;">
          <strong style="font-size:32px;">+${opts.points}</strong><br/><span style="font-size:13px;">Points Earned</span>
        </div>
      </div>
      ${opts.badgesEarned ? `<p style="color:#374151;">You unlocked <strong>${opts.badgesEarned} badge(s)</strong> for this attempt.</p>` : ''}
      ${opts.certificateIssued ? '<p style="color:#b45309;font-weight:700;background:#fffbeb;padding:12px 16px;border-radius:10px;border:1px solid #fde68a;">🏆 A certificate of completion has been issued for this quiz.</p>' : ''}
      ${opts.analysis ? `
        <div style="margin-top:20px;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <div style="background:#111827;color:#fff;padding:16px 18px;">
            <p style="margin:0;color:#93c5fd;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;">AI Performance Analysis</p>
            <h2 style="margin:6px 0 0;font-size:18px;">Your coaching report</h2>
          </div>
          <div style="padding:18px;background:#ffffff;">
            ${coachingRows ? `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${coachingRows}</table>` : ''}
            ${areasToImprove.length ? `<p style="margin:0 0 8px;font-weight:800;color:#991b1b;">Areas to improve</p><ul style="margin:0 0 16px 18px;color:#4b5563;">${areasToImprove.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
            ${strengths.length ? `<p style="margin:0 0 8px;font-weight:800;color:#166534;">Strong areas</p><ul style="margin:0 0 16px 18px;color:#4b5563;">${strengths.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
            <p style="margin:0 0 10px;color:#374151;"><strong>AI feedback:</strong> ${escapeHtml(opts.analysis.feedback || 'Review your answer explanations and repeat the weakest topics with timed practice.')}</p>
            <p style="margin:0;color:#374151;"><strong>Suggested improvement plan:</strong> ${escapeHtml(opts.analysis.suggestion || 'Practice five similar questions and explain the reasoning before checking the answer.')}</p>
          </div>
        </div>
      ` : ''}
      <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
        <a href="${resultUrl}" style="display:inline-block;background:#111827;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">View Full Results &amp; Score Breakdown</a>
        ${certificateUrl ? `<a href="${certificateUrl}" style="display:inline-block;background:#d97706;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Download Certificate</a>` : ''}
      </div>
      <p style="color:#6b7280;font-size:12px;margin-top:16px;">If the button does not open, paste this link in your browser:<br/><span style="color:#374151;word-break:break-all;">${resultUrl}</span></p>
    </div>
  </div>`
}

export function buildTrainerQuizInsightEmail(opts: {
  trainerName?: string | null
  employeeName?: string | null
  employeeEmail?: string | null
  quizTitle: string
  score: number
  passingScore?: number
  resultUrl?: string
  analysis?: {
    areasToImprove?: string[]
    strengths?: string[]
    feedback?: string
    suggestion?: string
    weakTopics?: Array<{ topic: string; accuracy: number; wrong: number; total: number }>
    strongTopics?: Array<{ topic: string; accuracy: number }>
  }
}) {
  const baseUrl = getSiteUrl().replace(/\/$/, '')
  const resultUrl = escapeHtml(opts.resultUrl || `${baseUrl}/manager/analytics`)
  const passingScore = opts.passingScore ?? 60
  const needsCoaching = opts.score < passingScore || Boolean(opts.analysis?.weakTopics?.length)
  const weakTopics = opts.analysis?.weakTopics || []
  const strongTopics = opts.analysis?.strongTopics || []
  const improvementList = opts.analysis?.areasToImprove?.length
    ? opts.analysis.areasToImprove
    : weakTopics.map((topic) => `${topic.topic}: ${topic.wrong}/${topic.total} missed (${topic.accuracy}% accuracy)`)
  const strengths = opts.analysis?.strengths?.length
    ? opts.analysis.strengths
    : strongTopics.map((topic) => `${topic.topic}: ${topic.accuracy}% accuracy`)

  return `
  <div style="font-family:system-ui,sans-serif;max-width:680px;margin:0 auto;padding:24px;background:#f8fafc;">
    <div style="background:#111827;color:#fff;padding:24px;border-radius:18px 18px 0 0;">
      <p style="margin:0;color:#93c5fd;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;">SkillTest_AI Trainer Insight</p>
      <h1 style="margin:10px 0 0;font-size:24px;">Learner coaching signal</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 18px 18px;">
      <p>Hi ${escapeHtml(opts.trainerName || 'Trainer')},</p>
      <p><strong>${escapeHtml(opts.employeeName || 'Learner')}</strong>${opts.employeeEmail ? ` (${escapeHtml(opts.employeeEmail)})` : ''} has completed <strong>${escapeHtml(opts.quizTitle)}</strong>.</p>
      <div style="display:flex;gap:12px;margin:18px 0;flex-wrap:wrap;">
        <div style="flex:1;min-width:180px;padding:18px;border-radius:14px;background:${needsCoaching ? '#fff7ed' : '#ecfdf5'};color:${needsCoaching ? '#9a3412' : '#065f46'};text-align:center;">
          <strong style="font-size:30px;">${opts.score}%</strong><br/><span style="font-size:13px;">Learner score</span>
        </div>
        <div style="flex:1;min-width:180px;padding:18px;border-radius:14px;background:#eef2ff;color:#3730a3;text-align:center;">
          <strong style="font-size:30px;">${passingScore}%</strong><br/><span style="font-size:13px;">Passing score</span>
        </div>
      </div>
      ${improvementList.length ? `<p style="margin:0 0 8px;font-weight:800;color:#991b1b;">Areas to coach</p><ul style="margin:0 0 16px 18px;color:#4b5563;">${improvementList.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      ${strengths.length ? `<p style="margin:0 0 8px;font-weight:800;color:#166534;">Strong areas to reinforce</p><ul style="margin:0 0 16px 18px;color:#4b5563;">${strengths.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      <div style="padding:16px;border-radius:14px;background:#f9fafb;border:1px solid #e5e7eb;margin:18px 0;">
        <p style="margin:0 0 10px;color:#374151;"><strong>AI feedback:</strong> ${escapeHtml(opts.analysis?.feedback || 'Review this learner with the topic breakdown and assign short targeted practice.')}</p>
        <p style="margin:0;color:#374151;"><strong>Trainer action:</strong> ${escapeHtml(opts.analysis?.suggestion || 'Use the next coaching session to discuss missed concepts, then retest with similar questions.')}</p>
      </div>
      <a href="${resultUrl}" style="display:inline-block;background:#111827;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Open AI Insights</a>
      <p style="color:#6b7280;font-size:12px;margin-top:16px;">If the button does not open, paste this link in your browser:<br/><span style="color:#374151;word-break:break-all;">${resultUrl}</span></p>
    </div>
  </div>`
}

export function buildQuizProctoringFlagEmail(opts: {
  employeeName?: string | null
  employeeEmail?: string | null
  employeeId?: string | null
  quizTitle: string
  score: number
  violationCount: number
  riskScore: number
  riskLevel: string
  autoSubmitted: boolean
  reviewUrl: string
  events: Array<{
    type: string
    label: string
    occurredAt: string
    riskScore?: number
    riskLevel?: string
    evidencePath?: string | null
  }>
}) {
  const employeeName = escapeHtml(opts.employeeName || 'Learner')
  const employeeEmail = escapeHtml(opts.employeeEmail || 'Unknown email')
  const employeeId = escapeHtml(opts.employeeId || 'N/A')
  const quizTitle = escapeHtml(opts.quizTitle)
  const rows = opts.events.slice(0, 10).map((event, index) => {
    const evidence = event.evidencePath
      ? '<span style="color:#991b1b;font-size:12px;">Protected evidence captured. Open the review dashboard to view.</span>'
      : '<span style="color:#991b1b;font-size:12px;">No frame captured</span>'

    return `
      <tr>
        <td style="vertical-align:top;padding:10px;border-bottom:1px solid #fee2e2;font-weight:700;">${index + 1}</td>
        <td style="vertical-align:top;padding:10px;border-bottom:1px solid #fee2e2;">
          <strong>${escapeHtml(event.label)}</strong><br/>
          <span style="color:#6b7280;font-size:12px;">${escapeHtml(event.type)} - ${escapeHtml(new Date(event.occurredAt).toLocaleString('en-IN'))} - risk ${event.riskScore ?? 0}</span>
          ${evidence}
        </td>
      </tr>`
  }).join('')

  return `
  <div style="font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px;background:#fff7ed;">
    <div style="background:#991b1b;color:#fff;padding:24px;border-radius:18px 18px 0 0;">
      <p style="margin:0;color:#fecaca;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">SkillTest_AI Proctoring Alert</p>
      <h1 style="margin:10px 0 0;font-size:24px;">Quiz attempt flagged</h1>
    </div>
    <div style="background:#fff;border:1px solid #fecaca;border-top:0;padding:24px;border-radius:0 0 18px 18px;">
      <p><strong>${employeeName}</strong> (${employeeEmail}) was flagged during <strong>${quizTitle}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0;">
        <tr><td style="padding:10px;background:#fee2e2;font-weight:700;width:38%;">Candidate ID</td><td style="padding:10px;background:#fff7ed;">${employeeId}</td></tr>
        <tr><td style="padding:10px;background:#fee2e2;font-weight:700;width:38%;">Violations</td><td style="padding:10px;background:#fff7ed;">${opts.violationCount}</td></tr>
        <tr><td style="padding:10px;background:#fee2e2;font-weight:700;">Risk score</td><td style="padding:10px;background:#fff7ed;">${opts.riskScore} (${escapeHtml(opts.riskLevel)})</td></tr>
        <tr><td style="padding:10px;background:#fee2e2;font-weight:700;">Auto submitted</td><td style="padding:10px;background:#fff7ed;">${opts.autoSubmitted ? 'Yes' : 'No'}</td></tr>
        <tr><td style="padding:10px;background:#fee2e2;font-weight:700;">Final score</td><td style="padding:10px;background:#fff7ed;">${opts.score}%</td></tr>
      </table>
      <a href="${escapeHtml(opts.reviewUrl)}" style="display:inline-block;background:#991b1b;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700;margin-bottom:18px;">Open Secure Review</a>
      <h2 style="font-size:16px;margin:18px 0 8px;">Violation summary</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #fee2e2;">
        ${rows || '<tr><td style="padding:12px;">No event details were submitted.</td></tr>'}
      </table>
      <p style="color:#7f1d1d;font-size:13px;margin-top:16px;">Review this attempt before accepting the result. Evidence is stored privately and is only available to authorized training staff.</p>
    </div>
  </div>`
}

export function buildCandidateProctoringNoticeEmail(opts: {
  employeeName?: string | null
  quizTitle: string
  violationCount: number
  riskScore: number
  riskLevel: string
}) {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:620px;margin:0 auto;padding:24px;background:#f8fafc;">
    <div style="background:#7f1d1d;color:#fff;padding:24px;border-radius:18px 18px 0 0;">
      <p style="margin:0;color:#fecaca;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">SkillTest_AI Assessment Integrity</p>
      <h1 style="margin:10px 0 0;font-size:24px;">Assessment submitted for review</h1>
    </div>
    <div style="background:#fff;border:1px solid #fecaca;border-top:0;padding:24px;border-radius:0 0 18px 18px;">
      <p>Hi ${escapeHtml(opts.employeeName || 'Learner')},</p>
      <p>Your assessment <strong>${escapeHtml(opts.quizTitle)}</strong> was automatically submitted because repeated integrity violations were detected.</p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0;">
        <tr><td style="padding:10px;background:#fee2e2;font-weight:700;">Violations</td><td style="padding:10px;background:#fff7ed;">${opts.violationCount}</td></tr>
        <tr><td style="padding:10px;background:#fee2e2;font-weight:700;">Risk score</td><td style="padding:10px;background:#fff7ed;">${opts.riskScore} (${escapeHtml(opts.riskLevel)})</td></tr>
        <tr><td style="padding:10px;background:#fee2e2;font-weight:700;">Status</td><td style="padding:10px;background:#fff7ed;">Flagged for trainer/admin review</td></tr>
      </table>
      <p style="color:#7f1d1d;font-size:13px;">Your trainer or administrator will review the evidence package and decide the final outcome.</p>
    </div>
  </div>`
}
