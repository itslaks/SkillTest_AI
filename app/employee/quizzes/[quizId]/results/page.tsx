import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getQuizLeaderboard } from '@/lib/actions/employee'
import { analyzeAttemptPattern, buildRetentionChecks, getTopicAttempts } from '@/lib/insights'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FeedbackRequiredExit } from '@/components/quiz/feedback-required-exit'
import {
  Brain,
  Clock,
  Crown,
  Gauge,
  Snowflake,
  Trophy,
} from 'lucide-react'

export default async function QuizResultsPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: attempt } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('user_id', user.id)
    .single()

  if (!attempt || attempt.status !== 'completed') {
    redirect(`/employee/quizzes/${quizId}`)
  }

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single()

  const { data: history } = await supabase
    .from('quiz_attempts')
    .select('quiz_id, score, answers, completed_at, quizzes:quiz_id(id, topic, difficulty, created_by)')
    .eq('user_id', user.id)
    .eq('status', 'completed')

  const { data: leaderboard } = await getQuizLeaderboard(quizId)
  const userRank = leaderboard?.find((entry) => entry.user_id === user.id)?.rank || 0
  const totalParticipants = leaderboard?.length || 0
  const isPassing = attempt.score >= (quiz?.passing_score || 60)
  const topicAttempts = getTopicAttempts(history || [], quiz?.topic)
  const behavior = analyzeAttemptPattern(attempt.answers || [], quiz?.difficulty, topicAttempts)
  const retentionCheck = buildRetentionChecks(topicAttempts).find((item) => item.topic.toLowerCase() === (quiz?.topic || '').toLowerCase())

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const remainder = seconds % 60
    return `${minutes}m ${remainder}s`
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <Card className="overflow-hidden border-zinc-900 bg-black text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
        <div className="grid gap-6 p-8 md:grid-cols-[1.1fr_0.9fr] md:p-10">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-[0.35em] text-zinc-400">
              <Gauge className="h-3.5 w-3.5" />
              Adaptive attempt report
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">
              {isPassing ? 'Mission Cleared' : 'Progress Logged'}
            </h1>
            <p className="mt-3 text-zinc-400">{quiz?.title}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ResultMetric label="Score" value={`${attempt.score}%`} />
              <ResultMetric label="Correct" value={`${attempt.correct_answers}/${attempt.total_questions}`} />
              <ResultMetric label="Time" value={formatTime(attempt.time_taken_seconds)} />
              <ResultMetric label="Points" value={`+${attempt.points_earned}`} />
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Brain className="h-4 w-4" />
              Behavioral AI summary
            </div>
            <div className="mt-4 space-y-3 text-sm text-zinc-300">
              <InsightRow
                title="Cognitive load detector"
                value={behavior.cognitiveLoadDetected ? 'Triggered' : 'Stable'}
                body={`Easy-question hesitation count: ${behavior.easyQuestionOverloadCount}`}
              />
              <InsightRow
                title="Emotional state inference"
                value={behavior.panicModeDetected ? 'Panic mode' : 'Composed'}
                body={`Fast wrong streak: ${behavior.panicStreak}`}
              />
              <InsightRow
                title="Next recommended difficulty"
                value={behavior.suggestedNextDifficulty}
                body={behavior.masterySignal}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="border-zinc-200 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <Crown className="h-6 w-6" />
              Quiz leaderboard
            </CardTitle>
            <CardDescription>
              Your rank: <span className="font-semibold text-black">#{userRank}</span> out of {totalParticipants}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {leaderboard?.slice(0, 15).map((entry) => (
              <div
                key={entry.user_id}
                className={`flex items-center justify-between rounded-[1.5rem] border p-4 ${
                  entry.user_id === user.id ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-black'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ${
                    entry.user_id === user.id ? 'bg-white text-black' : 'bg-black text-white'
                  }`}>
                    {entry.rank}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {entry.full_name}
                      {entry.user_id === user.id && (
                        <Badge className="ml-2 bg-white text-black">YOU</Badge>
                      )}
                    </p>
                    <p className={`text-xs ${entry.user_id === user.id ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {entry.department || 'Employee'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold">{entry.score}%</p>
                  <p className={`text-xs ${entry.user_id === user.id ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {formatTime(entry.time_taken_seconds)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-zinc-900 bg-black text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Snowflake className="h-4 w-4" />
                Readiness feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-300">
              <p>{behavior.masterySignal}</p>
              <p>Average answer time: {behavior.averageAnswerTime}s</p>
              {behavior.antiGamingDetected && (
                <p>A challenge variant is recommended for the next {quiz?.topic} attempt.</p>
              )}
            </CardContent>
          </Card>

          {retentionCheck && (
            <Card className="border-zinc-200 bg-zinc-50">
              <CardHeader>
                <CardTitle className="text-lg">Knowledge decay tracker</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-zinc-600">
                <p>{retentionCheck.topic}</p>
                <p>{retentionCheck.daysSinceLastAssessment} day(s) since the last assessment.</p>
                <p>Baseline {retentionCheck.baselineScore}% vs latest {retentionCheck.latestScore}%.</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-zinc-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-4 w-4" />
                Next action
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-600">
              Review the explanation, cool down if pressure spiked, and check the leaderboard before your next attempt.
            </CardContent>
          </Card>
        </div>
      </div>

      <FeedbackRequiredExit feedbackUrl={quiz?.feedback_form_url} backHref="/employee/quizzes" />
    </div>
  )
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
      <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  )
}

function InsightRow({
  title,
  value,
  body,
}: {
  title: string
  value: string
  body: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-white">{title}</p>
        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-black">
          {value}
        </span>
      </div>
      <p className="mt-2 text-zinc-400">{body}</p>
    </div>
  )
}
