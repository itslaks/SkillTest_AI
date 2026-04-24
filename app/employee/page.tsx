import { getEmployeeStats, getAvailableQuizzes } from '@/lib/actions/employee'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ReadinessMeter } from '@/components/insights/readiness-meter'
import { MonochromeOrb } from '@/components/insights/monochrome-orb'
import Link from 'next/link'
import {
  ArrowRight,
  Award,
  Brain,
  FileQuestion,
  Flame,
  ShieldAlert,
  Star,
  Trophy,
} from 'lucide-react'

export default async function EmployeeDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user?.id)
    .single()

  const fullName = profile?.full_name || user?.user_metadata?.full_name || null
  const { data: stats } = await getEmployeeStats()
  const { data: quizzes } = await getAvailableQuizzes()

  const openQuizzes = quizzes?.filter((quiz: any) => quiz.attemptStatus !== 'completed') || []
  const nextQuiz = openQuizzes[0]
  const retentionRisk = stats?.retentionChecks?.find((item: any) => item.daysSinceLastAssessment >= 14)

  const statCards = [
    { title: 'Points', value: stats?.stats?.total_points || 0, icon: Star },
    { title: 'Streak', value: stats?.stats?.current_streak || 0, icon: Flame },
    { title: 'Completed', value: stats?.stats?.tests_completed || 0, icon: Trophy },
    { title: 'Badges', value: stats?.badges?.length || 0, icon: Award },
  ]

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-zinc-900 bg-black p-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.5)] md:p-8">
        <div className="absolute right-4 top-4 hidden md:block">
          <MonochromeOrb />
        </div>
        <div className="relative z-10 grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Employee Intelligence Console</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              Welcome back, {fullName?.split(' ')[0] || 'there'}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Your dashboard now forecasts readiness, tracks knowledge decay, and adapts every assessment around how you respond.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statCards.map((card) => (
                <div key={card.title} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{card.title}</p>
                    <card.icon className="h-4 w-4 text-white" />
                  </div>
                  <p className="mt-4 text-3xl font-semibold">{card.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {nextQuiz?.readiness ? <ReadinessMeter readiness={nextQuiz.readiness} className="bg-white text-black" /> : null}
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Brain className="h-4 w-4" />
                Next best move
              </div>
              <p className="mt-3 text-lg font-medium text-white">{nextQuiz ? nextQuiz.title : 'No active assignment'}</p>
              <p className="mt-2 text-sm text-zinc-400">
                {nextQuiz ? nextQuiz.readiness?.recommendation : 'Your manager has not assigned a quiz yet.'}
              </p>
              <Button className="mt-5 rounded-full bg-white text-black hover:bg-zinc-200" asChild>
                <Link href={nextQuiz ? `/employee/quizzes/${nextQuiz.id}` : '/employee/badges'}>
                  {nextQuiz ? 'Open quiz' : 'View badges'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: 'Blue means guidance', body: 'Helpful prompts and next-step suggestions.', tone: 'bg-blue-50 border-blue-100 text-blue-800' },
              { title: 'Green means healthy', body: 'Good readiness, completed work, or safe learning rhythm.', tone: 'bg-emerald-50 border-emerald-100 text-emerald-800' },
              { title: 'Amber means review', body: 'Revision, retention checks, or low-confidence areas.', tone: 'bg-amber-50 border-amber-100 text-amber-800' },
            ].map((item) => (
              <div key={item.title} className={`rounded-[1.5rem] border p-4 ${item.tone}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em]">Quick Hint</p>
                <p className="mt-2 font-semibold">{item.title}</p>
                <p className="mt-1 text-sm opacity-80">{item.body}</p>
              </div>
            ))}
          </div>

          {openQuizzes.slice(0, 3).map((quiz: any) => (
            <div key={quiz.id} className="grid gap-4 rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] ${
                    quiz.attemptStatus === 'in_progress' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                  }`}>
                    {quiz.attemptStatus === 'in_progress' ? 'In progress' : 'Queued'}
                  </span>
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-700">
                    {quiz.topic}
                  </span>
                  {quiz.challengeMode && (
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-rose-700">
                      Challenge
                    </span>
                  )}
                  {quiz.retentionCheck?.daysSinceLastAssessment >= 14 && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-700">
                      Retention due
                    </span>
                  )}
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-black">{quiz.title}</h2>
                <p className="mt-2 text-sm text-zinc-500">{quiz.description || quiz.topic}</p>
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                  {quiz.readiness?.recommendation || 'This quiz is ready for you.'}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button className="rounded-full bg-black text-white hover:bg-zinc-800" asChild>
                    <Link href={`/employee/quizzes/${quiz.id}`}>
                      <FileQuestion className="mr-2 h-4 w-4" />
                      {quiz.attemptStatus === 'in_progress' ? 'Continue' : 'Start'}
                    </Link>
                  </Button>
                  <Button variant="outline" className="rounded-full" asChild>
                    <Link href="/employee/quizzes">See all quizzes</Link>
                  </Button>
                </div>
              </div>
              {quiz.readiness ? <ReadinessMeter readiness={quiz.readiness} compact /> : null}
            </div>
          ))}
        </section>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-blue-100 bg-blue-50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
              <Brain className="h-4 w-4" />
              How to use this app
            </div>
            <div className="mt-4 space-y-2 text-sm text-blue-800">
              <p>1. Open the top recommended quiz first.</p>
              <p>2. Watch your readiness meter before starting.</p>
              <p>3. If cooldown appears mid-quiz, slow down and reset.</p>
              <p>4. Revisit results to improve your next attempt.</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-black">
              <ShieldAlert className="h-4 w-4" />
              Knowledge decay tracker
            </div>
            {retentionRisk ? (
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p className="font-medium text-black">{retentionRisk.topic}</p>
                <p>{retentionRisk.daysSinceLastAssessment} days since the last assessment.</p>
                <p>Baseline {retentionRisk.baselineScore}% vs latest {retentionRisk.latestScore}%.</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">No retention risk has crossed the two-week threshold.</p>
            )}
          </div>

          <div className="rounded-[2rem] border border-zinc-900 bg-black p-5 text-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <p className="text-sm font-semibold">Behavioral AI is active</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              During each quiz, SkillTest now measures hesitation, panic patterns, and adaptive difficulty shifts in real time.
            </p>
            <Button variant="outline" className="mt-5 rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10" asChild>
              <Link href="/employee/quizzes">
                Explore quiz deck
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
