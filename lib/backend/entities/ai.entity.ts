export type AIProviderName = 'openai' | 'gemini' | 'skilltest_ai_local'

export type InsightType = 'batch_health' | 'attendance' | 'trainer_performance' | 'quiz_results'

export type AIProviderStatus = {
  hasOpenAI: boolean
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

export type LearnerRecommendationInput = {
  stats: any
  quizzes: any[]
  retentionRisk?: any
}

export type AIChatResult = {
  message: string
  provider: AIProviderName
}
