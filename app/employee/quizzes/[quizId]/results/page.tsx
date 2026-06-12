import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getQuizLeaderboard } from '@/lib/actions/employee'
import { analyzeAttemptPattern, buildRetentionChecks, getTopicAttempts } from '@/lib/insights'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FeedbackRequiredExit } from '@/components/quiz/feedback-required-exit'
import { AvatarView } from '@/components/avatar/avatar-view'
import {
  Award,
  Brain,
  Clock,
  Crown,
  Gauge,
  Radar,
  ShieldAlert,
  Snowflake,
  Target,
} from 'lucide-react'

export default async function QuizResultsPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: attempt } = await supabase
    .from('quiz_attempts')
    .select('id, quiz_id, user_id, answers, score, total_questions, correct_answers, time_taken_seconds, points_earned, status, auto_submitted, proctoring_status, proctoring_violations_count, proctoring_risk_level, review_status, completed_at')
    .eq('quiz_id', quizId)
    .eq('user_id', user.id)
    .in('status', ['completed', 'suspicious'])
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!attempt) {
    redirect(`/employee/quizzes/${quizId}`)
  }

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*, questions(*)')
    .eq('id', quizId)
    .maybeSingle()

  if (!quiz) {
    redirect('/employee/quizzes')
  }

  const { data: history } = await supabase
    .from('quiz_attempts')
    .select('quiz_id, score, answers, completed_at, quizzes:quiz_id(id, topic, difficulty, created_by)')
    .eq('user_id', user.id)
    .eq('status', 'completed')

  const { data: certificate } = await supabase
    .from('certificates')
    .select('id, cert_number, issued_at')
    .eq('quiz_id', quizId)
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: leaderboard } = await getQuizLeaderboard(quizId)
  const userRank = leaderboard?.find((entry) => entry.user_id === user.id)?.rank || 0
  const totalParticipants = leaderboard?.length || 0
  const isPassing = attempt.score >= (quiz.passing_score || 60)
  const topicAttempts = getTopicAttempts(history || [], quiz.topic)
  const behavior = analyzeAttemptPattern(attempt.answers || [], quiz.difficulty, topicAttempts)
  const retentionCheck = buildRetentionChecks(topicAttempts).find((item) => item.topic.toLowerCase() === (quiz.topic || '').toLowerCase())
  const questionMap = new Map<string, any>((quiz.questions || []).map((question: any) => [question.id, question]))
  const isUnderReview = attempt.status === 'suspicious' || attempt.proctoring_status === 'suspicious'

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const remainder = seconds % 60
    return `${minutes}m ${remainder}s`
  }

  if (isUnderReview) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-4 py-10">
        <Card className="overflow-hidden border-amber-200 bg-amber-50 shadow-[0_30px_90px_rgba(146,64,14,0.18)]">
          <CardContent className="p-8 text-center md:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-600 text-white">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-3xl font-semibold text-amber-950">Your assessment is under review.</h1>
            <p className="mt-4 text-sm leading-6 text-amber-800">
              This attempt was flagged by integrity monitoring. Your final score, certificate, badges, and completion email are paused until an authorized reviewer clears the attempt.
            </p>
            <div className="mt-6 rounded-2xl border border-amber-200 bg-white/70 p-4 text-left text-sm text-amber-900">
              <p><strong>Quiz:</strong> {quiz.title || 'Assessment'}</p>
              <p><strong>Warnings:</strong> {attempt.proctoring_violations_count || 0}</p>
              <p><strong>Risk:</strong> {String(attempt.proctoring_risk_level || 'pending review')}</p>
              <p><strong>Review status:</strong> {String(attempt.review_status || 'pending').replace(/_/g, ' ')}</p>
            </div>
            <FeedbackRequiredExit feedbackUrl={quiz.feedback_form_url} backHref="/employee/quizzes" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <a href="/employee/quizzes" className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
          ← My Quizzes
        </a>
        {certificate && (
          <a href={`/certificates/${certificate.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors">
            <Award className="h-4 w-4" /> View Certificate
          </a>
        )}
      </div>
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
            <p className="mt-3 text-zinc-400">{quiz.title}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ResultMetric label="Score" value={`${attempt.score}%`} />
              <ResultMetric label="Correct" value={`${attempt.correct_answers}/${attempt.total_questions}`} />
              <ResultMetric label="Time" value={formatTime(attempt.time_taken_seconds)} />
              <ResultMetric label="Points" value={`+${attempt.points_earned}`} />
            </div>
            {attempt.proctoring_status === 'flagged' && (
              <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
                Assessment status: {attempt.auto_submitted ? 'Auto submitted' : 'Flagged for review'}.
                Review state: {String(attempt.review_status || 'pending').replace(/_/g, ' ')}.
              </div>
            )}
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
                title="Focus confidence"
                value={`${behavior.focusScore}/${behavior.confidenceScore}`}
                body={`Risk level: ${behavior.riskLevel}. Variance score: ${behavior.timeVariance}`}
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
                  <AvatarView
                    src={entry.avatar_url}
                    alt={`${entry.full_name || 'Employee'} avatar`}
                    size={44}
                    className="h-11 w-11 rounded-2xl border border-white object-cover shadow-sm"
                  />
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

        <Card className="border-zinc-200 bg-white">
          <CardHeader>
            <CardTitle className="text-2xl">Answer review</CardTitle>
            <CardDescription>Correct answers and explanations are available only after submission.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(attempt.answers || []).map((answer: any, index: number) => {
              const question = questionMap.get(answer.questionId)
              const options = Array.isArray(question?.options) ? question.options : []
              const selected = options[answer.selectedOption]
              const correctIndex = options.findIndex((option: any) => option.isCorrect)
              const correct = options[correctIndex]

              return (
                <div key={`${answer.questionId}-${index}`} className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Badge variant="outline" className="rounded-full border-zinc-300">Question {index + 1}</Badge>
                    <Badge className={answer.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                      {answer.isCorrect ? 'Correct' : 'Incorrect'}
                    </Badge>
                  </div>
                  <p className="mt-4 font-semibold text-zinc-950">{question?.question_text || 'Question unavailable'}</p>
                  <div className="mt-4 grid gap-2 text-sm">
                    <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                      <span className="font-semibold text-zinc-900">Your answer:</span> {selected?.text || 'Not answered'}
                    </p>
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950">
                      <span className="font-semibold">Correct answer:</span> {correct?.text || 'Not configured'}
                    </p>
                    {question?.explanation && (
                      <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950">
                        <span className="font-semibold">Explanation:</span> {question.explanation}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {certificate && (
            <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <Award className="h-5 w-5 text-amber-600" />
                  Certificate Earned
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-amber-800">
                  You earned a certificate for completing this assessment. Certificate No: <strong>{certificate.cert_number}</strong>
                </p>
                <p className="text-xs text-amber-700">
                  Issued on {new Date(certificate.issued_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                <a
                  href={`/certificates/${certificate.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
                >
                  <Award className="h-4 w-4" />
                  View &amp; Download Certificate
                </a>
              </CardContent>
            </Card>
          )}

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
                <p>A challenge variant is recommended for the next {quiz.topic} attempt.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Radar className="h-4 w-4" />
                Behavioral signal board
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <BehaviorMetric label="Focus" value={`${behavior.focusScore}%`} />
              <BehaviorMetric label="Confidence" value={`${behavior.confidenceScore}%`} />
              <BehaviorMetric label="Fast guesses" value={`${behavior.fastGuessCount}`} />
              <BehaviorMetric label="Slow struggles" value={`${behavior.slowStruggleCount}`} />
              {behavior.behaviorTags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {behavior.behaviorTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="rounded-full border-zinc-300 capitalize">
                      {tag.replace(/-/g, ' ')}
                    </Badge>
                  ))}
                </div>
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

      <FeedbackRequiredExit feedbackUrl={quiz.feedback_form_url} backHref="/employee/quizzes" />
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

function BehaviorMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[1.25rem] border border-zinc-200 bg-zinc-50 px-4 py-3">
      <span className="flex items-center gap-2 font-medium text-zinc-700">
        <Target className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="font-semibold text-black">{value}</span>
    </div>
  )
}
