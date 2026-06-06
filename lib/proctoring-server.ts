import type { ProctoringEvent, ProctoringEventType } from '@/lib/types/database'
import {
  calculateProctoringRisk,
  getProctoringEventRisk,
  getProctoringRiskLevel,
  shouldAutoSubmitForIntegrity,
} from '@/lib/proctoring'

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
  if (!precheck.cameraReady || !precheck.fullscreenReady || !precheck.consentAccepted) {
    return { error: 'Camera, fullscreen, and consent are required before starting this proctored quiz.' }
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
  if (!session.camera_ready || !session.fullscreen_ready || !session.consent_accepted) {
    return { error: 'Proctoring pre-checks were not completed.' }
  }

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
