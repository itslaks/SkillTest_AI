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
  const topicAttempts = completedAttempts.filter(
    (attempt) => getQuizRelation(attempt)?.topic?.toLowerCase() === quiz.topic.toLowerCase()
  )

  const averageHistory = completedAttempts.length
    ? completedAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / completedAttempts.length
    : 52
  const averageTopic = topicAttempts.length
    ? topicAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / topicAttempts.length
    : averageHistory

  const streakBoost = clamp((currentStreak || 0) * 2.2, 0, 14)
  const historyBoost = clamp((averageHistory - 50) * 0.28, -12, 18)
  const topicAlignmentBoost = clamp((averageTopic - 50) * 0.32, -15, 20)
  const trainingDaysBoost = clamp(daysInTraining / 6, 0, 10)
  const domainMatchBoost = domain && domain.toLowerCase() === quiz.topic.toLowerCase() ? 8 : 0
  const difficultyPenalty = getDifficultyRank(quiz.difficulty) * 4.5

  const score = clamp(
    Math.round(46 + streakBoost + historyBoost + topicAlignmentBoost + trainingDaysBoost + domainMatchBoost - difficultyPenalty),
    18,
    97
  )
  const predictedScore = clamp(Math.round(score + getDifficultyRank(quiz.difficulty) * 2), 15, 99)

  let status: ReadinessInsight['status'] = 'ready'
  let recommendation = 'You are in a healthy zone. Attempt the quiz now.'
  if (score < 45) {
    status = 'revise'
    recommendation = 'Quick revision is recommended before attempting this quiz.'
  } else if (score < 65) {
    status = 'focus'
    recommendation = 'Warm up with topic review to improve confidence and speed.'
  }

  return {
    score,
    predictedScore,
    status,
    recommendation,
    streakBoost: Math.round(streakBoost),
    historyBoost: Math.round(historyBoost),
    topicAlignmentBoost: Math.round(topicAlignmentBoost),
    trainingDaysBoost: Math.round(trainingDaysBoost),
  }
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
