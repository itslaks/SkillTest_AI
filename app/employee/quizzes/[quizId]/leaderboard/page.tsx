import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getQuizLeaderboard } from '@/lib/actions/employee'
import { RealtimeQuizLeaderboard } from '@/components/employee/realtime-quiz-leaderboard'

export default async function QuizLeaderboardPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('title, topic, difficulty')
    .eq('id', quizId)
    .single()

  if (!quiz) notFound()

  const { data: leaderboard } = await getQuizLeaderboard(quizId)

  return (
    <RealtimeQuizLeaderboard
      quizId={quizId}
      quiz={quiz}
      initialData={leaderboard || []}
      currentUserId={user.id}
    />
  )
}
