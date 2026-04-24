import { getAvailableQuizzes } from '@/lib/actions/employee'
import { Button } from '@/components/ui/button'
import { ReadinessMeter } from '@/components/insights/readiness-meter'
import Link from 'next/link'
import { Brain, Clock, FileQuestion, Play, ShieldAlert, Trophy } from 'lucide-react'

export default async function EmployeeQuizzesPage() {
  const { data: quizzes } = await getAvailableQuizzes()

  const available = quizzes?.filter((quiz: any) => !quiz.attemptStatus) || []
  const inProgress = quizzes?.filter((quiz: any) => quiz.attemptStatus === 'in_progress') || []
  const completed = quizzes?.filter((quiz: any) => quiz.attemptStatus === 'completed') || []

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-zinc-900 bg-black p-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.5)] md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">SkillTest Queue</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Adaptive quiz deck</h1>
            <p className="mt-3 max-w-2xl text-sm text-zinc-400">
              Every assignment now carries a readiness forecast, retention pressure, and anti-gaming intelligence before you launch.
            </p>
          </div>
          <Button variant="outline" className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10" asChild>
            <Link href="/employee/leaderboard">
              <Trophy className="mr-2 h-4 w-4" />
              Live leaderboard
            </Link>
          </Button>
        </div>
      </section>

      {inProgress.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-black" />
            In progress
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            {inProgress.map((quiz: any) => <QuizCard key={quiz.id} quiz={quiz} status="in_progress" />)}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
          <Brain className="h-4 w-4" />
          Available
        </div>
        {available.length > 0 ? (
          <div className="grid gap-5 xl:grid-cols-2">
            {available.map((quiz: any) => <QuizCard key={quiz.id} quiz={quiz} status="available" />)}
          </div>
        ) : (
          <div className="rounded-[2rem] border border-zinc-200 bg-white py-14 text-center">
            <FileQuestion className="mx-auto mb-3 h-14 w-14 text-zinc-300" />
            <h3 className="font-semibold">No quizzes available</h3>
            <p className="mt-1 text-sm text-zinc-500">Check back later for fresh adaptive assessments.</p>
          </div>
        )}
      </section>

      {completed.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
            <ShieldAlert className="h-4 w-4" />
            Completed
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            {completed.map((quiz: any) => <QuizCard key={quiz.id} quiz={quiz} status="completed" />)}
          </div>
        </section>
      )}
    </div>
  )
}

function QuizCard({ quiz, status }: { quiz: any; status: string }) {
  const ctaHref = status === 'completed' ? `/employee/quizzes/${quiz.id}/results` : `/employee/quizzes/${quiz.id}`

  return (
    <div className="grid gap-4 rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white">
            {status === 'in_progress' ? 'Live' : status === 'completed' ? 'Closed' : 'Queued'}
          </span>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-600">
            {quiz.difficulty}
          </span>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-600">
            {quiz.topic}
          </span>
          {quiz.challengeMode && (
            <span className="rounded-full bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white">
              Challenge
            </span>
          )}
          {quiz.retentionCheck?.daysSinceLastAssessment >= 14 && (
            <span className="rounded-full bg-zinc-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-900">
              Retention due
            </span>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold text-black">{quiz.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">{quiz.description || quiz.topic}</p>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-sm text-zinc-500">
          <span className="flex items-center gap-2"><FileQuestion className="h-4 w-4" />{quiz.questions?.[0]?.count || quiz.question_count} questions</span>
          <span className="flex items-center gap-2"><Clock className="h-4 w-4" />{quiz.time_limit_minutes} min</span>
        </div>

        <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          {quiz.retentionCheck?.daysSinceLastAssessment >= 14
            ? `Knowledge decay check: ${quiz.retentionCheck.daysSinceLastAssessment} days since last ${quiz.topic} assessment.`
            : quiz.challengeMode
              ? 'Anti-gaming pattern detected earlier. This run will bias harder questions.'
              : quiz.readiness?.recommendation}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button className="rounded-full bg-black px-5 text-white hover:bg-zinc-800" asChild>
            <Link href={ctaHref}>
              <Play className="mr-2 h-4 w-4" />
              {status === 'completed' ? 'Open results' : status === 'in_progress' ? 'Continue quiz' : 'Start quiz'}
            </Link>
          </Button>
          {status === 'completed' && (
            <Button variant="outline" className="rounded-full" asChild>
              <Link href={`/employee/quizzes/${quiz.id}/leaderboard`}>
                <Trophy className="mr-2 h-4 w-4" />
                Ranking
              </Link>
            </Button>
          )}
        </div>
      </div>

      {quiz.readiness ? <ReadinessMeter readiness={quiz.readiness} /> : null}
    </div>
  )
}
