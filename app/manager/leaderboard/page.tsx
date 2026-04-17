import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { 
  Trophy, Medal, Crown, Users, TrendingUp, Clock, 
  Download, ArrowLeft, BarChart3, Target 
} from 'lucide-react'

export default async function ManagerLeaderboardPage() {
  const { userId } = await requireManager()

  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Get all quizzes created by manager
  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, title, topic, difficulty')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })

  // Get global leaderboard (cumulative across all manager's quizzes)
  const { data: globalLeaderboard } = await adminClient
    .from('quiz_attempts')
    .select(`
      user_id,
      score,
      correct_answers,
      total_questions,
      time_taken_seconds,
      points_earned,
      quizzes!inner(created_by),
      profiles:user_id(full_name, email, employee_id, department, avatar_url)
    `)
    .eq('quizzes.created_by', userId)
    .eq('status', 'completed')
    .order('points_earned', { ascending: false })

  // Aggregate by user for cumulative leaderboard
  const userAggregates = new Map<string, {
    user_id: string
    full_name: string
    email: string
    employee_id: string | null
    department: string | null
    total_points: number
    total_quizzes: number
    avg_score: number
    total_correct: number
    total_questions: number
    total_time: number
  }>()

  globalLeaderboard?.forEach((attempt: any) => {
    const userId = attempt.user_id
    const existing = userAggregates.get(userId)
    
    if (existing) {
      existing.total_points += attempt.points_earned || 0
      existing.total_quizzes += 1
      existing.total_correct += attempt.correct_answers || 0
      existing.total_questions += attempt.total_questions || 0
      existing.total_time += attempt.time_taken_seconds || 0
      existing.avg_score = existing.total_questions > 0 
        ? Math.round((existing.total_correct / existing.total_questions) * 100) 
        : 0
    } else {
      userAggregates.set(userId, {
        user_id: userId,
        full_name: attempt.profiles?.full_name || 'Unknown',
        email: attempt.profiles?.email || '',
        employee_id: attempt.profiles?.employee_id || null,
        department: attempt.profiles?.department || null,
        total_points: attempt.points_earned || 0,
        total_quizzes: 1,
        total_correct: attempt.correct_answers || 0,
        total_questions: attempt.total_questions || 0,
        total_time: attempt.time_taken_seconds || 0,
        avg_score: attempt.score || 0,
      })
    }
  })

  const cumulativeLeaderboard = Array.from(userAggregates.values())
    .sort((a, b) => b.total_points - a.total_points)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))

  // Get per-quiz leaderboards
  const quizLeaderboards: Record<string, any[]> = {}
  
  for (const quiz of quizzes || []) {
    const { data: attempts } = await adminClient
      .from('quiz_attempts')
      .select(`
        *,
        profiles:user_id(full_name, email, employee_id, department)
      `)
      .eq('quiz_id', quiz.id)
      .eq('status', 'completed')
      .order('score', { ascending: false })
      .order('time_taken_seconds', { ascending: true })
      .limit(50)

    quizLeaderboards[quiz.id] = (attempts || []).map((a: any, i: number) => ({
      rank: i + 1,
      user_id: a.user_id,
      full_name: a.profiles?.full_name || 'Unknown',
      email: a.profiles?.email || '',
      employee_id: a.profiles?.employee_id,
      department: a.profiles?.department,
      score: a.score,
      correct_answers: a.correct_answers,
      total_questions: a.total_questions,
      time_taken_seconds: a.time_taken_seconds,
      points_earned: a.points_earned,
    }))
  }

  const formatTime = (s: number) => {
    if (!s) return '-'
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}m ${secs}s`
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Crown className="h-7 w-7 text-yellow-500" />
            Leaderboards
          </h1>
          <p className="text-muted-foreground mt-1">Track employee performance across all assessments</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 rounded-xl">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{cumulativeLeaderboard.length}</p>
              <p className="text-xs text-amber-600/70 font-medium">Total Participants</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-green-500 rounded-xl">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{quizzes?.length || 0}</p>
              <p className="text-xs text-green-600/70 font-medium">Total Quizzes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-500 rounded-xl">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">
                {cumulativeLeaderboard.length > 0 
                  ? Math.round(cumulativeLeaderboard.reduce((a, b) => a + b.avg_score, 0) / cumulativeLeaderboard.length)
                  : 0}%
              </p>
              <p className="text-xs text-blue-600/70 font-medium">Avg Score</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-purple-500 rounded-xl">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-700">
                {cumulativeLeaderboard.reduce((a, b) => a + b.total_points, 0)}
              </p>
              <p className="text-xs text-purple-600/70 font-medium">Total Points Earned</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard Tabs */}
      <Tabs defaultValue="cumulative" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-2">
          <TabsTrigger value="cumulative" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            Cumulative
          </TabsTrigger>
          {quizzes?.map((quiz: any) => (
            <TabsTrigger key={quiz.id} value={quiz.id} className="flex items-center gap-1">
              <Badge variant="secondary" className={`text-[10px] mr-1 ${difficultyColors[quiz.difficulty] || ''}`}>
                {quiz.difficulty.charAt(0).toUpperCase()}
              </Badge>
              {quiz.title.length > 20 ? quiz.title.substring(0, 20) + '...' : quiz.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Cumulative Leaderboard */}
        <TabsContent value="cumulative">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  Cumulative Leaderboard
                </CardTitle>
                <CardDescription>
                  Overall performance across all quizzes
                </CardDescription>
              </div>
              {cumulativeLeaderboard.length > 0 && (
                <Button variant="outline" size="sm" asChild>
                  <a href="/api/leaderboard/cumulative/download">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </a>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {/* Top 3 Podium */}
              {cumulativeLeaderboard.length >= 3 && (
                <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
                  {/* 2nd Place */}
                  <div className="flex flex-col items-center pt-8">
                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl mb-2 ring-2 ring-gray-300">
                      🥈
                    </div>
                    <p className="font-medium text-sm text-center truncate w-full">
                      {cumulativeLeaderboard[1].full_name}
                    </p>
                    <p className="text-2xl font-bold text-gray-600">{cumulativeLeaderboard[1].total_points}</p>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>

                  {/* 1st Place */}
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center text-3xl mb-2 ring-4 ring-yellow-400 shadow-lg">
                      🥇
                    </div>
                    <p className="font-semibold text-center truncate w-full">
                      {cumulativeLeaderboard[0].full_name}
                    </p>
                    <p className="text-3xl font-bold text-yellow-600">{cumulativeLeaderboard[0].total_points}</p>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>

                  {/* 3rd Place */}
                  <div className="flex flex-col items-center pt-12">
                    <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center text-xl mb-2 ring-2 ring-amber-400">
                      🥉
                    </div>
                    <p className="font-medium text-sm text-center truncate w-full">
                      {cumulativeLeaderboard[2].full_name}
                    </p>
                    <p className="text-xl font-bold text-amber-600">{cumulativeLeaderboard[2].total_points}</p>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>
                </div>
              )}

              {/* Full Leaderboard Table */}
              <div className="space-y-2">
                {cumulativeLeaderboard.map((entry) => (
                  <div
                    key={entry.user_id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
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
                        <p className="font-medium text-sm">{entry.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.email} • {entry.department || 'No Dept'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-bold text-primary">{entry.total_points}</p>
                        <p className="text-xs text-muted-foreground">Points</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold">{entry.avg_score}%</p>
                        <p className="text-xs text-muted-foreground">Avg Score</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold">{entry.total_quizzes}</p>
                        <p className="text-xs text-muted-foreground">Quizzes</p>
                      </div>
                      <div className="text-center hidden sm:block">
                        <p className="font-semibold">{formatTime(entry.total_time)}</p>
                        <p className="text-xs text-muted-foreground">Total Time</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {cumulativeLeaderboard.length === 0 && (
                  <div className="text-center py-12">
                    <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Data Yet</h3>
                    <p className="text-muted-foreground">
                      Employees will appear here after completing quizzes.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Per-Quiz Leaderboards */}
        {quizzes?.map((quiz: any) => (
          <TabsContent key={quiz.id} value={quiz.id}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    {quiz.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    {quiz.topic}
                    <Badge variant="secondary" className={difficultyColors[quiz.difficulty] || ''}>
                      {quiz.difficulty}
                    </Badge>
                  </CardDescription>
                </div>
                {quizLeaderboards[quiz.id]?.length > 0 && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/leaderboard/${quiz.id}/download`}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </a>
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {quizLeaderboards[quiz.id]?.map((entry: any) => (
                    <div
                      key={entry.user_id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
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
                          <p className="font-medium text-sm">{entry.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.email} • {entry.employee_id || 'No ID'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-bold">{entry.score}%</span>
                        <span className="text-muted-foreground">
                          {entry.correct_answers}/{entry.total_questions}
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(entry.time_taken_seconds)}
                        </span>
                        <Badge variant="secondary">{entry.points_earned} pts</Badge>
                      </div>
                    </div>
                  ))}

                  {(!quizLeaderboards[quiz.id] || quizLeaderboards[quiz.id].length === 0) && (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Participants Yet</h3>
                      <p className="text-muted-foreground">
                        Assign this quiz to employees to see results here.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
