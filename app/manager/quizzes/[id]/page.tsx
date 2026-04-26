import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  ArrowLeft, Download, Users, Clock, Trophy, CheckCircle2, XCircle,
  FileQuestion, Pencil, Upload, FileText,
} from 'lucide-react'
import { getQuizLeaderboard } from '@/lib/actions/employee'
import { getQuizAssignments, getEmployees } from '@/lib/actions/manager'
import { QuizToggleActive } from '@/components/manager/quiz-toggle-active'
import { QuizAssignmentManager } from '@/components/manager/quiz-assignment-manager'
import { AssessmentAnalyzer } from '@/components/manager/assessment-analyzer'
import { QuickDeleteButton } from '@/components/manager/quick-delete-button'

const difficultyColors: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-blue-100 text-blue-700',
  hard: 'bg-amber-100 text-amber-700',
  advanced: 'bg-orange-100 text-orange-700',
  hardcore: 'bg-red-100 text-red-700',
}

export default async function QuizDetailPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ assign?: string }> }) {
  const { id: quizId } = await params
  const { assign } = await searchParams
  const autoOpenAssign = assign === '1'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single()

  if (!quiz) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Quiz not found</h2>
      </div>
    )
  }

  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true })

  const { data: leaderboard } = await getQuizLeaderboard(quizId)
  const { data: assignmentData } = await getQuizAssignments(quizId)
  const { data: allEmployees } = await getEmployees()

  // Get attempt count for delete button
  const { count: attemptCount } = await supabase
    .from('quiz_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_id', quizId)
    .not('completed_at', 'is', null)

  const formatTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/manager/quizzes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{quiz.title}</h1>
          <p className="text-muted-foreground">{quiz.description || quiz.topic}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuizToggleActive quizId={quiz.id} isActive={quiz.is_active} />
          <Button variant="outline" asChild>
            <Link href={`/manager/quizzes/${quiz.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" /> Edit Quiz
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a href={`/api/leaderboard/${quiz.id}/download`}>
              <Download className="mr-2 h-4 w-4" /> Download Results
            </a>
          </Button>
          <QuickDeleteButton 
            quizId={quiz.id} 
            quizTitle={quiz.title}
            hasAttempts={(attemptCount || 0) > 0}
          />
        </div>
      </div>

      {/* Quiz Status Banner */}
      {!quiz.is_active && questions && questions.length > 0 ? (
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <CheckCircle2 className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-medium text-amber-800 dark:text-amber-200">Quiz Ready for Review</h3>
                  <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
                    {questions.length} questions generated. Review them below, then activate to make available for assignment.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="border-amber-200 text-amber-700 hover:bg-amber-50">
                  Review Questions Below
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : !quiz.is_active ? (
        <Card className="bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 border-blue-200 dark:border-violet-800">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-violet-900/30">
                  <Upload className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-blue-800 dark:text-violet-200">Add Questions</h3>
                  <p className="text-sm text-blue-700/80 dark:text-violet-300/80">
                    Upload PDF, DOCX, or Excel files to generate questions with AI
                  </p>
                </div>
              </div>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link href={`/manager/quizzes/${quiz.id}/edit`}>
                  <FileText className="mr-2 h-4 w-4" />
                  Upload & Generate
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Quiz Info */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FileQuestion className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{questions?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Questions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{quiz.time_limit_minutes}</p>
              <p className="text-xs text-muted-foreground">Minutes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{leaderboard?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Participants</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Badge variant="secondary" className={`text-sm capitalize ${difficultyColors[quiz.difficulty] || ''}`}>
              {quiz.difficulty}
            </Badge>
            <div>
              <p className="text-sm font-medium">Difficulty</p>
              <p className="text-xs text-muted-foreground">Passing: {quiz.passing_score}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quiz Assignment */}
      {quiz.is_active ? (
        <QuizAssignmentManager
          quizzes={[{
            id: quiz.id,
            title: quiz.title,
            topic: quiz.topic,
            difficulty: quiz.difficulty,
          }]}
          employees={(allEmployees || []).map((e: any) => ({
            id: e.id,
            full_name: e.full_name,
            email: e.email,
            employee_id: e.employee_id,
            department: e.department,
          }))}
          assignments={assignmentData || []}
          autoOpen={autoOpenAssign}
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-muted-foreground">Employee Assignment</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="p-3 rounded-full bg-muted w-fit mx-auto mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-muted-foreground mb-2">Quiz Not Active</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                This quiz is currently in draft mode. {questions && questions.length > 0 ? 'Review the questions above and activate the quiz to make it available for employee assignment.' : 'Add questions and activate the quiz to assign it to employees.'}
              </p>
              {questions && questions.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-3">Ready to assign? Activate this quiz using the toggle above.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Leaderboard
            </CardTitle>
            <CardDescription>{leaderboard?.length || 0} participants</CardDescription>
          </div>
          <Button variant="outline" asChild>
            <a href={`/api/leaderboard/${quizId}/download`}>
              <Download className="mr-2 h-4 w-4" />
              Download Excel
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          {leaderboard && leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div key={entry.user_id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      entry.rank === 1 ? 'bg-yellow-100 text-yellow-700'
                      : entry.rank === 2 ? 'bg-gray-100 text-gray-700'
                      : entry.rank === 3 ? 'bg-amber-100 text-amber-700'
                      : 'bg-muted text-muted-foreground'
                    }`}>
                      {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{entry.full_name}</p>
                      <p className="text-xs text-muted-foreground">{entry.email} • {entry.employee_id || 'No ID'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-bold">{entry.score}%</span>
                    <span className="text-muted-foreground hidden sm:inline">{entry.correct_answers}/{entry.total_questions}</span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(entry.time_taken_seconds)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No participants yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assessment Data Analyzer */}
      <AssessmentAnalyzer quizId={quizId} quizTitle={quiz.title} />

      {/* Questions Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Questions ({questions?.length || 0})</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/manager/quizzes/${quiz.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Questions
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {questions && questions.length > 0 ? (
            <div className="space-y-4">
              {questions.map((q: any, i: number) => (
                <div key={q.id} className="p-4 rounded-lg border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-muted-foreground">Q{i + 1}</span>
                        <Badge variant="secondary" className={`text-[10px] capitalize ${difficultyColors[q.difficulty] || ''}`}>
                          {q.difficulty}
                        </Badge>
                        {q.is_ai_generated && <Badge variant="outline" className="text-[10px]">AI</Badge>}
                      </div>
                      <p className="font-medium">{q.question_text}</p>
                      <div className="mt-2 space-y-1">
                        {q.options?.map((opt: any, idx: number) => (
                          <div key={idx} className={`flex items-center gap-2 text-sm ${
                            opt.isCorrect ? 'text-green-700 font-medium' : 'text-muted-foreground'
                          }`}>
                            {opt.isCorrect ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 opacity-30" />}
                            {opt.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileQuestion className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No questions yet</p>
              <Button variant="link" asChild className="mt-2">
                <Link href={`/manager/quizzes/${quiz.id}/edit`}>
                  Add questions to this quiz
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
