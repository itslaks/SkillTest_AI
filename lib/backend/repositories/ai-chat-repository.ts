import { createRequestDbClient } from '@/lib/backend/database/supabase'

export async function createChatSession(args: { userId: string; quizId?: string | null; title: string }) {
  const supabase = await createRequestDbClient()
  return supabase
    .from('ai_chat_sessions')
    .insert({
      user_id: args.userId,
      quiz_id: args.quizId || null,
      title: args.title,
    })
    .select()
    .single()
}

export async function saveChatMessage(args: { sessionId: string; role: 'user' | 'assistant'; content: string }) {
  const supabase = await createRequestDbClient()
  return supabase.from('ai_chat_messages').insert({
    session_id: args.sessionId,
    role: args.role,
    content: args.content,
  })
}

export async function fetchAssessmentResultsForQuiz(quizId: string) {
  const supabase = await createRequestDbClient()
  return supabase
    .from('assessment_results')
    .select('candidate_name,candidate_email,percentage,time_taken_minutes,performance_category,percentile')
    .eq('quiz_id', quizId)
    .order('percentage', { ascending: false })
    .limit(60)
}

export async function fetchChatMessages(sessionId: string) {
  const supabase = await createRequestDbClient()
  return supabase
    .from('ai_chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
}

export async function fetchChatSessions(userId: string) {
  const supabase = await createRequestDbClient()
  return supabase
    .from('ai_chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(20)
}
