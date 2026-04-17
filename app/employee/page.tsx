import { getEmployeeStats, getAvailableQuizzes } from '@/lib/actions/employee'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  Trophy, Flame, Target, Star, ArrowRight, FileQuestion, Clock, Award, Sparkles, CheckCircle2,
} from 'lucide-react'

export default async function EmployeeDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user?.id)
    .single()

  const fullName = profile?.full_name || user?.user_metadata?.full_name || null

  const { data: stats } = await getEmployeeStats()
  const { data: quizzes } = await getAvailableQuizzes()

  const activeQuizzes = quizzes?.filter((q: any) => !q.attemptStatus || q.attemptStatus === 'in_progress') || []
  const completedQuizzes = quizzes?.filter((q: any) => q.attemptStatus === 'completed') || []

  const statCards = [
    { title: 'Total Points', value: stats?.stats?.total_points || 0, suffix: '', icon: Star, color: 'text-amber-600', bg: 'bg-amber-50', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500' },
    { title: 'Day Streak', value: stats?.stats?.current_streak || 0, suffix: ' days', icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50', iconBg: 'bg-orange-500/10', iconColor: 'text-orange-500' },
    { title: 'Quizzes Done', value: stats?.stats?.tests_completed || 0, suffix: '', icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
    { title: 'Avg Score', value: Math.round(stats?.stats?.average_score || 0), suffix: '%', icon: Trophy, color: 'text-blue-600', bg: 'bg-blue-50', iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500' },
  ]

  const difficultyColors: Record<string, string> = {
    easy: 'bg-emerald-100 text-emerald-700',
    medium: 'bg-blue-100 text-blue-700',
    hard: 'bg-amber-100 text-amber-700',
    advanced: 'bg-orange-100 text-orange-700',
    hardcore: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0f0f10] p-6 md:p-8 text-white">
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-violet-600/15 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-semibold tracking-wide uppercase mb-3">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              Employee Dashboard
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1.5">
              Hey, {fullName?.split(' ')[0] || 'there'} 👋
            </h1>
            <p className="text-white/50 text-sm md:text-base">
              Keep learning, earn badges, and climb the leaderboard!
            </p>
          </div>
          <Button asChild className="bg-white text-[#0f0f10] hover:bg-white/90 font-semibold shrink-0 rounded-xl h-11 px-5">
            <Link href="/employee/quizzes">
              <FileQuestion className="mr-2 h-4 w-4" />Take a Quiz
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.title} className={`rounded-2xl p-5 border border-border/60 bg-white shadow-sm`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
              <div className={`w-8 h-8 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>
              {stat.value}<span className="text-sm font-normal text-muted-foreground">{stat.suffix}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Quick nav cards */}
      <div className="grid gap-4 md:grid-cols-3">
        { [
          { href: '/employee/quizzes', icon: FileQuestion, label: 'Take Quizzes', desc: `${activeQuizzes.length} available`, iconBg: 'bg-violet-500/10', iconColor: 'text-violet-500' },
          { href: '/employee/leaderboard', icon: Trophy, label: 'Leaderboard', desc: 'See rankings', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500' },
          { href: '/employee/badges', icon: Award, label: 'Badges', desc: `${stats?.badges?.length || 0} earned`, iconBg: 'bg-pink-500/10', iconColor: 'text-pink-500' },
        ].map(item => (
          <Link key={item.href} href={item.href} className="group flex items-center gap-4 p-5 rounded-2xl bg-white border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
            <div className={`w-11 h-11 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0`}>
              <item.icon className={`h-5 w-5 ${item.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{item.label}</p>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </Link>
        )) }
      </div>

      {/* Available quizzes */}
      <div className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/20">
          <div>
            <h2 className="font-semibold">Available Quizzes</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Take an assessment to earn points</p>
          </div>
          <Link href="/employee/quizzes" className="text-sm text-primary font-medium hover:underline underline-offset-4 flex items-center gap-1">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="p-5">
          {activeQuizzes.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeQuizzes.slice(0, 6).map((quiz: any) => (
                <div key={quiz.id} className="flex flex-col p-4 rounded-xl border border-border/60 hover:border-primary/30 hover:shadow-sm transition-all bg-[#f9f9fb]">
                  <div className="flex items-start gap-2 mb-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${difficultyColors[quiz.difficulty] || 'bg-gray-100 text-gray-700'}`}>{quiz.difficulty}</span>
                  </div>
                  <h3 className="font-semibold text-sm line-clamp-1 mb-1">{quiz.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{quiz.description || quiz.topic}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><FileQuestion className="h-3 w-3" />{quiz.questions?.[0]?.count || quiz.question_count} Q</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{quiz.time_limit_minutes}m</span>
                  </div>
                  <Button size="sm" className="mt-auto rounded-xl h-8 text-xs font-semibold bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 border-0" asChild>
                    <Link href={`/employee/quizzes/${quiz.id}`}>
                      {quiz.attemptStatus === 'in_progress' ? '▶ Continue' : '🚀 Start'}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No quizzes available right now</p>
              <p className="text-sm mt-1">Check back later for new assessments</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent results */}
      {stats?.recentAttempts && stats.recentAttempts.length > 0 && (
        <div className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50 bg-muted/20">
            <h2 className="font-semibold">Recent Results</h2>
          </div>
          <div className="divide-y divide-border/40">
            {stats.recentAttempts.slice(0, 5).map((attempt: any) => (
              <div key={attempt.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium text-sm">{attempt.quizzes?.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{attempt.quizzes?.topic}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{Math.floor(attempt.time_taken_seconds / 60)}m {attempt.time_taken_seconds % 60}s</span>
                  <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${attempt.score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {attempt.score}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Badges */}
      {stats?.badges && stats.badges.length > 0 && (
        <div className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/20">
            <h2 className="font-semibold flex items-center gap-2"><Award className="h-4 w-4 text-pink-500" />Your Badges</h2>
            <Link href="/employee/badges" className="text-sm text-primary font-medium hover:underline underline-offset-4 flex items-center gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="p-5 flex flex-wrap gap-3">
            {stats.badges.map((ub: any) => (
              <div key={ub.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 border border-violet-100">
                <span className="text-lg">🏆</span>
                <div>
                  <p className="text-xs font-semibold text-violet-800">{ub.badges?.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
