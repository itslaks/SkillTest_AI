import { createClient } from '@/lib/supabase/server'
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
} from 'lucide-react'
import { getQuizStats } from '@/lib/actions/quiz'

export default async function ManagerDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data: stats } = await getQuizStats()
  
  // Get recent quizzes
  const { data: recentQuizzes } = await supabase
    .from('quizzes')
    .select('*, questions(count)')
    .eq('created_by', user?.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Get pending questions
  const { data: pendingQuestions } = await supabase
    .from('questions')
    .select('*, quizzes!inner(title, created_by)')
    .eq('status', 'pending')
    .eq('quizzes.created_by', user?.id)
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
    .eq('quizzes.created_by', user?.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(5)

  const statCards = [
    {
      title: 'Total Quizzes',
      value: stats?.totalQuizzes || 0,
      icon: FileQuestion,
      description: 'Active assessments',
    },
    {
      title: 'Total Attempts',
      value: stats?.totalAttempts || 0,
      icon: CheckCircle2,
      description: 'Completed assessments',
    },
    {
      title: 'Average Score',
      value: `${stats?.averageScore || 0}%`,
      icon: TrendingUp,
      description: 'Across all quizzes',
    },
    {
      title: 'Active Employees',
      value: stats?.uniqueEmployees || 0,
      icon: Users,
      description: 'Have taken quizzes',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s an overview of your assessments.
          </p>
        </div>
        <Button asChild>
          <Link href="/manager/quizzes/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Quiz
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Quizzes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Quizzes</CardTitle>
              <CardDescription>Your latest assessments</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/manager/quizzes">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentQuizzes && recentQuizzes.length > 0 ? (
              <div className="space-y-4">
                {recentQuizzes.map((quiz: any) => (
                  <div 
                    key={quiz.id} 
                    className="flex items-center justify-between p-3 rounded-lg border"
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
                  </div>
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
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="h-7 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-destructive">
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
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
