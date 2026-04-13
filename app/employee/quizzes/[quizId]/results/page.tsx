import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getQuizLeaderboard } from '@/lib/actions/employee'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  Trophy, Clock, Crown, ArrowLeft,
} from 'lucide-react'
import { FeedbackRequiredExit } from '@/components/quiz/feedback-required-exit'

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
    <div className="max-w-4xl mx-auto space-y-8 py-8 px-4">
      {/* Results Hero */}
      <Card className="overflow-hidden shadow-2xl border-none ring-1 ring-foreground/5">
        <div className={`p-12 text-center ${isPassing
          ? 'bg-gradient-to-br from-green-500/20 via-emerald-500/10 to-transparent'
          : 'bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent'
        }`}>
          <div className="mb-6">
            {isPassing ? (
              <Trophy className="h-20 w-20 text-green-500 mx-auto animate-bounce" />
            ) : (
              < Crown className="h-20 w-20 text-amber-500 mx-auto" />
            )}
          </div>
          <h1 className="text-5xl font-display font-bold mb-3 tracking-tight">
            {isPassing ? 'Congratulations! 🎉' : 'Good Effort! 💪'}
          </h1>
          <p className="text-xl text-muted-foreground font-medium">{quiz?.title}</p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12 max-w-2xl mx-auto">
            <div className="p-6 rounded-2xl bg-background/50 backdrop-blur-sm border shadow-sm">
              <p className={`text-4xl font-display font-bold ${isPassing ? 'text-green-600' : 'text-amber-600'}`}>{attempt.score}%</p>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-2">Score</p>
            </div>
            <div className="p-6 rounded-2xl bg-background/50 backdrop-blur-sm border shadow-sm">
              <p className="text-4xl font-display font-bold">{attempt.correct_answers}/{attempt.total_questions}</p>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-2">Correct</p>
            </div>
            <div className="p-6 rounded-2xl bg-background/50 backdrop-blur-sm border shadow-sm">
              <p className="text-4xl font-display font-bold">{formatTime(attempt.time_taken_seconds)}</p>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-2">Time</p>
            </div>
            <div className="p-6 rounded-2xl bg-background/50 backdrop-blur-sm border shadow-sm">
              <p className="text-4xl font-display font-bold">+{attempt.points_earned}</p>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-2">Points</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Leaderboard */}
      <Card className="shadow-xl ring-1 ring-foreground/5 border-none overflow-hidden">
        <CardHeader className="bg-muted/30 pb-8">
          <CardTitle className="flex items-center gap-3 text-2xl font-display">
            <div className="p-2 rounded-lg bg-yellow-400/10">
              <Crown className="h-6 w-6 text-yellow-500" />
            </div>
            Quiz Leaderboard
          </CardTitle>
          <CardDescription className="text-base pt-1">
            Your rank: <span className="font-bold text-foreground">#{userRank}</span> out of {totalParticipants} participants
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {leaderboard?.slice(0, Math.max(totalParticipants, 2550)).map((entry) => (
              <div
                key={entry.user_id}
                className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-300 ${
                  entry.user_id === user.id 
                    ? 'bg-primary/5 border-primary/40 shadow-inner scale-[1.01]' 
                    : 'border-transparent hover:border-foreground/5 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-sm ${
                    entry.rank === 1 ? 'bg-yellow-400 text-yellow-900 border-2 border-yellow-200 shadow-yellow-200/50'
                    : entry.rank === 2 ? 'bg-gray-200 text-gray-700 border-2 border-gray-100 shadow-gray-200/50'
                    : entry.rank === 3 ? 'bg-amber-100 text-amber-700 border-2 border-amber-50 shadow-amber-200/50'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                    {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                  </div>
                  <div>
                    <p className="font-bold text-lg leading-none mb-2">
                      {entry.full_name}
                      {entry.user_id === user.id && (
                        <Badge variant="default" className="ml-2 text-[10px] h-5 px-2 bg-primary text-primary-foreground font-bold">YOU</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">{entry.department || 'Employee'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="font-display font-bold text-2xl leading-none">{entry.score}%</p>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-1">Score</p>
                  </div>
                  <div className="text-right hidden sm:block border-l pl-8 border-foreground/5 h-10 flex flex-col justify-center">
                    <p className="font-bold text-base flex items-center gap-2 justify-end">
                      <Clock className="h-4 w-4 text-primary" />
                      {formatTime(entry.time_taken_seconds)}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-1">Time</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mandatory Feedback & Exit */}
      <FeedbackRequiredExit 
        feedbackUrl={quiz?.feedback_form_url} 
        backHref="/employee/quizzes" 
      />
    </div>
  )
}
