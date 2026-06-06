import { createAdminClient } from '@/lib/supabase/server'
import { requireTrainingStaff } from '@/lib/rbac'
import { calculateProctoringRisk, getProctoringEventRisk } from '@/lib/proctoring'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  Camera,
  FileWarning,
  Gauge,
  MailCheck,
  Radio,
  ShieldCheck,
  ShieldX,
  Siren,
  Users,
} from 'lucide-react'

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
      quizzes:quiz_id(id, title, topic, batch_id, created_by),
      profiles:user_id(full_name, email, employee_id, department)
    `)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(80)

  if (scopedQuizIds) attemptsQuery.in('quiz_id', scopedQuizIds.length ? scopedQuizIds : ['00000000-0000-0000-0000-000000000000'])

  const { data: attempts } = await attemptsQuery
  const proctoredAttempts = (attempts || []).filter((attempt: any) =>
    attempt.proctoring_status || (attempt.proctoring_events || []).length > 0
  )

  const activeSessions = (attempts || []).filter((attempt: any) => attempt.status === 'in_progress').length
  const flagged = proctoredAttempts.filter((attempt: any) => attempt.proctoring_status === 'flagged')
  const autoSubmitted = proctoredAttempts.filter((attempt: any) => attempt.auto_submitted)
  const criticalAttempts = proctoredAttempts.filter((attempt: any) => normalizeRisk(attempt).level === 'critical')
  const averageIntegrity = proctoredAttempts.length
    ? Math.max(0, 100 - Math.round(proctoredAttempts.reduce((sum: number, attempt: any) => sum + normalizeRisk(attempt).score, 0) / proctoredAttempts.length))
    : 100

  const eventFeed = proctoredAttempts
    .flatMap((attempt: any) => (attempt.proctoring_events || []).map((event: any) => ({ event, attempt })))
    .sort((left: any, right: any) => new Date(right.event.occurredAt).getTime() - new Date(left.event.occurredAt).getTime())
    .slice(0, 12)

  const notificationCount = await getIntegrityNotificationCount(admin)

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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-zinc-800 bg-zinc-950 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-cyan-200" />
              Live proctoring center
            </CardTitle>
            <CardDescription className="text-zinc-400">Recent proctored attempts sorted by latest activity.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {proctoredAttempts.length === 0 ? (
              <EmptyPanel text="No proctored attempts have been recorded yet." />
            ) : proctoredAttempts.slice(0, 8).map((attempt: any) => {
              const risk = normalizeRisk(attempt)
              const latestEvidence = latestEvidenceImage(attempt)

              return (
                <div key={attempt.id} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[120px_1fr_auto] md:items-center">
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
                    <p className="mt-1 truncate text-sm text-zinc-400">{attempt.quizzes?.title || 'Assessment'} - {attempt.quizzes?.topic || 'General'}</p>
                    <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
                      <span>Score {attempt.score ?? 0}%</span>
                      <span>Violations {attempt.proctoring_violations_count ?? 0}</span>
                      <span>{formatDate(attempt.completed_at || attempt.started_at)}</span>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-3xl font-semibold">{risk.score}</p>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Risk score</p>
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
            <CardDescription className="text-zinc-400">Timestamped browser, camera, audio, and AI-vision integrity events.</CardDescription>
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
            {eventFeed.filter(({ event }: any) => event.evidenceImage).slice(0, 6).map(({ event, attempt }: any, index: number) => (
              <div key={`${attempt.id}-evidence-${index}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={event.evidenceImage} alt="" className="aspect-video w-full object-cover" />
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{attempt.profiles?.full_name || 'Employee'}</p>
                  <p className="mt-1 text-xs text-zinc-500">{event.type} - {formatDate(event.occurredAt)}</p>
                </div>
              </div>
            ))}
            {eventFeed.filter(({ event }: any) => event.evidenceImage).length === 0 && (
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

async function getIntegrityNotificationCount(admin: ReturnType<typeof createAdminClient>) {
  const { count } = await admin
    .from('training_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('title', 'Quiz proctoring flag')

  return count || 0
}

function normalizeRisk(attempt: any) {
  if (typeof attempt.proctoring_risk_score === 'number' && attempt.proctoring_risk_level) {
    return { score: attempt.proctoring_risk_score, level: attempt.proctoring_risk_level }
  }
  return calculateProctoringRisk(attempt.proctoring_events || [])
}

function latestEvidenceImage(attempt: any) {
  return [...(attempt.proctoring_events || [])].reverse().find((event: any) => event.evidenceImage)?.evidenceImage || null
}

function formatDate(value?: string | null) {
  if (!value) return 'Not completed'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: 'cyan' | 'emerald' | 'rose' | 'amber' }) {
  const tones = {
    cyan: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    rose: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
    amber: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
  }[tone]

  return (
    <div className={`rounded-2xl border p-4 ${tones}`}>
      <Icon className="h-5 w-5" />
      <p className="mt-4 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.25em] opacity-70">{label}</p>
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
