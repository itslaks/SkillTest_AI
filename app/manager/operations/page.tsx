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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AttendanceImporter } from '@/components/manager/attendance-importer'
import { AssessmentScoreImporter } from '@/components/manager/assessment-score-importer'
import { BatchCandidateImporter } from '@/components/manager/batch-candidate-importer'
import { DashboardSignalShowcase } from '@/components/insights/dashboard-signal-showcase'
import {
  BellRing,
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  MessageSquareQuote,
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

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-zinc-900 bg-black p-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-8 dashboard-grid-bg">
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
              title="Today’s risks are visible before they become follow-ups."
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            <CardTitle>Batch Lifecycle Management</CardTitle>
            <CardDescription>Create batches, attach trainers, enroll learners, and link assessments in one action.</CardDescription>
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
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Description</span>
                <textarea name="description" rows={3} className="w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-3" placeholder="Goal, scope, batch objective, and delivery expectations." />
              </label>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Status</span>
                  <select name="status" defaultValue="planned" className="h-11 w-full min-w-0 rounded-xl border border-zinc-200 px-3">
                    <option value="planned">Planned</option>
                    <option value="running">Running</option>
                    <option value="completed">Completed</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
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
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Trainer panel</span>
                <select name="trainer_ids" multiple className="min-h-28 w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-3">
                  {trainers.filter((trainer: any) => trainer.role === 'trainer').map((trainer: any) => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.full_name || trainer.email}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Customization</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Cadence</span>
                    <select name="cadence" className="h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3">
                      <option value="">Flexible</option>
                      <option value="Daily">Daily</option>
                      <option value="Twice weekly">Twice weekly</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Bootcamp">Bootcamp</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Capacity</span>
                    <input name="capacity" type="number" min="1" className="h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3" placeholder="30" />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Priority</span>
                    <select name="priority" className="h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3">
                      <option value="">Normal</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                      <option value="Pilot">Pilot</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Support model</span>
                    <select name="support_model" className="h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3">
                      <option value="">Standard</option>
                      <option value="Mentor led">Mentor led</option>
                      <option value="Office hours">Office hours</option>
                      <option value="Manager coaching">Manager coaching</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Timezone</span>
                    <input name="timezone" className="h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3" placeholder="IST, UTC..." />
                  </label>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Enroll learners</span>
                  <select name="employee_ids" multiple className="min-h-44 w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-3">
                    {employees.map((employee: any) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name || employee.email} {employee.domain ? `- ${employee.domain}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Link assessments</span>
                  <select name="quiz_ids" multiple className="min-h-44 w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-3">
                    {quizzes.map((quiz: any) => (
                      <option key={quiz.id} value={quiz.id}>
                        {quiz.title} - {quiz.topic}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                <p>Create once, then manage schedule, attendance, reminders, feedback, and reports from the same operating view.</p>
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
            <CardDescription>Your access is scoped to assigned batches. Use the attendance tracker, project evaluations, and assessment upload controls below.</CardDescription>
          </CardHeader>
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
                <span className="font-medium">Remarks</span>
                <textarea name="remarks" rows={3} className="rounded-xl border border-zinc-200 px-3 py-3" placeholder="Evaluation notes, strengths, and improvement actions." />
              </label>
              <Button type="submit" className="w-fit rounded-full bg-black text-white hover:bg-zinc-800">Save project evaluation</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {canCoordinate ? (
      <Card className="border-zinc-200 shadow-sm spotlight-card">
        <CardHeader>
          <CardTitle>Automation Control</CardTitle>
          <CardDescription>Run governance checks for cut-off alerts and upcoming assessment reminders. Each run is logged for audit.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {(['attendance_cutoff', 'absence_streak', 'assessment_reminder', 'feedback_reminder'] as const).map((runType) => (
            <form key={runType} action={runTrainingAutomationAction} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <input type="hidden" name="run_type" value={runType} />
              <p className="font-semibold capitalize">{runType.replace('_', ' ')}</p>
              <p className="mt-1 text-sm text-zinc-500">
                {runType === 'attendance_cutoff'
                  ? 'Create coordinator email alerts for sessions past the attendance cut-off.'
                  : runType === 'absence_streak'
                    ? 'Create coordinator alerts for candidates absent across the configured streak window.'
                    : runType === 'assessment_reminder'
                      ? 'Create candidate email reminders for assessments due in the next 48 hours.'
                      : 'Create candidate email reminders for open feedback windows before closure.'}
              </p>
              <label className="mt-3 grid gap-2 text-sm">
                <span className="font-medium">Optional batch</span>
                <select name="batch_id" className="h-11 rounded-xl border border-zinc-200 bg-white px-3">
                  <option value="">All visible batches</option>
                  {batches.map((batch: any) => <option key={batch.id} value={batch.id}>{batch.title}</option>)}
                </select>
              </label>
              <Button type="submit" variant="outline" className="mt-4 rounded-full bg-white">Run check</Button>
            </form>
          ))}
        </CardContent>
      </Card>
      ) : null}

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
                          {batchMembers.length > 0 ? batchMembers.slice(0, 8).map((member: any) => (
                            <Badge key={member.id} variant="outline" className="rounded-full bg-white">
                              {member.profile?.full_name || member.profile?.email}
                            </Badge>
                          )) : <p className="text-sm text-zinc-500">No learners added yet.</p>}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Linked assessments</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {batchAssessments.length > 0 ? batchAssessments.map((setup: any) => (
                            <Badge key={setup.id} variant="outline" className="rounded-full bg-white">
                              {setup.title} - {setup.assessment_type.replace('_', ' ')}
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
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniMetric label="Notifications sent" value={`${summary.notificationsSent}`} />
              <MiniMetric label="Negative feedback" value={`${summary.negativeFeedbackCount}`} />
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

      <Card className="border-zinc-200 shadow-sm spotlight-card">
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
              const records = attendanceBySession.get(session.id) || []
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
                      <p className="text-sm text-zinc-500">Learners will appear here once a batch is linked to this session.</p>
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

      <Card className="border-zinc-200 shadow-sm spotlight-card">
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

      <div className="grid gap-6 xl:grid-cols-3">
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
    <div className="min-w-0 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
    </div>
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

function ActionTile({ title, value, detail, tone }: { title: string; value: string; detail: string; tone: 'rose' | 'amber' | 'blue' }) {
  const tones = {
    rose: 'border-rose-100 bg-rose-50 text-rose-950',
    amber: 'border-amber-100 bg-amber-50 text-amber-950',
    blue: 'border-blue-100 bg-blue-50 text-blue-950',
  }

  return (
    <div className={`min-w-0 rounded-[1.5rem] border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-60">{title}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm leading-relaxed opacity-75">{detail}</p>
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

function AuditPanel({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; title: string; body: string; meta: string }> }) {
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
            <p className="mt-2 text-xs text-zinc-400">{item.meta}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
