import { getEmployeeStats, getAvailableQuizzes } from '@/lib/actions/employee'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ReadinessMeter } from '@/components/insights/readiness-meter'
import Link from 'next/link'
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CalendarDays,
  FileQuestion,
  Flame,
  ShieldAlert,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react'

export default async function EmployeeDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('full_name')
    .eq('id', user?.id)
    .single()

  const fullName = profile?.full_name || user?.user_metadata?.full_name || null
  const firstName = fullName?.split(' ')[0] || 'there'
  const { data: stats } = await getEmployeeStats()
  const { data: quizzes } = await getAvailableQuizzes()

  const openQuizzes = quizzes?.filter((quiz: any) => quiz.attemptStatus !== 'completed') || []
  const completedQuizzes = quizzes?.filter((quiz: any) => quiz.attemptStatus === 'completed') || []
  const nextQuiz = openQuizzes[0]
  const retentionRisk = stats?.retentionChecks?.find((item: any) => item.daysSinceLastAssessment >= 14)

  const statCards = [
    { title: 'Points', value: stats?.stats?.total_points || 0, icon: Star, tone: 'bg-blue-50 text-blue-700 border-blue-100' },
    { title: 'Streak', value: stats?.stats?.current_streak || 0, icon: Flame, tone: 'bg-amber-50 text-amber-700 border-amber-100' },
    { title: 'Completed', value: stats?.stats?.tests_completed || 0, icon: Trophy, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { title: 'Badges', value: stats?.badges?.length || 0, icon: Award, tone: 'bg-violet-50 text-violet-700 border-violet-100' },
  ]

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <section className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm">
        <div className="grid gap-0 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="relative min-w-0 bg-black p-6 text-white md:p-8 dashboard-grid-bg">
            <div className="absolute right-6 top-6 hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60 md:block">
              Learner Console
            </div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70">
              <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
              Today&apos;s focus
            </p>
            <h1 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-300 md:text-base">
              Keep your learning streak moving. Start with the next assigned quiz, check readiness, then use training notes when you need context.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button className="rounded-full bg-white text-black hover:bg-zinc-200" asChild>
                <Link href={nextQuiz ? `/employee/quizzes/${nextQuiz.id}` : '/employee/quizzes'}>
                  {nextQuiz ? 'Continue learning' : 'Browse quizzes'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10" asChild>
                <Link href="/employee/training">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Training hub
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 bg-zinc-50 p-5 md:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {statCards.map((card) => (
                <div key={card.title} className={`min-w-0 rounded-2xl border p-4 ${card.tone}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em]">{card.title}</p>
                    <card.icon className="h-4 w-4 shrink-0" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold leading-none">{card.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-black">Next best move</p>
                  <p className="mt-1 text-sm text-zinc-500">{nextQuiz ? nextQuiz.title : 'No active assignment'}</p>
                </div>
                <Button size="sm" className="rounded-full bg-black text-white hover:bg-zinc-800" asChild>
                  <Link href={nextQuiz ? `/employee/quizzes/${nextQuiz.id}` : '/employee/badges'}>
                    Open
                  </Link>
                </Button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                {nextQuiz ? nextQuiz.readiness?.recommendation || 'This quiz is ready for you.' : 'Your manager has not assigned a quiz yet.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="space-y-6">
          {nextQuiz?.readiness ? (
            <ReadinessMeter readiness={nextQuiz.readiness} className="border-zinc-200 bg-white text-black shadow-sm" />
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            {[
              { title: 'Guided next steps', body: 'Follow recommendations before you start an assessment.', tone: 'border-blue-100 bg-blue-50 text-blue-800' },
              { title: 'Healthy rhythm', body: 'Streak and readiness show whether your pace is sustainable.', tone: 'border-emerald-100 bg-emerald-50 text-emerald-800' },
              { title: 'Review signals', body: 'Amber alerts mean a topic needs revision before moving on.', tone: 'border-amber-100 bg-amber-50 text-amber-800' },
            ].map((item) => (
              <div key={item.title} className={`rounded-2xl border p-4 ${item.tone}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em]">Quick hint</p>
                <p className="mt-2 font-semibold">{item.title}</p>
                <p className="mt-1 text-sm opacity-80">{item.body}</p>
              </div>
            ))}
          </section>

          <section className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-black">Assigned quizzes</h2>
                <p className="mt-1 text-sm text-zinc-500">Prioritized by what still needs your attention.</p>
              </div>
              <Button variant="outline" className="rounded-full" asChild>
                <Link href="/employee/quizzes">View all</Link>
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              {openQuizzes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                  You are caught up. Completed quizzes and badges are still available from the sidebar.
                </div>
              ) : (
                openQuizzes.slice(0, 4).map((quiz: any) => (
                  <article key={quiz.id} className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                          quiz.attemptStatus === 'in_progress' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                        }`}>
                          {quiz.attemptStatus === 'in_progress' ? 'In progress' : 'Queued'}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                          {quiz.topic}
                        </span>
                        {quiz.retentionCheck?.daysSinceLastAssessment >= 14 ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                            Retention due
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-xl font-semibold text-black">{quiz.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-500">{quiz.description || quiz.topic}</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button className="rounded-full bg-black text-white hover:bg-zinc-800" asChild>
                          <Link href={`/employee/quizzes/${quiz.id}`}>
                            <FileQuestion className="mr-2 h-4 w-4" />
                            {quiz.attemptStatus === 'in_progress' ? 'Continue' : 'Start'}
                          </Link>
                        </Button>
                      </div>
                    </div>
                    {quiz.readiness ? <ReadinessMeter readiness={quiz.readiness} compact /> : null}
                  </article>
                ))
              )}
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <section className="rounded-[1.5rem] border border-blue-100 bg-blue-50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
              <CalendarDays className="h-4 w-4" />
              Training operations
            </div>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-blue-800">
              <p>Open training to see your batch, sessions, attendance, and reminders.</p>
              <p>Submit feedback after each session so the trainer can tune the next cycle.</p>
            </div>
            <Button variant="outline" className="mt-5 rounded-full border-blue-200 bg-white text-blue-900 hover:bg-blue-100" asChild>
              <Link href="/employee/training">Open training</Link>
            </Button>
          </section>

          <section className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-black">
              <ShieldAlert className="h-4 w-4" />
              Knowledge decay
            </div>
            {retentionRisk ? (
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p className="font-medium text-black">{retentionRisk.topic}</p>
                <p>{retentionRisk.daysSinceLastAssessment} days since the last assessment.</p>
                <p>Baseline {retentionRisk.baselineScore}% vs latest {retentionRisk.latestScore}%.</p>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-zinc-500">No retention risk has crossed the two-week threshold.</p>
            )}
          </section>

          <section className="rounded-[1.5rem] border border-zinc-900 bg-black p-5 text-white shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BookOpenCheck className="h-4 w-4" />
              Learning summary
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMetric label="Open" value={`${openQuizzes.length}`} />
              <MiniMetric label="Done" value={`${completedQuizzes.length}`} />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              SkillTest watches readiness, pace, and retention so each quiz feels like the right next step.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}
