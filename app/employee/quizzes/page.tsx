import { getAvailableQuizzes } from '@/lib/actions/employee'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Clock, FileQuestion, CheckCircle2, ArrowRight } from 'lucide-react'

const difficultyColors: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-blue-100 text-blue-700',
  hard: 'bg-amber-100 text-amber-700',
  advanced: 'bg-orange-100 text-orange-700',
  hardcore: 'bg-red-100 text-red-700',
}

export default async function EmployeeQuizzesPage() {
  const { data: quizzes } = await getAvailableQuizzes()

  const available = quizzes?.filter((q: any) => !q.attemptStatus) || []
  const inProgress = quizzes?.filter((q: any) => q.attemptStatus === 'in_progress') || []
  const completed = quizzes?.filter((q: any) => q.attemptStatus === 'completed') || []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
        <p className="text-muted-foreground">Browse available assessments and track your progress</p>
      </div>

      {/* In Progress */}
      {inProgress.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            In Progress
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inProgress.map((quiz: any) => (
              <QuizCard key={quiz.id} quiz={quiz} status="in_progress" />
            ))}
          </div>
        </section>
      )}

      {/* Available */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Available Quizzes</h2>
        {available.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((quiz: any) => (
              <QuizCard key={quiz.id} quiz={quiz} status="available" />
            ))}
          </div>
        ) : (
          <Card className="py-12">
            <CardContent className="text-center">
              <FileQuestion className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No quizzes available</h3>
              <p className="text-muted-foreground">Check back later for new assessments.</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Completed
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((quiz: any) => (
              <QuizCard key={quiz.id} quiz={quiz} status="completed" />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function QuizCard({ quiz, status }: { quiz: any; status: string }) {
  return (
    <Card className={`relative overflow-hidden transition-all hover:shadow-md ${status === 'completed' ? 'opacity-80' : ''}`}>
      {status === 'completed' && (
        <div className="absolute top-3 right-3">
          <span className={`text-lg font-bold ${(quiz.attemptScore || 0) >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
            {quiz.attemptScore}%
          </span>
        </div>
      )}
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-lg truncate">{quiz.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{quiz.description || quiz.topic}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className={difficultyColors[quiz.difficulty] || ''}>
            {quiz.difficulty}
          </Badge>
          <Badge variant="outline">{quiz.topic}</Badge>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileQuestion className="h-4 w-4" />
            {quiz.questions?.[0]?.count || quiz.question_count} questions
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {quiz.time_limit_minutes} min
          </span>
        </div>

        <Button className="w-full" variant={status === 'completed' ? 'outline' : 'default'} asChild>
          <Link href={status === 'completed' ? `/employee/quizzes/${quiz.id}/results` : `/employee/quizzes/${quiz.id}`}>
            {status === 'completed' ? 'View Results' : status === 'in_progress' ? 'Continue Quiz' : 'Start Quiz'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
