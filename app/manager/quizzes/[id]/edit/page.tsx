import { getQuizWithQuestions } from '@/lib/actions/quiz'
import { redirect } from 'next/navigation'
import { QuizEditor } from '@/components/manager/quiz-editor'

interface EditQuizPageProps {
  params: Promise<{ id: string }>
}

export default async function EditQuizPage({ params }: EditQuizPageProps) {
  const { id } = await params
  const { data, error } = await getQuizWithQuestions(id)

  if (error || !data) {
    redirect('/manager/quizzes')
  }

  const { questions, ...quiz } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Quiz</h1>
        <p className="text-muted-foreground mt-1">Modify quiz details and manage questions</p>
      </div>

      <QuizEditor quiz={quiz} questions={questions || []} />
    </div>
  )
}
