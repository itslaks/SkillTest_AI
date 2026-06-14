import type {
  AttemptInsight,
  DifficultyLevel,
  Quiz,
  QuizAnswer,
  ReadinessInsight,
  RetentionCheck,
  TopicStrengthPoint,
  TrainerImpactPoint,
} from '@/lib/types/database'

const difficultyRank: Record<DifficultyLevel, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
  advanced: 4,
  hardcore: 5,
}

const rankedDifficulties = Object.entries(difficultyRank)
  .sort((a, b) => a[1] - b[1])
  .map(([difficulty]) => difficulty as DifficultyLevel)

export type AttemptLike = {
  quiz_id: string
  user_id?: string
  score?: number | null
  completed_at?: string | null
  created_at?: string | null
  answers?: QuizAnswer[] | null
  quizzes?: {
    id?: string
    title?: string | null
    topic?: string | null
    difficulty?: DifficultyLevel | null
    created_by?: string | null
  } | Array<{
    id?: string
    title?: string | null
    topic?: string | null
    difficulty?: DifficultyLevel | null
    created_by?: string | null
  }> | null
}

export type QuizLike = {
  id: string
  title?: string | null
  topic?: string | null
  difficulty?: DifficultyLevel | null
  created_by?: string | null
}

export type ProfileLike = {
  id: string
  full_name?: string | null
}

function getQuizRelation(attempt: AttemptLike) {
  if (Array.isArray(attempt.quizzes)) {
    return attempt.quizzes[0] || null
  }
  return attempt.quizzes || null
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function getDifficultyRank(level?: string | null) {
  if (!level) return difficultyRank.medium
  return difficultyRank[level as DifficultyLevel] ?? difficultyRank.medium
}

export function getDifficultyLabel(level?: string | null) {
  return (level || 'medium') as DifficultyLevel
}

export function shiftDifficulty(
  current: DifficultyLevel | null | undefined,
  delta: -1 | 0 | 1
): DifficultyLevel {
  const index = rankedDifficulties.indexOf(getDifficultyLabel(current))
  const safeIndex = index >= 0 ? index : 1
  return rankedDifficulties[clamp(safeIndex + delta, 0, rankedDifficulties.length - 1)]
}

export function analyzeAttemptPattern(
  answers: QuizAnswer[],
  baseDifficulty?: DifficultyLevel | null,
  topicAttempts: AttemptLike[] = []
): AttemptInsight {
  const averageAnswerTime = answers.length
    ? Math.round(answers.reduce((sum, answer) => sum + answer.timeSpent, 0) / answers.length)
    : 0

  const easyQuestionOverloadCount = answers.filter((answer) => {
    const difficulty = answer.questionDifficulty || baseDifficulty || 'medium'
    return difficulty === 'easy' && answer.timeSpent > 15
  }).length
  const fastGuessCount = answers.filter((answer) => answer.timeSpent <= 4).length
  const slowStruggleCount = answers.filter((answer) => !answer.isCorrect && answer.timeSpent >= 25).length
  const timeVariance = answers.length
    ? Math.round(
        answers.reduce((sum, answer) => sum + Math.pow(answer.timeSpent - averageAnswerTime, 2), 0) / answers.length
      )
    : 0

  const fastWrongRun = answers.reduce(
    (state, answer) => {
      const nextStreak = !answer.isCorrect && answer.timeSpent <= 5 ? state.current + 1 : 0
      return {
        current: nextStreak,
        longest: Math.max(state.longest, nextStreak),
      }
    },
    { current: 0, longest: 0 }
  ).longest

  const perfectFastAttempts = topicAttempts.filter((attempt) => {
    const answerSet = attempt.answers || []
    if (!answerSet.length) return false
    const average = answerSet.reduce((sum, answer) => sum + answer.timeSpent, 0) / answerSet.length
    return (attempt.score || 0) === 100 && average < 5
  }).length

  const cognitiveLoadDetected = easyQuestionOverloadCount > 0
  const panicModeDetected = fastWrongRun >= 2
  const antiGamingDetected = perfectFastAttempts >= 3
  const rhythmPenalty = clamp(Math.round(timeVariance / 18), 0, 18)
  const focusScore = clamp(
    100 - easyQuestionOverloadCount * 14 - fastGuessCount * 7 - slowStruggleCount * 10 - rhythmPenalty,
    12,
    100
  )
  const confidenceScore = clamp(
    72 + answers.filter((answer) => answer.isCorrect).length * 5 - fastWrongRun * 16 - slowStruggleCount * 8 - easyQuestionOverloadCount * 8,
    8,
    100
  )
  const riskLevel: AttemptInsight['riskLevel'] =
    panicModeDetected || focusScore < 45 || confidenceScore < 40
      ? 'high'
      : cognitiveLoadDetected || fastGuessCount >= 2 || slowStruggleCount >= 2
        ? 'medium'
        : 'low'
  const behaviorTags = [
    cognitiveLoadDetected ? 'cognitive-load' : null,
    panicModeDetected ? 'panic-streak' : null,
    antiGamingDetected ? 'challenge-needed' : null,
    fastGuessCount >= 2 ? 'fast-guessing' : null,
    slowStruggleCount >= 2 ? 'slow-struggle' : null,
    focusScore >= 80 ? 'steady-focus' : null,
  ].filter(Boolean) as string[]

  const suggestedNextDifficulty = antiGamingDetected
    ? shiftDifficulty(baseDifficulty, 1)
    : cognitiveLoadDetected
      ? shiftDifficulty(baseDifficulty, -1)
      : panicModeDetected
        ? shiftDifficulty(baseDifficulty, -1)
        : shiftDifficulty(baseDifficulty, 1)

  const masterySignal = antiGamingDetected
    ? 'Memorization pattern detected. Injecting challenge mode is recommended.'
    : cognitiveLoadDetected
      ? 'Cognitive load is elevated on easy questions.'
      : panicModeDetected
        ? 'Fast wrong streak suggests panic mode. Cooldown is recommended.'
        : 'Healthy response rhythm with room to push difficulty.'

  return {
    averageAnswerTime,
    easyQuestionOverloadCount,
    fastGuessCount,
    slowStruggleCount,
    timeVariance,
    focusScore,
    confidenceScore,
    riskLevel,
    behaviorTags,
    cognitiveLoadDetected,
    panicModeDetected,
    panicStreak: fastWrongRun,
    suggestedNextDifficulty,
    antiGamingDetected,
    masterySignal,
  }
}

export function computeReadinessInsight(args: {
  attempts: AttemptLike[]
  quiz: Pick<Quiz, 'topic' | 'difficulty'>
  currentStreak?: number | null
  domain?: string | null
  daysInTraining?: number
}): ReadinessInsight {
  const { attempts, quiz, currentStreak = 0, domain, daysInTraining = 0 } = args
  const completedAttempts = attempts.filter((attempt) => typeof attempt.score === 'number')
  const targetTopic = normalizeSkillLabel(quiz.topic)
  const targetFamily = getSkillFamily(targetTopic || normalizeSkillLabel(domain || 'general'))
  const targetDifficultyRank = getDifficultyRank(quiz.difficulty)
  const scoredAttempts = completedAttempts.map((attempt) => {
    const attemptTopic = normalizeSkillLabel(getQuizRelation(attempt)?.topic || '')
    const attemptFamily = getSkillFamily(attemptTopic)
    const score = Number(attempt.score || 0)
    const difficultyRankValue = getDifficultyRank(getQuizRelation(attempt)?.difficulty)
    const completedAt = attempt.completed_at || attempt.created_at || null
    const ageDays = completedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(completedAt).getTime()) / 86_400_000))
      : 120
    const recencyWeight = ageDays <= 30 ? 1 : ageDays <= 90 ? 0.85 : 0.7
    const difficultyWeight = 1 + (difficultyRankValue - targetDifficultyRank) * 0.06
    const topicWeight = attemptTopic === targetTopic
      ? 1
      : attemptFamily && attemptFamily === targetFamily
        ? 0.72
        : 0.36
    return {
      score,
      attemptTopic,
      weight: clamp(topicWeight * recencyWeight * difficultyWeight, 0.2, 1.15),
      direct: attemptTopic === targetTopic,
      related: Boolean(attemptFamily && attemptFamily === targetFamily && attemptTopic !== targetTopic),
    }
  })

  const directAttempts = scoredAttempts.filter((attempt) => attempt.direct)
  const relatedAttempts = scoredAttempts.filter((attempt) => attempt.related)
  const weightedAverage = weightedScore(scoredAttempts)
  const directAverage = weightedScore(directAttempts)
  const relatedAverage = weightedScore(relatedAttempts)
  const overallAverage = completedAttempts.length
    ? completedAttempts.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0) / completedAttempts.length
    : 0

  const evidenceCount = directAttempts.length || relatedAttempts.length || completedAttempts.length
  const confidence: ReadinessInsight['confidence'] =
    directAttempts.length >= 3
      ? 'high'
      : directAttempts.length >= 1 || relatedAttempts.length >= 3
        ? 'medium'
        : 'low'

  const baseEvidenceScore = confidence === 'high'
    ? directAverage
    : confidence === 'medium'
      ? (directAttempts.length ? directAverage * 0.7 + overallAverage * 0.3 : relatedAverage * 0.75 + overallAverage * 0.25)
      : completedAttempts.length
        ? weightedAverage
        : 50

  const streakBoost = clamp((currentStreak || 0) * 1.5, 0, 8)
  const historyBoost = completedAttempts.length ? clamp((overallAverage - 65) * 0.12, -5, 5) : 0
  const topicAlignmentBoost = directAttempts.length
    ? clamp((directAverage - overallAverage) * 0.18, -8, 8)
    : relatedAttempts.length
      ? clamp((relatedAverage - overallAverage) * 0.1, -5, 5)
      : 0
  const trainingDaysBoost = clamp(daysInTraining / 14, 0, 5)
  const difficultyPenalty = Math.max(0, targetDifficultyRank - 2) * 3.5
  const lowEvidencePenalty = confidence === 'low' ? 8 : confidence === 'medium' ? 3 : 0

  const score = clamp(
    Math.round(baseEvidenceScore + streakBoost + historyBoost + topicAlignmentBoost + trainingDaysBoost - difficultyPenalty - lowEvidencePenalty),
    15,
    98
  )

  const predictedScore = clamp(
    Math.round(score - Math.max(0, targetDifficultyRank - 2) * 2 + (confidence === 'high' ? 1 : confidence === 'low' ? -4 : -1)),
    10,
    99
  )

  let status: ReadinessInsight['status'] = 'ready'
  const topicLabel = quiz.topic || 'this topic'
  let recommendation = `Evidence supports attempting ${topicLabel}. Prediction is ${confidence}-confidence from ${evidenceCount} completed attempt(s).`
  if (score < 45) {
    status = 'revise'
    recommendation = `Revise ${topicLabel} before attempting. Prediction is ${confidence}-confidence from ${evidenceCount} completed attempt(s).`
  } else if (score < 65) {
    status = 'focus'
    recommendation = `Do a focused warm-up on ${topicLabel}. Prediction is ${confidence}-confidence from ${evidenceCount} completed attempt(s).`
  }

  return {
    score,
    predictedScore,
    confidence,
    evidenceCount,
    evidenceSummary: buildReadinessEvidenceSummary({
      directCount: directAttempts.length,
      relatedCount: relatedAttempts.length,
      totalCount: completedAttempts.length,
      directAverage,
      relatedAverage,
      overallAverage,
    }),
    status,
    recommendation,
    streakBoost: Math.round(streakBoost),
    historyBoost: Math.round(historyBoost),
    topicAlignmentBoost: Math.round(topicAlignmentBoost),
    trainingDaysBoost: Math.round(trainingDaysBoost),
  }
}

function normalizeSkillLabel(value?: string | null) {
  return String(value || 'general').toLowerCase().replace(/[^a-z0-9 +#.-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function getSkillFamily(topic: string) {
  const normalized = normalizeSkillLabel(topic)
  const families: Array<{ family: string; terms: string[] }> = [
    { family: 'data engineering', terms: ['data engineering', 'rag', 'retrieval augmented generation', 'vector database', 'etl', 'pipeline', 'spark', 'sql', 'data lake', 'airflow', 'analytics'] },
    { family: 'java', terms: ['java', 'spring', 'spring boot', 'jvm', 'microservice', 'hibernate'] },
    { family: 'frontend', terms: ['react', 'next.js', 'nextjs', 'javascript', 'typescript', 'frontend', 'ui'] },
    { family: 'cloud', terms: ['azure', 'aws', 'cloud', 'devops', 'kubernetes', 'docker', 'aks'] },
    { family: 'ai', terms: ['ai', 'ml', 'machine learning', 'llm', 'prompt', 'genai', 'openai'] },
    { family: 'testing', terms: ['testing', 'qa', 'automation', 'selenium', 'playwright'] },
  ]
  return families.find((item) => item.terms.some((term) => normalized.includes(term)))?.family || normalized
}

function weightedScore(items: Array<{ score: number; weight: number }>) {
  if (!items.length) return 0
  const weight = items.reduce((sum, item) => sum + item.weight, 0)
  if (!weight) return 0
  return items.reduce((sum, item) => sum + item.score * item.weight, 0) / weight
}

function buildReadinessEvidenceSummary(input: {
  directCount: number
  relatedCount: number
  totalCount: number
  directAverage: number
  relatedAverage: number
  overallAverage: number
}) {
  if (input.directCount) return `${input.directCount} direct topic attempt(s), avg ${Math.round(input.directAverage)}%.`
  if (input.relatedCount) return `${input.relatedCount} related domain attempt(s), avg ${Math.round(input.relatedAverage)}%.`
  if (input.totalCount) return `${input.totalCount} overall attempt(s), avg ${Math.round(input.overallAverage)}%; no direct topic history yet.`
  return 'No completed attempts yet; prediction uses a conservative baseline until evidence is available.'
}

export function buildBatchProfile(attempts: AttemptLike[]): TopicStrengthPoint[] {
  const bucket = new Map<string, { totalScore: number; attempts: number; overloadCount: number }>()

  for (const attempt of attempts) {
    const topic = getQuizRelation(attempt)?.topic || 'General'
    const current = bucket.get(topic) || { totalScore: 0, attempts: 0, overloadCount: 0 }
    current.totalScore += attempt.score || 0
    current.attempts += 1
    current.overloadCount += (attempt.answers || []).filter((answer) => answer.cognitiveLoadFlag).length > 0 ? 1 : 0
    bucket.set(topic, current)
  }

  return [...bucket.entries()]
    .map(([topic, value]) => {
      const accuracy = value.attempts ? Math.round(value.totalScore / value.attempts) : 0
      return {
        topic,
        score: clamp(Math.round((accuracy * 0.8) + ((1 - value.overloadCount / Math.max(value.attempts, 1)) * 20)), 0, 100),
        accuracy,
        overloadRate: clamp(Math.round((value.overloadCount / Math.max(value.attempts, 1)) * 100), 0, 100),
      }
    })
    .sort((a, b) => b.score - a.score)
}

export function buildTrainerImpact(args: {
  quizzes: QuizLike[]
  attempts: AttemptLike[]
  profiles: ProfileLike[]
}): TrainerImpactPoint[] {
  const quizMap = new Map(args.quizzes.map((quiz) => [quiz.id, quiz]))
  const profileMap = new Map(args.profiles.map((profile) => [profile.id, profile.full_name || 'Trainer']))
  const bucket = new Map<string, { trainerId: string; trainerName: string; topic: string; totalScore: number; attempts: number }>()

  for (const attempt of args.attempts) {
    const relationQuiz = getQuizRelation(attempt)
    const quiz = relationQuiz?.id ? quizMap.get(relationQuiz.id) : quizMap.get(attempt.quiz_id)
    const trainerId = quiz?.created_by || relationQuiz?.created_by || 'unknown'
    const trainerName = profileMap.get(trainerId) || 'Unassigned Trainer'
    const topic = quiz?.topic || relationQuiz?.topic || 'General'
    const key = `${trainerId}:${topic}`
    const current = bucket.get(key) || { trainerId, trainerName, topic, totalScore: 0, attempts: 0 }
    current.totalScore += attempt.score || 0
    current.attempts += 1
    bucket.set(key, current)
  }

  return [...bucket.values()]
    .map((value) => {
      const averageScore = value.attempts ? Math.round(value.totalScore / value.attempts) : 0
      return {
        trainerId: value.trainerId,
        trainerName: value.trainerName,
        topic: value.topic,
        averageScore,
        attempts: value.attempts,
        impactScore: clamp(Math.round((averageScore * 0.7) + Math.min(value.attempts, 10) * 3), 0, 100),
      }
    })
    .sort((a, b) => b.impactScore - a.impactScore)
}

export function buildRetentionChecks(attempts: AttemptLike[], now = new Date()): RetentionCheck[] {
  const byTopic = new Map<string, AttemptLike[]>()

  for (const attempt of attempts) {
    const topic = getQuizRelation(attempt)?.topic || 'General'
    const collection = byTopic.get(topic) || []
    collection.push(attempt)
    byTopic.set(topic, collection)
  }

  return [...byTopic.entries()]
    .map(([topic, topicAttempts]) => {
      const sorted = [...topicAttempts].sort((a, b) => {
        return new Date(a.completed_at || a.created_at || 0).getTime() - new Date(b.completed_at || b.created_at || 0).getTime()
      })
      const first = sorted[0]
      const latest = sorted[sorted.length - 1]
      const latestDate = new Date(latest.completed_at || latest.created_at || now.toISOString())
      const daysSince = Math.floor((now.getTime() - latestDate.getTime()) / 86400000)
      const baselineScore = Math.round(first.score || 0)
      const latestScore = Math.round(latest.score || 0)
      const decayDelta = baselineScore - latestScore

      let status: RetentionCheck['status'] = 'healthy'
      if (daysSince >= 14 && decayDelta > 12) status = 'critical'
      else if (daysSince >= 14 || decayDelta > 6) status = 'watch'

      return {
        topic,
        daysSinceLastAssessment: Math.max(daysSince, 0),
        baselineScore,
        latestScore,
        decayDelta,
        status,
      }
    })
    .sort((a, b) => b.daysSinceLastAssessment - a.daysSinceLastAssessment)
}

export function getTopicAttempts(attempts: AttemptLike[], topic?: string | null) {
  if (!topic) return []
  return attempts.filter((attempt) => getQuizRelation(attempt)?.topic?.toLowerCase() === topic.toLowerCase())
}

export function getDaysInTraining(createdAt?: string | null) {
  if (!createdAt) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000))
}
