import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/rbac'
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
import { DownloadReportButton } from '@/components/manager/download-report-button'

export default async function ManagerReportsPage() {
  const { userId } = await requireManager()

  const supabase = await createClient()

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Reports &amp; Analytics</h1>
          <p className="text-muted-foreground mt-1">Overview of quiz performance and employee engagement</p>
        </div>
        <DownloadReportButton quizId="all" variant="all" />
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500 rounded-xl">
                <FileQuestion className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{stats.totalQuizzes}</p>
                <p className="text-xs text-blue-600/70 font-medium">Total Quizzes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-500 rounded-xl">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{stats.totalAttempts}</p>
                <p className="text-xs text-green-600/70 font-medium">Total Completions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 rounded-xl">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats.averageScore}%</p>
                <p className="text-xs text-amber-600/70 font-medium">Average Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500 rounded-xl">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{stats.uniqueEmployees}</p>
                <p className="text-xs text-purple-600/70 font-medium">Active Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Quiz Reports - individual cards with download */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Per-Quiz Reports
          </h2>
          <p className="text-sm text-muted-foreground">Download individual Excel reports for each quiz</p>
        </div>

        {quizzes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground opacity-40 mb-3" />
              <p className="text-muted-foreground">No quizzes created yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {quizzes.map((quiz: any) => {
              const data = quizAttemptData[quiz.id]
              const hasAttempts = data && data.attempts > 0
              const difficultyColors: Record<string, string> = {
                easy: 'bg-green-100 text-green-700 border-green-200',
                medium: 'bg-blue-100 text-blue-700 border-blue-200',
                hard: 'bg-amber-100 text-amber-700 border-amber-200',
                advanced: 'bg-orange-100 text-orange-700 border-orange-200',
                hardcore: 'bg-red-100 text-red-700 border-red-200',
              }
              return (
                <Card key={quiz.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{quiz.title}</CardTitle>
                        <CardDescription className="truncate mt-0.5">{quiz.topic}</CardDescription>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-xs ${difficultyColors[quiz.difficulty] || ''}`}>
                        {quiz.difficulty}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 bg-muted/60 rounded-lg">
                        <p className="text-lg font-bold">{data?.attempts || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Attempts</p>
                      </div>
                      <div className="p-2 bg-muted/60 rounded-lg">
                        <p className={`text-lg font-bold ${hasAttempts ? (data.avgScore >= (quiz.passing_score || 70) ? 'text-green-600' : 'text-red-500') : ''}`}>
                          {hasAttempts ? `${data.avgScore}%` : '—'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Avg Score</p>
                      </div>
                      <div className="p-2 bg-muted/60 rounded-lg">
                        <p className={`text-lg font-bold ${hasAttempts ? (data.passRate >= 70 ? 'text-green-600' : data.passRate >= 40 ? 'text-amber-600' : 'text-red-500') : ''}`}>
                          {hasAttempts ? `${data.passRate}%` : '—'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Pass Rate</p>
                      </div>
                    </div>

                    {/* Pass rate bar */}
                    {hasAttempts && (
                      <div className="space-y-1">
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${data.passRate >= 70 ? 'bg-green-500' : data.passRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${data.passRate}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Status + Download */}
                    <div className="flex items-center justify-between pt-1">
                      <Badge variant={quiz.is_active ? 'default' : 'secondary'} className="text-xs">
                        {quiz.is_active ? '● Active' : '○ Inactive'}
                      </Badge>
                      <DownloadReportButton quizId={quiz.id} quizTitle={quiz.title} />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

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
