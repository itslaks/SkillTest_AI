import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/rbac'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { 
  FileQuestion, 
  Users, 
  TrendingUp, 
  Clock,
  Plus,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Sparkles,
  BarChart3,
  Trophy,
  Brain,
  Upload,
  FileSpreadsheet,
} from 'lucide-react'
import { getQuizStats } from '@/lib/actions/quiz'
import { PendingQuestionActions } from '@/components/manager/pending-question-actions'

export default async function ManagerDashboard() {
  const { userId } = await requireManager()

  const supabase = await createClient()
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single()

  const { data: stats } = await getQuizStats()
  
  // Get recent quizzes
  const { data: recentQuizzes } = await supabase
    .from('quizzes')
    .select('*, questions(count)')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(5)

  // Get pending questions
  const { data: pendingQuestions } = await supabase
    .from('questions')
    .select('*, quizzes!inner(title, created_by)')
    .eq('status', 'pending')
    .eq('quizzes.created_by', userId)
    .order('created_at', { ascending: false })
    .limit(5)

  // Get recent attempts on manager's quizzes
  const { data: recentAttempts } = await supabase
    .from('quiz_attempts')
    .select(`
      *,
      quizzes!inner(title, created_by),
      profiles:user_id(full_name, email)
    `)
    .eq('quizzes.created_by', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(5)

  const statCards = [
    {
      title: 'Total Quizzes',
      value: stats?.totalQuizzes || 0,
      icon: FileQuestion,
      description: 'Active assessments',
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-blue-50/50',
      border: 'border-blue-100',
      iconBg: 'bg-blue-500',
      text: 'text-blue-700',
    },
    {
      title: 'Total Attempts',
      value: stats?.totalAttempts || 0,
      icon: CheckCircle2,
      description: 'Completed assessments',
      gradient: 'from-green-500 to-emerald-600',
      bgGradient: 'from-green-50 to-emerald-50/50',
      border: 'border-green-100',
      iconBg: 'bg-green-500',
      text: 'text-green-700',
    },
    {
      title: 'Average Score',
      value: `${stats?.averageScore || 0}%`,
      icon: TrendingUp,
      description: 'Across all quizzes',
      gradient: 'from-purple-500 to-violet-600',
      bgGradient: 'from-purple-50 to-violet-50/50',
      border: 'border-purple-100',
      iconBg: 'bg-purple-500',
      text: 'text-purple-700',
    },
    {
      title: 'Active Employees',
      value: stats?.uniqueEmployees || 0,
      icon: Users,
      description: 'Have taken quizzes',
      gradient: 'from-orange-500 to-amber-600',
      bgGradient: 'from-orange-50 to-amber-50/50',
      border: 'border-orange-100',
      iconBg: 'bg-orange-500',
      text: 'text-orange-700',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 md:p-8 text-white shadow-xl shadow-blue-500/20">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold tracking-wide uppercase">
                Manager Dashboard
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'Manager'}! 👋
            </h1>
            <p className="text-white/75 max-w-md text-sm md:text-base">
              Here&apos;s an overview of your assessments and employee performance today.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              asChild 
              size="lg" 
              className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg font-semibold"
            >
              <Link href="/manager/quizzes/new">
                <Plus className="mr-2 h-5 w-5" />
                Create Quiz
              </Link>
            </Button>
            <Button 
              asChild 
              variant="outline"
              size="lg"
              className="border-white/30 text-white hover:bg-white/10 bg-white/10"
            >
              <Link href="/manager/analytics">
                <Brain className="mr-2 h-4 w-4" />
                AI Tools
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className={`relative overflow-hidden bg-gradient-to-br ${stat.bgGradient} ${stat.border} shadow-sm hover:shadow-md transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-1.5 md:p-2 rounded-lg ${stat.iconBg}`}>
                <stat.icon className="h-3 w-3 md:h-4 md:w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl md:text-3xl font-bold ${stat.text}`}>{stat.value}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Link href="/manager/quizzes" className="group">
          <Card className="h-full hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer">
            <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-3">
              <div className="p-2 md:p-3 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                <FileQuestion className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">Manage Quizzes</h3>
                <p className="text-xs text-muted-foreground hidden md:block">View and edit assessments</p>
              </div>
              <ArrowRight className="hidden lg:block h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/manager/employees" className="group">
          <Card className="h-full hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer">
            <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-3">
              <div className="p-2 md:p-3 rounded-xl bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                <Users className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">Employees</h3>
                <p className="text-xs text-muted-foreground hidden md:block">Import and assign</p>
              </div>
              <ArrowRight className="hidden lg:block h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/manager/leaderboard" className="group">
          <Card className="h-full hover:shadow-lg hover:border-yellow-500/50 transition-all cursor-pointer border-yellow-200/50">
            <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-3">
              <div className="p-2 md:p-3 rounded-xl bg-yellow-500/10 group-hover:bg-yellow-500/20 transition-colors">
                <Trophy className="h-5 w-5 md:h-6 md:w-6 text-yellow-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm group-hover:text-yellow-600 transition-colors">Leaderboard</h3>
                <p className="text-xs text-muted-foreground hidden md:block">Rankings & scores</p>
              </div>
              <ArrowRight className="hidden lg:block h-5 w-5 text-muted-foreground group-hover:text-yellow-600 group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/manager/analytics" className="group">
          <Card className="h-full hover:shadow-lg hover:border-purple-500/50 transition-all cursor-pointer border-purple-200/50">
            <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-3">
              <div className="p-2 md:p-3 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                <Brain className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm group-hover:text-purple-600 transition-colors">Analytics & AI</h3>
                <p className="text-xs text-muted-foreground hidden md:block">Import & analyze</p>
              </div>
              <ArrowRight className="hidden lg:block h-5 w-5 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/manager/reports" className="group col-span-2 md:col-span-1">
          <Card className="h-full hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer">
            <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-3">
              <div className="p-2 md:p-3 rounded-xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">Reports</h3>
                <p className="text-xs text-muted-foreground hidden md:block">Detailed analytics</p>
              </div>
              <ArrowRight className="hidden lg:block h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Quizzes */}
        <Card className="shadow-lg border-0">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
            <div>
              <CardTitle className="text-lg">Recent Quizzes</CardTitle>
              <CardDescription>Your latest assessments</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/manager/quizzes">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            {recentQuizzes && recentQuizzes.length > 0 ? (
              <div className="space-y-3">
                {recentQuizzes.map((quiz: any) => (
                  <Link 
                    key={quiz.id}
                    href={`/manager/quizzes/${quiz.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{quiz.title}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{quiz.questions?.[0]?.count || 0} questions</span>
                        <span>•</span>
                        <span className="capitalize">{quiz.difficulty}</span>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      quiz.is_active 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {quiz.is_active ? 'Active' : 'Draft'}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileQuestion className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No quizzes yet</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/manager/quizzes/new">Create your first quiz</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Questions for Approval */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pending Approval</CardTitle>
              <CardDescription>AI-generated questions awaiting review</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {pendingQuestions && pendingQuestions.length > 0 ? (
              <div className="space-y-4">
                {pendingQuestions.map((question: any) => (
                  <div 
                    key={question.id} 
                    className="p-3 rounded-lg border"
                  >
                    <p className="text-sm font-medium line-clamp-2">{question.question_text}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {question.quizzes?.title}
                      </span>
                      <PendingQuestionActions questionId={question.id} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending questions</p>
                <p className="text-sm">All questions have been reviewed</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest quiz completions by employees</CardDescription>
        </CardHeader>
        <CardContent>
          {recentAttempts && recentAttempts.length > 0 ? (
            <div className="space-y-4">
              {recentAttempts.map((attempt: any) => (
                <div 
                  key={attempt.id} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {attempt.profiles?.full_name?.charAt(0) || 'E'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">
                        {attempt.profiles?.full_name || 'Employee'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Completed {attempt.quizzes?.title}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      attempt.score >= 70 ? 'text-green-600' : 'text-amber-600'
                    }`}>
                      {attempt.score}%
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {Math.round(attempt.time_taken_seconds / 60)}m
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activity yet</p>
              <p className="text-sm">Employees haven&apos;t taken any quizzes</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
