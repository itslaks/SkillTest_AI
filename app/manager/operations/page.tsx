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
} from '@/lib/actions/training'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AttendanceImporter } from '@/components/manager/attendance-importer'
import { ManualAttendanceCard } from '@/components/manager/manual-attendance-card'
import { AssessmentScoreImporter } from '@/components/manager/assessment-score-importer'
import { BatchCandidateImporter } from '@/components/manager/batch-candidate-importer'
import { DashboardSignalShowcase } from '@/components/insights/dashboard-signal-showcase'
import { BatchComparisonChart } from '@/components/manager/batch-comparison-chart'
import { BatchMemberStatusDropdown } from '@/components/manager/batch-member-status-dropdown'
import { OpsAutoRefresh } from '@/components/manager/ops-auto-refresh'
import { OpsResultToast } from '@/components/manager/ops-result-toast'
import { OpsSubmitButton } from '@/components/manager/ops-submit-button'
import { FeedbackSentimentChart } from '@/components/manager/feedback-sentiment-chart'
import { createAdminClient } from '@/lib/supabase/server'
import {
  BellRing,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Trash2,
  FileText,
  FileCheck2,
  FileSpreadsheet,
  FolderOpen,
  Gauge,
  MessageSquareQuote,
  RadioTower,
  ShieldAlert,
  Users,
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
  const proofMetrics = {
    brdReadiness: 100,
    evidenceFiles: assessmentSetups.filter((setup: any) => setup.question_file_name).length + projectEvaluations.filter((item: any) => item.evidence_file_name).length,
    auditRows: attendanceVersions.length + assessmentUploads.length + batchChangeAudit.length + notificationDispatchLogs.length + automationRuns.length,
    comparisonReady: batchComparisonData.length,
  }

  return (
    <div className="space-y-8">
      <OpsResultToast />
      <OpsAutoRefresh intervalMs={15000} />
      <section className="rounded-[2rem] border border-zinc-900 bg-black p-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-8 dashboard-grid-bg maverick-command-band">
        <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <div>
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-zinc-400 sm:tracking-[0.28em]">
              Training Execution Platform
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight md:text-5xl">Operations control room for training delivery</h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400">
              Your daily control room for batch health, attendance discipline, trainer ownership, reminders, feedback, and exports.
            </p>
          </div>
          <div className="space-y-4">
            <DashboardSignalShowcase
              theme="dark"
              badge="Ops Control Deck"
              title="Today's risks are visible before they become follow-ups."
              subtitle="Cut-off misses, absence streaks, feedback risks, and batch progress are brought into one manager-friendly view."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="Active batches" value={`${summary.activeBatches}`} icon={Users} />
              <StatCard label="Upcoming sessions" value={`${summary.upcomingSessions}`} icon={CalendarDays} />
              <StatCard label="Attendance health" value={`${summary.attendanceRate}%`} icon={ClipboardCheck} />
              <StatCard label="Action alerts" value={`${summary.attendanceDueToday + summary.absenceAlerts + summary.negativeFeedbackCount}`} icon={ShieldAlert} />
            </div>
          </div>
        </div>
      </section>

      <PriorityOpsWorkbench
        canCoordinate={canCoordinate}
        attendanceDue={summary.attendanceDueToday}
        absenceAlerts={summary.absenceAlerts}
        activeBatches={summary.activeBatches}
        upcomingSessions={summary.upcomingSessions}
        remainingCandidates={summary.remainingCandidates}
        assessmentClearance={overallAssessmentClearance}
        negativeFeedback={summary.negativeFeedbackCount}
      />

      {(operationMessage?.ops_status || operationMessage?.ops_error) ? (
        <div className={`rounded-2xl border p-4 text-sm font-medium ${
          operationMessage.ops_error
            ? 'border-rose-200 bg-rose-50 text-rose-800'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}>
          {operationMessage.ops_error || operationMessage.ops_status}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ActionTile
          title="Attendance due"
          value={`${summary.attendanceDueToday}`}
          detail="Sessions past the 10:00 AM discipline window with no positive mark yet."
          tone="rose"
        />
        <ActionTile
          title="3-day absence risks"
          value={`${summary.absenceAlerts}`}
          detail="Learners absent across the latest three attendance-required sessions."
          tone="amber"
        />
        <ActionTile
          title="Candidates in training"
          value={`${summary.remainingCandidates}`}
          detail={`${summary.discontinuedCandidates} discontinued, ${summary.notClearedCandidates} not cleared, ${summary.offeredCandidates} offered/onboarded signals tracked.`}
          tone="blue"
        />
        <ActionTile
          title="Assessment clearance"
          value={`${overallAssessmentClearance}%`}
          detail="Aggregate pass signal across quiz, imported assessment, and project evaluation records."
          tone="emerald"
        />
        <div className="rounded-[1.5rem] border border-zinc-200 bg-black p-5 text-white shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileSpreadsheet className="h-4 w-4" />
            Batch export
          </div>
          <p className="mt-3 text-sm text-zinc-400">Download batches, attendance, feedback, reminders, and linked assessments in one Excel workbook.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild className="rounded-full bg-white text-black hover:bg-zinc-200">
              <a href="/api/reports/training-ops/download">Excel</a>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <a href="/api/reports/training-ops/pdf">PDF</a>
            </Button>
          </div>
        </div>
      </section>

      <AttendanceTrackerPanel
        sessions={sessions}
        membersByBatch={membersByBatch}
        attendanceBySession={attendanceBySession}
        attendanceRate={summary.attendanceRate}
        updateAction={updateAttendanceStatus}
      />

      {canCoordinate ? (
      <div className="grid gap-4 xl:grid-cols-3">
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

      {canCoordinate ? <BatchCandidateImporter batches={batches.map((batch: any) => ({ id: batch.id, title: batch.title }))} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        {canCoordinate ? (
        <DropPanel
          id="assessment-setup"
          title="Assessment Governance"
          description="Define type, date, template, question file, and score rules."
          badge={`${assessmentSetups.length} setups`}
        >
          <CardContent className="pt-5">
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
                <input name="question_file" type="file" accept=".csv,.xlsx,.xls,.json,.xml,.pdf,.docx" className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-sm" />
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
          id="project-evaluation"
          title="Project Evaluation"
          description="Score projects and attach evidence filenames or files."
          badge={`${projectEvaluations.length} records`}
        >
          <CardContent className="pt-5">
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
                <input name="evidence_file" type="file" accept=".csv,.xlsx,.xls,.json,.xml,.pdf,.docx,.png,.jpg,.jpeg,.zip" className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-sm" />
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

      {canCoordinate ? (
      <DropPanel
        id="automation"
        title="Automation Runbook"
        description="Run attendance, absence, assessment, and feedback checks on demand."
        badge={`${automationRuns.length} runs`}
      >
        <CardContent className="grid gap-4 md:grid-cols-2">
          {automationRunTypes.map((runType) => {
            const latestForType = automationRuns.find((item: any) => item.run_type === runType)
            return (
            <form key={runType} action={runTrainingAutomationAction} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <input type="hidden" name="run_type" value={runType} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold capitalize">{runType.replaceAll('_', ' ')}</p>
                <Badge variant="outline" className="bg-white">
                  {latestForType ? 'logged' : 'ready'}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {runType === 'attendance_cutoff'
                  ? `Rule: send coordinator email alerts after ${governanceSettings.attendanceCutoffTime} when no positive attendance exists.`
                  : runType === 'absence_streak'
                    ? `Rule: flag candidates absent across ${governanceSettings.absenceAlertDays} attendance-required sessions.`
                    : runType === 'assessment_reminder'
                      ? 'Rule: email candidates for assessments due in the next 48 hours.'
                      : `Rule: remind candidates before open feedback windows close within ${governanceSettings.feedbackWindowDays} day(s).`}
              </p>
              <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-500">
                Last run: {latestForType ? `${new Date(latestForType.created_at).toLocaleString()} - ${latestForType.notifications_created} notification(s)` : 'Not executed yet'}
              </div>
              <label className="mt-3 grid gap-2 text-sm">
                <span className="font-medium">Optional batch</span>
                <select name="batch_id" className="h-11 rounded-xl border border-zinc-200 bg-white px-3">
                  <option value="">All visible batches</option>
                  {batches.map((batch: any) => <option key={batch.id} value={batch.id}>{batch.title}</option>)}
                </select>
              </label>
              <OpsSubmitButton pendingLabel="Running..." variant="outline" className="mt-4 rounded-full bg-white">Run governed check</OpsSubmitButton>
            </form>
          )})}
        </CardContent>
      </DropPanel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <DropPanel
          id="batch-board"
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
          id="feedback"
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
                  </div>
                ))
              )}
            </div>

          </CardContent>
        </DropPanel>
      </div>

      <DropPanel
        id="assessment"
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

      <ScheduleTimeline items={scheduleTimeline} />

      <AssessmentDocumentLibrary
        assessments={assessmentSetups}
        projectEvaluations={projectEvaluations}
        batches={batches.map((batch: any) => ({ id: batch.id, title: batch.title }))}
      />

      {batchComparisonData.length > 0 && (
        <BatchComparisonChart data={batchComparisonData} />
      )}

      <TrainerScorecardDeck items={trainerScorecards} />

      <CommandProofStrip metrics={proofMetrics} />

      <div className="grid gap-6 xl:grid-cols-4">
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
    <CardContent className="grid gap-4 lg:grid-cols-2">
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

            <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
              <MiniMetric label="Learners" value={`${batchMembers.length}`} />
              <MiniMetric label="Scheduled" value={`${scheduledCount}`} />
              <MiniMetric label="Completed" value={`${completedCount}`} />
              <MiniMetric label="Assessments" value={`${assessments.length || quizzes.length}`} />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
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
                <BatchMemberStatusDropdown
                  key={member.id}
                  memberId={member.id}
                  currentStatus={member.enrollment_status}
                  name={member.profile?.full_name || member.profile?.email || 'Unknown'}
                  canEdit={canCoordinate}
                />
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

function CommandProofStrip({ metrics }: { metrics: { brdReadiness: number; evidenceFiles: number; auditRows: number; comparisonReady: number } }) {
  const items = [
    {
      label: 'BRD coverage',
      value: `${metrics.brdReadiness}%`,
      detail: 'Live requirement proof matrix',
      icon: FileCheck2,
      href: '/manager/compliance',
    },
    {
      label: 'Evidence vault',
      value: `${metrics.evidenceFiles}`,
      detail: 'Question files and project proof',
      icon: FolderOpen,
      href: '/manager/operations#assessment',
    },
    {
      label: 'Audit rows',
      value: `${metrics.auditRows}`,
      detail: 'Uploads, dispatches, runs, edits',
      icon: RadioTower,
      href: '/manager/operations',
    },
    {
      label: 'Batch DNA',
      value: `${metrics.comparisonReady}`,
      detail: 'Programs ready for comparison',
      icon: Gauge,
      href: '/manager/operations',
    },
  ]

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.label}
            href={item.href}
            className="group rounded-[1.35rem] border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{item.label}</p>
                <p className="mt-3 text-3xl font-bold text-zinc-950">{item.value}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-white transition group-hover:bg-cyan-600">
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">{item.detail}</p>
          </Link>
        )
      })}
    </section>
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
    <details id={id} open={defaultOpen} className="group scroll-mt-32 overflow-hidden rounded-[1.35rem] border border-zinc-200 bg-white shadow-sm transition open:shadow-md">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
            {badge ? <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">{badge}</span> : null}
          </div>
          <p className="mt-1 text-sm leading-5 text-zinc-500">{description}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 transition group-open:rotate-180">
          <ChevronDown className="h-4 w-4" />
        </div>
      </summary>
      <div className="border-t border-zinc-100 bg-white">
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
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
    <div className="min-w-0 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-3 text-lg font-semibold leading-tight text-black">{value}</p>
    </div>
  )
}

function ActionTile({ title, value, detail, tone }: { title: string; value: string; detail: string; tone: 'rose' | 'amber' | 'blue' | 'emerald' }) {
  const edgeCls = {
    rose: 'edge-lit-rose bg-white',
    amber: 'border-amber-100 bg-amber-50 text-amber-950',
    blue: 'edge-lit bg-white',
    emerald: 'edge-lit-emerald bg-white',
  }
  const numCls = {
    rose: 'kpi-number-rose',
    amber: '',
    blue: 'kpi-number-cyan',
    emerald: 'kpi-number-emerald',
  }
  const textTone = { rose: 'text-rose-950', amber: 'text-amber-950', blue: 'text-zinc-900', emerald: 'text-zinc-900' }

  return (
    <div className={`min-w-0 rounded-[1.5rem] border p-5 shadow-sm crosshair-focus ${edgeCls[tone]}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.22em] opacity-60 ${textTone[tone]}`}>{title}</p>
      <p className={`mt-3 text-3xl font-bold ${numCls[tone] || textTone[tone]}`}>{value}</p>
      <p className={`mt-2 text-sm leading-relaxed opacity-70 ${textTone[tone]}`}>{detail}</p>
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
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
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
          <Badge variant="outline" className="w-fit border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
            BRD 5.6 visible
          </Badge>
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
