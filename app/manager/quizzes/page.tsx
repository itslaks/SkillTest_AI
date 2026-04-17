import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, FileQuestion, Pencil, Upload, Trophy, Download, Users, Clock, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { QuizToggleActive } from '@/components/manager/quiz-toggle-active'
import { QuizDeleteButton } from '@/components/manager/quiz-delete-button'

export default async function QuizzesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: quizzes } = await supabase
    .from('quizzes')
    .select(`*, questions(count), quiz_attempts(count)`)
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
          <p className="text-sm text-muted-foreground mt-1">Create, assign, and download reports in a few clicks</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz: any) => (
            <div key={quiz.id} className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base truncate">{quiz.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{quiz.description || quiz.topic}</p>
                  </div>
                  <QuizDeleteButton quizId={quiz.id} quizTitle={quiz.title} />
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${difficultyColors[quiz.difficulty] || 'bg-gray-100 text-gray-700'}`}>{quiz.difficulty}</span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{quiz.topic}</span>
                  {quiz.is_active ? (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Active</span>
                  ) : (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                  <div className="rounded-xl bg-[#f9f9fb] p-2.5 border border-border/40">
                    <p className="text-base font-bold text-blue-600">{quiz.questions?.[0]?.count || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Questions</p>
                  </div>
                  <div className="rounded-xl bg-[#f9f9fb] p-2.5 border border-border/40">
                    <p className="text-base font-bold text-amber-600">{quiz.time_limit_minutes}m</p>
                    <p className="text-[10px] text-muted-foreground">Time Limit</p>
                  </div>
                  <div className="rounded-xl bg-[#f9f9fb] p-2.5 border border-border/40">
                    <p className="text-base font-bold text-violet-600">{quiz.quiz_attempts?.[0]?.count || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Attempts</p>
                  </div>
                </div>
              </div>

              {/* Quick action footer */}
              <div className="border-t border-border/50 bg-muted/20 px-4 py-3 flex items-center gap-2">
                <QuizToggleActive quizId={quiz.id} isActive={quiz.is_active} />
                <div className="flex-1" />
                <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs" asChild>
                  <Link href={`/manager/quizzes/${quiz.id}/edit`}>
                    <Pencil className="h-3 w-3 mr-1" />Edit
                  </Link>
                </Button>
                <Button size="sm" className="h-8 rounded-xl text-xs bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 border-0" asChild>
                  <Link href={`/manager/quizzes/${quiz.id}?assign=1`}>
                    <Users className="h-3 w-3 mr-1" />Assign
                  </Link>
                </Button>
                {(quiz.quiz_attempts?.[0]?.count || 0) > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-xl text-xs"
                    asChild
                  >
                    <a href={`/api/leaderboard/${quiz.id}/download`} target="_blank">
                      <Download className="h-3 w-3 mr-1" />Report
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
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
