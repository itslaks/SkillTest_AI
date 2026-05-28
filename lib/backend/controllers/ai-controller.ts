import {
  createChatSession,
  fetchAssessmentResultsForQuiz,
  fetchChatMessages,
  fetchChatSessions,
  saveChatMessage,
} from '@/lib/backend/repositories/ai-chat-repository'
import { generateAssessmentChatReply, generateLearnerRecommendation, generateManagerInsight, getAIProviderStatus } from '@/lib/backend/services/ai-service'
import { requireManagerForApi } from '@/lib/rbac'
import { createRequestDbClient } from '@/lib/backend/database/supabase'
import { NextRequest, NextResponse } from 'next/server'
import type { InsightType } from '@/lib/backend/entities/ai.entity'

export async function getAIStatus() {
  return NextResponse.json(getAIProviderStatus())
}

export async function createManagerInsight(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth

  const { type, data } = (await request.json()) as { type: InsightType; data: any }
  if (!type || !data) {
    return NextResponse.json({ error: 'type and data are required' }, { status: 400 })
  }

  const result = await generateManagerInsight(type, data)
  return NextResponse.json({ insight: result.insight, provider: result.provider })
}

export async function createLearnerRecommendation(request: NextRequest) {
  const supabase = await createRequestDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = await generateLearnerRecommendation(body)
  return NextResponse.json({ recommendation: result.insight, provider: result.provider })
}

export async function createAIChatReply(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth

  const { message, sessionId, quizId, assessmentData } = await request.json()
  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  let currentSessionId = sessionId
  if (!currentSessionId) {
    const { data: newSession, error } = await createChatSession({
      userId: auth.userId,
      quizId,
      title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
    })
    if (error || !newSession) {
      return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 })
    }
    currentSessionId = newSession.id
  }

  await saveChatMessage({ sessionId: currentSessionId, role: 'user', content: message })

  let loadedAssessmentResults: any[] = []
  if (!assessmentData?.length && quizId) {
    const { data } = await fetchAssessmentResultsForQuiz(quizId)
    loadedAssessmentResults = data || []
  }

  const result = await generateAssessmentChatReply({
    message,
    assessmentData,
    loadedAssessmentResults,
  })

  await saveChatMessage({ sessionId: currentSessionId, role: 'assistant', content: result.message })

  return NextResponse.json({
    message: result.message,
    provider: result.provider,
    sessionId: currentSessionId,
  })
}

export async function getAIChatHistory(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth

  const sessionId = request.nextUrl.searchParams.get('sessionId')

  if (sessionId) {
    const { data: messages, error } = await fetchChatMessages(sessionId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ messages })
  }

  const { data: sessions, error } = await fetchChatSessions(auth.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions })
}
