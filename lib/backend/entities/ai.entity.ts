export type AIProviderName = 'openai' | 'groq' | 'gemini' | 'skilltest_ai_local'

export type InsightType = 'batch_health' | 'attendance' | 'trainer_performance' | 'quiz_results'

export type AIProviderStatus = {
  hasOpenAI: boolean
  hasGroq: boolean
  hasGemini: boolean
  hasAnyAI: boolean
  hasExternalAI: boolean
  providers: string[]
  activeProvider: AIProviderName
}

export type AIInsightResult = {
  insight: string
  provider: AIProviderName
}

export type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike }

export type LearnerStatsPayload = {
  stats?: {
    total_points?: number | null
    current_streak?: number | null
    tests_completed?: number | null
    pass_rate?: number | null
  } | null
}

export type LearnerQuizPayload = {
  attemptStatus?: string | null
  title?: string | null
  topic?: string | null
}

export type RetentionRiskPayload = {
  status?: string | null
  topic?: string | null
  daysSinceLastAssessment?: number | null
}

export type LearnerRecommendationInput = {
  stats?: LearnerStatsPayload | null
  quizzes?: LearnerQuizPayload[]
  retentionRisk?: RetentionRiskPayload | null
}

export type AIChatResult = {
  message: string
  provider: AIProviderName
}
