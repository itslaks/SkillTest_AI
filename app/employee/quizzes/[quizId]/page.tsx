import { getQuizForAttempt } from '@/lib/actions/employee'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { QuizPlayer } from './quiz-player'

export default async function TakeQuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Check if already completed
  const { data: existingAttempt } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('user_id', user.id)
    .single()

  if (existingAttempt?.status === 'completed') {
    redirect(`/employee/quizzes/${quizId}/results`)
  }

  const { data: quizData, error } = await getQuizForAttempt(quizId)

  if (error || !quizData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Quiz Not Found</h2>
          <p className="text-muted-foreground">{error || 'This quiz is not available.'}</p>
        </div>
      </div>
    )
  }

  return <QuizPlayer quiz={quizData} />
}
