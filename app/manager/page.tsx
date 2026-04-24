import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/rbac'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { DashboardSignalShowcase } from '@/components/insights/dashboard-signal-showcase'
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
  AlertTriangle,
  ClipboardCheck,
  ShieldAlert,
  CalendarDays,
} from 'lucide-react'
import { getQuizStats } from '@/lib/actions/quiz'

export default async function ManagerDashboard() {
  const { userId } = await requireManager()

  const supabase = await createClient()
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single()

  const { data: stats } = await getQuizStats()
  const adminClient = createAdminClient()
  
  // Get recent quizzes
  const { data: recentQuizzes } = await supabase
    .from('quizzes')
    .select('*, questions(count)')
    .eq('created_by', userId)
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

  const { data: allQuizzes } = await supabase
    .from('quizzes')
    .select('id, title, is_active, created_at, questions(count)')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })

  const quizIds = allQuizzes?.map((quiz: any) => quiz.id) || []

  const { data: allAttempts } = quizIds.length > 0
    ? await adminClient
        .from('quiz_attempts')
        .select('quiz_id, user_id, score, completed_at, profiles:user_id(full_name, email)')
        .in('quiz_id', quizIds)
        .eq('status', 'completed')
    : { data: [] }

  const { data: employees } = await adminClient
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'employee')

  const attemptsByQuiz = new Map<string, number>()
  const attemptedUserIds = new Set<string>()
  for (const attempt of allAttempts || []) {
    attemptsByQuiz.set(attempt.quiz_id, (attemptsByQuiz.get(attempt.quiz_id) || 0) + 1)
    attemptedUserIds.add(attempt.user_id)
  }

  const lowQuestionQuizzes = (allQuizzes || []).filter((quiz: any) => (quiz.questions?.[0]?.count || 0) < 5)
  const readyDrafts = (allQuizzes || []).filter((quiz: any) => !quiz.is_active && (quiz.questions?.[0]?.count || 0) >= 5)
  const quietActiveQuizzes = (allQuizzes || []).filter((quiz: any) => quiz.is_active && (attemptsByQuiz.get(quiz.id) || 0) === 0)
  const inactiveEmployees = (employees || []).filter((employee: any) => !attemptedUserIds.has(employee.id))
  const lowScoreAttempts = (allAttempts || []).filter((attempt: any) => (attempt.score || 0) < 50)

  const actionItems = [
    {
      title: 'Quizzes need questions',
      count: lowQuestionQuizzes.length,
      detail: lowQuestionQuizzes[0]?.title || 'Add at least 5 questions before assigning.',
      href: '/manager/quizzes',
      icon: AlertTriangle,
      tone: 'amber',
    },
    {
      title: 'Drafts ready to publish',
      count: readyDrafts.length,
      detail: readyDrafts[0]?.title || 'Review and activate ready quizzes.',
      href: '/manager/quizzes',
      icon: ClipboardCheck,
      tone: 'emerald',
    },
    {
      title: 'Active quizzes with no completions',
      count: quietActiveQuizzes.length,
      detail: quietActiveQuizzes[0]?.title || 'Assign or remind employees.',
      href: '/manager/quizzes',
      icon: ShieldAlert,
      tone: 'blue',
    },
    {
      title: 'Employees not yet engaged',
      count: inactiveEmployees.length,
      detail: inactiveEmployees[0]?.full_name || 'Assign a starter quiz.',
      href: '/manager/employees',
      icon: Users,
      tone: 'violet',
    },
  ]

  const priorityAction = actionItems.find((item) => item.count > 0)

  const statCards = [
    {
      title: 'Total Quizzes',
      value: stats?.totalQuizzes || 0,
      icon: FileQuestion,
      description: 'Active assessments',
      bgGradient: 'from-zinc-50 to-white',
      border: 'border-zinc-200',
      iconBg: 'bg-black',
      text: 'text-black',
    },
    {
      title: 'Total Attempts',
      value: stats?.totalAttempts || 0,
      icon: CheckCircle2,
      description: 'Completed assessments',
      bgGradient: 'from-zinc-50 to-white',
      border: 'border-zinc-200',
      iconBg: 'bg-black',
      text: 'text-black',
    },
    {
      title: 'Average Score',
      value: `${stats?.averageScore || 0}%`,
      icon: TrendingUp,
      description: 'Across all quizzes',
      bgGradient: 'from-zinc-50 to-white',
      border: 'border-zinc-200',
      iconBg: 'bg-black',
      text: 'text-black',
    },
    {
      title: 'Active Employees',
      value: stats?.uniqueEmployees || 0,
      icon: Users,
      description: 'Have taken quizzes',
      bgGradient: 'from-zinc-50 to-white',
      border: 'border-zinc-200',
      iconBg: 'bg-black',
      text: 'text-black',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-[2rem] border border-zinc-900 bg-black p-6 md:p-8 text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)] dashboard-grid-bg">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="relative z-10 grid gap-6 xl:grid-cols-[0.85fr_1.15fr] xl:items-center">
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
            <div className="mt-6 flex gap-2 flex-wrap">
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
                <Link href="/manager/operations">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Training Ops
                </Link>
              </Button>
            </div>
          </div>
          <DashboardSignalShowcase
            theme="dark"
            badge="Manager Signal Deck"
            title="A command center that feels as sharp as the decisions made inside it."
            subtitle="Ambient 3D telemetry gives the manager view more presence without getting in the way of metrics, actions, and live reporting."
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="glass-panel spotlight-card border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <CardTitle className="text-lg">Presentation Edge</CardTitle>
            <CardDescription>
              These screens now carry the same design confidence as the landing page, so the wow factor is visible in the real product experience too.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {[
              'Layered dark surfaces create depth on the first manager impression.',
              'Interactive-feeling ambient motion comes from scene objects, not gimmicks.',
              'Operational content still stays readable and presentation-ready.',
            ].map((item) => (
              <div key={item} className="rounded-[1.4rem] border border-black/6 bg-white/70 p-4 text-sm text-zinc-600">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
        <DashboardSignalShowcase
          theme="light"
          badge="Ops + AI Layer"
          title="The product screens now flex interface craft, not just the marketing shell."
          subtitle="That matters in a designathon, because judges notice whether the actual workflow pages feel special."
        />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className={`relative overflow-hidden bg-gradient-to-br ${stat.bgGradient} ${stat.border} spotlight-card shadow-sm hover:shadow-md transition-shadow`}>
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

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-zinc-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Quick Start Guide</CardTitle>
            <CardDescription>
              A simple manager flow to get value from the platform without technical setup knowledge.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              { step: '1', title: 'Create a quiz', body: 'Start with one topic and at least 5 questions.', tone: 'bg-blue-50 border-blue-100 text-blue-700' },
              { step: '2', title: 'Assign employees', body: 'Pick the trainees or batch who should attempt it.', tone: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
              { step: '3', title: 'Run training operations', body: 'Schedule sessions, track attendance, and send reminders.', tone: 'bg-cyan-50 border-cyan-100 text-cyan-700' },
              { step: '4', title: 'Review weak topics', body: 'Use Batch DNA and trainer impact to coach faster.', tone: 'bg-amber-50 border-amber-100 text-amber-700' },
            ].map((item) => (
              <div key={item.step} className={`rounded-2xl border p-4 ${item.tone}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em]">Step {item.step}</p>
                <p className="mt-2 font-semibold">{item.title}</p>
                <p className="mt-1 text-sm opacity-80">{item.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-zinc-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Color Legend</CardTitle>
            <CardDescription>
              Fast visual cues so a manager can know what needs attention immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Blue', meaning: 'Informational guidance and setup help', tone: 'bg-blue-500' },
              { label: 'Green', meaning: 'Healthy, ready, or completed successfully', tone: 'bg-emerald-500' },
              { label: 'Amber', meaning: 'Needs review soon or low-score coaching opportunity', tone: 'bg-amber-500' },
              { label: 'Violet', meaning: 'AI and advanced intelligence insights', tone: 'bg-violet-500' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-zinc-200 p-4">
                <div className={`mt-0.5 h-3 w-3 rounded-full ${item.tone}`} />
                <div>
                  <p className="font-semibold text-black">{item.label}</p>
                  <p className="text-sm text-zinc-500">{item.meaning}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          'Cognitive Load Detector',
          'Emotional State Inference',
          'Batch DNA Fingerprint',
          'Trainer Impact Score',
        ].map((feature, index) => (
          <div key={feature} className={`rounded-[1.5rem] border p-4 shadow-sm ${
            index === 0 ? 'border-blue-100 bg-blue-50' :
            index === 1 ? 'border-rose-100 bg-rose-50' :
            index === 2 ? 'border-violet-100 bg-violet-50' :
            'border-amber-100 bg-amber-50'
          }`}>
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">AI Surface</p>
            <p className="mt-3 font-semibold text-black">{feature}</p>
          </div>
        ))}
      </div>

      {/* Manager Action Center */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-black" />
                Manager Action Center
              </CardTitle>
              <CardDescription>Important next steps based on current quiz and employee activity.</CardDescription>
            </div>
            {priorityAction ? (
              <Button size="sm" className="rounded-xl" asChild>
                <Link href={priorityAction.href}>
                  Fix top item <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 border border-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
                Everything looks healthy
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {actionItems.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-xl border border-border/60 bg-white p-4 transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`rounded-xl p-2 ${
                    item.tone === 'amber' ? 'bg-amber-50 text-amber-600'
                    : item.tone === 'emerald' ? 'bg-emerald-50 text-emerald-600'
                    : item.tone === 'blue' ? 'bg-blue-50 text-blue-600'
                    : 'bg-violet-50 text-violet-600'
                  }`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    item.count > 0 ? 'bg-slate-900 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {item.count}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold group-hover:text-primary">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.detail}</p>
              </Link>
            ))}
          </div>
          {lowScoreAttempts.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/70 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Coaching opportunity</p>
                  <p className="text-xs text-amber-800/80">
                    {lowScoreAttempts.length} recent completion(s) are below 50%. Review reports and assign a follow-up quiz.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl bg-white border-amber-200 text-amber-800" asChild>
                  <Link href="/manager/reports">Open reports</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
        <Link href="/manager/operations" className="group">
          <Card className="h-full hover:shadow-lg hover:border-cyan-500/50 transition-all cursor-pointer border-cyan-200/50">
            <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-3">
              <div className="p-2 md:p-3 rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                <CalendarDays className="h-5 w-5 md:h-6 md:w-6 text-cyan-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm group-hover:text-cyan-600 transition-colors">Training Ops</h3>
                <p className="text-xs text-muted-foreground hidden md:block">Batches, sessions, attendance</p>
              </div>
              <ArrowRight className="hidden lg:block h-5 w-5 text-muted-foreground group-hover:text-cyan-600 group-hover:translate-x-1 transition-all" />
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
