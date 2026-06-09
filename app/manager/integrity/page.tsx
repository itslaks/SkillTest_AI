import { createAdminClient } from '@/lib/supabase/server'
import { requireTrainingStaff } from '@/lib/rbac'
import { calculateProctoringRisk, getProctoringEventRisk } from '@/lib/proctoring'
import { PROCTORING_EVIDENCE_BUCKET } from '@/lib/proctoring-server'
import { buildQuizCompletedEmail, sendEmail } from '@/lib/email'
import { getSiteUrl } from '@/lib/security/env'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LiveIntegrityFeed, type LiveIntegrityEvent } from '@/components/manager/live-integrity-feed'
import { SuspiciousReviewButtons, CandidateReviewButtons } from '@/components/manager/integrity-review-buttons'
import {
  AlertTriangle,
  Camera,
  Download,
  FileWarning,
  Gauge,
  MailCheck,
  Radio,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Siren,
  Trash2,
  Users,
} from 'lucide-react'

const REVIEW_DECISIONS = [
  { status: 'approved', label: 'Approve / clear attempt' },
  { status: 'approved', label: 'Dismiss violations' },
  { status: 'rejected', label: 'Confirm suspicious' },
  { status: 'retest_required', label: 'Request retest' },
  { status: 'escalated', label: 'Escalate' },
] as Array<{ status: 'approved' | 'rejected' | 'retest_required' | 'escalated'; label: string }>

async function updateIntegrityReviewAction(formData: FormData) {
  'use server'
  const { userId, role } = await requireTrainingStaff()
  const admin = createAdminClient()
  const attemptId = String(formData.get('attempt_id') || '')
  const decision = String(formData.get('review_decision') || '')
  const notes = String(formData.get('review_notes') || '').trim()
  const allowed = REVIEW_DECISIONS.map((item) => item.status)
  if (!attemptId || !allowed.includes(decision as any)) return

  const { data: attempt } = await admin
    .from('quiz_attempts')
    .select('id, quiz_id, user_id, score, points_earned, status, proctoring_status, quizzes:quiz_id(title), profiles:user_id(full_name,email)')
    .eq('id', attemptId)
    .maybeSingle()

  if (!attempt) return
  const scopedQuizIds = await getScopedQuizIds(admin, userId, role)
  if (scopedQuizIds && !scopedQuizIds.includes(attempt.quiz_id)) return

  const releaseAttempt = decision === 'approved'
  await admin
    .from('quiz_attempts')
    .update({
      ...(releaseAttempt ? { status: 'completed', proctoring_status: 'clear' } : { status: 'suspicious', proctoring_status: 'suspicious' }),
      review_status: decision,
      review_decision: decision,
      review_notes: notes || null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', attemptId)

  if (releaseAttempt) {
    after(() => {
      void sendApprovedAttemptEmail(admin, attempt)
    })
  }

  revalidatePath('/manager/integrity')
  revalidatePath(`/employee/quizzes/${attempt.quiz_id}/results`)
}

async function deleteAttemptAction(formData: FormData) {
  'use server'
  const { userId, role } = await requireTrainingStaff()
  const admin = createAdminClient()
  const attemptId = String(formData.get('attempt_id') || '')
  if (!attemptId) return

  // Only allow deleting suspicious/flagged attempts
  const { data: attempt } = await admin
    .from('quiz_attempts')
    .select('id, quiz_id, status, proctoring_status')
    .eq('id', attemptId)
    .maybeSingle()
  if (!attempt) return
  if (!['suspicious', 'flagged'].includes(attempt.status) && attempt.proctoring_status !== 'suspicious') return

  const scopedQuizIds = await getScopedQuizIds(admin, userId, role)
  if (scopedQuizIds && !scopedQuizIds.includes(attempt.quiz_id)) return

  // Hard delete: removes attempt + cascade (events, evidence rows)
  await admin.from('quiz_attempts').delete().eq('id', attemptId)

  revalidatePath('/manager/integrity')
}

async function deleteProctoredAttemptAction(formData: FormData) {
  'use server'
  const { userId, role } = await requireTrainingStaff()
  const admin = createAdminClient()
  const attemptId = String(formData.get('attempt_id') || '')
  if (!attemptId) return

  const { data: attempt } = await admin
    .from('quiz_attempts')
    .select('id, quiz_id')
    .eq('id', attemptId)
    .maybeSingle()
  if (!attempt) return

  const scopedQuizIds = await getScopedQuizIds(admin, userId, role)
  if (scopedQuizIds && !scopedQuizIds.includes(attempt.quiz_id)) return

  await admin.from('quiz_attempts').delete().eq('id', attemptId)
  revalidatePath('/manager/integrity')
}

export default async function AssessmentIntegrityPage() {
  const { userId, role } = await requireTrainingStaff()
  const admin = createAdminClient()

  const scopedQuizIds = await getScopedQuizIds(admin, userId, role)
  const attemptsQuery = admin
    .from('quiz_attempts')
    .select(`
      id,
      quiz_id,
      user_id,
      status,
      score,
      completed_at,
      started_at,
      auto_submitted,
      proctoring_status,
      proctoring_violations_count,
      proctoring_risk_score,
      proctoring_risk_level,
      proctoring_events,
      integrity_report,
      review_status,
      review_decision,
      review_notes,
      reviewed_at,
      quizzes:quiz_id(id, title, topic, batch_id, created_by),
      profiles:user_id(full_name, email, employee_id, department)
    `)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(80)

  if (scopedQuizIds) attemptsQuery.in('quiz_id', scopedQuizIds.length ? scopedQuizIds : ['00000000-0000-0000-0000-000000000000'])

  const { data: attempts } = await attemptsQuery
  const attemptIds = (attempts || []).map((attempt: any) => attempt.id)
  const { data: normalizedEvents } = attemptIds.length
    ? await admin
        .from('quiz_proctoring_events')
        .select('*, evidence:quiz_proctoring_evidence(id, storage_path, evidence_type, mime_type)')
        .in('attempt_id', attemptIds)
        .order('occurred_at', { ascending: false })
        .limit(160)
    : { data: [] }

  const normalizedEventsByAttempt = new Map<string, any[]>()
  for (const event of normalizedEvents || []) {
    const list = normalizedEventsByAttempt.get(event.attempt_id) || []
    const evidence = Array.isArray(event.evidence) ? event.evidence[0] : null
    list.push({
      id: event.id,
      type: event.violation_type,
      label: event.metadata?.label || String(event.violation_type).replace(/-/g, ' '),
      occurredAt: event.occurred_at,
      questionIndex: typeof event.question_number === 'number' ? Math.max(0, event.question_number - 1) : undefined,
      riskScore: event.risk_score,
      riskLevel: event.severity,
      evidenceUrl: null,
      evidenceStoragePath: evidence?.storage_path || null,
      evidencePath: event.metadata?.evidencePath || null,
    })
    normalizedEventsByAttempt.set(event.attempt_id, list)
  }

  const proctoredAttempts = (attempts || []).filter((attempt: any) =>
    attempt.proctoring_status || (attempt.proctoring_events || []).length > 0 || normalizedEventsByAttempt.has(attempt.id)
  )

  const activeSessions = (attempts || []).filter((attempt: any) => attempt.status === 'in_progress').length
  const suspicious = proctoredAttempts.filter((attempt: any) => attempt.status === 'suspicious' || attempt.proctoring_status === 'suspicious')
  const flagged = proctoredAttempts.filter((attempt: any) => attempt.proctoring_status === 'flagged' || attempt.status === 'suspicious' || attempt.proctoring_status === 'suspicious')
  const autoSubmitted = proctoredAttempts.filter((attempt: any) => attempt.auto_submitted)
  const criticalAttempts = proctoredAttempts.filter((attempt: any) => normalizeRisk(attempt).level === 'critical')
  const averageIntegrity = proctoredAttempts.length
    ? Math.max(0, 100 - Math.round(proctoredAttempts.reduce((sum: number, attempt: any) => sum + normalizeRisk(attempt).score, 0) / proctoredAttempts.length))
    : 100

  const eventFeed = proctoredAttempts
    .flatMap((attempt: any) => {
      const normalized = normalizedEventsByAttempt.get(attempt.id)
      const events = normalized?.length ? normalized : (attempt.proctoring_events || [])
      return events.map((event: any) => ({ event, attempt }))
    })
    .sort((left: any, right: any) => new Date(right.event.occurredAt).getTime() - new Date(left.event.occurredAt).getTime())
    .slice(0, 12)

  const visibleEvidenceEvents = [
    ...proctoredAttempts.slice(0, 5).map((attempt: any) => normalizedEventsByAttempt.get(attempt.id)?.find((event: any) => event.evidenceStoragePath)).filter(Boolean),
    ...eventFeed.map(({ event }: any) => event).filter((event: any) => event.evidenceStoragePath).slice(0, 4),
  ]
  const signedEvidenceByEvent = await signVisibleEvidence(admin, visibleEvidenceEvents)
  for (const events of normalizedEventsByAttempt.values()) {
    for (const event of events) {
      if (signedEvidenceByEvent.has(event.id)) event.evidenceUrl = signedEvidenceByEvent.get(event.id)
    }
  }

  const notificationCount = await getIntegrityNotificationCount(admin)
  const todayStats = await getTodayIntegrityStats(admin, scopedQuizIds)
  const liveInitialEvents: LiveIntegrityEvent[] = eventFeed.map(({ event, attempt }: any, index: number) => ({
    id: `${attempt.id}-${event.occurredAt}-${index}`,
    attemptId: attempt.id,
    employeeName: attempt.profiles?.full_name || attempt.profiles?.email || 'Employee',
    quizTitle: attempt.quizzes?.title || 'Assessment',
    type: event.type,
    label: event.label,
    severity: event.riskLevel || normalizeRisk(attempt).level,
    riskScore: event.riskScore ?? getProctoringEventRisk(event.type),
    occurredAt: event.occurredAt,
  }))

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="grid gap-6 xl:grid-cols-[1fr_520px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-200">
              <Radio className="h-3.5 w-3.5" />
              Assessment Integrity Center
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">AI proctoring command center</h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400">
              Live risk scoring, auto-submission evidence, flagged candidate review, and trainer/admin escalation are consolidated here for training operations.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Kpi icon={Radio} label="Active Proctored Tests" value={`${activeSessions}`} tone="cyan" />
            <Kpi icon={Gauge} label="Integrity Score" value={`${averageIntegrity}%`} tone="emerald" />
            <Kpi icon={ShieldX} label="Flagged Candidates" value={`${flagged.length}`} tone="rose" />
            <Kpi icon={Siren} label="Auto Submitted" value={`${autoSubmitted.length}`} tone="amber" />
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={Siren} label="Flagged Attempts Today" value={`${todayStats.flaggedAttemptsToday}`} tone="rose" />
        <Kpi icon={AlertTriangle} label="Violations Today" value={`${todayStats.violationsToday}`} tone="amber" />
        <Kpi icon={Radio} label="Active Sessions" value={`${todayStats.activeSessions}`} tone="cyan" />
        <Kpi icon={ShieldCheck} label="Cleared Attempts Today" value={`${todayStats.clearedAttemptsToday}`} tone="emerald" />
      </div>

      <LiveIntegrityFeed initialEvents={liveInitialEvents} />

      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-950">
            <ShieldAlert className="h-5 w-5" />
            Suspicious Attempts
          </CardTitle>
          <CardDescription className="text-amber-800">Scores, certificates, badges, and completion emails stay blocked until these attempts are cleared.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {suspicious.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-200 bg-white/60 p-5 text-center text-sm text-amber-800">No suspicious attempts are waiting for review.</div>
          ) : suspicious.slice(0, 8).map((attempt: any) => {
            const risk = normalizeRisk(attempt)
            return (
              <div key={`suspicious-${attempt.id}`} className="grid gap-3 rounded-2xl border border-amber-200 bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-amber-950">{attempt.profiles?.full_name || attempt.profiles?.email || 'Employee'}</p>
                    <RiskBadge level={risk.level} />
                    <Badge className="bg-amber-200 text-amber-950">{String(attempt.review_status || 'pending').replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-amber-800">{attempt.quizzes?.title || 'Assessment'}</p>
                  <p className="mt-2 text-xs text-amber-700">Risk {risk.score} - Violations {attempt.proctoring_violations_count ?? 0} - Status {attempt.status}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={updateIntegrityReviewAction} className="flex flex-wrap gap-2">
                    <SuspiciousReviewButtons attemptId={attempt.id} />
                  </form>
                  <form action={deleteAttemptAction}>
                    <input type="hidden" name="attempt_id" value={attempt.id} />
                    <button type="submit" className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700">
                      Delete record
                    </button>
                  </form>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-zinc-800 bg-zinc-950 text-white">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-cyan-200" />
                  Live proctoring center
                </CardTitle>
                <CardDescription className="mt-1 text-zinc-400">
                  Recent proctored attempts sorted by latest activity. {proctoredAttempts.length} record{proctoredAttempts.length !== 1 ? 's' : ''} loaded.
                </CardDescription>
              </div>
              <a
                href="/api/export/proctoring"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                <Download className="h-3.5 w-3.5 text-cyan-300" />
                Export Excel
              </a>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {proctoredAttempts.length === 0 ? (
              <EmptyPanel text="No proctored attempts have been recorded yet." />
            ) : proctoredAttempts.slice(0, 8).map((attempt: any) => {
              const risk = normalizeRisk(attempt)
              const latestEvidence = latestEvidenceImage(attempt, normalizedEventsByAttempt)

              return (
                <div key={attempt.id} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[120px_1fr_auto] md:items-start">
                  <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                    {latestEvidence ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={latestEvidence} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-600">
                        <Camera className="h-7 w-7" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{attempt.profiles?.full_name || attempt.profiles?.email || 'Employee'}</p>
                      <RiskBadge level={risk.level} />
                      {attempt.auto_submitted && <Badge className="bg-amber-200 text-amber-950">Auto submitted</Badge>}
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-400">{attempt.quizzes?.title || 'Assessment'} · {attempt.quizzes?.topic || 'General'}</p>
                    <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
                      <span>Score {attempt.score ?? 0}%</span>
                      <span>Violations {attempt.proctoring_violations_count ?? 0}</span>
                      <span>{formatDate(attempt.completed_at || attempt.started_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <p className="text-3xl font-semibold">{risk.score}</p>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Risk score</p>
                    </div>
                    <form action={deleteProctoredAttemptAction}>
                      <input type="hidden" name="attempt_id" value={attempt.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-200" />
              AI violation feed
            </CardTitle>
            <CardDescription className="text-zinc-400">Timestamped browser, camera, fullscreen, focus, and clipboard integrity events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {eventFeed.length === 0 ? (
              <EmptyPanel text="No violations have been captured." />
            ) : eventFeed.map(({ event, attempt }: any, index: number) => (
              <div key={`${attempt.id}-${event.occurredAt}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{event.label}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {attempt.profiles?.full_name || 'Employee'} - Q{Number(event.questionIndex ?? 0) + 1} - {formatDate(event.occurredAt)}
                    </p>
                  </div>
                  <Badge className={riskBadgeClass(event.riskLevel || normalizeRisk(attempt).level)}>
                    +{event.riskScore ?? getProctoringEventRisk(event.type)}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-zinc-800 bg-zinc-950 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-rose-200" />
              Evidence review panel
            </CardTitle>
            <CardDescription className="text-zinc-400">Latest captured frames and incident context.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {eventFeed.filter(({ event }: any) => event.evidenceUrl).slice(0, 6).map(({ event, attempt }: any, index: number) => (
              <div key={`${attempt.id}-evidence-${index}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={event.evidenceUrl} alt="" className="aspect-video w-full object-cover" />
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{attempt.profiles?.full_name || 'Employee'}</p>
                  <p className="mt-1 text-xs text-zinc-500">{event.type} - {formatDate(event.occurredAt)}</p>
                </div>
              </div>
            ))}
            {eventFeed.filter(({ event }: any) => event.evidenceUrl).length === 0 && (
              <div className="sm:col-span-2">
                <EmptyPanel text="Evidence frames will appear here when violations include camera snapshots." />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-zinc-800 bg-zinc-950 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-violet-200" />
                Candidate integrity profile
              </CardTitle>
              <CardDescription className="text-zinc-400">Highest-risk candidates pending review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {flagged.slice(0, 6).map((attempt: any) => {
                const risk = normalizeRisk(attempt)
                return (
                  <div key={attempt.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{attempt.profiles?.full_name || attempt.profiles?.email || 'Employee'}</p>
                        <p className="text-xs text-zinc-500">{attempt.profiles?.employee_id || attempt.profiles?.department || 'No profile metadata'}</p>
                      </div>
                      <RiskBadge level={risk.level} />
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-rose-300" style={{ width: `${Math.min(100, risk.score)}%` }} />
                    </div>
                    <p className="mt-3 text-xs text-zinc-500">Review status: {String(attempt.review_status || 'pending').replace(/_/g, ' ')}</p>
                    <form action={updateIntegrityReviewAction} className="mt-4 grid gap-2">
                      <input type="hidden" name="attempt_id" value={attempt.id} />
                      <textarea
                        name="review_notes"
                        rows={2}
                        className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-zinc-600"
                        placeholder="Review notes (optional)"
                        defaultValue={attempt.review_notes || ''}
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <CandidateReviewButtons />
                      </div>
                    </form>
                  </div>
                )
              })}
              {flagged.length === 0 && <EmptyPanel text="No candidates are flagged for review." />}
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailCheck className="h-5 w-5 text-emerald-200" />
                Auto escalation center
              </CardTitle>
              <CardDescription className="text-zinc-400">Trainer/admin alerts and auto-submission audit state.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <EscalationRow icon={ShieldCheck} label="Clear proctored attempts" value={`${proctoredAttempts.length - flagged.length}`} />
              <EscalationRow icon={Siren} label="Critical violations" value={`${criticalAttempts.length}`} />
              <EscalationRow icon={MailCheck} label="Integrity notifications" value={`${notificationCount}`} />
              <EscalationRow icon={FileWarning} label="Evidence pending review" value={`${flagged.length}`} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

async function getScopedQuizIds(admin: ReturnType<typeof createAdminClient>, userId: string, role: string) {
  if (role === 'admin' || role === 'manager' || role === 'training_coordinator') return null

  const [{ data: ownQuizzes }, { data: trainerBatches }] = await Promise.all([
    admin.from('quizzes').select('id').eq('created_by', userId),
    admin.from('training_batch_trainers').select('batch_id').eq('trainer_id', userId),
  ])
  const batchIds = (trainerBatches || []).map((row: any) => row.batch_id)
  const { data: batchQuizzes } = batchIds.length
    ? await admin.from('quizzes').select('id').in('batch_id', batchIds)
    : { data: [] }

  return Array.from(new Set([...(ownQuizzes || []), ...(batchQuizzes || [])].map((quiz: any) => quiz.id)))
}

async function signVisibleEvidence(admin: ReturnType<typeof createAdminClient>, events: any[]) {
  const uniqueEvents = Array.from(new Map(
    events
      .filter((event) => event?.id && typeof event.evidenceStoragePath === 'string')
      .map((event) => [event.id, event]),
  ).values())

  const signedEntries = await Promise.all(uniqueEvents.map(async (event: any) => {
    const storagePath = event.evidenceStoragePath as string
    if (!storagePath.startsWith(`${PROCTORING_EVIDENCE_BUCKET}/`)) return null
    const objectPath = storagePath.split('/').slice(1).join('/')
    const { data: signed } = await admin.storage.from(PROCTORING_EVIDENCE_BUCKET).createSignedUrl(objectPath, 300)
    return signed?.signedUrl ? [event.id, signed.signedUrl] as const : null
  }))

  return new Map(signedEntries.filter(Boolean) as Array<readonly [string, string]>)
}

async function getIntegrityNotificationCount(admin: ReturnType<typeof createAdminClient>) {
  const { count } = await admin
    .from('training_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('title', 'Quiz proctoring flag')

  return count || 0
}

async function sendApprovedAttemptEmail(admin: ReturnType<typeof createAdminClient>, attempt: any) {
  try {
    const profile = Array.isArray(attempt.profiles) ? attempt.profiles[0] : attempt.profiles
    const quiz = Array.isArray(attempt.quizzes) ? attempt.quizzes[0] : attempt.quizzes
    if (!profile?.email) return

    const [{ data: earnedBadges }, { data: certificate }] = await Promise.all([
      admin.from('user_badges').select('id').eq('user_id', attempt.user_id),
      admin.from('certificates').select('id').eq('quiz_id', attempt.quiz_id).eq('user_id', attempt.user_id).maybeSingle(),
    ])

    const baseUrl = getSiteUrl().replace(/\/$/, '')
    await sendEmail({
      to: profile.email,
      subject: `Quiz Results Released: ${quiz?.title || 'Assessment'} — ${attempt.score}%`,
      html: buildQuizCompletedEmail({
        employeeName: profile.full_name,
        quizTitle: quiz?.title || 'Assessment',
        score: attempt.score || 0,
        points: attempt.points_earned || 0,
        passingScore: quiz?.passing_score ?? 60,
        badgesEarned: earnedBadges?.length || 0,
        certificateIssued: Boolean(certificate),
        certificateUrl: certificate ? `${baseUrl}/certificates/${certificate.id}` : undefined,
        resultUrl: `${baseUrl}/employee/quizzes/${attempt.quiz_id}/results`,
      }),
    })
  } catch (error) {
    console.warn('Approved attempt completion email failed:', error)
  }
}

async function getTodayIntegrityStats(admin: ReturnType<typeof createAdminClient>, scopedQuizIds: string[] | null) {
  const startIso = getKolkataDayStartIso()
  const scopedIds = scopedQuizIds ?? undefined
  const emptyScope = Array.isArray(scopedQuizIds) && scopedQuizIds.length === 0
  if (emptyScope) {
    return {
      flaggedAttemptsToday: 0,
      violationsToday: 0,
      activeSessions: 0,
      clearedAttemptsToday: 0,
    }
  }

  const flaggedQuery = admin
    .from('quiz_attempts')
    .select('id', { count: 'exact', head: true })
    .or('proctoring_status.eq.flagged,proctoring_status.eq.suspicious,status.eq.suspicious')
    .gte('completed_at', startIso)
  const clearQuery = admin
    .from('quiz_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('proctoring_status', 'clear')
    .gte('completed_at', startIso)
  const eventQuery = admin
    .from('quiz_proctoring_events')
    .select('id', { count: 'exact', head: true })
    .gte('occurred_at', startIso)
  const sessionQuery = admin
    .from('proctoring_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  if (scopedIds) {
    flaggedQuery.in('quiz_id', scopedIds)
    clearQuery.in('quiz_id', scopedIds)
    eventQuery.in('quiz_id', scopedIds)
    sessionQuery.in('quiz_id', scopedIds)
  }

  const [flagged, violations, sessions, cleared] = await Promise.all([
    flaggedQuery,
    eventQuery,
    sessionQuery,
    clearQuery,
  ])

  return {
    flaggedAttemptsToday: flagged.count || 0,
    violationsToday: violations.count || 0,
    activeSessions: sessions.count || 0,
    clearedAttemptsToday: cleared.count || 0,
  }
}

function getKolkataDayStartIso() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value || String(now.getUTCFullYear())
  const month = parts.find((part) => part.type === 'month')?.value || '01'
  const day = parts.find((part) => part.type === 'day')?.value || '01'
  return new Date(`${year}-${month}-${day}T00:00:00+05:30`).toISOString()
}

function normalizeRisk(attempt: any) {
  if (typeof attempt.proctoring_risk_score === 'number' && attempt.proctoring_risk_level) {
    return { score: attempt.proctoring_risk_score, level: attempt.proctoring_risk_level }
  }
  return calculateProctoringRisk(attempt.proctoring_events || [])
}

function latestEvidenceImage(attempt: any, normalizedEventsByAttempt: Map<string, any[]>) {
  const normalized = normalizedEventsByAttempt.get(attempt.id)
  if (normalized?.length) return normalized.find((event: any) => event.evidenceUrl)?.evidenceUrl || null
  return [...(attempt.proctoring_events || [])].reverse().find((event: any) => event.evidenceUrl)?.evidenceUrl || null
}

function formatDate(value?: string | null) {
  if (!value) return 'Not completed'
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: 'cyan' | 'emerald' | 'rose' | 'amber' }) {
  const tones = {
    cyan: 'border-cyan-400/40 bg-zinc-950 text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.08)] [&_svg]:text-cyan-200',
    emerald: 'border-emerald-400/40 bg-zinc-950 text-white shadow-[inset_0_0_0_1px_rgba(52,211,153,0.08)] [&_svg]:text-emerald-200',
    rose: 'border-rose-400/40 bg-zinc-950 text-white shadow-[inset_0_0_0_1px_rgba(251,113,133,0.08)] [&_svg]:text-rose-200',
    amber: 'border-amber-400/40 bg-zinc-950 text-white shadow-[inset_0_0_0_1px_rgba(251,191,36,0.08)] [&_svg]:text-amber-200',
  }[tone]

  return (
    <div className={`rounded-2xl border p-4 ${tones}`}>
      <Icon className="h-5 w-5" />
      <p className="mt-4 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-zinc-300">{label}</p>
    </div>
  )
}

function RiskBadge({ level }: { level: string }) {
  return <Badge className={riskBadgeClass(level)}>{level}</Badge>
}

function riskBadgeClass(level: string) {
  if (level === 'critical') return 'bg-red-200 text-red-950'
  if (level === 'high') return 'bg-rose-200 text-rose-950'
  if (level === 'medium') return 'bg-amber-200 text-amber-950'
  return 'bg-emerald-200 text-emerald-950'
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-zinc-500">
      {text}
    </div>
  )
}

function EscalationRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <span className="flex items-center gap-2 text-sm text-zinc-300">
        <Icon className="h-4 w-4 text-cyan-200" />
        {label}
      </span>
      <span className="text-xl font-semibold">{value}</span>
    </div>
  )
}
