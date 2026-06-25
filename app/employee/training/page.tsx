import { getEmployeeTrainingData, submitTrainingFeedback } from '@/lib/actions/training'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardSignalShowcase } from '@/components/insights/dashboard-signal-showcase'
import { OpsAutoRefresh } from '@/components/manager/ops-auto-refresh'
import {
  ArrowUpRight,
  BellRing,
  CalendarDays,
  ClipboardCheck,
  MessageSquareText,
  ShieldCheck,
  Users,
} from 'lucide-react'
import Link from 'next/link'

async function submitTrainingFeedbackAction(formData: FormData) {
  'use server'
  await submitTrainingFeedback(formData)
}

export default async function EmployeeTrainingPage() {
  const {
    memberships,
    sessions,
    nextSession,
    attendance,
    attendanceRate,
    notifications,
    feedback,
    feedbackWindows,
    quizzes,
  } = await getEmployeeTrainingData()
  const trainerByBatch = new Map(
    memberships.map((membership: any) => [
      membership.batch_id,
      membership.batch?.trainer?.full_name || membership.batch?.trainer?.email || null,
    ])
  )
  const nextSessionTrainer = nextSession
    ? nextSession.trainer?.full_name || nextSession.trainer?.email || trainerByBatch.get(nextSession.batch_id) || 'Trainer TBD'
    : 'Trainer TBD'

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-zinc-900 bg-black p-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.45)] md:p-8 dashboard-grid-bg">
        <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">My Training</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Your training, all in one place</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
              See your training schedule, upcoming sessions, attendance record, and any reminders from your trainer — all right here. You can also leave feedback once a feedback window is open.
            </p>
          </div>
          <div className="space-y-4">
            <DashboardSignalShowcase
              theme="dark"
              badge="Your Training Overview"
              title="Track your progress and stay on top of your schedule."
              subtitle="Check back here daily to see sessions, attendance, and reminders from your trainer."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <StatTile icon={Users} label="My batches" value={`${memberships.length}`} />
              <StatTile icon={CalendarDays} label="Upcoming sessions" value={`${sessions.filter((session: any) => session.status === 'scheduled').length}`} />
              <StatTile icon={ClipboardCheck} label="Attendance health" value={`${attendanceRate}%`} />
              <StatTile icon={BellRing} label="Reminders" value={`${notifications.length}`} />
            </div>
          </div>
        </div>
      </section>

      <OpsAutoRefresh intervalMs={15000} compact />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-zinc-200 shadow-sm spotlight-card">
          <CardHeader>
            <CardTitle>Current Batch & Schedule</CardTitle>
            <CardDescription>Your training batch, dates, and the trainer and coordinator assigned to you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {memberships.length === 0 ? (
              <EmptyState text="You are not enrolled in a training batch yet. Once assigned, your schedule and trainer details will appear here." />
            ) : (
              memberships.map((membership: any) => (
                <div key={membership.id} className="rounded-[1.5rem] border border-zinc-200 p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-black">{membership.batch?.title}</h2>
                        <Badge variant="outline" className="capitalize">{membership.enrollment_status}</Badge>
                        <Badge variant="outline" className="capitalize">{membership.support_status.replace('_', ' ')}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-zinc-500">{membership.batch?.description || 'Training details will be updated by your coordinator.'}</p>
                    </div>
                    <div className="shrink-0 text-sm text-zinc-500 md:text-right">
                      <p>Trainer: {membership.batch?.trainer?.full_name || membership.batch?.trainer?.email || 'TBD'}</p>
                      <p className="mt-1">Coordinator: {membership.batch?.coordinator?.full_name || membership.batch?.coordinator?.email || 'TBD'}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MiniMetric label="Start" value={membership.batch?.start_date ? new Date(membership.batch.start_date).toLocaleDateString() : 'TBD'} />
                    <MiniMetric label="End" value={membership.batch?.end_date ? new Date(membership.batch.end_date).toLocaleDateString() : 'TBD'} />
                    <MiniMetric label="Linked quizzes" value={`${quizzes.filter((quiz: any) => quiz.batch_id === membership.batch_id).length}`} />
                  </div>
                </div>
              ))
            )}

            <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                <CalendarDays className="h-4 w-4" />
                Next session
              </div>
              <p className="mt-3 text-lg font-medium text-blue-950">{nextSession?.title || 'No scheduled session yet'}</p>
              <p className="mt-1 text-sm text-blue-800">
                {nextSession ? `${new Date(nextSession.session_date).toLocaleString()} - ${nextSession.mode} - ${nextSessionTrainer}` : 'Your next session details will appear here as soon as your trainer schedules one.'}
              </p>
              {nextSession?.meeting_url ? (
                <Button asChild className="mt-4 rounded-full bg-blue-950 text-white hover:bg-blue-900">
                  <a href={nextSession.meeting_url} target="_blank" rel="noreferrer">
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    Join session
                  </a>
                </Button>
              ) : nextSession ? (
                <p className="mt-4 rounded-2xl border border-blue-200 bg-white/70 px-4 py-3 text-sm font-medium text-blue-900">
                  Join link is pending. Your admin or trainer can add it before the session.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm spotlight-card">
          <CardHeader>
            <CardTitle>Attendance & Communication</CardTitle>
            <CardDescription>Your attendance record and any messages or reminders from your trainer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniMetric label="Attendance rate" value={`${attendanceRate}%`} />
              <MiniMetric label="Feedback sent" value={`${feedback.length}`} />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Attendance history</p>
              {attendance.length === 0 ? (
                <EmptyState text="Attendance records will appear after your batch starts logging session participation." compact />
              ) : (
                attendance.slice(0, 6).map((entry: any) => (
                  <div key={entry.id} className="rounded-2xl border border-zinc-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium">{entry.session?.title || 'Session'}</p>
                      <Badge variant="outline" className="capitalize">{entry.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">{entry.session?.session_date ? new Date(entry.session.session_date).toLocaleString() : 'Date pending'}</p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Latest reminders</p>
              {notifications.length === 0 ? (
                <EmptyState text="No reminders yet." compact />
              ) : (
                notifications.slice(0, 5).map((item: any) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium">{item.title}</p>
                      <Badge variant="outline" className="capitalize">{item.channel}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">{item.message}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="border-zinc-200 shadow-sm spotlight-card">
          <CardHeader>
            <CardTitle>Submit Training Feedback</CardTitle>
            <CardDescription>Share your honest thoughts about the training. Feedback is only available during an open feedback window.</CardDescription>
          </CardHeader>
          <CardContent>
            {feedbackWindows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
                No feedback window is open right now.
              </div>
            ) : (
            <form action={submitTrainingFeedbackAction} className="grid gap-4">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Feedback window</span>
                <select name="feedback_window_id" required className="h-11 rounded-xl border border-zinc-200 px-3">
                  {feedbackWindows.map((window: any) => (
                    <option key={window.id} value={window.id}>
                      {window.batch?.title || 'Batch'} - {window.title} - closes {new Date(window.closes_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Rating</span>
                <select name="rating" defaultValue="5" className="h-11 rounded-xl border border-zinc-200 px-3">
                  <option value="5">5 - Excellent</option>
                  <option value="4">4 - Good</option>
                  <option value="3">3 - Average</option>
                  <option value="2">2 - Needs Improvement</option>
                  <option value="1">1 - Poor</option>
                </select>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Training content quality</span>
                  <select name="content_quality_rating" defaultValue="5" className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Average</option>
                    <option value="2">2 - Needs Improvement</option>
                    <option value="1">1 - Poor</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Trainer effectiveness</span>
                  <select name="trainer_effectiveness_rating" defaultValue="5" className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Average</option>
                    <option value="2">2 - Needs Improvement</option>
                    <option value="1">1 - Poor</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Feedback</span>
                <textarea name="feedback_text" rows={4} required className="rounded-xl border border-zinc-200 px-3 py-3" placeholder="What worked well? What should be improved?" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Suggested action item</span>
                <input name="action_item" className="h-11 rounded-xl border border-zinc-200 px-3" placeholder="Example: add more practical labs in week 2" />
              </label>
              <Button type="submit" className="rounded-full bg-black text-white hover:bg-zinc-800">Submit feedback</Button>
            </form>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm spotlight-card">
          <CardHeader>
            <CardTitle>Why Your Feedback Matters</CardTitle>
            <CardDescription>Your feedback helps improve training quality for you and future learners.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <ShieldCheck className="h-4 w-4" />
                Your progress is tracked
              </div>
              <p className="mt-3 text-sm text-emerald-800">
                Your attendance, sessions, and batch details are all visible here. You always know where you stand.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <MessageSquareText className="h-4 w-4" />
                Your feedback goes directly to the manager
              </div>
              <p className="mt-3 text-sm text-amber-800">
                When you submit feedback, it is reviewed by your training coordinator to improve session quality and address any issues.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                <BellRing className="h-4 w-4" />
                Reminders keep you on track
              </div>
              <p className="mt-3 text-sm text-blue-800">
                Whenever your trainer or coordinator sends a reminder, it will appear in the reminders section above so you never miss an update.
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/employee/quizzes">Go to my assessments</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
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

function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-center text-zinc-500 ${compact ? 'p-4 text-sm' : 'p-8 text-sm'}`}>
      <MessageSquareText className="mx-auto mb-3 h-5 w-5 opacity-50" />
      <p>{text}</p>
    </div>
  )
}
