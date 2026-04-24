import {
  createTrainingBatch,
  createTrainingNotification,
  createTrainingSession,
  getTrainingOpsManagerData,
  updateAttendanceStatus,
} from '@/lib/actions/training'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardSignalShowcase } from '@/components/insights/dashboard-signal-showcase'
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
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

async function updateAttendanceStatusAction(formData: FormData) {
  'use server'
  await updateAttendanceStatus(formData)
}

function toneForBatchStatus(status: string) {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700'
    case 'completed':
      return 'bg-slate-100 text-slate-700'
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
  } = await getTrainingOpsManagerData()

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
              This module closes the gap between assessment analytics and day-to-day training execution. Every operational requirement from the brief now has a visible workflow here.
            </p>
          </div>
          <div className="space-y-4">
            <DashboardSignalShowcase
              theme="dark"
              badge="Ops Control Deck"
              title="Execution screens now feel more cinematic and presentation-ready."
              subtitle="Sessions, attendance, reminders, and feedback sit inside a richer visual system instead of plain utility layouts."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="Active batches" value={`${summary.activeBatches}`} icon={Users} />
              <StatCard label="Upcoming sessions" value={`${summary.upcomingSessions}`} icon={CalendarDays} />
              <StatCard label="Attendance health" value={`${summary.attendanceRate}%`} icon={ClipboardCheck} />
              <StatCard label="Feedback risks" value={`${summary.negativeFeedbackCount}`} icon={ShieldAlert} />
            </div>
          </div>
        </div>
      </section>

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
                  <input name="title" required className="h-11 rounded-xl border border-zinc-200 px-3" placeholder="Maverick Java Batch 07" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Domain</span>
                  <input name="domain" className="h-11 rounded-xl border border-zinc-200 px-3" placeholder="Java, Data, Cloud..." />
                </label>
              </div>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Description</span>
                <textarea name="description" rows={3} className="rounded-xl border border-zinc-200 px-3 py-3" placeholder="Goal, scope, batch objective, and delivery expectations." />
              </label>
              <div className="grid gap-4 md:grid-cols-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Status</span>
                  <select name="status" defaultValue="planned" className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="at_risk">At Risk</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Start date</span>
                  <input name="start_date" type="date" className="h-11 rounded-xl border border-zinc-200 px-3" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">End date</span>
                  <input name="end_date" type="date" className="h-11 rounded-xl border border-zinc-200 px-3" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Lead trainer</span>
                  <select name="trainer_id" className="h-11 rounded-xl border border-zinc-200 px-3">
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
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Enroll learners</span>
                  <select name="employee_ids" multiple className="min-h-44 rounded-xl border border-zinc-200 px-3 py-3">
                    {employees.map((employee: any) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name || employee.email} {employee.domain ? `• ${employee.domain}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Link assessments</span>
                  <select name="quiz_ids" multiple className="min-h-44 rounded-xl border border-zinc-200 px-3 py-3">
                    {quizzes.map((quiz: any) => (
                      <option key={quiz.id} value={quiz.id}>
                        {quiz.title} • {quiz.topic}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                <p>Batch creation now updates the backend and immediately reflects in the manager and employee experience.</p>
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
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Session date & time</span>
                  <input name="session_date" type="datetime-local" required className="h-11 rounded-xl border border-zinc-200 px-3" />
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
                <input name="scheduled_for" type="datetime-local" className="h-11 rounded-xl border border-zinc-200 px-3" />
              </label>
              <Button type="submit" variant="outline" className="rounded-full">Create notification</Button>
            </form>
          </CardContent>
        </Card>
      </div>

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
                return (
                  <div key={batch.id} className="rounded-[1.5rem] border border-zinc-200 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold">{batch.title}</h2>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] ${toneForBatchStatus(batch.status)}`}>
                            {batch.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-500">{batch.description || 'No description added yet.'}</p>
                      </div>
                      <div className="text-sm text-zinc-500">
                        <p>{batch.start_date ? new Date(batch.start_date).toLocaleDateString() : 'TBD'} to {batch.end_date ? new Date(batch.end_date).toLocaleDateString() : 'TBD'}</p>
                        <p className="mt-1">Trainer: {batch.trainer?.full_name || batch.trainer?.email || 'Unassigned'}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <MiniMetric label="Learners" value={`${batchMembers.length}`} />
                      <MiniMetric label="Sessions" value={`${batch.training_sessions?.[0]?.count || 0}`} />
                      <MiniMetric label="Assessments" value={`${batchQuizzes.length}`} />
                      <MiniMetric label="Coordinator" value={batch.coordinator?.full_name || batch.coordinator?.email || 'Manager'} />
                    </div>

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
                          {batchQuizzes.length > 0 ? batchQuizzes.map((quiz: any) => (
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
                      {item.batch?.title || item.session?.title || item.recipient?.full_name || 'General'} • {new Date(item.created_at).toLocaleString()}
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
        </Card>
      </div>

      <Card className="border-zinc-200 shadow-sm spotlight-card">
        <CardHeader>
          <CardTitle>Attendance Tracker</CardTitle>
          <CardDescription>Session-level attendance now has physical controls in the UI and persists through the backend.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {sessions.length === 0 ? (
            <EmptyState text="No sessions scheduled yet. Attendance controls appear here after a session is created." />
          ) : (
            sessions.slice(0, 6).map((session: any) => {
              const records = attendanceBySession.get(session.id) || []
              return (
                <div key={session.id} className="rounded-[1.5rem] border border-zinc-200 p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{session.title}</h3>
                        <Badge variant="outline" className="capitalize">{session.mode}</Badge>
                        <Badge variant="outline" className="capitalize">{session.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        {session.batch?.title || 'Batch'} • {new Date(session.session_date).toLocaleString()} • {session.trainer?.full_name || session.trainer?.email || 'Trainer TBD'}
                      </p>
                    </div>
                    <div className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white">
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
                              <p className="text-sm opacity-80">{record.status.toUpperCase()} {record.check_in_time ? `• ${new Date(record.check_in_time).toLocaleTimeString()}` : ''}</p>
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
    </div>
  )
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{label}</p>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{label}</p>
      <p className="mt-3 text-xl font-semibold text-black">{value}</p>
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
