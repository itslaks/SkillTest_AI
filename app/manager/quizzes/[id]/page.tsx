import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  ArrowLeft, Download, Users, Clock, Trophy, CheckCircle2, XCircle,
  FileQuestion, Pencil, ClipboardList, Brain,
} from 'lucide-react'
import { getQuizLeaderboard } from '@/lib/actions/employee'
import { getQuizAssignments, getEmployees } from '@/lib/actions/manager'
import { QuizToggleActive } from '@/components/manager/quiz-toggle-active'
import { QuizAssignmentManager } from '@/components/manager/quiz-assignment-manager'
import { AssessmentAnalyzer } from '@/components/manager/assessment-analyzer'

const difficultyColors: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-blue-100 text-blue-700',
  hard: 'bg-amber-100 text-amber-700',
  advanced: 'bg-orange-100 text-orange-700',
  hardcore: 'bg-red-100 text-red-700',
}

export default async function QuizDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: quizId } = await params

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

  const formatTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/manager/quizzes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{quiz.title}</h1>
          <p className="text-muted-foreground">{quiz.description || quiz.topic}</p>
        </div>
        <QuizToggleActive quizId={quiz.id} isActive={quiz.is_active} />
        <Button variant="outline" asChild>
          <Link href={`/manager/quizzes/${quiz.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" /> Edit Quiz
          </Link>
        </Button>
      </div>

      {/* Quiz Info */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      />

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
          {leaderboard && leaderboard.length > 0 && (
            <Button variant="outline" asChild>
              <a href={`/api/leaderboard/${quizId}/download`} download>
                <Download className="mr-2 h-4 w-4" />
                Download Excel
              </a>
            </Button>
          )}
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
                    <span className="text-muted-foreground">{entry.correct_answers}/{entry.total_questions}</span>
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
        <CardHeader>
          <CardTitle>Questions ({questions?.length || 0})</CardTitle>
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
                        {!q.is_approved && <Badge variant="destructive" className="text-[10px]">Pending</Badge>}
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
