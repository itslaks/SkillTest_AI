import { getEmployeeTrainingData, submitTrainingFeedback } from '@/lib/actions/training'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardSignalShowcase } from '@/components/insights/dashboard-signal-showcase'
import {
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
    quizzes,
  } = await getEmployeeTrainingData()

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-zinc-900 bg-black p-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.45)] md:p-8 dashboard-grid-bg">
        <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Training Command Center</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Sessions, attendance, reminders, and trainer communication in one place</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
              This view makes the operational layer visible for learners too, not just managers. You can now see your batch, upcoming sessions, attendance health, reminders, and submit structured feedback.
            </p>
          </div>
          <div className="space-y-4">
            <DashboardSignalShowcase
              theme="dark"
              badge="Learner Ops Layer"
              title="Utility views feel connected to the product system."
              subtitle="Daily training surfaces stay clear, consistent, and presentation-ready."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <StatTile icon={Users} label="My batches" value={`${memberships.length}`} />
              <StatTile icon={CalendarDays} label="Upcoming sessions" value={`${sessions.filter((session: any) => session.status === 'scheduled').length}`} />
              <StatTile icon={ClipboardCheck} label="Attendance health" value={`${attendanceRate}%`} />
              <StatTile icon={BellRing} label="Unread-style signals" value={`${notifications.length}`} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-zinc-200 shadow-sm spotlight-card">
          <CardHeader>
            <CardTitle>Current Batch & Schedule</CardTitle>
            <CardDescription>Your training lifecycle is now visible from the learner side as well.</CardDescription>
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
                {nextSession ? `${new Date(nextSession.session_date).toLocaleString()} - ${nextSession.mode} - ${nextSession.trainer?.full_name || nextSession.trainer?.email || 'Trainer TBD'}` : 'Your next session details will appear here as soon as your trainer schedules one.'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm spotlight-card">
          <CardHeader>
            <CardTitle>Attendance & Communication</CardTitle>
            <CardDescription>Operational reminders now reach the learner interface too.</CardDescription>
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
            <CardDescription>Feedback is now part of the operational flow, not an afterthought.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={submitTrainingFeedbackAction} className="grid gap-4">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Batch</span>
                <select name="batch_id" className="h-11 rounded-xl border border-zinc-200 px-3">
                  <option value="">Optional</option>
                  {memberships.map((membership: any) => (
                    <option key={membership.batch_id} value={membership.batch_id}>
                      {membership.batch?.title}
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
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm spotlight-card">
          <CardHeader>
            <CardTitle>Why This Matters</CardTitle>
            <CardDescription>This screen keeps training operations connected with assessments from end to end.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <ShieldCheck className="h-4 w-4" />
                Operational clarity
              </div>
              <p className="mt-3 text-sm text-emerald-800">
                Learners can now see batch ownership, session cadence, reminders, and attendance signals instead of interacting with isolated assessments only.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <MessageSquareText className="h-4 w-4" />
                Closed-loop feedback
              </div>
              <p className="mt-3 text-sm text-amber-800">
                Every session can now feed sentiment and action items back to the manager operations console so continuous improvement is part of the platform.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                <BellRing className="h-4 w-4" />
                Actionable reminders
              </div>
              <p className="mt-3 text-sm text-blue-800">
                Communication is surfaced inside the application so trainers and learners stay aligned around sessions, attendance, and assessments.
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/employee/quizzes">Continue to linked assessments</Link>
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
