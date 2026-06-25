import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireTrainingStaff } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { DashboardSignalShowcase } from '@/components/insights/dashboard-signal-showcase'
import {
  FileQuestion,
  Users,
  Clock,
  Plus,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Trophy,
  Brain,
  AlertTriangle,
  ClipboardCheck,
  ShieldAlert,
  CalendarDays,
  Activity,
} from 'lucide-react'
import { getQuizStats } from '@/lib/actions/quiz'
import { getTrainingOpsManagerData } from '@/lib/actions/training'
import { AiInsightCard } from '@/components/manager/ai-insight-card'
import { OpsAutoRefresh } from '@/components/manager/ops-auto-refresh'

export default async function ManagerDashboard() {
  const { userId, role } = await requireTrainingStaff()
  // Admin users get redirected to admin console
  if (role === 'admin') redirect('/manager/admin')

  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: profile } = await adminClient
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle()

  const { data: stats } = await getQuizStats()

  // Fetch TMS summary data
  const tmsData = await getTrainingOpsManagerData().catch(() => null)
  const tmsSummary = tmsData?.summary ?? null

  // Get recent quizzes
  const { data: recentQuizzes } = await supabase
    .from('quizzes')
    .select('*, questions(count)')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(5)

  // Get recent attempts on manager's quizzes
  const { data: recentAttempts } = await adminClient
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
  const activeQuizCount = (allQuizzes || []).filter((quiz: any) => quiz.is_active).length
  const draftQuizCount = (allQuizzes || []).length - activeQuizCount
  const completionCoverage = employees?.length ? Math.round((attemptedUserIds.size / employees.length) * 100) : 0
  const averageCompletedScore = allAttempts?.length
    ? Math.round(allAttempts.reduce((sum: number, attempt: any) => sum + Number(attempt.score || 0), 0) / allAttempts.length)
    : 0

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
  const dailyBriefingItems = [
    inactiveEmployees.length ? `${inactiveEmployees.length} employee(s) not yet engaged` : '',
    lowScoreAttempts.length ? `${lowScoreAttempts.length} attempt(s) below 50%` : '',
    quietActiveQuizzes.length ? `${quietActiveQuizzes.length} active quiz(es) with no completions` : '',
    tmsSummary && tmsSummary.absenceAlerts ? `${tmsSummary.absenceAlerts} attendance risk alert(s)` : '',
  ].filter(Boolean)

  const statCards = [
    {
      title: 'Active Batches',
      value: tmsSummary?.activeBatches ?? 0,
      icon: Activity,
      description: 'Running training batches',
      bgGradient: 'from-cyan-50 to-white',
      border: 'border-cyan-200',
      iconBg: 'bg-cyan-600',
      text: 'text-cyan-900',
    },
    {
      title: 'Attendance Health',
      value: `${tmsSummary?.attendanceRate ?? 0}%`,
      icon: ClipboardCheck,
      description: 'Present/late across sessions',
      bgGradient: 'from-emerald-50 to-white',
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-600',
      text: 'text-emerald-900',
    },
    {
      title: 'Action Alerts',
      value: tmsSummary ? tmsSummary.attendanceDueToday + tmsSummary.absenceAlerts + tmsSummary.negativeFeedbackCount : 0,
      icon: ShieldAlert,
      description: 'Cut-off misses + absences + feedback',
      bgGradient: 'from-rose-50 to-white',
      border: 'border-rose-200',
      iconBg: 'bg-rose-600',
      text: 'text-rose-900',
    },
    {
      title: 'Total Quizzes',
      value: stats?.totalQuizzes || 0,
      icon: FileQuestion,
      description: `${stats?.totalAttempts || 0} attempts · ${stats?.averageScore || 0}% avg`,
      bgGradient: 'from-zinc-50 to-white',
      border: 'border-zinc-200',
      iconBg: 'bg-black',
      text: 'text-black',
    },
  ]

  return (
    <div className="space-y-8">
      <OpsAutoRefresh intervalMs={15000} compact />

      {/* Welcome Section */}
      <div className="signal-shell relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-black p-6 md:p-8 text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)] dashboard-grid-bg">
        <div className="aura-ring -right-8 -top-8 h-72 w-72 bg-cyan-400/25" />
        <div className="aura-ring -bottom-16 -left-10 h-80 w-80 bg-violet-500/20" style={{ animationDelay: '1.2s' }} />
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
        {role === 'trainer' && (
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-violet-500/15 rounded-full blur-3xl" />
        )}
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_0.72fr] lg:items-end">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${
                role === 'trainer' ? 'bg-violet-500/30 text-violet-200' : 'bg-white/20'
              }`}>
                {role === 'trainer' ? 'Trainer Dashboard' : 'Manager Dashboard'}
              </div>
            </div>
            <h1 className="max-w-2xl text-3xl font-display leading-tight tracking-tight md:text-5xl">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'Manager'}.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-cyan-50/75 md:text-base">
              {role === 'trainer'
                ? 'SkillTest_AI is watching batch rhythm, attendance signals, and assessment momentum so trainers can act before risks become outcomes.'
                : 'SkillTest_AI turns assessments, batches, attendance, and behavior signals into one live command surface.'
              }
            </p>
            <div className="mt-6 flex gap-2 flex-wrap">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-white text-slate-950 hover:bg-cyan-50 shadow-lg font-semibold"
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
                className="rounded-full border-white/30 text-white hover:bg-white/10 bg-white/10"
              >
                <Link href="/manager/operations">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Training Ops
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'AI Layer', value: 'Live' },
              { label: 'Ops Pulse', value: `${tmsSummary?.attendanceRate ?? 0}%` },
              { label: 'Alerts', value: `${tmsSummary ? tmsSummary.attendanceDueToday + tmsSummary.absenceAlerts + tmsSummary.negativeFeedbackCount : 0}` },
            ].map((item) => (
              <div key={item.label} className="signal-card rounded-2xl border border-white/15 bg-white/10 p-4 text-white">
                <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-100/70">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="xl:col-span-2 border-cyan-200 bg-cyan-50/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyan-950">
              <Brain className="h-5 w-5" />
              Manager Daily Briefing
            </CardTitle>
            <CardDescription className="text-cyan-800">
              AI Command summary generated from current quiz, learner, attendance, and batch signals.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-2 text-sm text-cyan-950">
              {dailyBriefingItems.length ? dailyBriefingItems.map((item) => (
                <p key={item} className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  {item}
                </p>
              )) : (
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  No critical training operations items in the current dashboard scope.
                </p>
              )}
            </div>
            <Button asChild className="rounded-full bg-cyan-950 text-white hover:bg-cyan-900">
              <Link href="/manager/ai-command">
                Open AI Command
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="signal-shell glass-panel spotlight-card border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <CardTitle className="text-lg">Manager Command Summary</CardTitle>
            <CardDescription>
              A quick read on readiness, coverage, and quiz supply before you drill into reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Completion coverage', value: `${completionCoverage}%`, detail: `${attemptedUserIds.size}/${employees?.length || 0} employees have completed at least one quiz` },
              { label: 'Average score', value: `${averageCompletedScore}%`, detail: `${allAttempts?.length || 0} completed attempt(s) across your quizzes` },
              { label: 'Quiz supply', value: `${activeQuizCount}/${draftQuizCount}`, detail: 'Active quizzes / drafts waiting in your library' },
            ].map((item) => (
              <div key={item.label} className="signal-card rounded-[1.4rem] border border-black/6 bg-white/75 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{item.label}</p>
                <p className="mt-3 text-3xl font-bold text-black">{item.value}</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <DashboardSignalShowcase
          theme="light"
          badge="Live Ops Layer"
          title={priorityAction ? priorityAction.title : 'No urgent manager action is pending.'}
          subtitle={priorityAction ? priorityAction.detail : 'Your quiz library, learner coverage, and training signals are currently in a healthy operating band.'}
        />
      </div>

      {/* TMS Live Status Strip */}
      {tmsSummary && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
          <TmsStatusPill label="Active Batches" value={`${tmsSummary.activeBatches}`} tone="cyan" href="/manager/operations" />
          <TmsStatusPill label="Upcoming Sessions" value={`${tmsSummary.upcomingSessions}`} tone="blue" href="/manager/operations" />
          <TmsStatusPill label="Attendance %" value={`${tmsSummary.attendanceRate}%`} tone="emerald" href="/manager/operations#attendance" />
          <TmsStatusPill label="Cut-off Misses" value={`${tmsSummary.attendanceDueToday}`} tone={tmsSummary.attendanceDueToday > 0 ? 'rose' : 'zinc'} href="/manager/operations#attendance" />
          <TmsStatusPill label="Absence Alerts" value={`${tmsSummary.absenceAlerts}`} tone={tmsSummary.absenceAlerts > 0 ? 'amber' : 'zinc'} href="/manager/operations" />
          <TmsStatusPill label="Candidates Active" value={`${tmsSummary.remainingCandidates}`} tone="violet" href="/manager/operations" />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className={`signal-card relative overflow-hidden bg-gradient-to-br ${stat.bgGradient} ${stat.border} spotlight-card shadow-sm hover:shadow-md transition-shadow`}>
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

      {/* AI Batch Health Insight */}
      {tmsSummary && (
        <AiInsightCard
          type="batch_health"
          data={{ activeBatches: tmsSummary.activeBatches, attendanceRate: tmsSummary.attendanceRate, absenceAlerts: tmsSummary.absenceAlerts, cutoffMisses: tmsSummary.attendanceDueToday, candidates: tmsSummary.remainingCandidates }}
          label="AI Dashboard Insight"
        />
      )}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-zinc-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Recommended Operating Flow</CardTitle>
            <CardDescription>
              The shortest path from setup to measurable training outcomes.
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
            <CardTitle className="text-lg">System Health</CardTitle>
            <CardDescription>
              The signals that usually decide what you should do next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Learner coverage', meaning: `${completionCoverage}% of employees have at least one completed attempt.`, tone: completionCoverage >= 70 ? 'bg-emerald-500' : completionCoverage >= 35 ? 'bg-amber-500' : 'bg-rose-500' },
              { label: 'Draft readiness', meaning: `${readyDrafts.length} draft(s) are ready to publish.`, tone: readyDrafts.length ? 'bg-blue-500' : 'bg-zinc-400' },
              { label: 'Question quality', meaning: `${lowQuestionQuizzes.length} quiz(zes) have fewer than 5 questions.`, tone: lowQuestionQuizzes.length ? 'bg-amber-500' : 'bg-emerald-500' },
              { label: 'Coaching need', meaning: `${lowScoreAttempts.length} completed attempt(s) are below 50%.`, tone: lowScoreAttempts.length ? 'bg-rose-500' : 'bg-emerald-500' },
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
          { title: 'Activate ready drafts', value: `${readyDrafts.length}`, detail: 'Publish prepared assessments once assignments are confirmed.' },
          { title: 'Repair quiz depth', value: `${lowQuestionQuizzes.length}`, detail: 'Add questions to thin assessments before they reach learners.' },
          { title: 'Nudge quiet quizzes', value: `${quietActiveQuizzes.length}`, detail: 'Active quizzes with no completions need reminders or reassignment.' },
          { title: 'Coach low scores', value: `${lowScoreAttempts.length}`, detail: 'Use reports to assign follow-up learning for weak attempts.' },
        ].map((feature, index) => (
          <div key={feature.title} className={`rounded-[1.5rem] border p-4 shadow-sm ${
            index === 0 ? 'border-blue-100 bg-blue-50' :
            index === 1 ? 'border-rose-100 bg-rose-50' :
            index === 2 ? 'border-violet-100 bg-violet-50' :
            'border-amber-100 bg-amber-50'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Priority</p>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-black shadow-sm">{feature.value}</span>
            </div>
            <p className="mt-3 font-semibold text-black">{feature.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">{feature.detail}</p>
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
                <p className="text-xs text-muted-foreground hidden md:block">Rankings &amp; scores</p>
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
                <h3 className="font-semibold text-sm group-hover:text-purple-600 transition-colors">Analytics &amp; AI</h3>
                <p className="text-xs text-muted-foreground hidden md:block">Import &amp; analyze</p>
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
                        <span>-</span>
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

function TmsStatusPill({ label, value, tone, href }: { label: string; value: string; tone: string; href: string }) {
  const tones: Record<string, string> = {
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-900 hover:bg-cyan-100',
    blue: 'border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
    rose: 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100',
    amber: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100',
    violet: 'border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100',
    zinc: 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100',
  }
  return (
    <Link href={href} className={`rounded-2xl border px-4 py-3 transition-colors ${tones[tone] ?? tones.zinc}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-60">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-none">{value}</p>
    </Link>
  )
}
