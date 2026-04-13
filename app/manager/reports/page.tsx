import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getQuizStats, getQuizzes } from '@/lib/actions/quiz'
import { getEmployees } from '@/lib/actions/manager'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  Users,
  FileQuestion,
  Trophy,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Target,
} from 'lucide-react'

export default async function ManagerReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [statsRes, quizzesRes, employeesRes] = await Promise.all([
    getQuizStats(),
    getQuizzes(),
    getEmployees(),
  ])

  const stats = statsRes.data || { totalQuizzes: 0, totalAttempts: 0, averageScore: 0, uniqueEmployees: 0 }
  const quizzes = quizzesRes.data || []
  const employees = employeesRes.data || []

  // Get per-quiz attempt data
  const quizIds = quizzes.map((q: any) => q.id)
  let quizAttemptData: Record<string, { attempts: number; avgScore: number; passRate: number }> = {}

  if (quizIds.length > 0) {
    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('quiz_id, score, completed_at')
      .in('quiz_id', quizIds)
      .not('completed_at', 'is', null)

    if (attempts) {
      for (const attempt of attempts) {
        if (!quizAttemptData[attempt.quiz_id]) {
          quizAttemptData[attempt.quiz_id] = { attempts: 0, avgScore: 0, passRate: 0 }
        }
        quizAttemptData[attempt.quiz_id].attempts++
        quizAttemptData[attempt.quiz_id].avgScore += attempt.score
      }

      // Calculate averages and pass rates
      for (const qid of Object.keys(quizAttemptData)) {
        const quiz = quizzes.find((q: any) => q.id === qid)
        const passingScore = quiz?.passing_score || 70
        quizAttemptData[qid].avgScore = Math.round(quizAttemptData[qid].avgScore / quizAttemptData[qid].attempts)

        const passCount = attempts.filter((a: any) => a.quiz_id === qid && a.score >= passingScore).length
        quizAttemptData[qid].passRate = Math.round((passCount / quizAttemptData[qid].attempts) * 100)
      }
    }
  }

  // Domain breakdown
  const domainCounts: Record<string, number> = {}
  for (const emp of employees) {
    const domain = (emp as any).domain || 'Uncategorized'
    domainCounts[domain] = (domainCounts[domain] || 0) + 1
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Reports &amp; Analytics</h1>
        <p className="text-muted-foreground mt-1">Overview of quiz performance and employee engagement</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileQuestion className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalQuizzes}</p>
                <p className="text-xs text-muted-foreground">Total Quizzes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalAttempts}</p>
                <p className="text-xs text-muted-foreground">Total Completions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Target className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.averageScore}%</p>
                <p className="text-xs text-muted-foreground">Average Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.uniqueEmployees}</p>
                <p className="text-xs text-muted-foreground">Active Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Quiz Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Quiz Performance
          </CardTitle>
          <CardDescription>Breakdown by individual quiz</CardDescription>
        </CardHeader>
        <CardContent>
          {quizzes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No quizzes created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Quiz</th>
                    <th className="text-left p-3 font-medium">Difficulty</th>
                    <th className="text-left p-3 font-medium">Attempts</th>
                    <th className="text-left p-3 font-medium">Avg Score</th>
                    <th className="text-left p-3 font-medium">Pass Rate</th>
                    <th className="text-left p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.map((quiz: any) => {
                    const data = quizAttemptData[quiz.id]
                    return (
                      <tr key={quiz.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium">{quiz.title}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">{quiz.difficulty}</Badge>
                        </td>
                        <td className="p-3">{data?.attempts || 0}</td>
                        <td className="p-3">
                          {data ? (
                            <span className={data.avgScore >= (quiz.passing_score || 70) ? 'text-green-600' : 'text-red-500'}>
                              {data.avgScore}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          {data ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${data.passRate >= 70 ? 'bg-green-500' : data.passRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${data.passRate}%` }}
                                />
                              </div>
                              <span className="text-xs">{data.passRate}%</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant={quiz.is_active ? 'default' : 'secondary'} className="text-xs">
                            {quiz.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Domain Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Employee Distribution by Domain
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(domainCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No domain data available.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(domainCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([domain, count]) => (
                    <div key={domain} className="flex items-center gap-3">
                      <span className="text-sm w-32 truncate font-medium">{domain}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(count / employees.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-10 text-right">{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Engagement Rate</span>
              </div>
              <span className="font-bold">
                {employees.length > 0 ? Math.round((stats.uniqueEmployees / employees.length) * 100) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Avg Attempts / Quiz</span>
              </div>
              <span className="font-bold">
                {stats.totalQuizzes > 0 ? (stats.totalAttempts / stats.totalQuizzes).toFixed(1) : 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Quizzes with Attempts</span>
              </div>
              <span className="font-bold">
                {Object.keys(quizAttemptData).length} / {stats.totalQuizzes}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">Avg Pass Rate</span>
              </div>
              <span className="font-bold">
                {Object.values(quizAttemptData).length > 0
                  ? Math.round(Object.values(quizAttemptData).reduce((sum, d) => sum + d.passRate, 0) / Object.values(quizAttemptData).length)
                  : 0}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
