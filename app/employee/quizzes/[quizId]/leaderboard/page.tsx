import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Trophy, Clock, Crown, ArrowLeft, Users, Medal, Target } from 'lucide-react'
import { getQuizLeaderboard } from '@/lib/actions/employee'

export default async function QuizLeaderboardPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Get quiz info
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single()

  if (!quiz) {
    notFound()
  }

  // Get leaderboard
  const { data: leaderboard } = await getQuizLeaderboard(quizId)

  // Find user's position
  const userEntry = leaderboard?.find(e => e.user_id === user.id)
  const userRank = userEntry?.rank || 0
  const totalParticipants = leaderboard?.length || 0

  // Calculate stats
  const avgScore = leaderboard && leaderboard.length > 0
    ? Math.round(leaderboard.reduce((a, b) => a + b.score, 0) / leaderboard.length)
    : 0

  const avgTime = leaderboard && leaderboard.length > 0
    ? Math.round(leaderboard.reduce((a, b) => a + b.time_taken_seconds, 0) / leaderboard.length)
    : 0

  const formatTime = (s: number) => {
    if (!s) return '-'
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}m ${sec}s`
  }

  const difficultyColors: Record<string, string> = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-blue-100 text-blue-700',
    hard: 'bg-amber-100 text-amber-700',
    advanced: 'bg-orange-100 text-orange-700',
    hardcore: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/employee/quizzes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Crown className="h-8 w-8 text-yellow-500" />
            {quiz.title} Leaderboard
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{quiz.topic}</span>
            <Badge variant="secondary" className={difficultyColors[quiz.difficulty]}>
              {quiz.difficulty}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-yellow-500/10 to-amber-600/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalParticipants}</p>
              <p className="text-xs text-muted-foreground">Participants</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-600/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgScore}%</p>
              <p className="text-xs text-muted-foreground">Average Score</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-600/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatTime(avgTime)}</p>
              <p className="text-xs text-muted-foreground">Avg Time</p>
            </div>
          </CardContent>
        </Card>
        {userRank > 0 && (
          <Card className="bg-gradient-to-br from-purple-500/10 to-violet-600/10 border-purple-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600">
                <Medal className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">#{userRank}</p>
                <p className="text-xs text-muted-foreground">Your Rank</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top 3 Podium */}
      {leaderboard && leaderboard.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {/* 2nd Place */}
          <div className="flex flex-col items-center pt-8">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl mb-2 ring-2 ring-gray-300">
              🥈
            </div>
            <p className="font-medium text-sm text-center truncate w-full">
              {leaderboard[1].full_name}
            </p>
            <p className="text-2xl font-bold text-gray-600">{leaderboard[1].score}%</p>
            <p className="text-xs text-muted-foreground">{formatTime(leaderboard[1].time_taken_seconds)}</p>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center text-3xl mb-2 ring-4 ring-yellow-400 shadow-lg">
              🥇
            </div>
            <p className="font-semibold text-center truncate w-full">
              {leaderboard[0].full_name}
            </p>
            <p className="text-3xl font-bold text-yellow-600">{leaderboard[0].score}%</p>
            <p className="text-xs text-muted-foreground">{formatTime(leaderboard[0].time_taken_seconds)}</p>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center pt-12">
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center text-xl mb-2 ring-2 ring-amber-400">
              🥉
            </div>
            <p className="font-medium text-sm text-center truncate w-full">
              {leaderboard[2].full_name}
            </p>
            <p className="text-xl font-bold text-amber-600">{leaderboard[2].score}%</p>
            <p className="text-xs text-muted-foreground">{formatTime(leaderboard[2].time_taken_seconds)}</p>
          </div>
        </div>
      )}

      {/* Full Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            All Rankings
          </CardTitle>
          <CardDescription>{totalParticipants} participants</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {leaderboard?.map((entry) => (
              <div
                key={entry.user_id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  entry.user_id === user.id 
                    ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' 
                    : 'hover:bg-muted/50'
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
                        <Badge variant="default" className="ml-2 text-[10px] px-1.5">YOU</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{entry.department || 'Employee'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <span className="font-bold">{entry.score}%</span>
                    <p className="text-xs text-muted-foreground">{entry.correct_answers}/{entry.total_questions}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(entry.time_taken_seconds)}
                    </span>
                  </div>
                  <Badge variant="secondary">{entry.points_earned} pts</Badge>
                </div>
              </div>
            ))}

            {(!leaderboard || leaderboard.length === 0) && (
              <div className="text-center py-12">
                <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Rankings Yet</h3>
                <p className="text-muted-foreground">
                  Be the first to complete this quiz!
                </p>
                <Button className="mt-4" asChild>
                  <Link href={`/employee/quizzes/${quizId}`}>
                    Take Quiz
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
