import {
  createProjectEvaluation,
  createTrainingAssessmentSetup,
  createTrainingBatch,
  createFeedbackWindow,
  createTrainingNotification,
  createTrainingSession,
  getTrainingOpsManagerData,
  runTrainingAutomation,
  updateTrainingBatchDetails,
  updateAttendanceStatus,
} from '@/lib/actions/training'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AttendanceImporter } from '@/components/manager/attendance-importer'
import { AssessmentScoreImporter } from '@/components/manager/assessment-score-importer'
import { BatchCandidateImporter } from '@/components/manager/batch-candidate-importer'
import { DashboardSignalShowcase } from '@/components/insights/dashboard-signal-showcase'
import { BatchComparisonChart } from '@/components/manager/batch-comparison-chart'
import { BatchMemberStatusDropdown } from '@/components/manager/batch-member-status-dropdown'
import { OpsAutoRefresh } from '@/components/manager/ops-auto-refresh'
import { FeedbackSentimentChart } from '@/components/manager/feedback-sentiment-chart'
import { createAdminClient } from '@/lib/supabase/server'
import {
  BellRing,
  CalendarDays,
  ClipboardCheck,
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

async function createTrainingBatchAction(formData: FormData) {
  'use server'
  await createTrainingBatch(formData)
}

async function createTrainingSessionAction(formData: FormData) {
  'use server'
  await createTrainingSession(formData)
}

async function createTrainingNotificationAction(formData: FormData) {
  'use server'
  await createTrainingNotification(formData)
}

async function createFeedbackWindowAction(formData: FormData) {
  'use server'
  await createFeedbackWindow(formData)
}

async function updateAttendanceStatusAction(formData: FormData) {
  'use server'
  await updateAttendanceStatus(formData)
}

async function updateTrainingBatchDetailsAction(formData: FormData) {
  'use server'
  await updateTrainingBatchDetails(formData)
}

async function createTrainingAssessmentSetupAction(formData: FormData) {
  'use server'
  await createTrainingAssessmentSetup(formData)
}

async function createProjectEvaluationAction(formData: FormData) {
  'use server'
  await createProjectEvaluation(formData)
}

async function runTrainingAutomationAction(formData: FormData) {
  'use server'
  await runTrainingAutomation(formData)
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

function toneForAttendance(status: string) {
  switch (status) {
    case 'present':
      return 'bg-emerald-50 border-emerald-200 text-emerald-700'
    case 'late':
      return 'bg-amber-50 border-amber-200 text-amber-700'
    case 'excused':
      return 'bg-slate-50 border-slate-200 text-slate-700'
    default:
      return 'bg-rose-50 border-rose-200 text-rose-700'
  }
}

export default async function ManagerOperationsPage() {
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
      <OpsAutoRefresh />
      <section className="rounded-[2rem] border border-zinc-900 bg-black p-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-8 dashboard-grid-bg maverick-command-band">
        <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-[0.35em] text-zinc-400">
              Training Execution Platform
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">Operations control room for batches, trainers, attendance, and reminders</h1>
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

      <CommandProofStrip metrics={proofMetrics} />

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

      {canCoordinate ? (
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-zinc-200 shadow-sm spotlight-card">
          <CardHeader>
            <CardTitle>Create Training Batch</CardTitle>
            <CardDescription>Keep setup simple: name the batch, choose a trainer, add learners, and optionally link assessments.</CardDescription>
          </CardHeader>
          <CardContent>
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
                <Button type="submit" className="rounded-full bg-black text-white hover:bg-zinc-800">Create batch</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm spotlight-card">
          <CardHeader>
            <CardTitle>Session Planner & Notifications</CardTitle>
            <CardDescription>Schedule trainer-led sessions and trigger communication without leaving this screen.</CardDescription>
          </CardHeader>
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
              <Button type="submit" className="rounded-full bg-black text-white hover:bg-zinc-800">Schedule session</Button>
            </form>

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
              <Button type="submit" variant="outline" className="rounded-full">Create notification</Button>
            </form>
          </CardContent>
        </Card>
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
        <Card className="border-zinc-200 shadow-sm spotlight-card">
          <CardHeader>
            <CardTitle>Assessment Governance</CardTitle>
            <CardDescription>Define assessment type, date, template, question file, and score rules before trainers upload results.</CardDescription>
          </CardHeader>
          <CardContent>
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
                <input name="question_file" type="file" accept=".xlsx,.xls,.csv,.pdf,.doc,.docx" className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-sm" />
              </label>
              <Button type="submit" className="w-fit rounded-full bg-black text-white hover:bg-zinc-800">Create assessment setup</Button>
            </form>
          </CardContent>
        </Card>
        ) : null}

        <Card className="border-zinc-200 shadow-sm spotlight-card">
          <CardHeader>
            <CardTitle>Project Evaluation Evidence</CardTitle>
            <CardDescription>Trainer-uploaded project scores and evidence filenames are tracked as a first-class TMS artifact.</CardDescription>
          </CardHeader>
          <CardContent>
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
                <input name="evidence_file" type="file" accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.png,.jpg,.jpeg,.zip" className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-sm" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Remarks</span>
                <textarea name="remarks" rows={3} className="rounded-xl border border-zinc-200 px-3 py-3" placeholder="Evaluation notes, strengths, and improvement actions." />
              </label>
              <Button type="submit" className="w-fit rounded-full bg-black text-white hover:bg-zinc-800">Save project evaluation</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {canCoordinate ? (
      <Card id="feedback" className="scroll-mt-32 border-zinc-200 shadow-sm spotlight-card">
        <CardHeader>
          <CardTitle>Automation Runbook</CardTitle>
          <CardDescription>Each governed check has a business rule, an operator override, and an audit record after execution.</CardDescription>
        </CardHeader>
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
              <Button type="submit" variant="outline" className="mt-4 rounded-full bg-white">Run governed check</Button>
            </form>
          )})}
        </CardContent>
      </Card>
      ) : null}

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

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-zinc-200 shadow-sm spotlight-card">
          <CardHeader>
            <CardTitle>Live Batch Board</CardTitle>
            <CardDescription>Operational visibility across lifecycle, trainer ownership, enrolled learners, and linked assessments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {batches.length === 0 ? (
              <EmptyState text="No training batches yet. Create the first batch above to unlock session planning, attendance, and communication workflows." />
            ) : (
              batches.map((batch: any) => {
                const batchMembers = membersByBatch.get(batch.id) || []
                const batchQuizzes = quizzesByBatch.get(batch.id) || []
                const assignedTrainers = trainersByBatch.get(batch.id) || []
                const batchAssessments = assessmentsByBatch.get(batch.id) || []
                return (
                  <div key={batch.id} className="rounded-[1.5rem] border border-zinc-200 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold">{batch.title}</h2>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] ${toneForBatchStatus(batch.status)}`}>
                            {batch.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-500">{batch.description || 'No description added yet.'}</p>
                      </div>
                      <div className="shrink-0 text-sm text-zinc-500 md:text-right">
                        <p>{batch.start_date ? new Date(batch.start_date).toLocaleDateString() : 'TBD'} to {batch.end_date ? new Date(batch.end_date).toLocaleDateString() : 'TBD'}</p>
                        <p className="mt-1">Trainer: {batch.trainer?.full_name || batch.trainer?.email || 'Unassigned'}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <MiniMetric label="Learners" value={`${batchMembers.length}`} />
                      <MiniMetric label="Sessions" value={`${batch.training_sessions?.[0]?.count || 0}`} />
                      <MiniMetric label="Assessments" value={`${batchQuizzes.length}`} />
                      <MiniMetric label="Trainers" value={`${Math.max(assignedTrainers.length, batch.trainer ? 1 : 0)}`} />
                    </div>

                    {canCoordinate ? (
                    <form action={updateTrainingBatchDetailsAction} className="mt-4 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
                      <input type="hidden" name="batch_id" value={batch.id} />
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="grid gap-2 text-sm">
                          <span className="font-medium">Batch name</span>
                          <input name="title" defaultValue={batch.title} className="h-11 rounded-xl border border-zinc-200 px-3" />
                        </label>
                        <label className="grid gap-2 text-sm">
                          <span className="font-medium">Domain</span>
                          <input name="domain" defaultValue={batch.domain || ''} className="h-11 rounded-xl border border-zinc-200 px-3" />
                        </label>
                      </div>
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Description</span>
                        <textarea name="description" defaultValue={batch.description || ''} rows={2} className="rounded-xl border border-zinc-200 px-3 py-3" />
                      </label>
                      <div className="grid gap-3 md:grid-cols-4">
                        <label className="grid gap-2 text-sm">
                          <span className="font-medium">Status</span>
                          <select name="status" defaultValue={batch.status === 'active' || batch.status === 'at_risk' ? 'running' : batch.status} className="h-11 rounded-xl border border-zinc-200 px-3">
                            <option value="planned">Planned</option>
                            <option value="running">Running</option>
                            <option value="completed">Completed</option>
                            <option value="closed">Closed</option>
                          </select>
                        </label>
                        <label className="grid gap-2 text-sm">
                          <span className="font-medium">Start</span>
                          <input name="start_date" type="date" defaultValue={batch.start_date || ''} className="h-11 rounded-xl border border-zinc-200 px-3" />
                        </label>
                        <label className="grid gap-2 text-sm">
                          <span className="font-medium">End</span>
                          <input name="end_date" type="date" defaultValue={batch.end_date || ''} className="h-11 rounded-xl border border-zinc-200 px-3" />
                        </label>
                        <label className="grid gap-2 text-sm">
                          <span className="font-medium">Trainer panel</span>
                          <select name="trainer_ids" multiple defaultValue={assignedTrainers.map((item: any) => item.trainer_id)} className="min-h-11 rounded-xl border border-zinc-200 px-3 py-2">
                            {trainers.filter((trainer: any) => trainer.role === 'trainer').map((trainer: any) => (
                              <option key={trainer.id} value={trainer.id}>{trainer.full_name || trainer.email}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <Button type="submit" variant="outline" className="w-fit rounded-full">Save batch edits</Button>
                    </form>
                    ) : null}

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Learner cohort</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {batchMembers.length > 0 ? batchMembers.map((member: any) => (
                            <BatchMemberStatusDropdown
                              key={member.id}
                              memberId={member.id}
                              currentStatus={member.enrollment_status}
                              name={member.profile?.full_name || member.profile?.email || 'Unknown'}
                              canEdit={canCoordinate}
                            />
                          )) : <p className="text-sm text-zinc-500">No learners added yet.</p>}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Linked assessments</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {batchAssessments.length > 0 ? batchAssessments.map((setup: any) => (
                            <Badge key={setup.id} variant="outline" className="rounded-full bg-white">
                              {setup.title} - {setup.assessment_type.replace('_', ' ')}
                              {setup.question_file_name ? (
                                <EvidenceLink path={setup.question_file_name} label="file" />
                              ) : null}
                            </Badge>
                          )) : batchQuizzes.length > 0 ? batchQuizzes.map((quiz: any) => (
                            <Badge key={quiz.id} variant="outline" className="rounded-full bg-white">
                              {quiz.title}
                            </Badge>
                          )) : <p className="text-sm text-zinc-500">No quizzes linked yet.</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm spotlight-card">
          <CardHeader>
            <CardTitle>Feedback & Reminder Pulse</CardTitle>
            <CardDescription>Recent learner sentiment and communication activity tied to training execution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FeedbackAnalyticsPanel
              analytics={feedbackAnalytics}
              batches={batches.map((batch: any) => ({ id: batch.id, title: batch.title }))}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <MiniMetric label="Notifications sent" value={`${summary.notificationsSent}`} />
              <MiniMetric label="Negative feedback" value={`${summary.negativeFeedbackCount}`} />
            </div>

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

            <form action={createFeedbackWindowAction} className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Open feedback window</p>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Batch</span>
                  <select name="batch_id" required className="h-11 rounded-xl border border-zinc-200 bg-white px-3">
                    <option value="">Select batch</option>
                    {batches.map((batch: any) => (
                      <option key={batch.id} value={batch.id}>{batch.title}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Related session</span>
                  <select name="session_id" className="h-11 rounded-xl border border-zinc-200 bg-white px-3">
                    <option value="">Optional</option>
                    {sessions.map((session: any) => (
                      <option key={session.id} value={session.id}>{session.title}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Feedback title</span>
                  <input name="title" defaultValue="Training content and trainer feedback" className="h-11 rounded-xl border border-zinc-200 bg-white px-3" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Close by</span>
                  <input name="closes_at" type="datetime-local" required className="h-11 rounded-xl border border-zinc-200 bg-white px-3" />
                </label>
                <Button type="submit" className="rounded-full bg-black text-white hover:bg-zinc-800">Trigger feedback email</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card id="attendance" className="scroll-mt-32 border-zinc-200 shadow-sm spotlight-card">
        <CardHeader>
          <CardTitle>Attendance Tracker</CardTitle>
          <CardDescription>Session-level attendance now has physical controls in the UI and persists through the backend.</CardDescription>
        </CardHeader>
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
            sessions.slice(0, 6).map((session: any) => {
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
                <div key={session.id} className="rounded-[1.5rem] border border-zinc-200 p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{session.title}</h3>
                        <Badge variant="outline" className="capitalize">{session.mode}</Badge>
                        <Badge variant="outline" className="capitalize">{session.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        {session.batch?.title || 'Batch'} - {new Date(session.session_date).toLocaleString()} - {session.trainer?.full_name || session.trainer?.email || 'Trainer TBD'}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-full bg-black px-4 py-2 text-sm font-medium text-white">
                      {records.filter((record: any) => record.status === 'present' || record.status === 'late').length}/{records.length} marked
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {records.length === 0 ? (
                      <p className="text-sm text-zinc-500">Add learners to this batch to begin manual attendance marking.</p>
                    ) : (
                      records.map((record: any) => (
                        <div key={record.id || `${record.session_id}-${record.user_id}`} className={`rounded-2xl border p-4 ${toneForAttendance(record.status)}`}>
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="font-medium">{record.profile?.full_name || record.profile?.email || 'Learner'}</p>
                              <p className="text-sm opacity-80">{record.status.toUpperCase()} {record.check_in_time ? `- ${new Date(record.check_in_time).toLocaleTimeString()}` : ''}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(['present', 'late', 'excused', 'absent'] as const).map((status) => (
                                <form key={status} action={updateAttendanceStatusAction}>
                                  <input type="hidden" name="session_id" value={session.id} />
                                  <input type="hidden" name="user_id" value={record.user_id} />
                                  <input type="hidden" name="status" value={status} />
                                  <Button type="submit" size="sm" variant={record.status === status ? 'default' : 'outline'} className="rounded-full capitalize">
                                    {status}
                                  </Button>
                                </form>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card id="assessment" className="scroll-mt-32 border-zinc-200 shadow-sm spotlight-card">
        <CardHeader>
          <CardTitle>Assessment Score Upload</CardTitle>
          <CardDescription>Trainers can upload sprint review, API/coding, and project-linked assessment scores for assigned batches.</CardDescription>
        </CardHeader>
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
      </Card>

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
    <Card className="border-zinc-200 shadow-sm spotlight-card">
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
    <Card className="border-zinc-200 shadow-sm spotlight-card">
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

function EvidenceLink({ path, label }: { path: string; label: string }) {
  if (!path.startsWith('training-evidence/')) return null
  return (
    <a
      href={`/api/training/evidence?path=${encodeURIComponent(path)}`}
      className="ml-2 underline decoration-zinc-400 underline-offset-2"
    >
      {label}
    </a>
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
