import {
  createProjectEvaluation,
  clearAllTrainingData,
  clearScheduledTrainingSessions,
  createTrainingAssessmentSetup,
  createTrainingBatch,
  createFeedbackWindow,
  createTrainingNotification,
  createTrainingSession,
  deleteFeedbackWindow,
  deleteProjectEvaluation,
  deleteTrainingAssessmentSetup,
  deleteTrainingBatch,
  deleteTrainingSession,
  getTrainingOpsManagerData,
  runTrainingAutomation,
  updateFeedbackWindow,
  updateProjectEvaluation,
  updateTrainingAssessmentSetup,
  updateTrainingBatchDetails,
  updateTrainingSession,
  updateAttendanceStatus,
  removeTrainingBatchMember,
  deleteTrainingNotification,
  deleteTrainingFeedback,
} from '@/lib/actions/training'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { OpsNotepad } from '@/components/manager/ops-notepad'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AttendanceImporter } from '@/components/manager/attendance-importer'
import { ManualAttendanceCard } from '@/components/manager/manual-attendance-card'
import { AssessmentScoreImporter } from '@/components/manager/assessment-score-importer'
import { BatchCandidateImporter } from '@/components/manager/batch-candidate-importer'
import { BatchComparisonChart } from '@/components/manager/batch-comparison-chart'
import { BatchMemberStatusDropdown } from '@/components/manager/batch-member-status-dropdown'
import { OpsAutoRefresh } from '@/components/manager/ops-auto-refresh'
import { OpsResultToast } from '@/components/manager/ops-result-toast'
import { OpsSubmitButton } from '@/components/manager/ops-submit-button'
import { FeedbackSentimentChart } from '@/components/manager/feedback-sentiment-chart'
import { createAdminClient } from '@/lib/supabase/server'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Database,
  Trash2,
  FileText,
  FileSpreadsheet,
  FolderOpen,
  Gauge,
  Layers3,
  LineChart,
  ListChecks,
  RadioTower,
  MessageSquareQuote,
  ShieldAlert,
  UploadCloud,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'

async function createTrainingBatchAction(formData: FormData) {
  'use server'
  const result = await createTrainingBatch(formData)
  redirectWithOpsResult(result, 'Batch created.', 'create-batch')
}

async function deleteTrainingBatchAction(formData: FormData) {
  'use server'
  const result = await deleteTrainingBatch(formData)
  redirectWithOpsResult(result, 'Training batch deleted.', 'manage-training')
}

async function clearAllTrainingDataAction(formData: FormData) {
  'use server'
  const result = await clearAllTrainingData(formData)
  redirectWithOpsResult(result, 'All existing training data removed.', 'manage-training')
}

async function clearScheduledTrainingSessionsAction(formData: FormData) {
  'use server'
  const result = await clearScheduledTrainingSessions(formData)
  redirectWithOpsResult(result, 'Scheduled training sessions cleared.', 'schedule-session')
}

async function createTrainingSessionAction(formData: FormData) {
  'use server'
  const result = await createTrainingSession(formData)
  redirectWithOpsResult(result, 'Session scheduled.', 'schedule-session')
}

async function updateTrainingSessionAction(formData: FormData) {
  'use server'
  const result = await updateTrainingSession(formData)
  redirectWithOpsResult(result, 'Session updated.', 'schedule-session')
}

async function deleteTrainingSessionAction(formData: FormData) {
  'use server'
  const result = await deleteTrainingSession(formData)
  redirectWithOpsResult(result, 'Session deleted.', 'schedule-session')
}

async function createTrainingNotificationAction(formData: FormData) {
  'use server'
  const result = await createTrainingNotification(formData)
  redirectWithOpsResult(result, 'Notification created.', 'schedule-session')
}

async function createFeedbackWindowAction(formData: FormData) {
  'use server'
  const result = await createFeedbackWindow(formData)
  const details = result.data
  const message = details
    ? `Feedback form created. Email requested for ${details.recipients} learner(s): ${details.sent} sent/logged, ${details.failed} failed.`
    : 'Feedback form created and email delivery was triggered.'
  redirectWithOpsResult(result, message, 'feedback')
}

async function updateFeedbackWindowAction(formData: FormData) {
  'use server'
  const result = await updateFeedbackWindow(formData)
  redirectWithOpsResult(result, 'Feedback form updated.', 'feedback')
}

async function deleteFeedbackWindowAction(formData: FormData) {
  'use server'
  const result = await deleteFeedbackWindow(formData)
  redirectWithOpsResult(result, 'Feedback form deleted.', 'feedback')
}

async function updateTrainingBatchDetailsAction(formData: FormData) {
  'use server'
  const result = await updateTrainingBatchDetails(formData)
  redirectWithOpsResult(result, 'Batch edits saved.', 'batch-board')
}

async function createTrainingAssessmentSetupAction(formData: FormData) {
  'use server'
  const result = await createTrainingAssessmentSetup(formData)
  redirectWithOpsResult(result, 'Assessment setup created.', 'assessment-setup')
}

async function updateTrainingAssessmentSetupAction(formData: FormData) {
  'use server'
  const result = await updateTrainingAssessmentSetup(formData)
  redirectWithOpsResult(result, 'Assessment setup updated.', 'assessment-setup')
}

async function deleteTrainingAssessmentSetupAction(formData: FormData) {
  'use server'
  const result = await deleteTrainingAssessmentSetup(formData)
  redirectWithOpsResult(result, 'Assessment setup deleted.', 'assessment-setup')
}

async function createProjectEvaluationAction(formData: FormData) {
  'use server'
  const result = await createProjectEvaluation(formData)
  redirectWithOpsResult(result, 'Project evaluation saved.', 'project-evaluation')
}

async function updateProjectEvaluationAction(formData: FormData) {
  'use server'
  const result = await updateProjectEvaluation(formData)
  redirectWithOpsResult(result, 'Project evaluation updated.', 'project-evaluation')
}

async function deleteProjectEvaluationAction(formData: FormData) {
  'use server'
  const result = await deleteProjectEvaluation(formData)
  redirectWithOpsResult(result, 'Project evaluation deleted.', 'project-evaluation')
}

async function removeTrainingBatchMemberAction(formData: FormData) {
  'use server'
  const result = await removeTrainingBatchMember(formData)
  redirectWithOpsResult(result, 'Learner removed from batch.', 'batches')
}

async function deleteTrainingNotificationAction(formData: FormData) {
  'use server'
  const result = await deleteTrainingNotification(formData)
  redirectWithOpsResult(result, 'Notification deleted.', 'schedule-session')
}

async function deleteTrainingFeedbackAction(formData: FormData) {
  'use server'
  const result = await deleteTrainingFeedback(formData)
  redirectWithOpsResult(result, 'Feedback record deleted.', 'communication')
}

async function runTrainingAutomationAction(formData: FormData) {
  'use server'
  try {
    const result = await runTrainingAutomation(formData)
    redirectWithOpsResult(result, 'Automation run completed.', 'automation')
  } catch (error: any) {
    redirectWithOpsResult({ error: error?.message || 'Automation run failed.' }, 'Automation run completed.', 'automation')
  }
}

function redirectWithOpsResult(result: { error?: string } | unknown, success: string, anchor: string) {
  const maybeError = result && typeof result === 'object' && 'error' in result ? String((result as { error?: string }).error || '') : ''
  const params = new URLSearchParams()
  if (maybeError) params.set('ops_error', maybeError)
  else params.set('ops_status', success)
  redirect(`/manager/operations?${params.toString()}#${anchor}`)
}

function toneForBatchStatus(status: string) {
  switch (status) {
    case 'running':
    case 'active':
      return 'bg-emerald-100 text-emerald-700'
    case 'completed':
      return 'bg-slate-100 text-slate-700'
    case 'closed':
      return 'bg-zinc-900 text-white'
    case 'at_risk':
      return 'bg-rose-100 text-rose-700'
    default:
      return 'bg-amber-100 text-amber-700'
  }
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export default async function ManagerOperationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ ops_status?: string; ops_error?: string }>
}) {
  const operationMessage = await searchParams
  const {
    role,
    summary,
    batches,
    sessions,
    trainers,
    employees,
    members,
    attendance,
    notifications,
    feedback,
    feedbackWindows,
    quizzes,
    batchTrainers,
    assessmentSetups,
    projectEvaluations,
    automationRuns,
    attendanceVersions,
    assessmentUploads,
    batchChangeAudit,
    notificationDispatchLogs,
    governanceSettings,
  } = await getTrainingOpsManagerData()

  const canCoordinate = role !== 'trainer'

  const membersByBatch = new Map<string, any[]>()
  for (const member of members) {
    const batchMembers = membersByBatch.get(member.batch_id) || []
    batchMembers.push(member)
    membersByBatch.set(member.batch_id, batchMembers)
  }

  const attendanceBySession = new Map<string, any[]>()
  for (const record of attendance) {
    const sessionEntries = attendanceBySession.get(record.session_id) || []
    sessionEntries.push(record)
    attendanceBySession.set(record.session_id, sessionEntries)
  }

  const quizzesByBatch = new Map<string, any[]>()
  for (const quiz of quizzes) {
    if (!quiz.batch_id) continue
    const items = quizzesByBatch.get(quiz.batch_id) || []
    items.push(quiz)
    quizzesByBatch.set(quiz.batch_id, items)
  }

  const trainersByBatch = new Map<string, any[]>()
  for (const item of batchTrainers) {
    const list = trainersByBatch.get(item.batch_id) || []
    list.push(item)
    trainersByBatch.set(item.batch_id, list)
  }

  const assessmentsByBatch = new Map<string, any[]>()
  for (const item of assessmentSetups) {
    const list = assessmentsByBatch.get(item.batch_id) || []
    list.push(item)
    assessmentsByBatch.set(item.batch_id, list)
  }

  const admin = createAdminClient()
  const batchIds = batches.map((b: any) => b.id)
  
  const { data: attempts } = batchIds.length > 0 
    ? await admin.from('quiz_attempts').select('user_id, score, quizzes!inner(batch_id, passing_score)').in('quizzes.batch_id', batchIds).eq('status', 'completed')
    : { data: [] }
  const quizAttempts = attempts || []
  
  const { data: results } = batchIds.length > 0
    ? await admin.from('assessment_results').select('candidate_email, candidate_score, percentage, batch_id, assessment_setup_id').in('batch_id', batchIds)
    : { data: [] }
  const importedAssessments = results || []
  const assessmentSetupById = new Map(assessmentSetups.map((setup: any) => [setup.id, setup]))

  // Combine projectEvaluations and quizAttempts to calculate batch assessment average
  const batchComparisonData = batches.map((b: any) => {
    const bMembers = membersByBatch.get(b.id) || []
    
    // Attendance calculation
    const bSessions = sessions.filter((s: any) => s.batch_id === b.id)
    const bSessionIds = bSessions.map((s: any) => s.id)
    const bAttendance = attendance.filter((a: any) => bSessionIds.includes(a.session_id))
    const posAtt = bAttendance.filter((a: any) => ['present', 'late'].includes(a.status)).length
    const attRate = bAttendance.length ? Math.round((posAtt / bAttendance.length) * 100) : 0
    
    // Assessment calculation
    const bQuizAttempts = quizAttempts.filter((a: any) => a.quizzes?.batch_id === b.id)
    const bProjects = projectEvaluations.filter((p: any) => p.batch_id === b.id)
    const bImports = importedAssessments.filter((a: any) => a.batch_id === b.id)
    const bQuizScores = bQuizAttempts.map((a: any) => Number(a.score || 0))
    const bProjScores = bProjects.map((p: any) => Number(p.score || 0))
    const bImportScores = bImports.map((a: any) => Number(a.percentage ?? a.candidate_score ?? 0))
    
    const allScores = [...bQuizScores, ...bProjScores, ...bImportScores]
    const asmtRate = allScores.length ? Math.round(allScores.reduce((sum: number, s: number) => sum + s, 0) / allScores.length) : 0
    const clearanceRows = [
      ...bQuizAttempts.map((attempt: any) => Number(attempt.score || 0) >= Number(attempt.quizzes?.passing_score || 70)),
      ...bProjects.map((project: any) => Number(project.score || 0) >= 70),
      ...bImports.map((result: any) => {
        const setup = assessmentSetupById.get(result.assessment_setup_id) as any
        const threshold = setup ? Math.round((Number(setup.passing_score || 70) / Math.max(1, Number(setup.max_score || 100))) * 100) : 70
        return Number(result.percentage ?? result.candidate_score ?? 0) >= threshold
      }),
    ]
    const clearanceRate = clearanceRows.length ? Math.round((clearanceRows.filter(Boolean).length / clearanceRows.length) * 100) : 0
    
    return {
      id: b.id,
      name: b.title,
      attendance: attRate,
      assessment: asmtRate,
      clearance: clearanceRate,
      learners: bMembers.length
    }
  }).filter((b: any) => {
    const orig = batches.find((orig: any) => orig.id === b.id)
    return orig && ['running', 'completed'].includes(orig.status)
  })

  const overallAssessmentClearance = batchComparisonData.length
    ? Math.round(batchComparisonData.reduce((sum: number, batch: any) => sum + batch.clearance, 0) / batchComparisonData.length)
    : 0

  const scheduleTimeline = [
    ...sessions.map((session: any) => ({
      id: `session-${session.id}`,
      type: 'Session',
      title: session.title,
      batchTitle: session.batch?.title || 'Batch',
      date: session.session_date,
      meta: `${session.mode} - ${session.trainer?.full_name || session.trainer?.email || 'Trainer TBD'}`,
      status: session.status,
    })),
    ...assessmentSetups.filter((setup: any) => setup.scheduled_at).map((setup: any) => ({
      id: `assessment-${setup.id}`,
      type: 'Assessment',
      title: setup.title,
      batchTitle: batches.find((batch: any) => batch.id === setup.batch_id)?.title || 'Batch',
      date: setup.scheduled_at,
      meta: `${String(setup.assessment_type).replace('_', ' ')} - pass ${setup.passing_score}/${setup.max_score}`,
      status: setup.status,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const feedbackAnalytics = {
    total: feedback.length,
    positive: feedback.filter((item: any) => item.sentiment === 'positive').length,
    neutral: feedback.filter((item: any) => item.sentiment === 'neutral').length,
    negative: feedback.filter((item: any) => item.sentiment === 'negative').length,
    avgRating: feedback.length ? (feedback.reduce((sum: number, item: any) => sum + Number(item.rating || 0), 0) / feedback.length).toFixed(1) : '0.0',
    avgContent: feedback.length ? (feedback.reduce((sum: number, item: any) => sum + Number(item.content_quality_rating || item.rating || 0), 0) / feedback.length).toFixed(1) : '0.0',
    avgTrainer: feedback.length ? (feedback.reduce((sum: number, item: any) => sum + Number(item.trainer_effectiveness_rating || item.rating || 0), 0) / feedback.length).toFixed(1) : '0.0',
  }

  const trainerScorecards = buildTrainerScorecards({
    batches,
    batchTrainers,
    sessions,
    attendance,
    feedback,
    projectEvaluations,
    importedAssessments,
    quizAttempts,
  }).slice(0, 6)

  const automationRunTypes = ['attendance_cutoff', 'absence_streak', 'assessment_reminder', 'feedback_reminder'] as const
  const notificationById = new Map(notifications.map((item: any) => [item.id, item]))
  const dispatchHealth = {
    sent: notificationDispatchLogs.filter((item: any) => item.provider_status === 'sent').length,
    failed: notificationDispatchLogs.filter((item: any) => item.provider_status === 'failed').length,
    logged: notificationDispatchLogs.filter((item: any) => item.provider_status === 'logged').length,
  }
  const pendingScoreUploads = assessmentSetups.filter((setup: any) => {
    const status = String(setup.status || '').toLowerCase()
    if (status === 'completed' || status === 'cancelled') return false
    return !assessmentUploads.some((upload: any) => upload.assessment_setup_id === setup.id && Number(upload.successful_records || 0) > 0)
  }).length
  const openRisks = summary.attendanceDueToday + summary.absenceAlerts + summary.negativeFeedbackCount + dispatchHealth.failed
  const automationHealth = dispatchHealth.failed > 0 ? 'Needs review' : automationRuns.length ? 'Healthy' : 'Ready'
  const nextScheduleItems = scheduleTimeline.slice(0, 4)
  const missionNav = [
    { label: 'Live Ops', href: '#live-operations', detail: 'Daily workflow', icon: Activity },
    { label: 'Governance', href: '#governance-zone', detail: 'Quality controls', icon: ShieldAlert },
    { label: 'Automation', href: '#automation-zone', detail: 'Proactive checks', icon: Zap },
    { label: 'Resources', href: '#resources-zone', detail: 'Setup tools', icon: Database },
    { label: 'Intelligence', href: '#intelligence-hub', detail: 'Signals and audit', icon: BarChart3 },
  ]

  return (
    <div className="space-y-8 text-slate-950">
      <OpsResultToast />
      <OpsAutoRefresh intervalMs={15000} />
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.32),transparent_34%),linear-gradient(135deg,#0B1220_0%,#111827_52%,#172554_100%)] p-6 text-white shadow-[0_30px_110px_rgba(2,6,23,0.45)] md:p-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300 to-transparent" />
        <div className="grid gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(28rem,1.05fr)] xl:items-end">
          <div className="max-w-4xl">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-100">
              <RadioTower className="h-3.5 w-3.5" />
              Mission Control
            </div>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">Training Ops Workspace</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
              Manage batches, assessments, attendance, projects, and training governance from a unified operational workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="rounded-full bg-white px-5 text-[#0B1220] shadow-lg shadow-sky-950/20 hover:bg-slate-100">
                <a href="#live-operations">Open live operations</a>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-white/20 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white">
                <a href="/api/reports/training-ops/download">Export evidence pack</a>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MissionKpiCard label="Active Batches" value={`${summary.activeBatches}`} detail={`${summary.upcomingSessions} sessions queued`} icon={Layers3} tone="blue" />
            <MissionKpiCard label="Attendance Due" value={`${summary.attendanceDueToday}`} detail={`${summary.attendanceRate}% attendance health`} icon={ClipboardCheck} tone={summary.attendanceDueToday > 0 ? 'amber' : 'emerald'} />
            <MissionKpiCard label="Pending Score Uploads" value={`${pendingScoreUploads}`} detail={`${overallAssessmentClearance}% clearance signal`} icon={UploadCloud} tone={pendingScoreUploads > 0 ? 'amber' : 'emerald'} />
            <MissionKpiCard label="Open Risks" value={`${openRisks}`} detail={`${summary.absenceAlerts} absence, ${summary.negativeFeedbackCount} feedback`} icon={ShieldAlert} tone={openRisks > 0 ? 'red' : 'emerald'} />
          </div>
        </div>
      </section>

      {(operationMessage?.ops_status || operationMessage?.ops_error) ? (
        <div className={`rounded-2xl border p-4 text-sm font-medium ${
          operationMessage.ops_error
            ? 'border-rose-200 bg-rose-50 text-rose-800'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}>
          {operationMessage.ops_error || operationMessage.ops_status}
        </div>
      ) : null}

      {/* Command Rail + Notepad row */}
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Command Rail — horizontal nav */}
        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
          <div className="relative overflow-hidden rounded-[1.1rem] bg-[#0B1220] px-5 py-3.5 text-white">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/60 to-transparent" />
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-sky-400/15">
                  <RadioTower className="h-3.5 w-3.5 text-sky-300" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-sky-300">Command Rail</p>
                  <p className="text-xs font-semibold text-white">Mission Control</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <p className="text-xs text-slate-400">{automationHealth} automation · {openRisks} risk{openRisks !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
          <nav className="mt-3 flex flex-wrap gap-2">
            {missionNav.map((item) => {
              const NavIcon = item.icon
              return (
                <a key={item.href} href={item.href} className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 transition hover:border-blue-200 hover:bg-blue-50">
                  <NavIcon className="h-3.5 w-3.5 text-slate-400 transition group-hover:text-blue-600" />
                  <div>
                    <span className="block text-sm font-semibold text-slate-800 group-hover:text-blue-700">{item.label}</span>
                    <span className="block text-[10px] text-slate-400">{item.detail}</span>
                  </div>
                </a>
              )
            })}
          </nav>
        </div>

        {/* Notepad */}
        <OpsNotepad />
      </div>

      <div className="space-y-8">
      <section id="overview" className="scroll-mt-32 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <div className="grid gap-4 md:grid-cols-2">
          <ActionTile
            title="Attendance Due"
            value={`${summary.attendanceDueToday}`}
            detail="Sessions past the governance window with no positive attendance mark."
            tone="amber"
            className="md:row-span-2"
          />
          <ActionTile
            title="3-Day Absence Risks"
            value={`${summary.absenceAlerts}`}
            detail="Learners absent across the latest required sessions."
            tone="rose"
          />
          <ActionTile
            title="Assessment Clearance"
            value={`${overallAssessmentClearance}%`}
            detail="Combined pass signal across quizzes, imports, and project evaluations."
            tone="emerald"
          />
          <ActionTile
            title="Candidates In Training"
            value={`${summary.remainingCandidates}`}
            detail={`${summary.discontinuedCandidates} discontinued, ${summary.notClearedCandidates} not cleared, ${summary.offeredCandidates} offered/onboarded.`}
            tone="blue"
            className="md:col-span-2"
          />
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-[#111827] p-5 text-white shadow-[0_18px_70px_rgba(2,6,23,0.28)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileSpreadsheet className="h-4 w-4 text-sky-300" />
              Evidence Pack
            </div>
            <Badge variant="outline" className="border-white/15 bg-white/10 text-slate-100">Export-ready</Badge>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-400">Download batches, attendance, feedback, reminders, audit history, and linked assessment evidence in one workbook.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="rounded-full bg-white text-[#0B1220] hover:bg-slate-200">
              <a href="/api/reports/training-ops/download">Excel</a>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <a href="/api/reports/training-ops/pdf">PDF</a>
            </Button>
          </div>
          <div className="mt-5 grid gap-2 text-xs text-slate-400">
            <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2"><span>Automation health</span><span className="font-semibold text-white">{automationHealth}</span></div>
            <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2"><span>Provider failures</span><span className="font-semibold text-white">{dispatchHealth.failed}</span></div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MissionSignalCard icon={Gauge} label="Automation Health" value={automationHealth} detail={`${automationRuns.length} governed run(s) logged`} tone="blue" />
        <MissionSignalCard icon={ListChecks} label="Schedule Lanes" value={`${nextScheduleItems.length}`} detail={`${scheduleTimeline.length} total sessions and assessments`} tone="emerald" />
        <MissionSignalCard icon={Database} label="Evidence Objects" value={`${assessmentSetups.length + projectEvaluations.length}`} detail="Assessment files and project evidence indexed" tone="amber" />
        <MissionSignalCard icon={Workflow} label="Dispatch Health" value={`${dispatchHealth.sent}/${dispatchHealth.failed}`} detail="Sent vs failed notification outcomes" tone={dispatchHealth.failed > 0 ? 'red' : 'emerald'} />
      </section>

      <section id="live-operations" className="scroll-mt-32 space-y-4">
      <SectionIntro eyebrow="Primary Zone" title="Live Operations" description="The daily operating loop: batches, attendance, score uploads, and schedule lanes." />
      <div id="batches" className="grid gap-6 2xl:grid-cols-[minmax(0,1.4fr)_minmax(24rem,0.6fr)]">
        <DropPanel
          id="batch-board-panel"
          title="Live Batch Board"
          description="Scan batch health, attendance, trainers, and next action without opening every admin control."
          badge={`${batches.length} batches`}
          defaultOpen
        >
          <LiveBatchBoard
            batches={batches}
            sessions={sessions}
            attendance={attendance}
            membersByBatch={membersByBatch}
            trainersByBatch={trainersByBatch}
            assessmentsByBatch={assessmentsByBatch}
            quizzesByBatch={quizzesByBatch}
            canCoordinate={canCoordinate}
          />
        </DropPanel>

        <DropPanel
          id="communication"
          title="Feedback Pulse"
          description="Create feedback forms, track open windows, and review learner sentiment."
          badge={`${feedbackWindows.length} forms`}
        >
          <CardContent className="space-y-4">
            <form action={createFeedbackWindowAction} className="rounded-[1.5rem] border border-zinc-900 bg-black p-5 text-white">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Create Feedback Form</p>
                  <h3 className="mt-2 text-lg font-semibold">Open a learner feedback form from Ops</h3>
                  <p className="mt-1 text-sm text-zinc-400">Pick the batch, optionally link a session, set the close time, and learners receive the feedback request.</p>
                </div>
                <Badge variant="outline" className="w-fit border-white/15 bg-white/10 text-white">
                  {feedbackWindows.filter((item: any) => item.status === 'open').length} open
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Batch</span>
                  <select name="batch_id" required className="h-11 rounded-xl border border-white/10 bg-white px-3 text-zinc-950">
                    <option value="">Select batch</option>
                    {batches.map((batch: any) => (
                      <option key={batch.id} value={batch.id}>{batch.title}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Related session</span>
                  <select name="session_id" className="h-11 rounded-xl border border-white/10 bg-white px-3 text-zinc-950">
                    <option value="">Optional</option>
                    {sessions.map((session: any) => (
                      <option key={session.id} value={session.id}>{session.title}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Close by</span>
                  <input name="closes_at" type="datetime-local" required className="h-11 rounded-xl border border-white/10 bg-white px-3 text-zinc-950" />
                </label>
                <OpsSubmitButton pendingLabel="Creating and emailing..." className="rounded-full bg-white text-black hover:bg-zinc-200">Create form</OpsSubmitButton>
              </div>
              <p className="mt-3 text-xs text-zinc-400">
                You will see a confirmation message with learner email counts after the form is created.
              </p>
              <label className="mt-3 grid gap-2 text-sm">
                <span className="font-medium">Form title</span>
                <input name="title" defaultValue="Training content and trainer feedback" className="h-11 rounded-xl border border-white/10 bg-white px-3 text-zinc-950" />
              </label>
            </form>

            <div className="grid gap-3 md:grid-cols-3">
              <MiniMetric label="Open feedback forms" value={`${feedbackWindows.filter((item: any) => item.status === 'open').length}`} />
              <MiniMetric label="Submitted feedback" value={`${feedback.length}`} />
              <MiniMetric label="Negative feedback" value={`${summary.negativeFeedbackCount}`} />
            </div>

            <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Feedback forms</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {feedbackWindows.length === 0 ? (
                  <div className="md:col-span-2">
                    <EmptyState text="No feedback forms have been created yet." compact />
                  </div>
                ) : feedbackWindows.slice(0, 6).map((window: any) => (
                  <div key={window.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-zinc-950" title={window.title}>{window.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{window.batch?.title || 'Batch'}{window.session?.title ? ` - ${window.session.title}` : ''}</p>
                      </div>
                      <Badge variant="outline" className="capitalize">{window.status}</Badge>
                    </div>
                    <p className="mt-3 text-xs text-zinc-500">Closes {new Date(window.closes_at).toLocaleString()}</p>
                    <details className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-zinc-700">Edit form</summary>
                      <form action={updateFeedbackWindowAction} className="grid gap-2 border-t border-zinc-200 p-3">
                        <input type="hidden" name="feedback_window_id" value={window.id} />
                        <label className="grid gap-1 text-xs">
                          <span className="font-medium">Title</span>
                          <input name="title" defaultValue={window.title} className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm" />
                        </label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="grid gap-1 text-xs">
                            <span className="font-medium">Close by</span>
                            <input name="closes_at" type="datetime-local" defaultValue={toDateTimeLocal(window.closes_at)} className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm" />
                          </label>
                          <label className="grid gap-1 text-xs">
                            <span className="font-medium">Status</span>
                            <select name="status" defaultValue={window.status} className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm">
                              <option value="draft">Draft</option>
                              <option value="open">Open</option>
                              <option value="closed">Closed</option>
                            </select>
                          </label>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <OpsSubmitButton pendingLabel="Updating..." size="sm" variant="outline" className="h-8 rounded-full bg-white">Update</OpsSubmitButton>
                        </div>
                      </form>
                      <form action={deleteFeedbackWindowAction} className="border-t border-zinc-200 p-3 text-right">
                        <input type="hidden" name="feedback_window_id" value={window.id} />
                        <OpsSubmitButton pendingLabel="Deleting..." size="sm" variant="outline" className="h-8 rounded-full border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">Delete</OpsSubmitButton>
                      </form>
                    </details>
                  </div>
                ))}
              </div>
            </div>

            <FeedbackAnalyticsPanel
              analytics={feedbackAnalytics}
              batches={batches.map((batch: any) => ({ id: batch.id, title: batch.title }))}
            />

            <MiniMetric label="Notifications sent" value={`${summary.notificationsSent}`} />

            <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Dispatch Evidence</p>
                  <p className="mt-1 text-sm text-zinc-500">Recipient-level email provider outcomes from recent training notifications.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">Sent {dispatchHealth.sent}</Badge>
                  <Badge variant="outline" className="border-rose-200 bg-white text-rose-700">Failed {dispatchHealth.failed}</Badge>
                  <Badge variant="outline" className="border-zinc-200 bg-white text-zinc-700">Logged {dispatchHealth.logged}</Badge>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {notificationDispatchLogs.length === 0 ? (
                  <EmptyState text="No provider dispatch evidence has been logged yet." compact />
                ) : notificationDispatchLogs.slice(0, 4).map((item: any) => {
                  const sourceNotification = notificationById.get(item.notification_id) as any
                  return (
                    <div key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-medium">{sourceNotification?.title || 'Training notification'}</p>
                        <Badge variant="outline" className="capitalize">{item.provider_status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">{item.recipient_email || 'No recipient email'} - {item.provider_message || 'No provider message'}</p>
                      <p className="mt-1 text-xs text-zinc-400">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Recent notifications</p>
              {notifications.length === 0 ? (
                <EmptyState text="No notifications yet." compact />
              ) : (
                notifications.slice(0, 5).map((item: any) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{item.title}</p>
                      <Badge variant="outline" className="capitalize">{item.delivery_status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">{item.message}</p>
                    <p className="mt-2 text-xs text-zinc-400">
                      {item.batch?.title || item.session?.title || item.recipient?.full_name || 'General'} - {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Recent feedback</p>
              {feedback.length === 0 ? (
                <EmptyState text="No feedback submitted yet." compact />
              ) : (
                feedback.slice(0, 5).map((item: any) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{item.trainee?.full_name || item.trainee?.email || 'Learner'}</p>
                      <Badge variant="outline" className="capitalize">{item.sentiment}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">{item.feedback_text}</p>
                    {item.action_item ? <p className="mt-2 text-xs text-zinc-400">Suggested action: {item.action_item}</p> : null}
                    <form action={deleteTrainingFeedbackAction}>
                      <input type="hidden" name="feedback_id" value={item.id} />
                      <OpsSubmitButton pendingLabel="Deleting..." size="sm" variant="outline" className="mt-2 h-7 rounded-full border-rose-200 bg-rose-50 text-xs text-rose-700 hover:bg-rose-100">Delete</OpsSubmitButton>
                    </form>
                  </div>
                ))
              )}
            </div>

          </CardContent>
        </DropPanel>
      </div>

      <AttendanceTrackerPanel
        sessions={sessions}
        membersByBatch={membersByBatch}
        attendanceBySession={attendanceBySession}
        attendanceRate={summary.attendanceRate}
        updateAction={updateAttendanceStatus}
      />

      <DropPanel
        id="assessment-upload"
        title="Assessment Score Upload"
        description="Upload sprint, coding, and project-linked assessment scores."
        badge={`${assessmentUploads.length} uploads`}
      >
        <CardContent>
          <AssessmentScoreImporter
            batches={batches.map((batch: any) => ({ id: batch.id, title: batch.title }))}
            assessments={assessmentSetups.map((setup: any) => ({
              id: setup.id,
              batch_id: setup.batch_id,
              title: setup.title,
              assessment_type: setup.assessment_type,
            }))}
          />
        </CardContent>
      </DropPanel>
      </section>

      <section id="governance-zone" className="scroll-mt-32 space-y-4">
        <SectionIntro eyebrow="Governance Zone" title="Quality, Compliance, Oversight" description="Assessment governance, project evidence, feedback pulse, and audit readiness in one operating layer." />
        <div id="assessment" className="grid gap-6 lg:grid-cols-2">
        {canCoordinate ? (
        <DropPanel
          id="assessment-setup"
          title="Assessment Governance"
          description="Set up official assessments for each batch — define the type, schedule, pass mark, and question file."
          badge={`${assessmentSetups.length} setups`}
          defaultOpen
        >
          <CardContent className="pt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm">
              <div>
                <p className="font-semibold text-blue-900">📋 Step 1 — Pick the batch</p>
                <p className="mt-1 text-xs text-blue-700">Choose which training batch this assessment belongs to.</p>
              </div>
              <div>
                <p className="font-semibold text-blue-900">📅 Step 2 — Set type and date</p>
                <p className="mt-1 text-xs text-blue-700">Choose Sprint Review, Coding, or Project. Set the date so candidates know when it happens.</p>
              </div>
              <div>
                <p className="font-semibold text-blue-900">✅ Step 3 — Set pass mark and save</p>
                <p className="mt-1 text-xs text-blue-700">Default is 70/100. Hit "Create" — the assessment now appears in your score upload section.</p>
              </div>
            </div>
            <form action={createTrainingAssessmentSetupAction} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Batch</span>
                  <select name="batch_id" required className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="">Select batch</option>
                    {batches.map((batch: any) => <option key={batch.id} value={batch.id}>{batch.title}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Assessment type</span>
                  <select name="assessment_type" defaultValue="sprint_review" className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="sprint_review">Sprint review</option>
                    <option value="api_coding">API and coding</option>
                    <option value="coding">Coding</option>
                    <option value="project">Project evaluation</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Assessment title</span>
                <input name="title" required className="h-11 rounded-xl border border-zinc-200 px-3" placeholder="Sprint 2 Review - Collections and API" />
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Schedule</span>
                  <input name="scheduled_at" type="datetime-local" className="h-11 rounded-xl border border-zinc-200 px-3" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Max score</span>
                  <input name="max_score" type="number" min="1" defaultValue="100" className="h-11 rounded-xl border border-zinc-200 px-3" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Passing score</span>
                  <input name="passing_score" type="number" min="0" defaultValue="70" className="h-11 rounded-xl border border-zinc-200 px-3" />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Excel template name</span>
                  <input name="template_name" className="h-11 rounded-xl border border-zinc-200 px-3" placeholder="api-coding-template.xlsx" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Question file name</span>
                  <input name="question_file_name" className="h-11 rounded-xl border border-zinc-200 px-3" placeholder="sprint-2-question-bank.xlsx" />
                </label>
              </div>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Upload question file</span>
                <input name="question_file" type="file" accept=".csv,.txt,.xlsx,.xls,.json,.xml,.pdf,.docx" className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-sm" />
              </label>
              <OpsSubmitButton pendingLabel="Creating..." className="w-fit rounded-full bg-black text-white hover:bg-zinc-800">Create assessment setup</OpsSubmitButton>
            </form>
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-950">Assessment setup CRUD</p>
                <Badge variant="outline" className="bg-white">{assessmentSetups.length} setup(s)</Badge>
              </div>
              <div className="mt-3 grid gap-3">
                {assessmentSetups.length === 0 ? (
                  <EmptyState text="No assessment setups yet." compact />
                ) : assessmentSetups.slice(0, 8).map((setup: any) => (
                  <div key={setup.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                    <form action={updateTrainingAssessmentSetupAction} className="grid gap-2 lg:grid-cols-[1.2fr_0.9fr_0.9fr_0.7fr_0.7fr_0.8fr_auto] lg:items-end">
                      <input type="hidden" name="assessment_setup_id" value={setup.id} />
                      <input type="hidden" name="template_name" value={setup.template_name || ''} />
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Title</span>
                        <input name="title" defaultValue={setup.title} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm" />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Type</span>
                        <select name="assessment_type" defaultValue={setup.assessment_type} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm">
                          <option value="sprint_review">Sprint review</option>
                          <option value="api_coding">API and coding</option>
                          <option value="coding">Coding</option>
                          <option value="project">Project</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Schedule</span>
                        <input name="scheduled_at" type="datetime-local" defaultValue={toDateTimeLocal(setup.scheduled_at)} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm" />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Max</span>
                        <input name="max_score" type="number" defaultValue={setup.max_score || 100} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm" />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Pass</span>
                        <input name="passing_score" type="number" defaultValue={setup.passing_score || 70} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm" />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Status</span>
                        <select name="status" defaultValue={setup.status} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm">
                          <option value="planned">Planned</option>
                          <option value="open">Open</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </label>
                      <OpsSubmitButton pendingLabel="Updating..." size="sm" variant="outline" className="h-9 rounded-full bg-white">Update</OpsSubmitButton>
                    </form>
                    <form action={deleteTrainingAssessmentSetupAction} className="mt-2 flex justify-end">
                      <input type="hidden" name="assessment_setup_id" value={setup.id} />
                      <OpsSubmitButton pendingLabel="Deleting..." size="sm" variant="outline" className="h-8 rounded-full border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">Delete</OpsSubmitButton>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </DropPanel>
        ) : null}

        <DropPanel
          id="projects"
          title="Project Evaluation"
          description="Record final project scores for each candidate and attach the evidence file."
          badge={`${projectEvaluations.length} records`}
          defaultOpen
        >
          <CardContent className="pt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm">
              <div>
                <p className="font-semibold text-emerald-900">👤 Step 1 — Pick candidate</p>
                <p className="mt-1 text-xs text-emerald-700">Select the batch, then pick the candidate whose project you are scoring.</p>
              </div>
              <div>
                <p className="font-semibold text-emerald-900">📊 Step 2 — Enter score</p>
                <p className="mt-1 text-xs text-emerald-700">Give a score out of 100. Optionally upload a PDF/ZIP as evidence — this is stored for compliance.</p>
              </div>
              <div>
                <p className="font-semibold text-emerald-900">💾 Step 3 — Save evaluation</p>
                <p className="mt-1 text-xs text-emerald-700">Hit "Save". The score is counted in the batch assessment clearance % shown at the top of the page.</p>
              </div>
            </div>
            <form action={createProjectEvaluationAction} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Batch</span>
                  <select name="batch_id" required className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="">Select batch</option>
                    {batches.map((batch: any) => <option key={batch.id} value={batch.id}>{batch.title}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Candidate</span>
                  <select name="user_id" required className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="">Select candidate</option>
                    {members.map((member: any) => (
                      <option key={member.id} value={member.user_id}>{member.profile?.full_name || member.profile?.email}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Project title</span>
                <input name="project_title" required className="h-11 rounded-xl border border-zinc-200 px-3" placeholder="Capstone API project" />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Score</span>
                  <input name="score" type="number" min="0" max="100" required className="h-11 rounded-xl border border-zinc-200 px-3" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Evidence file</span>
                  <input name="evidence_file_name" className="h-11 rounded-xl border border-zinc-200 px-3" placeholder="candidate-project-review.pdf" />
                </label>
              </div>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Upload evidence file</span>
                <input name="evidence_file" type="file" accept=".csv,.txt,.xlsx,.xls,.json,.xml,.pdf,.docx,.png,.jpg,.jpeg,.zip" className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-sm" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Remarks</span>
                <textarea name="remarks" rows={3} className="rounded-xl border border-zinc-200 px-3 py-3" placeholder="Evaluation notes, strengths, and improvement actions." />
              </label>
              <OpsSubmitButton pendingLabel="Saving..." className="w-fit rounded-full bg-black text-white hover:bg-zinc-800">Save project evaluation</OpsSubmitButton>
            </form>
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-950">Project evaluation CRUD</p>
                <Badge variant="outline" className="bg-white">{projectEvaluations.length} record(s)</Badge>
              </div>
              <div className="mt-3 grid gap-3">
                {projectEvaluations.length === 0 ? (
                  <EmptyState text="No project evaluations yet." compact />
                ) : projectEvaluations.slice(0, 8).map((evaluation: any) => (
                  <div key={evaluation.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                    <form action={updateProjectEvaluationAction} className="grid gap-2 lg:grid-cols-[1fr_0.5fr_1fr_auto] lg:items-end">
                      <input type="hidden" name="project_evaluation_id" value={evaluation.id} />
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Project</span>
                        <input name="project_title" defaultValue={evaluation.project_title} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm" />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Score</span>
                        <input name="score" type="number" min="0" max="100" defaultValue={evaluation.score} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm" />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Evidence</span>
                        <input name="evidence_file_name" defaultValue={evaluation.evidence_file_name || ''} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm" />
                      </label>
                      <OpsSubmitButton pendingLabel="Updating..." size="sm" variant="outline" className="h-9 rounded-full bg-white">Update</OpsSubmitButton>
                      <label className="grid gap-1 text-xs lg:col-span-3">
                        <span className="font-medium">Remarks</span>
                        <input name="remarks" defaultValue={evaluation.remarks || ''} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm" />
                      </label>
                      <p className="text-xs text-zinc-500">{evaluation.trainee?.full_name || evaluation.trainee?.email || 'Candidate'}</p>
                    </form>
                    <form action={deleteProjectEvaluationAction} className="mt-2 flex justify-end">
                      <input type="hidden" name="project_evaluation_id" value={evaluation.id} />
                      <OpsSubmitButton pendingLabel="Deleting..." size="sm" variant="outline" className="h-8 rounded-full border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">Delete</OpsSubmitButton>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </DropPanel>
        </div>
      </section>

      {canCoordinate ? (
      <section id="automation-zone" className="scroll-mt-32 space-y-4">
      <SectionIntro eyebrow="Automation Zone" title="Proactive Governance" description="Compact automation controls with recent status, alert health, and governed runbooks." />
      <div>
      <DropPanel
        id="automation"
        title="Automation Runbook"
        description="One-click checks that send reminders and alerts to candidates and trainers automatically."
        badge={`${automationRuns.length} runs`}
        defaultOpen
      >
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm">
            <p className="font-semibold text-amber-900">💡 How automation works</p>
            <p className="mt-1 text-xs text-amber-700">
              Each button below runs a governed check and sends notifications instantly. You can target all batches or a specific one.
              No technical knowledge needed — just click "Run" and the system handles the rest.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
          {automationRunTypes.map((runType) => {
            const latestForType = automationRuns.find((item: any) => item.run_type === runType)
            const labels: Record<string, { title: string; plain: string; emoji: string }> = {
              attendance_cutoff: {
                title: 'Attendance Cut-off Alert',
                emoji: '🕙',
                plain: `Sends an email alert to coordinators when a session has passed ${governanceSettings.attendanceCutoffTime} with no positive attendance recorded. Keeps discipline on track.`,
              },
              absence_streak: {
                title: 'Absence Streak Warning',
                emoji: '⚠️',
                plain: `Flags candidates who have been absent for ${governanceSettings.absenceAlertDays} or more consecutive sessions. Use this to catch at-risk candidates early.`,
              },
              assessment_reminder: {
                title: 'Assessment Reminder',
                emoji: '📝',
                plain: 'Emails all candidates who have an assessment due in the next 48 hours so they are prepared and not surprised.',
              },
              feedback_reminder: {
                title: 'Feedback Window Reminder',
                emoji: '💬',
                plain: `Reminds candidates to submit feedback before open forms close within ${governanceSettings.feedbackWindowDays} day(s). Improves feedback submission rates.`,
              },
            }
            const meta = labels[runType] || { title: runType.replaceAll('_', ' '), emoji: '▶️', plain: '' }
            return (
            <form key={runType} action={runTrainingAutomationAction} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <input type="hidden" name="run_type" value={runType} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{meta.emoji} {meta.title}</p>
                <Badge variant="outline" className="bg-white">
                  {latestForType ? '✓ last run logged' : 'ready to run'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{meta.plain}</p>
              <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-500">
                {latestForType
                  ? `Last run: ${new Date(latestForType.created_at).toLocaleString()} — sent ${latestForType.notifications_created} notification(s)`
                  : 'Not run yet. Click below to run it for the first time.'}
              </div>
              <label className="mt-3 grid gap-2 text-sm">
                <span className="font-medium">Target batch (leave blank for all)</span>
                <select name="batch_id" className="h-11 rounded-xl border border-zinc-200 bg-white px-3">
                  <option value="">All active batches</option>
                  {batches.map((batch: any) => <option key={batch.id} value={batch.id}>{batch.title}</option>)}
                </select>
              </label>
              <OpsSubmitButton pendingLabel="Running check…" variant="outline" className="mt-4 rounded-full bg-white">▶ Run now</OpsSubmitButton>
            </form>
          )})}
          </div>
        </CardContent>
      </DropPanel>
      </div>
      </section>
      ) : null}

      <section id="resources-zone" className="scroll-mt-32 space-y-4">
      <SectionIntro eyebrow="Resources Zone" title="Operational Utilities" description="Secondary tools for setup, learner imports, schedule maintenance, and evidence libraries." />
      <div id="setup">
      {canCoordinate ? (
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <DropPanel
          id="create-batch"
          title="Create Training Batch"
          description="Name it, choose trainers, add learners, and link assessments."
          badge="Setup"
        >
          <CardContent className="pt-5">
            <form action={createTrainingBatchAction} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Batch name</span>
                  <input name="title" required className="h-11 w-full min-w-0 rounded-xl border border-zinc-200 px-3" placeholder="Java Foundation Batch 07" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Domain</span>
                  <input name="domain" className="h-11 w-full min-w-0 rounded-xl border border-zinc-200 px-3" placeholder="Java, Data, Cloud..." />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Start date</span>
                  <input name="start_date" type="date" className="h-11 w-full min-w-0 rounded-xl border border-zinc-200 px-3" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">End date</span>
                  <input name="end_date" type="date" className="h-11 w-full min-w-0 rounded-xl border border-zinc-200 px-3" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Lead trainer</span>
                  <select name="trainer_id" className="h-11 w-full min-w-0 rounded-xl border border-zinc-200 px-3">
                    <option value="">Select trainer</option>
                    {trainers.map((trainer: any) => (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.full_name || trainer.email}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 text-sm">
                  <span className="font-medium">Learners</span>
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3">
                    {employees.map((employee: any) => (
                      <label key={employee.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50">
                        <input type="checkbox" name="employee_ids" value={employee.id} className="mt-1 h-4 w-4 rounded border-zinc-300" />
                        <span>
                          <span className="block text-sm font-medium">{employee.full_name || employee.email}</span>
                          <span className="block text-xs text-zinc-500">{employee.employee_id || employee.email}{employee.domain ? ` - ${employee.domain}` : ''}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2 text-sm">
                  <span className="font-medium">Assessments</span>
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3">
                    {quizzes.map((quiz: any) => (
                      <label key={quiz.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50">
                        <input type="checkbox" name="quiz_ids" value={quiz.id} className="mt-1 h-4 w-4 rounded border-zinc-300" />
                        <span>
                          <span className="block text-sm font-medium">{quiz.title}</span>
                          <span className="block text-xs text-zinc-500">{quiz.topic} - {quiz.difficulty}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                <p>New batches start as planned. Add sessions and attendance after creation.</p>
                <OpsSubmitButton pendingLabel="Creating batch..." className="rounded-full bg-black text-white hover:bg-zinc-800">Create batch</OpsSubmitButton>
              </div>
            </form>
          </CardContent>
        </DropPanel>

        <DropPanel
          id="schedule-session"
          title="Session Planner"
          description="Schedule a session or send a quick batch notification."
          badge={`${sessions.length} sessions`}
        >
          <CardContent className="space-y-6">
            <form action={createTrainingSessionAction} className="grid gap-4">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Target batch</span>
                <select name="batch_id" required className="h-11 rounded-xl border border-zinc-200 px-3">
                  <option value="">Select batch</option>
                  {batches.map((batch: any) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Session title</span>
                  <input name="title" required className="h-11 rounded-xl border border-zinc-200 px-3" placeholder="Week 1 Foundation Lab" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Trainer</span>
                  <select name="trainer_id" className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="">Auto/Unassigned</option>
                    {trainers.map((trainer: any) => (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.full_name || trainer.email}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Agenda</span>
                <textarea name="agenda" rows={3} className="rounded-xl border border-zinc-200 px-3 py-3" placeholder="Concept coverage, practicals, feedback checkpoints, blockers." />
              </label>
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Session date & time</span>
                  <input name="session_date" type="datetime-local" required className="h-11 w-full min-w-0 rounded-xl border border-zinc-200 px-3" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Mode</span>
                  <select name="mode" defaultValue="virtual" className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="virtual">Virtual</option>
                    <option value="classroom">Classroom</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Status</span>
                  <select name="status" defaultValue="scheduled" className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium">
                <input type="checkbox" name="attendance_required" defaultChecked className="h-4 w-4 rounded border-zinc-300" />
                Attendance required for this session
              </label>
              <OpsSubmitButton pendingLabel="Scheduling..." className="rounded-full bg-black text-white hover:bg-zinc-800">Schedule session</OpsSubmitButton>
            </form>

            <form action={clearScheduledTrainingSessionsAction} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-rose-950">Clear duplicated scheduled training</p>
                  <p className="mt-1 text-xs leading-5 text-rose-800">Deletes sessions still marked scheduled, including their attendance setup and linked session notifications. Completed sessions are kept.</p>
                </div>
                <Badge variant="outline" className="w-fit border-rose-200 bg-white text-rose-800">
                  {sessions.filter((session: any) => session.status === 'scheduled').length} scheduled
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_12rem_auto] md:items-end">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-rose-950">Batch scope</span>
                  <select name="batch_id" className="h-11 rounded-xl border border-rose-200 bg-white px-3">
                    <option value="">All batches</option>
                    {batches.map((batch: any) => <option key={batch.id} value={batch.id}>{batch.title}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-rose-950">Type DELETE SCHEDULED</span>
                  <input name="confirmation" className="h-11 rounded-xl border border-rose-200 bg-white px-3" placeholder="DELETE SCHEDULED" />
                </label>
                <OpsSubmitButton pendingLabel="Clearing..." className="rounded-full bg-rose-700 text-white hover:bg-rose-800">
                  Clear scheduled
                </OpsSubmitButton>
              </div>
            </form>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-950">Session CRUD</p>
                <Badge variant="outline" className="bg-white">{sessions.length} total</Badge>
              </div>
              <div className="mt-3 grid gap-3">
                {sessions.length === 0 ? (
                  <EmptyState text="No sessions yet." compact />
                ) : sessions.slice(0, 8).map((session: any) => (
                  <div key={session.id} className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-3">
                    <form action={updateTrainingSessionAction} className="grid gap-2 lg:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.8fr_auto] lg:items-end">
                      <input type="hidden" name="session_id" value={session.id} />
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Title</span>
                        <input name="title" defaultValue={session.title} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm" />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Date</span>
                        <input name="session_date" type="datetime-local" defaultValue={toDateTimeLocal(session.session_date)} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm" />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Trainer</span>
                        <select name="trainer_id" defaultValue={session.trainer_id || ''} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm">
                          <option value="">Unassigned</option>
                          {trainers.map((trainer: any) => <option key={trainer.id} value={trainer.id}>{trainer.full_name || trainer.email}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Mode</span>
                        <select name="mode" defaultValue={session.mode} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm">
                          <option value="virtual">Virtual</option>
                          <option value="classroom">Classroom</option>
                          <option value="hybrid">Hybrid</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Status</span>
                        <select name="status" defaultValue={session.status} className="h-9 rounded-lg border border-zinc-200 px-2 text-sm">
                          <option value="scheduled">Scheduled</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </label>
                      <OpsSubmitButton pendingLabel="Updating..." size="sm" variant="outline" className="h-9 rounded-full bg-white">Update</OpsSubmitButton>
                      <input type="hidden" name="agenda" value={session.agenda || ''} />
                      <label className="flex items-center gap-2 text-xs lg:col-span-2">
                        <input type="checkbox" name="attendance_required" defaultChecked={session.attendance_required} className="h-4 w-4 rounded border-zinc-300" />
                        Attendance required
                      </label>
                      <p className="text-xs text-zinc-500 lg:col-span-3">{session.batch?.title || 'Batch'} - {session.trainer?.full_name || session.trainer?.email || 'Trainer TBD'}</p>
                    </form>
                    <form action={deleteTrainingSessionAction} className="flex justify-end">
                      <input type="hidden" name="session_id" value={session.id} />
                      <OpsSubmitButton pendingLabel="Deleting..." size="sm" variant="outline" className="h-8 rounded-full border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">Delete session</OpsSubmitButton>
                    </form>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-zinc-200" />

            <form action={createTrainingNotificationAction} className="grid gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BellRing className="h-4 w-4" />
                Communication center
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Batch</span>
                  <select name="batch_id" className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="">Optional</option>
                    {batches.map((batch: any) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Session</span>
                  <select name="session_id" className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="">Optional</option>
                    {sessions.map((session: any) => (
                      <option key={session.id} value={session.id}>
                        {session.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Audience</span>
                  <select name="audience" defaultValue="batch" className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="batch">Batch</option>
                    <option value="trainers">Trainers</option>
                    <option value="coordinators">Coordinators</option>
                    <option value="individual">Individual</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Channel</span>
                  <select name="channel" defaultValue="in_app" className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="in_app">In App</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Title</span>
                <input name="title" required className="h-11 rounded-xl border border-zinc-200 px-3" placeholder="Reminder: attendance check closes at 10:00 AM" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Message</span>
                <textarea name="message" rows={3} required className="rounded-xl border border-zinc-200 px-3 py-3" placeholder="Explain the action learners or trainers should take." />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Schedule for</span>
                <input name="scheduled_for" type="datetime-local" className="h-11 w-full min-w-0 rounded-xl border border-zinc-200 px-3" />
              </label>
              <OpsSubmitButton pendingLabel="Creating..." variant="outline" className="rounded-full">Create notification</OpsSubmitButton>
            </form>

            {notifications.slice(0, 10).length > 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-semibold text-zinc-950">Recent notifications</p>
                <div className="mt-3 grid gap-2">
                  {notifications.slice(0, 10).map((notification: any) => (
                    <div key={notification.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{notification.title}</p>
                        <p className="text-xs text-zinc-500">{notification.audience} · {notification.channel} · {notification.delivery_status}</p>
                      </div>
                      <form action={deleteTrainingNotificationAction}>
                        <input type="hidden" name="notification_id" value={notification.id} />
                        <OpsSubmitButton pendingLabel="Deleting..." size="sm" variant="outline" className="h-8 rounded-full border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">Delete</OpsSubmitButton>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </DropPanel>

        <DropPanel
          id="manage-training"
          title="Manage Training"
          description="Delete wrong batches or clear training data without touching employees."
          badge={`${batches.length} batches`}
        >
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Trash2 className="h-4 w-4" />
                Delete one batch
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Removes that batch with its sessions, attendance, members, feedback, trainer links, and training audit records.
              </p>
              <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
                {batches.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-3 text-sm text-zinc-500">No training batches exist.</p>
                ) : batches.map((batch: any) => (
                  <form key={batch.id} action={deleteTrainingBatchAction} className="rounded-xl border border-zinc-200 bg-white p-3">
                    <input type="hidden" name="batch_id" value={batch.id} />
                    <p className="text-sm font-semibold text-zinc-950">{batch.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">{batch.status.replace('_', ' ')} - {(membersByBatch.get(batch.id) || []).length} learner(s), {sessions.filter((session: any) => session.batch_id === batch.id).length} session(s)</p>
                    <label className="mt-3 grid gap-1 text-xs font-medium text-zinc-600">
                      Type DELETE
                      <input name="confirmation" className="h-9 rounded-lg border border-zinc-200 px-2 text-sm" placeholder="DELETE" />
                    </label>
                    <OpsSubmitButton pendingLabel="Deleting..." variant="outline" size="sm" className="mt-3 rounded-full border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
                      Delete batch
                    </OpsSubmitButton>
                  </form>
                ))}
              </div>
            </div>

            {role === 'admin' ? (
              <form action={clearAllTrainingDataAction} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-900">
                  <ShieldAlert className="h-4 w-4" />
                  Remove all existing training
                </div>
                <p className="mt-1 text-xs leading-5 text-rose-800">
                  Clears all training batches, sessions, attendance, candidate batch links, training feedback, assessment setup, project evaluations, automation logs, and notifications. Employees and quizzes stay available.
                </p>
                <label className="mt-3 grid gap-1 text-xs font-medium text-rose-900">
                  Type DELETE TRAINING
                  <input name="confirmation" className="h-10 rounded-lg border border-rose-200 bg-white px-2 text-sm" placeholder="DELETE TRAINING" />
                </label>
                <OpsSubmitButton pendingLabel="Removing..." className="mt-3 rounded-full bg-rose-700 text-white hover:bg-rose-800">
                  Remove all training
                </OpsSubmitButton>
              </form>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Only admins can remove all existing training data. Coordinators can delete batches they own.
              </div>
            )}
          </CardContent>
        </DropPanel>
      </div>
      ) : (
        <Card className="border-cyan-200 bg-cyan-50 shadow-sm">
          <CardHeader>
            <CardTitle>Trainer Workspace</CardTitle>
            <CardDescription>You are logged in as a trainer. You can only see and manage the batches assigned to you.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-cyan-200 bg-white p-4">
                <p className="text-xs font-semibold text-cyan-700 uppercase tracking-wide">Step 1 — After each session</p>
                <p className="mt-2 text-sm font-medium text-zinc-800">Mark attendance</p>
                <p className="mt-1 text-xs text-zinc-500">Use the Attendance section below. Upload or record who attended each session. Submit before the cut-off time.</p>
              </div>
              <div className="rounded-2xl border border-cyan-200 bg-white p-4">
                <p className="text-xs font-semibold text-cyan-700 uppercase tracking-wide">Step 2 — After assessments</p>
                <p className="mt-2 text-sm font-medium text-zinc-800">Upload assessment scores</p>
                <p className="mt-1 text-xs text-zinc-500">Download the Excel template, fill in scores, and upload it using the Assessment Import section below.</p>
              </div>
              <div className="rounded-2xl border border-cyan-200 bg-white p-4">
                <p className="text-xs font-semibold text-cyan-700 uppercase tracking-wide">Step 3 — For project work</p>
                <p className="mt-2 text-sm font-medium text-zinc-800">Submit project evaluations</p>
                <p className="mt-1 text-xs text-zinc-500">Use the Project Evaluation section below to score and comment on each candidate's project submission.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </div>

      {canCoordinate ? (
        <section id="import" className="scroll-mt-32">
          <BatchCandidateImporter batches={batches.map((batch: any) => ({ id: batch.id, title: batch.title }))} />
        </section>
      ) : null}

      <section id="schedule" className="scroll-mt-32">
        <ScheduleTimeline items={scheduleTimeline} />
      </section>

      <section id="documents" className="scroll-mt-32">
        <AssessmentDocumentLibrary
          assessments={assessmentSetups}
          projectEvaluations={projectEvaluations}
          batches={batches.map((batch: any) => ({ id: batch.id, title: batch.title }))}
        />
      </section>
      </section>

      <section id="intelligence-hub" className="scroll-mt-32 space-y-4">
        <SectionIntro eyebrow="Intelligence Hub" title="Executive Signals" description="Batch trends, trainer performance, risk indicators, and audit evidence for decisions." />
      <div className="grid gap-4 md:grid-cols-3">
        <MissionSignalCard icon={BarChart3} label="Batch Signals" value={`${batchComparisonData.length}`} detail="Attendance, assessment, and clearance trends" tone="blue" />
        <MissionSignalCard icon={LineChart} label="Trainer Signals" value={`${trainerScorecards.length}`} detail="Impact scorecards ranked by execution quality" tone="emerald" />
        <MissionSignalCard icon={Zap} label="AI Summary" value={openRisks > 0 ? 'Action' : 'Clear'} detail={openRisks > 0 ? 'Prioritize risk queues before new setup work' : 'No critical operating risk is open'} tone={openRisks > 0 ? 'amber' : 'emerald'} />
      </div>
      <div id="analytics" className="space-y-6">
        {batchComparisonData.length > 0 && (
          <BatchComparisonChart data={batchComparisonData} />
        )}

        <TrainerScorecardDeck items={trainerScorecards} />
      </div>

      <div id="audit" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <AuditPanel
          title="Batch Change Audit"
          empty="No batch lifecycle or configuration changes have been audited yet."
          items={batchChangeAudit.slice(0, 5).map((item: any) => ({
            id: item.id,
            title: item.batch?.title || 'Training batch',
            body: describeBatchAudit(item),
            meta: new Date(item.changed_at).toLocaleString(),
          }))}
        />
        <AuditPanel
          title="Attendance Versions"
          empty="No attendance changes have been versioned yet."
          items={attendanceVersions.slice(0, 5).map((item: any) => ({
            id: item.id,
            title: item.profile?.full_name || item.profile?.email || 'Candidate',
            body: `${item.previous_status || 'new'} -> ${item.new_status} via ${item.source}`,
            meta: new Date(item.changed_at).toLocaleString(),
          }))}
        />
        <AuditPanel
          title="Project Evaluations"
          empty="No project evaluations uploaded yet."
          items={projectEvaluations.slice(0, 5).map((item: any) => ({
            id: item.id,
            title: item.trainee?.full_name || item.trainee?.email || 'Candidate',
            body: `${item.project_title} - ${item.score}/100`,
            meta: item.evidence_file_name || 'Evidence optional',
            href: item.evidence_file_name?.startsWith('training-evidence/') ? `/api/training/evidence?path=${encodeURIComponent(item.evidence_file_name)}` : null,
          }))}
        />
        <AuditPanel
          title="Automation Runs"
          empty="No automation run has been logged yet."
          items={automationRuns.slice(0, 5).map((item: any) => ({
            id: item.id,
            title: item.run_type.replace('_', ' '),
            body: `${item.notifications_created} notification(s) created`,
            meta: new Date(item.created_at).toLocaleString(),
          }))}
        />
        <AuditPanel
          title="Assessment Upload Errors"
          empty="No assessment score upload errors yet."
          items={assessmentUploads.filter((item: any) => item.failed_records > 0).slice(0, 5).map((item: any) => ({
            id: item.id,
            title: item.file_name || 'Assessment upload',
            body: `${item.failed_records} failed, ${item.duplicate_records || 0} duplicate, ${item.successful_records} successful`,
            meta: new Date(item.created_at).toLocaleString(),
          }))}
        />
      </div>
      </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="min-w-0 rounded-[1.75rem] border border-white/10 bg-white/5 p-5 crosshair-focus hover:bg-white/[0.08] transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
        <Icon className="h-4 w-4 text-white/60" />
      </div>
      <p className="mt-4 text-3xl font-bold text-white">{value}</p>
    </div>
  )
}

function MissionKpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  detail: string
  icon: any
  tone: 'blue' | 'emerald' | 'amber' | 'red'
}) {
  const toneClass = {
    blue: 'from-sky-400/20 to-blue-500/10 text-sky-100',
    emerald: 'from-emerald-400/20 to-emerald-500/10 text-emerald-100',
    amber: 'from-amber-400/22 to-amber-500/10 text-amber-100',
    red: 'from-rose-500/24 to-red-500/10 text-rose-100',
  }[tone]

  return (
    <div className={`group min-w-0 rounded-[1.5rem] border border-white/10 bg-gradient-to-br ${toneClass} p-5 shadow-[0_16px_50px_rgba(2,6,23,0.22)] transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/10`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">{label}</p>
        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/10 text-white transition group-hover:scale-105">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-5 text-4xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm leading-5 text-white/62">{detail}</p>
    </div>
  )
}

function SectionIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-5">
        <div className="mt-0.5 w-1 shrink-0 self-stretch rounded-full bg-gradient-to-b from-blue-500 via-blue-400 to-blue-200" />
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-blue-700 ring-1 ring-inset ring-blue-100">
            <span className="h-1 w-1 rounded-full bg-blue-500" />
            {eyebrow}
          </span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{title}</h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        Live signals
      </div>
    </div>
  )
}

function MissionSignalCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: any
  label: string
  value: string
  detail: string
  tone: 'blue' | 'emerald' | 'amber' | 'red'
}) {
  const iconClass = {
    blue: 'border-blue-100 bg-blue-50 text-blue-600',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-600',
    amber: 'border-amber-100 bg-amber-50 text-amber-600',
    red: 'border-rose-100 bg-rose-50 text-rose-600',
  }[tone]
  const cardGradient = {
    blue: 'bg-gradient-to-br from-blue-50/60 via-white to-white border-blue-100/80',
    emerald: 'bg-gradient-to-br from-emerald-50/60 via-white to-white border-emerald-100/80',
    amber: 'bg-gradient-to-br from-amber-50/60 via-white to-white border-amber-100/80',
    red: 'bg-gradient-to-br from-rose-50/60 via-white to-white border-rose-100/80',
  }[tone]
  const accentBar = {
    blue: 'bg-blue-400',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    red: 'bg-rose-400',
  }[tone]
  const valueColor = {
    blue: 'text-blue-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-rose-700',
  }[tone]

  return (
    <div className={`group relative overflow-hidden rounded-[1.5rem] border p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(15,23,42,0.13)] ${cardGradient}`}>
      <div className={`absolute right-0 top-0 h-1 w-full rounded-t-[1.5rem] ${accentBar} opacity-60`} />
      <div className="flex items-start justify-between gap-4">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl border ${iconClass} shadow-sm`}>
          <Icon className="h-5 w-5" />
        </span>
        <CheckCircle2 className="h-4 w-4 text-emerald-500 opacity-60" />
      </div>
      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className={`mt-1.5 text-3xl font-bold tracking-tight ${valueColor}`}>{value}</p>
      <p className="mt-2 text-sm leading-5 text-slate-500">{detail}</p>
    </div>
  )
}

function LiveBatchBoard({
  batches,
  sessions,
  attendance,
  membersByBatch,
  trainersByBatch,
  assessmentsByBatch,
  quizzesByBatch,
  canCoordinate,
}: {
  batches: any[]
  sessions: any[]
  attendance: any[]
  membersByBatch: Map<string, any[]>
  trainersByBatch: Map<string, any[]>
  assessmentsByBatch: Map<string, any[]>
  quizzesByBatch: Map<string, any[]>
  canCoordinate: boolean
}) {
  if (batches.length === 0) {
    return (
      <CardContent>
        <EmptyState text="No training batches yet. Create the first batch above to unlock session planning, attendance, and feedback workflows." />
      </CardContent>
    )
  }

  return (
    <CardContent className="grid gap-4 xl:grid-cols-2">
      {batches.map((batch: any) => {
        const batchMembers = membersByBatch.get(batch.id) || []
        const batchSessions = sessions.filter((session: any) => session.batch_id === batch.id)
        const batchSessionIds = new Set(batchSessions.map((session: any) => session.id))
        const batchAttendance = attendance.filter((record: any) => batchSessionIds.has(record.session_id))
        const positiveAttendance = batchAttendance.filter((record: any) => record.status === 'present' || record.status === 'late').length
        const attendanceRate = batchAttendance.length ? Math.round((positiveAttendance / batchAttendance.length) * 100) : 0
        const scheduledCount = batchSessions.filter((session: any) => session.status === 'scheduled').length
        const completedCount = batchSessions.filter((session: any) => session.status === 'completed').length
        const assignedTrainers = trainersByBatch.get(batch.id) || []
        const trainerNames = [
          ...assignedTrainers.map((item: any) => item.trainer?.full_name || item.trainer?.email).filter(Boolean),
          batch.trainer?.full_name || batch.trainer?.email,
        ].filter(Boolean)
        const uniqueTrainerNames = Array.from(new Set(trainerNames))
        const assessments = assessmentsByBatch.get(batch.id) || []
        const quizzes = quizzesByBatch.get(batch.id) || []
        const existingTrainerIds = Array.from(new Set([
          ...assignedTrainers.map((item: any) => item.trainer_id).filter(Boolean),
          batch.trainer_id,
        ].filter(Boolean)))

        return (
          <div key={batch.id} className="rounded-[1.35rem] border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-semibold text-zinc-950" title={batch.title}>{batch.title}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneForBatchStatus(batch.status)}`}>
                    {batch.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">{batch.domain || 'General'} - {batch.start_date ? new Date(batch.start_date).toLocaleDateString() : 'TBD'} to {batch.end_date ? new Date(batch.end_date).toLocaleDateString() : 'TBD'}</p>
              </div>
              <Badge variant="outline" className={attendanceRate >= 75 ? 'w-fit bg-emerald-50 text-emerald-700' : 'w-fit bg-amber-50 text-amber-800'}>
                {attendanceRate}% attend
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniMetric label="Learners" value={`${batchMembers.length}`} />
              <MiniMetric label="Scheduled" value={`${scheduledCount}`} />
              <MiniMetric label="Completed" value={`${completedCount}`} />
              <MiniMetric label="Assessments" value={`${assessments.length || quizzes.length}`} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Trainers</p>
                <p className="mt-2 text-sm text-zinc-700">{uniqueTrainerNames.length ? uniqueTrainerNames.join(', ') : 'Unassigned'}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Next session</p>
                <p className="mt-2 text-sm text-zinc-700">
                  {batchSessions.find((session: any) => session.status === 'scheduled')
                    ? `${batchSessions.find((session: any) => session.status === 'scheduled')?.title} - ${new Date(batchSessions.find((session: any) => session.status === 'scheduled')?.session_date).toLocaleDateString()}`
                    : 'No scheduled session'}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {batchMembers.slice(0, 6).map((member: any) => (
                <div key={member.id} className="flex items-center gap-1">
                  <BatchMemberStatusDropdown
                    memberId={member.id}
                    currentStatus={member.enrollment_status}
                    name={member.profile?.full_name || member.profile?.email || 'Unknown'}
                    canEdit={canCoordinate}
                  />
                  {canCoordinate && (
                    <form action={removeTrainingBatchMemberAction}>
                      <input type="hidden" name="member_id" value={member.id} />
                      <input type="hidden" name="batch_id" value={batch.id} />
                      <button type="submit" className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 transition">Remove</button>
                    </form>
                  )}
                </div>
              ))}
              {batchMembers.length > 6 ? <Badge variant="outline" className="rounded-full bg-zinc-50">+{batchMembers.length - 6} more</Badge> : null}
            </div>

            {canCoordinate ? (
              <details className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-800">Quick edit</summary>
                <form action={updateTrainingBatchDetailsAction} className="grid gap-3 border-t border-zinc-200 p-4">
                  <input type="hidden" name="batch_id" value={batch.id} />
                  {existingTrainerIds.map((trainerId) => (
                    <input key={trainerId} type="hidden" name="trainer_ids" value={trainerId} />
                  ))}
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Batch name</span>
                      <input name="title" defaultValue={batch.title} className="h-10 rounded-xl border border-zinc-200 bg-white px-3" />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Domain</span>
                      <input name="domain" defaultValue={batch.domain || ''} className="h-10 rounded-xl border border-zinc-200 bg-white px-3" />
                    </label>
                  </div>
                  <input type="hidden" name="description" value={batch.description || ''} />
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Status</span>
                      <select name="status" defaultValue={batch.status === 'active' || batch.status === 'at_risk' ? 'running' : batch.status} className="h-10 rounded-xl border border-zinc-200 bg-white px-3">
                        <option value="planned">Planned</option>
                        <option value="running">Running</option>
                        <option value="completed">Completed</option>
                        <option value="closed">Closed</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Start</span>
                      <input name="start_date" type="date" defaultValue={batch.start_date || ''} className="h-10 rounded-xl border border-zinc-200 bg-white px-3" />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">End</span>
                      <input name="end_date" type="date" defaultValue={batch.end_date || ''} className="h-10 rounded-xl border border-zinc-200 bg-white px-3" />
                    </label>
                  </div>
                  <OpsSubmitButton pendingLabel="Saving..." variant="outline" className="w-fit rounded-full bg-white">Save quick edit</OpsSubmitButton>
                </form>
              </details>
            ) : null}
          </div>
        )
      })}
    </CardContent>
  )
}

function AttendanceTrackerPanel({
  sessions,
  membersByBatch,
  attendanceBySession,
  attendanceRate,
  updateAction,
}: {
  sessions: any[]
  membersByBatch: Map<string, any[]>
  attendanceBySession: Map<string, any[]>
  attendanceRate: number
  updateAction: (formData: FormData) => Promise<{ error?: string } | unknown>
}) {
  return (
    <DropPanel
      id="attendance"
      title="Attendance Tracker"
      description="Mark a session quickly, or upload an Excel sheet when the whole batch is ready."
      badge={`${attendanceRate}% health`}
      defaultOpen
    >
      <CardContent className="space-y-6">
        <AttendanceImporter
          sessions={sessions.map((session: any) => ({
            id: session.id,
            title: session.title,
            batchTitle: session.batch?.title || 'Batch',
            sessionDate: session.session_date,
          }))}
        />
        {sessions.length === 0 ? (
          <EmptyState text="No sessions scheduled yet. Attendance controls appear here after a session is created." />
        ) : (
          sessions.map((session: any) => {
            const existingRecords = attendanceBySession.get(session.id) || []
            const existingByUser = new Map(existingRecords.map((record: any) => [record.user_id, record]))
            const roster = membersByBatch.get(session.batch_id) || []
            const records = roster.length
              ? roster.map((member: any) => existingByUser.get(member.user_id) || {
                  id: null,
                  session_id: session.id,
                  user_id: member.user_id,
                  status: 'absent',
                  check_in_time: null,
                  profile: member.profile,
                })
              : existingRecords
            return (
              <ManualAttendanceCard
                key={session.id}
                session={session}
                records={records}
                action={updateAction}
              />
            )
          })
        )}
      </CardContent>
    </DropPanel>
  )
}

function DropPanel({
  id,
  title,
  description,
  badge,
  defaultOpen = false,
  children,
}: {
  id: string
  title: string
  description: string
  badge?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details id={id} open={defaultOpen} className="group scroll-mt-32 overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-sm transition duration-300 hover:shadow-md open:shadow-md">
      <summary className="relative flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 marker:hidden select-none">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200/60 to-transparent group-open:via-blue-300/70" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {badge ? (
              <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 shadow-sm transition group-open:rotate-180 group-open:border-blue-200 group-open:bg-blue-50 group-open:text-blue-600">
          <ChevronDown className="h-4 w-4" />
        </div>
      </summary>
      <div className="border-t border-slate-100 bg-slate-50/30">
        {children}
      </div>
    </details>
  )
}

function PriorityOpsWorkbench({
  canCoordinate,
  attendanceDue,
  absenceAlerts,
  activeBatches,
  upcomingSessions,
  remainingCandidates,
  assessmentClearance,
  negativeFeedback,
}: {
  canCoordinate: boolean
  attendanceDue: number
  absenceAlerts: number
  activeBatches: number
  upcomingSessions: number
  remainingCandidates: number
  assessmentClearance: number
  negativeFeedback: number
}) {
  const tasks = [
    {
      title: 'Add employees',
      detail: 'Create learners with Employee ID and Domain',
      href: '/manager/employees',
      icon: Users,
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-950',
      enabled: canCoordinate,
    },
    {
      title: 'Assign quiz',
      detail: 'Create or assign assessment before batch execution',
      href: '/manager/quizzes',
      icon: FileText,
      tone: 'border-violet-200 bg-violet-50 text-violet-950',
      enabled: canCoordinate,
    },
    {
      title: 'Fix attendance first',
      detail: attendanceDue > 0 ? `${attendanceDue} session(s) need attention` : 'No overdue attendance right now',
      href: '#attendance',
      icon: ClipboardCheck,
      tone: attendanceDue > 0 ? 'border-rose-200 bg-rose-50 text-rose-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950',
      enabled: true,
    },
    {
      title: 'Review live batches',
      detail: `${activeBatches} active batch(es), ${remainingCandidates} learner(s) in training`,
      href: '#batch-board',
      icon: Users,
      tone: 'border-zinc-200 bg-white text-zinc-950',
      enabled: true,
    },
    {
      title: 'Create or edit batch',
      detail: canCoordinate ? 'Add learners, trainer, dates, and quizzes' : 'Coordinator access required',
      href: canCoordinate ? '#create-batch' : '/manager/docs#create-training-batch',
      icon: CalendarDays,
      tone: 'border-cyan-200 bg-cyan-50 text-cyan-950',
      enabled: true,
    },
    {
      title: 'Plan sessions',
      detail: `${upcomingSessions} upcoming session(s)`,
      href: canCoordinate ? '#schedule-session' : '#schedule-planner',
      icon: CalendarDays,
      tone: 'border-blue-200 bg-blue-50 text-blue-950',
      enabled: true,
    },
    {
      title: 'Assessments and projects',
      detail: `Clearance signal ${assessmentClearance}%`,
      href: canCoordinate ? '#assessment-setup' : '#assessment',
      icon: FileSpreadsheet,
      tone: 'border-amber-200 bg-amber-50 text-amber-950',
      enabled: true,
    },
    {
      title: 'Feedback and reminders',
      detail: negativeFeedback > 0 ? `${negativeFeedback} negative feedback item(s)` : 'Open windows and reminders',
      href: '#feedback',
      icon: MessageSquareQuote,
      tone: negativeFeedback > 0 ? 'border-rose-200 bg-rose-50 text-rose-950' : 'border-violet-200 bg-violet-50 text-violet-950',
      enabled: true,
    },
    {
      title: 'Run automation',
      detail: `${absenceAlerts} absence risk(s) visible`,
      href: canCoordinate ? '#automation' : '/manager/docs#automation-runbook',
      icon: RadioTower,
      tone: 'border-zinc-200 bg-zinc-50 text-zinc-950',
      enabled: true,
    },
    {
      title: 'Read the guide',
      detail: 'A to Z non-technical instructions',
      href: '/manager/docs',
      icon: FileText,
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-950',
      enabled: true,
    },
  ]

  return (
    <section className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Manager workbench</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">Do these in priority order</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-zinc-500">
          The dense tools are still below, but this strip puts the highest-value actions first so a non-technical admin knows where to click.
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {tasks.filter((task) => task.enabled).map((task, index) => {
          const Icon = task.icon
          return (
            <Link key={task.title} href={task.href} className={`group rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${task.tone}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold">Step {index + 1}</span>
              </div>
              <p className="mt-4 text-sm font-semibold">{task.title}</p>
              <p className="mt-1 text-xs leading-5 opacity-75">{task.detail}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="group min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <div className="mt-3 h-0.5 w-6 rounded-full bg-blue-400/50 transition-all duration-300 group-hover:w-full group-hover:bg-blue-400/70" />
    </div>
  )
}

function ActionTile({ title, value, detail, tone, className = '' }: { title: string; value: string; detail: string; tone: 'rose' | 'amber' | 'blue' | 'emerald'; className?: string }) {
  const card = {
    rose: 'border-rose-100 bg-white',
    amber: 'border-amber-100 bg-white',
    blue: 'border-sky-100 bg-white',
    emerald: 'border-emerald-100 bg-white',
  }[tone]
  const accentBar = {
    rose: 'from-rose-400 to-rose-300',
    amber: 'from-amber-400 to-amber-300',
    blue: 'from-sky-500 to-blue-400',
    emerald: 'from-emerald-500 to-emerald-400',
  }[tone]
  const valueColor = {
    rose: 'text-rose-600',
    amber: 'text-amber-600',
    blue: 'text-sky-600',
    emerald: 'text-emerald-600',
  }[tone]
  const labelColor = {
    rose: 'text-rose-400',
    amber: 'text-amber-500',
    blue: 'text-sky-500',
    emerald: 'text-emerald-500',
  }[tone]
  const iconBg = {
    rose: 'border-rose-100 bg-rose-50 text-rose-500',
    amber: 'border-amber-100 bg-amber-50 text-amber-500',
    blue: 'border-sky-100 bg-sky-50 text-sky-500',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-500',
  }[tone]

  return (
    <div className={`group relative min-w-0 overflow-hidden rounded-[1.5rem] border p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(15,23,42,0.12)] ${card} ${className}`}>
      <div className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${accentBar}`} />
      <div className="flex items-start justify-between gap-3">
        <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${labelColor}`}>{title}</p>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border transition group-hover:scale-110 ${iconBg}`}>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className={`mt-4 text-4xl font-bold tracking-tight ${valueColor}`}>{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{detail}</p>
    </div>
  )
}

function ScheduleTimeline({ items }: { items: Array<{ id: string; type: string; title: string; batchTitle: string; date: string; meta: string; status: string }> }) {
  const now = Date.now()
  const upcoming = items.filter((item) => new Date(item.date).getTime() >= now)
  const completed = items.length - upcoming.length
  const assessmentCount = items.filter((item) => item.type === 'Assessment').length
  const nextItems = upcoming.slice(0, 8)
  const pastItems = items.filter((item) => new Date(item.date).getTime() < now).slice(-4).reverse()
  const dayBuckets = nextItems.reduce((acc, item) => {
    const key = new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    const list = acc.get(key) || []
    list.push(item)
    acc.set(key, list)
    return acc
  }, new Map<string, typeof nextItems>())

  return (
    <Card id="schedule-planner" className="scroll-mt-32 border-zinc-200 shadow-sm spotlight-card">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Batch Schedule Planner</CardTitle>
            <CardDescription>One operating rail for sessions, assessment dates, trainer ownership, and lifecycle status.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full bg-white">{upcoming.length} upcoming</Badge>
            <Badge variant="outline" className="rounded-full bg-white">{assessmentCount} assessment date(s)</Badge>
            <Badge variant="outline" className="rounded-full bg-white">{completed} completed/past</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState text="No scheduled sessions or assessments yet." />
        ) : (
          <div className="space-y-5">
            <div className="rounded-[1.5rem] border border-zinc-900 bg-black p-4 text-white">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Calendar command board</p>
                  <p className="mt-1 text-sm text-zinc-400">Upcoming days grouped as execution lanes so coordinators can scan the week at a glance.</p>
                </div>
                <Badge variant="outline" className="w-fit border-white/15 bg-white/10 text-white">
                  Next {nextItems.length} milestone(s)
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {Array.from(dayBuckets.entries()).slice(0, 4).map(([day, dayItems]) => (
                  <div key={day} className="min-h-40 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{day}</p>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-black">{dayItems.length}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {dayItems.map((item) => (
                        <div key={`lane-${item.id}`} className="rounded-xl border border-white/10 bg-black/30 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.type === 'Assessment' ? 'bg-amber-300 text-amber-950' : 'bg-cyan-300 text-cyan-950'}`}>
                              {item.type}
                            </span>
                            <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm font-semibold">{item.title}</p>
                          <p className="mt-1 truncate text-xs text-zinc-400">{item.batchTitle}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
            <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Upcoming execution lane</p>
              <div className="mt-4 grid gap-3">
                {nextItems.length === 0 ? (
                  <EmptyState text="No upcoming schedule items." compact />
                ) : nextItems.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 md:grid-cols-[9rem_1fr_auto] md:items-center">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{new Date(item.date).toLocaleDateString()}</p>
                      <p className="text-xs text-zinc-500">{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={item.type === 'Assessment' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}>{item.type}</Badge>
                        <Badge variant="outline" className="capitalize">{item.status}</Badge>
                      </div>
                      <p className="mt-2 font-semibold text-zinc-950">{item.title}</p>
                      <p className="mt-1 text-sm text-zinc-500">{item.batchTitle} - {item.meta}</p>
                    </div>
                    <div className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                      {Math.max(0, Math.ceil((new Date(item.date).getTime() - now) / 86400000))}d
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-zinc-900 bg-black p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Program roadmap</p>
              <div className="mt-4 space-y-3">
                {(pastItems.length ? pastItems : items.slice(0, 4)).map((item) => (
                  <div key={`compact-${item.id}`} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline" className="border-white/20 bg-white/10 text-white">{item.type}</Badge>
                      <span className="text-xs text-zinc-400">{new Date(item.date).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-3 font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-zinc-400">{item.batchTitle}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-relaxed text-zinc-400">
                This planner gives coordinators one place to narrate the complete batch calendar: delivery sessions, assessment dates, and ownership signals.
              </p>
            </div>
          </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AssessmentDocumentLibrary({
  assessments,
  projectEvaluations,
  batches,
}: {
  assessments: any[]
  projectEvaluations: any[]
  batches: Array<{ id: string; title: string }>
}) {
  const batchName = new Map(batches.map((batch) => [batch.id, batch.title]))
  const assessmentDocs = assessments.filter((setup) => setup.question_file_name)
  const projectDocs = projectEvaluations.filter((item) => item.evidence_file_name)
  const documents = [
    ...assessmentDocs.map((setup) => ({
      id: `assessment-${setup.id}`,
      type: 'Question file',
      title: setup.title,
      batch: batchName.get(setup.batch_id) || 'Batch',
      path: setup.question_file_name,
      meta: `${String(setup.assessment_type || 'assessment').replace('_', ' ')} - pass ${setup.passing_score}/${setup.max_score}`,
    })),
    ...projectDocs.map((item) => ({
      id: `project-${item.id}`,
      type: 'Project evidence',
      title: item.project_title,
      batch: batchName.get(item.batch_id) || 'Batch',
      path: item.evidence_file_name,
      meta: `${item.score}/100 - ${item.trainee?.full_name || item.trainee?.email || 'Candidate'}`,
    })),
  ]

  return (
    <Card id="document-library" className="scroll-mt-32 border-zinc-200 shadow-sm spotlight-card">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Assessment Document Library</CardTitle>
            <CardDescription>Question files, scoring templates, and project evidence are surfaced as a dedicated audit-ready library.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full bg-white">{assessmentDocs.length} question file(s)</Badge>
            <Badge variant="outline" className="rounded-full bg-white">{projectDocs.length} evidence file(s)</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <EmptyState text="No stored assessment or evidence files yet. Upload a question file or project evidence to populate the library." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((doc) => (
              <div key={doc.id} className="rounded-[1.35rem] border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Badge variant="outline" className="rounded-full bg-zinc-50">{doc.type}</Badge>
                    <p className="mt-3 truncate font-semibold text-zinc-950" title={doc.title}>{doc.title}</p>
                    <p className="mt-1 truncate text-sm text-zinc-500">{doc.batch}</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                    <FolderOpen className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">{doc.meta}</p>
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500">
                  {doc.path?.startsWith('training-evidence/') ? (
                    <a href={`/api/training/evidence?path=${encodeURIComponent(doc.path)}`} className="font-semibold text-zinc-950 underline decoration-zinc-400 underline-offset-2">
                      Open stored file
                    </a>
                  ) : (
                    <span className="break-all">{doc.path}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FeedbackAnalyticsPanel({
  analytics,
  batches,
}: {
  analytics: { total: number; positive: number; neutral: number; negative: number; avgRating: string; avgContent: string; avgTrainer: string }
  batches: Array<{ id: string; title: string }>
}) {
  const topBatchLinks = batches.slice(0, 4)

  return (
    <div className="space-y-4">
      <FeedbackSentimentChart
        positive={analytics.positive}
        neutral={analytics.neutral}
        negative={analytics.negative}
        total={analytics.total}
        avgRating={analytics.avgRating}
        avgContent={analytics.avgContent}
        avgTrainer={analytics.avgTrainer}
      />
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-950">Standalone feedback reports</p>
            <p className="mt-1 text-xs text-zinc-500">Download feedback-only analysis with windows, ratings, sentiment, comments, and action items.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <a href="/api/export/pdf?type=feedback">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              All feedback PDF
            </a>
          </Button>
        </div>
        {topBatchLinks.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {topBatchLinks.map((batch) => (
              <a key={batch.id} href={`/api/export/batch-feedback?batchId=${batch.id}`} className="inline-flex max-w-full items-center gap-2 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{batch.title}</span>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function TrainerScorecardDeck({ items }: { items: Array<{ id: string; name: string; batches: number; attendance: number; assessment: number; feedback: string; risk: string; score: number }> }) {
  return (
    <Card className="overflow-hidden border-zinc-900 bg-black text-white shadow-[0_28px_90px_rgba(0,0,0,0.35)]">
      <CardHeader className="border-b border-white/10">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Trainer Impact Scorecards</CardTitle>
            <CardDescription className="text-zinc-400">
              A production view of trainer impact across attendance discipline, assessment outcomes, and learner feedback.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">No trainer scorecard data yet.</div>
        ) : items.map((item) => (
          <div key={item.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.06] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold" title={item.name}>{item.name}</p>
                <p className="mt-1 text-xs text-zinc-400">{item.batches} assigned batch(es)</p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-black">{item.score}</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <DarkMetric label="Attend" value={`${item.attendance}%`} />
              <DarkMetric label="Assess" value={`${item.assessment}%`} />
              <DarkMetric label="Feedback" value={item.feedback} />
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-300">
              Signal: <span className="font-semibold text-white">{item.risk}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}

function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-center text-zinc-500 ${compact ? 'p-4 text-sm' : 'p-8 text-sm'}`}>
      <MessageSquareQuote className="mx-auto mb-3 h-5 w-5 opacity-50" />
      <p>{text}</p>
    </div>
  )
}

function buildTrainerScorecards({
  batches,
  batchTrainers,
  sessions,
  attendance,
  feedback,
  projectEvaluations,
  importedAssessments,
  quizAttempts,
}: {
  batches: any[]
  batchTrainers: any[]
  sessions: any[]
  attendance: any[]
  feedback: any[]
  projectEvaluations: any[]
  importedAssessments: any[]
  quizAttempts: any[]
}) {
  const trainers = new Map<string, { id: string; name: string; batchIds: Set<string> }>()
  for (const batch of batches) {
    if (!batch.trainer?.id) continue
    trainers.set(batch.trainer.id, trainers.get(batch.trainer.id) || { id: batch.trainer.id, name: batch.trainer.full_name || batch.trainer.email || 'Trainer', batchIds: new Set() })
    trainers.get(batch.trainer.id)!.batchIds.add(batch.id)
  }
  for (const assignment of batchTrainers) {
    const trainer = assignment.trainer
    if (!trainer?.id) continue
    trainers.set(trainer.id, trainers.get(trainer.id) || { id: trainer.id, name: trainer.full_name || trainer.email || 'Trainer', batchIds: new Set() })
    trainers.get(trainer.id)!.batchIds.add(assignment.batch_id)
  }

  return Array.from(trainers.values()).map((trainer) => {
    const batchIds = Array.from(trainer.batchIds)
    const trainerSessions = sessions.filter((session) => batchIds.includes(session.batch_id))
    const sessionIds = new Set(trainerSessions.map((session) => session.id))
    const attendanceRows = attendance.filter((row) => sessionIds.has(row.session_id))
    const positiveAttendance = attendanceRows.filter((row) => ['present', 'late'].includes(row.status)).length
    const attendanceRate = attendanceRows.length ? Math.round((positiveAttendance / attendanceRows.length) * 100) : 0
    const scoreRows = [
      ...quizAttempts.filter((attempt) => batchIds.includes(attempt.quizzes?.batch_id)).map((attempt) => Number(attempt.score || 0)),
      ...projectEvaluations.filter((item) => batchIds.includes(item.batch_id)).map((item) => Number(item.score || 0)),
      ...importedAssessments.filter((item) => batchIds.includes(item.batch_id)).map((item) => Number(item.percentage ?? item.candidate_score ?? 0)),
    ]
    const assessmentAvg = scoreRows.length ? Math.round(scoreRows.reduce((sum, score) => sum + score, 0) / scoreRows.length) : 0
    const feedbackRows = feedback.filter((item) => batchIds.includes(item.batch_id) && item.trainer_effectiveness_rating)
    const avgFeedback = feedbackRows.length ? (feedbackRows.reduce((sum, item) => sum + Number(item.trainer_effectiveness_rating || 0), 0) / feedbackRows.length).toFixed(1) : '0.0'
    const score = Math.round((attendanceRate * 0.35) + (assessmentAvg * 0.4) + (Number(avgFeedback) * 20 * 0.25))
    const risk = attendanceRate < 70 ? 'Attendance intervention' : assessmentAvg < 70 ? 'Assessment coaching' : Number(avgFeedback) < 3.5 && feedbackRows.length ? 'Feedback follow-up' : 'Healthy execution'
    return { id: trainer.id, name: trainer.name, batches: batchIds.length, attendance: attendanceRate, assessment: assessmentAvg, feedback: avgFeedback, score, risk }
  }).sort((a, b) => b.score - a.score)
}

function describeBatchAudit(item: any) {
  const actor = item.changer?.full_name || item.changer?.email || 'system'
  const changeType = String(item.change_type || 'change').replaceAll('_', ' ')
  const previousStatus = item.previous_value?.status || item.previous_value?.enrollment_status
  const nextStatus = item.new_value?.status || item.new_value?.enrollment_status

  if (previousStatus && nextStatus && previousStatus !== nextStatus) {
    return `${changeType}: ${previousStatus} -> ${nextStatus} by ${actor}`
  }

  if (nextStatus) {
    return `${changeType}: ${nextStatus} by ${actor}`
  }

  return `${changeType} by ${actor}`
}

function AuditPanel({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; title: string; body: string; meta: string; href?: string | null }> }) {
  return (
    <Card className="border-zinc-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <EmptyState text={empty} compact />
        ) : items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-zinc-200 p-4">
            <p className="font-medium capitalize">{item.title}</p>
            <p className="mt-1 text-sm text-zinc-500">{item.body}</p>
            <p className="mt-2 text-xs text-zinc-400">
              {item.href ? <a href={item.href} className="underline underline-offset-2">Open evidence file</a> : item.meta}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
