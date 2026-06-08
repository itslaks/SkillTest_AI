import type { ProctoringEvent, ProctoringEventType } from '@/lib/types/database'
import {
  calculateProctoringRisk,
  getProctoringEventRisk,
  getProctoringRiskLevel,
  shouldAutoSubmitForIntegrity,
  VIOLATION_SEVERITY,
} from '@/lib/proctoring'
import { sendEmail } from '@/lib/email'
import { getSiteUrl } from '@/lib/security/env'

export const PROCTORING_EVIDENCE_BUCKET = 'quiz-proctoring-evidence'
const DUPLICATE_EVENT_COOLDOWN_MS = 12_000

export type ProctoringPrecheck = {
  cameraReady: boolean
  microphoneReady: boolean
  fullscreenReady: boolean
  consentAccepted: boolean
}

export type ProctoringSessionRow = {
  id: string
  attempt_id: string
  employee_id: string
  quiz_id: string
  status: string
}

export function isProctoringRequired(quiz: { proctoring_required?: boolean | null } | null | undefined) {
  return quiz?.proctoring_required !== false
}

export function sanitizeProctoringEvents(events: ProctoringEvent[]) {
  return events.map((event) => ({
    type: event.type,
    label: event.label,
    occurredAt: event.occurredAt,
    questionIndex: event.questionIndex,
    riskScore: event.riskScore,
    riskLevel: event.riskLevel,
    evidencePath: event.evidencePath || null,
  }))
}

export function eventRowsToSubmissionEvents(rows: any[]): ProctoringEvent[] {
  return (rows || []).map((row: any) => ({
    type: row.violation_type as ProctoringEventType,
    label: typeof row.metadata?.label === 'string' ? row.metadata.label : humanizeViolation(row.violation_type),
    occurredAt: row.occurred_at,
    questionIndex: typeof row.question_number === 'number' ? Math.max(0, row.question_number - 1) : undefined,
    riskScore: row.risk_score,
    riskLevel: row.severity,
    evidencePath: row.metadata?.evidencePath || null,
  }))
}

export function buildProctoringSummary(events: ProctoringEvent[], forcedViolationCount?: number) {
  const violationCount = forcedViolationCount ?? events.filter((event) => event.type !== 'auto-submit').length
  const risk = calculateProctoringRisk(events)
  const autoSubmit = shouldAutoSubmitForIntegrity(events, violationCount)

  return {
    violationCount,
    riskScore: risk.score,
    riskLevel: risk.level,
    autoSubmit,
    warningLevel: Math.min(violationCount, 3),
  }
}

export async function createOrUpdateProctoringSession({
  admin,
  attempt,
  userId,
  quizId,
  precheck,
}: {
  admin: any
  attempt: any
  userId: string
  quizId: string
  precheck: ProctoringPrecheck
}) {
  if (!precheck.cameraReady || !precheck.microphoneReady || !precheck.fullscreenReady || !precheck.consentAccepted) {
    return { error: 'Camera, microphone, fullscreen, and consent are required before starting this proctored quiz.' }
  }

  const { data: session, error } = await admin
    .from('proctoring_sessions')
    .upsert({
      attempt_id: attempt.id,
      employee_id: userId,
      quiz_id: quizId,
      camera_ready: precheck.cameraReady,
      microphone_ready: precheck.microphoneReady,
      fullscreen_ready: precheck.fullscreenReady,
      consent_accepted: precheck.consentAccepted,
      status: 'active',
    }, { onConflict: 'attempt_id' })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data: session as ProctoringSessionRow }
}

export async function requireActiveProctoringSession(admin: any, sessionId: string | undefined, attemptId: string, userId: string) {
  if (!sessionId) return { error: 'A valid proctoring session is required for this quiz.' }

  const { data: session, error } = await admin
    .from('proctoring_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('attempt_id', attemptId)
    .eq('employee_id', userId)
    .maybeSingle()

  if (error || !session) return { error: error?.message || 'Proctoring session was not found.' }
  if (session.status !== 'active') return { error: 'Proctoring session is no longer active.' }
  if (!session.camera_ready || !session.microphone_ready || !session.fullscreen_ready || !session.consent_accepted) {
    return { error: 'Proctoring pre-checks were not completed.' }
  }

  const { data: attempt, error: attemptError } = await admin
    .from('quiz_attempts')
    .select('id, status, quiz_id, user_id')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .eq('quiz_id', session.quiz_id)
    .maybeSingle()

  if (attemptError || !attempt) return { error: attemptError?.message || 'Quiz attempt was not found.' }
  if (attempt.status !== 'in_progress') return { error: 'Proctoring events are not accepted after quiz submission.' }

  return { data: session as ProctoringSessionRow }
}

export async function recordProctoringEvent({
  admin,
  session,
  type,
  label,
  questionIndex,
  evidenceImage,
}: {
  admin: any
  session: ProctoringSessionRow
  type: ProctoringEventType
  label: string
  questionIndex?: number
  evidenceImage?: string | null
}) {
  const now = new Date()
  const { data: recentEvents } = await admin
    .from('quiz_proctoring_events')
    .select('id, violation_type, occurred_at')
    .eq('session_id', session.id)
    .eq('violation_type', type)
    .order('occurred_at', { ascending: false })
    .limit(1)

  const last = recentEvents?.[0]
  if (last && now.getTime() - new Date(last.occurred_at).getTime() < DUPLICATE_EVENT_COOLDOWN_MS) {
    return refreshAttemptProctoringSummary(admin, session, true)
  }

  const riskScore = getProctoringEventRisk(type)
  const riskLevel = getProctoringRiskLevel(riskScore)
  const { data: event, error } = await admin
    .from('quiz_proctoring_events')
    .insert({
      session_id: session.id,
      attempt_id: session.attempt_id,
      employee_id: session.employee_id,
      quiz_id: session.quiz_id,
      violation_type: type,
      severity: riskLevel,
      risk_score: riskScore,
      question_number: typeof questionIndex === 'number' ? questionIndex + 1 : null,
      occurred_at: now.toISOString(),
      metadata: { label },
    })
    .select()
    .single()

  if (error || !event) return { error: error?.message || 'Unable to record proctoring event.' }

  const evidencePath = await storeEvidenceImage(admin, {
    eventId: event.id,
    session,
    evidenceImage,
  })

  if (evidencePath) {
    await admin
      .from('quiz_proctoring_events')
      .update({ metadata: { label, evidencePath } })
      .eq('id', event.id)
  }

  void notifyProctoringViolation(admin, session, {
    eventId: event.id,
    type,
    label,
    severity: VIOLATION_SEVERITY[type] || riskLevel,
    riskScore,
    occurredAt: now.toISOString(),
    evidencePath,
  })

  return refreshAttemptProctoringSummary(admin, session, false)
}

export async function refreshAttemptProctoringSummary(admin: any, session: ProctoringSessionRow, duplicateIgnored = false) {
  const { data: rows } = await admin
    .from('quiz_proctoring_events')
    .select('*')
    .eq('session_id', session.id)
    .order('occurred_at', { ascending: true })

  const events = eventRowsToSubmissionEvents(rows || [])
  const summary = buildProctoringSummary(events)
  const reviewStatus = summary.autoSubmit || summary.riskLevel === 'high' || summary.riskLevel === 'critical'
    ? 'pending'
    : undefined

  await admin
    .from('quiz_attempts')
    .update({
      proctoring_status: summary.autoSubmit || summary.riskLevel === 'high' || summary.riskLevel === 'critical' ? 'flagged' : 'clear',
      proctoring_violations_count: summary.violationCount,
      proctoring_risk_score: summary.riskScore,
      proctoring_risk_level: summary.riskLevel,
      proctoring_events: sanitizeProctoringEvents(events),
      integrity_report: {
        generatedAt: new Date().toISOString(),
        sessionId: session.id,
        status: summary.autoSubmit ? 'auto_submit_required' : 'active',
        riskScore: summary.riskScore,
        riskLevel: summary.riskLevel,
        violationCount: summary.violationCount,
        timeline: sanitizeProctoringEvents(events),
      },
      auto_submitted: summary.autoSubmit,
      ...(reviewStatus ? { review_status: reviewStatus } : {}),
    })
    .eq('id', session.attempt_id)
    .neq('status', 'completed')

  return {
    data: {
      ...summary,
      duplicateIgnored,
    },
  }
}

async function storeEvidenceImage(admin: any, {
  eventId,
  session,
  evidenceImage,
}: {
  eventId: string
  session: ProctoringSessionRow
  evidenceImage?: string | null
}) {
  if (!evidenceImage) return null
  const match = /^data:(image\/jpe?g);base64,(.+)$/i.exec(evidenceImage)
  if (!match) return null

  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase()
  const bytes = Buffer.from(match[2], 'base64')
  const storagePath = `${session.employee_id}/${session.quiz_id}/${session.attempt_id}/${eventId}.jpg`

  const { error: uploadError } = await admin.storage
    .from(PROCTORING_EVIDENCE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: true,
    })

  if (uploadError) {
    console.warn('Proctoring evidence upload failed:', uploadError.message)
    return null
  }

  const { error: evidenceError } = await admin
    .from('quiz_proctoring_evidence')
    .insert({
      event_id: eventId,
      session_id: session.id,
      attempt_id: session.attempt_id,
      employee_id: session.employee_id,
      quiz_id: session.quiz_id,
      evidence_type: 'webcam',
      storage_path: `${PROCTORING_EVIDENCE_BUCKET}/${storagePath}`,
      mime_type: mimeType,
      metadata: { source: 'quiz-player' },
    })

  if (evidenceError) {
    console.warn('Proctoring evidence record failed:', evidenceError.message)
  }

  return `${PROCTORING_EVIDENCE_BUCKET}/${storagePath}`
}

function humanizeViolation(type: string) {
  return type.replace(/-/g, ' ')
}

async function notifyProctoringViolation(admin: any, session: ProctoringSessionRow, event: {
  eventId: string
  type: ProctoringEventType
  label: string
  severity: string
  riskScore: number
  occurredAt: string
  evidencePath: string | null
}) {
  try {
    if (!['critical', 'high'].includes(event.severity)) return

    const [{ data: employee }, { data: quiz }] = await Promise.all([
      admin.from('profiles').select('id, full_name, email, employee_id, role').eq('id', session.employee_id).maybeSingle(),
      admin.from('quizzes').select('id, title, topic, created_by, batch_id').eq('id', session.quiz_id).maybeSingle(),
    ])

    const recipientIds = new Set<string>()
    const { data: admins } = await admin
      .from('profiles')
      .select('id')
      .in('role', ['admin'])
    for (const profile of admins || []) recipientIds.add(profile.id)

    if (quiz?.created_by) recipientIds.add(quiz.created_by)
    if (quiz?.batch_id) {
      const { data: batchTrainers } = await admin
        .from('training_batch_trainers')
        .select('trainer_id')
        .eq('batch_id', quiz.batch_id)
      for (const trainer of batchTrainers || []) {
        if (trainer.trainer_id) recipientIds.add(trainer.trainer_id)
      }
    }

    const recipients = [...recipientIds]
    if (recipients.length === 0) return

    const dashboardLink = `${getSiteUrl()}/manager/integrity`
    const employeeName = employee?.full_name || employee?.email || 'Employee'
    const quizTitle = quiz?.title || 'Assessment'
    const message = `${employeeName} triggered ${event.severity} proctoring violation "${event.label}" during ${quizTitle}. Attempt ${session.attempt_id}.`
    const notificationRows = recipients.map((recipientId) => ({
      batch_id: quiz?.batch_id || null,
      recipient_user_id: recipientId,
      title: `Proctoring Alert - ${event.label}`,
      message,
      audience: 'individual',
      channel: 'in_app',
      delivery_status: 'sent',
      sent_at: new Date().toISOString(),
      created_by: quiz?.created_by || recipientId,
      metadata: {
        category: 'proctoring_alert',
        employeeId: session.employee_id,
        employeeName,
        quizId: session.quiz_id,
        quizTitle,
        attemptId: session.attempt_id,
        sessionId: session.id,
        eventId: event.eventId,
        violationType: event.type,
        violationLabel: event.label,
        severity: event.severity,
        riskScore: event.riskScore,
        occurredAt: event.occurredAt,
        evidenceCaptured: Boolean(event.evidencePath),
        dashboardLink,
      },
    }))

    const { error: notificationError } = await admin.from('training_notifications').insert(notificationRows)
    if (notificationError && /metadata/i.test(notificationError.message || '')) {
      await admin.from('training_notifications').insert(notificationRows.map((row) => {
        const compatibleRow = { ...row }
        delete (compatibleRow as any).metadata
        return compatibleRow
      }))
    } else if (notificationError) {
      console.warn('Proctoring notification insert failed:', notificationError.message)
    }

    const { data: recipientProfiles } = await admin
      .from('profiles')
      .select('email, full_name')
      .in('id', recipients)
    const emailRecipients = (recipientProfiles || []).map((profile: any) => profile.email).filter(Boolean)
    if (emailRecipients.length === 0) return

    const evidenceCopy = event.evidencePath ? '<p><strong>Evidence captured and stored</strong></p>' : ''
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fff7ed;">
        <div style="background:#991b1b;color:#fff;padding:20px;border-radius:14px 14px 0 0;">
          <h1 style="margin:0;font-size:22px;">Proctoring Alert - ${escapeHtml(event.label)}</h1>
        </div>
        <div style="background:#fff;border:1px solid #fecaca;border-top:0;padding:22px;border-radius:0 0 14px 14px;">
          <p><strong>Employee:</strong> ${escapeHtml(employeeName)} (${escapeHtml(employee?.employee_id || employee?.email || 'N/A')})</p>
          <p><strong>Quiz:</strong> ${escapeHtml(quizTitle)}</p>
          <p><strong>Severity:</strong> ${escapeHtml(event.severity)}</p>
          <p><strong>Timestamp:</strong> ${escapeHtml(new Date(event.occurredAt).toLocaleString('en-IN'))}</p>
          <p><strong>Attempt:</strong> ${escapeHtml(session.attempt_id)}</p>
          ${evidenceCopy}
          <a href="${dashboardLink}" style="display:inline-block;background:#991b1b;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700;">Open Integrity Dashboard</a>
        </div>
      </div>`
    const emailResult = await sendEmail({
      to: emailRecipients,
      subject: `Proctoring Alert - ${event.label}`,
      html,
    })
    if (!emailResult.success) console.warn('Proctoring alert email failed:', emailResult.error)
  } catch (error) {
    console.warn('Proctoring notification failed open:', error)
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
