import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getQuizLeaderboard } from '@/lib/actions/employee'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  Trophy, Medal, Clock, Star, ArrowLeft, ExternalLink, CheckCircle2, XCircle, Crown,
} from 'lucide-react'

export default async function QuizResultsPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Get user's attempt
  const { data: attempt } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('user_id', user.id)
    .single()

  if (!attempt || attempt.status !== 'completed') {
    redirect(`/employee/quizzes/${quizId}`)
  }

  // Get quiz info
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single()

  // Get leaderboard
  const { data: leaderboard } = await getQuizLeaderboard(quizId)

  const userRank = leaderboard?.find(e => e.user_id === user.id)?.rank || 0
  const totalParticipants = leaderboard?.length || 0
  const isPassing = attempt.score >= (quiz?.passing_score || 60)

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}m ${sec}s`
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/employee/quizzes">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quizzes
        </Link>
      </Button>

      {/* Results Hero */}
      <Card className="overflow-hidden">
        <div className={`p-8 text-center ${isPassing
          ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/5'
          : 'bg-gradient-to-br from-amber-500/10 to-orange-500/5'
        }`}>
          <div className="mb-4">
            {isPassing ? (
              <Trophy className="h-16 w-16 text-green-500 mx-auto animate-bounce" />
            ) : (
              <Star className="h-16 w-16 text-amber-500 mx-auto" />
            )}
          </div>
          <h1 className="text-3xl font-bold mb-1">
            {isPassing ? 'Congratulations! 🎉' : 'Good Effort! 💪'}
          </h1>
          <p className="text-muted-foreground">{quiz?.title}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 max-w-xl mx-auto">
            <div className="p-4 rounded-lg bg-background border">
              <p className={`text-3xl font-bold ${isPassing ? 'text-green-600' : 'text-amber-600'}`}>{attempt.score}%</p>
              <p className="text-xs text-muted-foreground">Score</p>
            </div>
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-3xl font-bold">{attempt.correct_answers}/{attempt.total_questions}</p>
              <p className="text-xs text-muted-foreground">Correct</p>
            </div>
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-3xl font-bold">{formatTime(attempt.time_taken_seconds)}</p>
              <p className="text-xs text-muted-foreground">Time Taken</p>
            </div>
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-3xl font-bold">+{attempt.points_earned}</p>
              <p className="text-xs text-muted-foreground">Points</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Feedback Form Link */}
      {quiz?.feedback_form_url && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">Share Your Feedback</h3>
              <p className="text-sm text-muted-foreground">Help us improve this assessment</p>
            </div>
            <Button asChild>
              <a href={quiz.feedback_form_url} target="_blank" rel="noopener noreferrer">
                Open Feedback Form
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Leaderboard
          </CardTitle>
          <CardDescription>
            Your rank: #{userRank} out of {totalParticipants} participants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {leaderboard?.slice(0, Math.max(totalParticipants, 10)).map((entry) => (
              <div
                key={entry.user_id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  entry.user_id === user.id ? 'bg-primary/5 border-primary/30' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    entry.rank === 1 ? 'bg-yellow-100 text-yellow-700'
                    : entry.rank === 2 ? 'bg-gray-100 text-gray-700'
                    : entry.rank === 3 ? 'bg-amber-100 text-amber-700'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                    {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {entry.full_name}
                      {entry.user_id === user.id && (
                        <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">You</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{entry.department || 'No department'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <span className="font-semibold">{entry.score}%</span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(entry.time_taken_seconds)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button variant="outline" asChild>
          <Link href="/employee/quizzes">Back to All Quizzes</Link>
        </Button>
      </div>
    </div>
  )
}
