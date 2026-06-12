import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, FileQuestion, Pencil, Trophy, Download, Users, CheckCircle2, Eye, BarChart3, AlertTriangle, ClipboardCheck, Clock, FileText } from 'lucide-react'
import { QuizToggleActive } from '@/components/manager/quiz-toggle-active'
import { QuickDeleteButton } from '@/components/manager/quick-delete-button'

export default async function QuizzesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: quizzes } = await supabase
    .from('quizzes')
    .select(`*, questions(count), quiz_attempts(count), quiz_assignments(count)`)
    .eq('created_by', user?.id)
    .order('created_at', { ascending: false })

  const difficultyColors: Record<string, string> = {
    easy: 'bg-emerald-100 text-emerald-700',
    medium: 'bg-blue-100 text-blue-700',
    hard: 'bg-amber-100 text-amber-700',
    advanced: 'bg-orange-100 text-orange-700',
    hardcore: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quizzes</h1>
          <p className="text-sm text-muted-foreground mt-1">Full quiz control: view, edit, activate, assign, download, and delete</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-xl h-9" asChild>
            <a href="/api/reports/download">
              <Download className="mr-2 h-4 w-4" />All Quiz Reports
            </a>
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl h-9" asChild>
            <Link href="/manager/leaderboard">
              <Trophy className="mr-2 h-4 w-4" />Leaderboards
            </Link>
          </Button>
          <Button size="sm" className="rounded-xl h-9 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 border-0" asChild>
            <Link href="/manager/quizzes/new">
              <Plus className="mr-2 h-4 w-4" />Create Quiz
            </Link>
          </Button>
        </div>
      </div>

      {quizzes && quizzes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quizzes.map((quiz: any) => {
            const questionCount = quiz.questions?.[0]?.count || 0
            const attemptCount = quiz.quiz_attempts?.[0]?.count || 0
            const assignmentCount = quiz.quiz_assignments?.[0]?.count || 0
            const readiness = !quiz.is_active && questionCount >= 5
              ? { label: 'Ready to activate', detail: 'Questions are in place. Review and publish when ready.', icon: ClipboardCheck, className: 'bg-emerald-50 border-emerald-100 text-emerald-800' }
              : questionCount < 5
                ? { label: 'Needs more questions', detail: `${Math.max(5 - questionCount, 0)} more question(s) recommended before assigning.`, icon: AlertTriangle, className: 'bg-amber-50 border-amber-100 text-amber-800' }
                : quiz.is_active && assignmentCount === 0
                  ? { label: 'Needs assignment', detail: 'Active but not assigned to employees yet.', icon: Users, className: 'bg-blue-50 border-blue-100 text-blue-800' }
                  : quiz.is_active && attemptCount === 0
                    ? { label: 'Waiting for completions', detail: 'Assigned quiz has no completed attempts yet.', icon: Clock, className: 'bg-violet-50 border-violet-100 text-violet-800' }
                    : { label: 'Collecting results', detail: 'This quiz has activity and reports are available.', icon: CheckCircle2, className: 'bg-slate-50 border-slate-100 text-slate-700' }
            return (
            <div key={quiz.id} className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
              <div className="p-5 flex-1 space-y-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base truncate">{quiz.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{quiz.description || quiz.topic}</p>
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${quiz.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                    {quiz.is_active ? 'Active' : 'Draft'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${difficultyColors[quiz.difficulty] || 'bg-gray-100 text-gray-700'}`}>{quiz.difficulty}</span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{quiz.topic}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                  <div className="rounded-xl bg-[#f9f9fb] p-2.5 border border-border/40">
                    <p className="text-base font-bold text-blue-600">{questionCount}</p>
                    <p className="text-[10px] text-muted-foreground">Questions</p>
                  </div>
                  <div className="rounded-xl bg-[#f9f9fb] p-2.5 border border-border/40">
                    <p className="text-base font-bold text-amber-600">{quiz.time_limit_minutes}m</p>
                    <p className="text-[10px] text-muted-foreground">Time Limit</p>
                  </div>
                  <div className="rounded-xl bg-[#f9f9fb] p-2.5 border border-border/40">
                    <p className="text-base font-bold text-violet-600">{attemptCount}</p>
                    <p className="text-[10px] text-muted-foreground">Attempts</p>
                  </div>
                </div>

                <div className={`rounded-xl border p-3 ${readiness.className}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <readiness.icon className="h-4 w-4" />
                    {readiness.label}
                  </div>
                  <p className="mt-1 text-xs opacity-80">{readiness.detail}</p>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                    <BarChart3 className="h-4 w-4" />
                    Results & ranking report
                  </div>
                  <p className="mt-1 text-xs text-blue-700/80">
                    Downloads ranked results with employee name, email, score, answers, completion time, and points.
                  </p>
                </div>
              </div>

              <div className="border-t border-border/50 bg-muted/20 px-4 py-3 flex flex-wrap items-center gap-2">
                <QuizToggleActive quizId={quiz.id} isActive={quiz.is_active} />
                <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs" asChild>
                  <Link href={`/manager/quizzes/${quiz.id}`}>
                    <Eye className="h-3 w-3 mr-1" />View
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs" asChild>
                  <Link href={`/manager/quizzes/${quiz.id}/edit`}>
                    <Pencil className="h-3 w-3 mr-1" />Edit
                  </Link>
                </Button>
                {quiz.is_active ? (
                  <Button size="sm" className="h-8 rounded-xl text-xs bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 border-0" asChild>
                    <Link href={`/manager/quizzes/${quiz.id}?assign=1`}>
                      <Users className="h-3 w-3 mr-1" />Assign
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs" asChild>
                    <Link href={`/manager/quizzes/${quiz.id}`}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />Review
                    </Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                  asChild
                >
                  <a href={`/api/leaderboard/${quiz.id}/download`}>
                    <Download className="h-3 w-3 mr-1" />Results
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                  asChild
                >
                  <a href={`/api/leaderboard/${quiz.id}/download?format=txt`}>
                    <FileText className="h-3 w-3 mr-1" />TXT
                  </a>
                </Button>
                <QuickDeleteButton 
                  quizId={quiz.id} 
                  quizTitle={quiz.title}
                  hasAttempts={attemptCount > 0}
                />
              </div>
            </div>
          )})}
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-border/60 shadow-sm py-16 text-center">
          <FileQuestion className="h-14 w-14 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
          <p className="text-sm text-muted-foreground mb-5">Create your first quiz to start assessing employees</p>
          <Button className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 border-0" asChild>
            <Link href="/manager/quizzes/new">
              <Plus className="mr-2 h-4 w-4" />Create Your First Quiz
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
