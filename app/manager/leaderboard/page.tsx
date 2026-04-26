import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RealtimeManagerLeaderboard } from '@/components/manager/realtime-manager-leaderboard'
import { QuizCompletionDetails } from '@/components/manager/quiz-completion-details'
import { buildCumulativeLeaderboard, type CumulativeAttempt } from '@/lib/leaderboard'
import { 
  Trophy, Crown, Users, TrendingUp, Clock, 
  Download, BarChart3, Target 
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
      completed_at,
      quizzes!inner(created_by),
      profiles:user_id(full_name, email, employee_id, department, avatar_url)
    `)
    .eq('quizzes.created_by', userId)
    .eq('status', 'completed')
    .order('points_earned', { ascending: false })

  const cumulativeLeaderboard = buildCumulativeLeaderboard(globalLeaderboard as CumulativeAttempt[])

  // Get per-quiz leaderboards with proper tiebreaking
  const quizLeaderboards: Record<string, any[]> = {}
  
  for (const quiz of quizzes || []) {
    try {
      const { data: attempts, error } = await adminClient
        .from('quiz_attempts')
        .select(`
          *,
          profiles:user_id(full_name, email, employee_id, department)
        `)
        .eq('quiz_id', quiz.id)
        .eq('status', 'completed')
        .order('score', { ascending: false })
        .order('completed_at', { ascending: true }) // Earlier completion wins for same score
        .order('time_taken_seconds', { ascending: true })
        .limit(50)

      if (error) {
        console.error(`Error fetching leaderboard for quiz ${quiz.id}:`, error)
        quizLeaderboards[quiz.id] = []
        continue
      }

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
    } catch (quizError) {
      console.error(`Failed to fetch leaderboard for quiz ${quiz.title}:`, quizError)
      quizLeaderboards[quiz.id] = []
    }
  }

  // Get recent completions with detailed information
  const { data: recentCompletions } = await adminClient
    .from('quiz_attempts')
    .select(`
      id,
      score,
      correct_answers,
      total_questions,
      time_taken_seconds,
      points_earned,
      completed_at,
      quizzes!inner(title, topic, difficulty, created_by),
      profiles:user_id(full_name, email, employee_id, department)
    `)
    .eq('quizzes.created_by', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(10)

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Crown className="h-7 w-7 text-yellow-500" />
            Leaderboards
          </h1>
          <p className="text-muted-foreground mt-1">Track employee performance across all assessments</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/api/leaderboard/cumulative/download">
              <Download className="mr-2 h-4 w-4" />
              Download Cumulative
            </a>
          </Button>
          <Button className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700" asChild>
            <a href="/api/reports/download">
              <Download className="mr-2 h-4 w-4" />
              Download Full Report
            </a>
          </Button>
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

      {/* Recent Activity */}
      {recentCompletions && recentCompletions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-500" />
              Recent Quiz Completions
            </CardTitle>
            <CardDescription>Latest quiz attempts by your employees</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentCompletions.slice(0, 5).map((completion: any) => (
                <div key={completion.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-sm">
                      {completion.score}%
                    </div>
                    <div>
                      <p className="font-medium text-sm">{completion.profiles?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {completion.quizzes?.title} • {completion.profiles?.department || 'No Dept'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-semibold">{completion.correct_answers}/{completion.total_questions}</p>
                      <p className="text-xs text-muted-foreground">Correct</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="font-semibold">{formatTime(completion.time_taken_seconds)}</p>
                      <p className="text-xs text-muted-foreground">Time</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{completion.points_earned} pts</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(completion.completed_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Tabs */}
      <Tabs defaultValue="cumulative" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-2">
          <TabsTrigger value="cumulative" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            Cumulative
          </TabsTrigger>
          <TabsTrigger value="completions" className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Recent Activity
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
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Cumulative Performance
                </CardTitle>
                <CardDescription>
                  Overall employee performance across all quizzes
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="/api/leaderboard/cumulative/download">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </a>
              </Button>
            </CardHeader>
            <CardContent>
              <RealtimeManagerLeaderboard 
                initialData={cumulativeLeaderboard}
                managerId={userId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Completions */}
        <TabsContent value="completions">
          <QuizCompletionDetails 
            completions={recentCompletions?.map((c: any) => ({
              id: c.id,
              user_id: c.user_id,
              score: c.score,
              correct_answers: c.correct_answers,
              total_questions: c.total_questions,
              time_taken_seconds: c.time_taken_seconds,
              points_earned: c.points_earned,
              completed_at: c.completed_at,
              quiz: {
                title: c.quizzes.title,
                topic: c.quizzes.topic,
                difficulty: c.quizzes.difficulty
              },
              profile: {
                full_name: c.profiles.full_name,
                email: c.profiles.email,
                employee_id: c.profiles.employee_id,
                department: c.profiles.department
              }
            })) || []}
            exportHref="/api/leaderboard/cumulative/download"
          />
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
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/leaderboard/${quiz.id}/download`}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Results
                  </a>
                </Button>
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
