import { buildCompactAssessmentContext, callAI, type AIMessage } from '@/lib/ai'
import type {
  AIChatResult,
  AIInsightResult,
  AIProviderName,
  AIProviderStatus,
  InsightType,
  LearnerRecommendationInput,
} from '@/lib/backend/entities/ai.entity'

const INSIGHT_PROMPTS: Record<InsightType, string> = {
  batch_health: 'You are a training manager coach. Given batch health data, give 1 concise actionable recommendation in 2 sentences max.',
  attendance: 'You are a training manager coach. Given attendance data, identify the single biggest risk and suggest one action in 2 sentences max.',
  trainer_performance: 'You are a training manager coach. Given trainer metrics, name the top and bottom performer and suggest one improvement in 2 sentences max.',
  quiz_results: 'You are a training assessment coach. Given quiz result data, identify the weakest area and suggest one remediation in 2 sentences max.',
}

export function getAIProviderStatus(): AIProviderStatus {
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY)
  const hasGemini = Boolean(process.env.GOOGLE_GEMINI_API_KEY)

  return {
    hasOpenAI,
    hasGemini,
    hasAnyAI: true,
    hasExternalAI: hasOpenAI || hasGemini,
    providers: [
      ...(hasOpenAI ? ['OpenAI'] : []),
      ...(hasGemini ? ['Google Gemini'] : []),
      ...(hasOpenAI || hasGemini ? [] : ['SkillTest_AI local intelligence']),
    ],
    activeProvider: hasOpenAI ? 'openai' : hasGemini ? 'gemini' : 'skilltest_ai_local',
  }
}

export async function generateManagerInsight(type: InsightType, data: any): Promise<AIInsightResult> {
  const context = buildInsightContext(type, data)
  const fallback = buildLocalManagerInsight(type, data)
  return callAIWithFallback(
    [
      { role: 'system', content: INSIGHT_PROMPTS[type] ?? INSIGHT_PROMPTS.batch_health },
      { role: 'user', content: context },
    ],
    { maxTokens: 200, temperature: 0.4 },
    fallback,
  )
}

export async function generateLearnerRecommendation(input: LearnerRecommendationInput): Promise<AIInsightResult> {
  const context = buildLearnerContext(input)
  const fallback = buildLocalLearnerRecommendation(input)
  return callAIWithFallback(
    [
      {
        role: 'system',
        content: 'You are a learning coach inside SkillTest_AI: Mavericks Execution Platform. Give one short, encouraging, personalised recommendation (max 2 sentences). Be direct and practical, not generic.',
      },
      { role: 'user', content: context },
    ],
    { maxTokens: 150, temperature: 0.7 },
    fallback,
  )
}

export async function generateAssessmentChatReply(args: {
  message: string
  assessmentData?: any[]
  loadedAssessmentResults?: any[]
}): Promise<AIChatResult> {
  const context =
    args.assessmentData?.length
      ? buildCompactAssessmentContext(args.assessmentData)
      : args.loadedAssessmentResults?.length
        ? buildCompactAssessmentContext(args.loadedAssessmentResults)
        : ''
  const fallback = buildLocalChatReply(args.message, args.assessmentData || args.loadedAssessmentResults || [])
  const result = await callAIWithFallback(
    [
      {
        role: 'system',
        content: `You are SkillTest_AI, a training analytics assistant for managers. Be concise and data-driven.
${context ? `\nASSESSMENT DATA:\n${context}\n` : 'No data loaded. Ask the user to provide assessment data when needed.'}
Rules: identify patterns, give actionable advice, format numbers cleanly, max 3 bullet points per insight.`,
      },
      { role: 'user', content: args.message },
    ],
    { maxTokens: 600, temperature: 0.5 },
    fallback,
  )
  return { message: result.insight, provider: result.provider }
}

function buildInsightContext(type: InsightType, data: any) {
  if (type === 'quiz_results' && Array.isArray(data)) return buildCompactAssessmentContext(data)
  if (typeof data === 'object') return JSON.stringify(data, null, 0)
  return String(data)
}

async function callAIWithFallback(
  messages: AIMessage[],
  options: { maxTokens: number; temperature: number },
  fallbackText: string,
): Promise<AIInsightResult> {
  if (!getAIProviderStatus().hasAnyAI) {
    return { insight: fallbackText, provider: 'skilltest_ai_local' }
  }

  try {
    const { text, provider } = await callAI(messages, options)
    const trimmed = text.trim()
    return {
      insight: trimmed || fallbackText,
      provider: provider as AIProviderName,
    }
  } catch (error) {
    console.error('SkillTest_AI provider failed, using local intelligence:', error)
    return { insight: fallbackText, provider: 'skilltest_ai_local' }
  }
}

function buildLearnerContext({ stats, quizzes, retentionRisk }: LearnerRecommendationInput) {
  const points = stats?.stats?.total_points ?? 0
  const streak = stats?.stats?.current_streak ?? 0
  const completed = stats?.stats?.tests_completed ?? 0
  const open = quizzes?.filter((q: any) => q.attemptStatus !== 'completed').length ?? 0
  const nextQuiz = quizzes?.find((q: any) => q.attemptStatus !== 'completed')
  const passRate = stats?.stats?.pass_rate ?? 0
  return `learner: points=${points}, streak=${streak}d, completed=${completed}, open=${open}, passRate=${passRate}%${retentionRisk ? `, retention risk: ${retentionRisk.topic} (${retentionRisk.daysSinceLastAssessment} days)` : ''}${nextQuiz ? `, next quiz: "${nextQuiz.title}" (${nextQuiz.topic})` : ''}`
}

function buildLocalLearnerRecommendation({ stats, quizzes, retentionRisk }: LearnerRecommendationInput) {
  const streak = stats?.stats?.current_streak ?? 0
  const passRate = stats?.stats?.pass_rate ?? 0
  const nextQuiz = quizzes?.find((q: any) => q.attemptStatus !== 'completed')
  if (retentionRisk?.status === 'critical') {
    return `SkillTest_AI sees retention risk in ${retentionRisk.topic}. Review the last weak concepts for 15 minutes, then attempt one focused practice quiz.`
  }
  if (passRate < 60) {
    return 'SkillTest_AI recommends a short revision sprint before the next assessment. Focus on accuracy first, then increase speed.'
  }
  if (nextQuiz) {
    return `SkillTest_AI suggests starting "${nextQuiz.title}" next while your momentum is active. Keep the streak steady and review mistakes immediately after submission.`
  }
  return streak > 0
    ? `SkillTest_AI sees a healthy ${streak}-day rhythm. Use today for a light recap so the streak becomes durable, not just active.`
    : 'SkillTest_AI recommends one small action today: complete a short quiz or review note to restart your learning rhythm.'
}

function buildLocalManagerInsight(type: InsightType, data: any) {
  if (type === 'attendance') {
    const rows = Array.isArray(data) ? data : Object.values(data || {})
    const absent = rows.filter((item: any) => String(item?.status || '').toLowerCase() === 'absent').length
    return absent
      ? `SkillTest_AI detected ${absent} absence signal(s). Prioritize coordinator follow-up for repeated absences before assessment readiness drops.`
      : 'SkillTest_AI sees no dominant absence spike in this snapshot. Keep the cut-off reminder active and watch late submissions.'
  }

  if (type === 'trainer_performance') {
    const rows = Array.isArray(data) ? data : []
    const sorted = rows
      .filter((item: any) => typeof item?.impactScore === 'number' || typeof item?.averageScore === 'number')
      .sort((a: any, b: any) => (b.impactScore ?? b.averageScore ?? 0) - (a.impactScore ?? a.averageScore ?? 0))
    if (sorted.length) {
      return `SkillTest_AI ranks ${sorted[0].trainerName || 'the leading trainer'} strongest in this view. Pair lower-impact sessions with their pattern and review topic-level gaps.`
    }
  }

  if (type === 'quiz_results') {
    const rows = Array.isArray(data) ? data : []
    const scores = rows.map((item: any) => Number(item.percentage ?? item.score ?? 0)).filter(Number.isFinite)
    const avg = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0
    return avg < 65
      ? `SkillTest_AI flags quiz readiness risk: average score is ${avg}%. Run remediation on the weakest topic before publishing the next assessment.`
      : `SkillTest_AI sees stable quiz performance at ${avg}%. Increase difficulty slightly for high performers while supporting the bottom band.`
  }

  return 'SkillTest_AI recommends focusing on the largest operational gap first: batch health, attendance discipline, assessment clearance, or feedback closure.'
}

function buildLocalChatReply(message: string, rows: any[]) {
  const scores = rows.map((item: any) => Number(item.percentage ?? item.score ?? 0)).filter(Number.isFinite)
  const avg = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null
  const lower = message.toLowerCase()
  if (!rows.length) {
    return 'SkillTest_AI is ready, but no assessment dataset is loaded in this chat. Upload or select assessment results, then ask for weak topics, pass rate, or remediation actions.'
  }
  if (lower.includes('weak') || lower.includes('risk')) {
    return `SkillTest_AI risk read: average score is ${avg}%, so prioritize learners below the clearance line and schedule a focused remediation block before the next sprint.`
  }
  if (lower.includes('top') || lower.includes('best')) {
    return `SkillTest_AI recommends using the top performers as peer anchors, but keep topper decisions tied to assessment score, project score, and attendance threshold.`
  }
  return `SkillTest_AI summary: ${rows.length} assessment row(s) loaded with average score ${avg}%. Next action: split candidates into remedial, ready, and stretch groups.`
}
