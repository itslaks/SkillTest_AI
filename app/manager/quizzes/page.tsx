import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, FileQuestion, MoreHorizontal, Pencil, Trash2, Eye, Power, Upload, Trophy, FileSpreadsheet } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { QuizToggleActive } from '@/components/manager/quiz-toggle-active'
import { QuizDeleteButton } from '@/components/manager/quiz-delete-button'

export default async function QuizzesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: quizzes } = await supabase
    .from('quizzes')
    .select(`
      *,
      questions(count),
      quiz_attempts(count)
    `)
    .eq('created_by', user?.id)
    .order('created_at', { ascending: false })

  const difficultyColors: Record<string, string> = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-blue-100 text-blue-700',
    hard: 'bg-amber-100 text-amber-700',
    advanced: 'bg-orange-100 text-orange-700',
    hardcore: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
          <p className="text-muted-foreground">
            Create and manage your employee assessments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/manager/leaderboard">
              <Trophy className="mr-2 h-4 w-4" />
              Leaderboards
            </Link>
          </Button>
          <Button asChild>
            <Link href="/manager/quizzes/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Quiz
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Actions Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Upload className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-amber-800 dark:text-amber-200">Import Questions from Excel</h3>
                <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
                  Create a quiz first, then use the &ldquo;Import Questions&rdquo; feature in the quiz editor.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <FileSpreadsheet className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-purple-800 dark:text-purple-200">Analyze Assessment Data</h3>
                <p className="text-sm text-purple-700/80 dark:text-purple-300/80">
                  Go to <Link href="/manager/analytics" className="underline font-medium">Analytics & AI</Link> to import CSV results and chat with AI.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {quizzes && quizzes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz: any) => (
            <Card key={quiz.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-2">
                    <CardTitle className="text-lg truncate">{quiz.title}</CardTitle>
                    <CardDescription className="line-clamp-2 mt-1">
                      {quiz.description || 'No description'}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/manager/quizzes/${quiz.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/manager/quizzes/${quiz.id}/edit`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Quiz
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <QuizDeleteButton quizId={quiz.id} quizTitle={quiz.title} />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className={difficultyColors[quiz.difficulty]}>
                    {quiz.difficulty}
                  </Badge>
                  <Badge variant="outline">{quiz.topic}</Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="p-2 rounded-lg bg-muted">
                    <p className="font-semibold">{quiz.questions?.[0]?.count || 0}</p>
                    <p className="text-muted-foreground text-xs">Questions</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <p className="font-semibold">{quiz.time_limit_minutes}</p>
                    <p className="text-muted-foreground text-xs">Minutes</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <p className="font-semibold">{quiz.quiz_attempts?.[0]?.count || 0}</p>
                    <p className="text-muted-foreground text-xs">Attempts</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <QuizToggleActive quizId={quiz.id} isActive={quiz.is_active} />
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/manager/quizzes/${quiz.id}`}>
                      Manage
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="py-12">
          <CardContent className="text-center">
            <FileQuestion className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No quizzes yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first quiz to start assessing your employees
            </p>
            <Button asChild>
              <Link href="/manager/quizzes/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Quiz
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
