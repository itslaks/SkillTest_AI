type QuestionLike = {
  id: string
  question_text?: string | null
  topic?: string | null
  subtopic?: string | null
  category?: string | null
  skill?: string | null
  tags?: string[] | null
  explanation?: string | null
}

type AnswerLike = {
  questionId?: string | null
  isCorrect?: boolean | null
  timeSpent?: number | null
  questionDifficulty?: string | null
}

type QuizLike = {
  id?: string
  title?: string | null
  topic?: string | null
  difficulty?: string | null
  questions?: QuestionLike[] | null
}

export type TopicPerformancePoint = {
  topic: string
  total: number
  correct: number
  wrong: number
  accuracy: number
  wrongRate: number
  avgTime: number
  questionIds: string[]
}

export type AttemptPerformanceAnalysis = {
  score: number
  totalQuestions: number
  strongTopics: TopicPerformancePoint[]
  weakTopics: TopicPerformancePoint[]
  topicBreakdown: TopicPerformancePoint[]
  areasToImprove: string[]
  strengths: string[]
  feedback: string
  suggestion: string
}

export type CohortWeakTopicPoint = {
  topic: string
  quizTitle: string
  attempts: number
  questionsAnswered: number
  wrongAnswers: number
  wrongRate: number
  affectedEmployees: number
}

const TOPIC_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(partition\s+by|over\s*\(|row_number|rank\(|dense_rank|lag\(|lead\(|window function)/i, 'SQL window functions'],
  [/\b(join|inner join|left join|right join|foreign key)\b/i, 'SQL joins and relationships'],
  [/\b(group by|having|aggregate|count\(|sum\(|avg\()/i, 'SQL aggregation'],
  [/\b(subquery|nested query|exists|cte|with\s+\w+\s+as)\b/i, 'SQL subqueries and CTEs'],
  [/\b(index|query plan|performance|optimization)\b/i, 'Database performance'],
  [/\b(transaction|commit|rollback|isolation|deadlock)\b/i, 'Transactions'],
  [/\b(normalization|normal form|1nf|2nf|3nf)\b/i, 'Database design'],
  [/\b(class|object|inheritance|polymorphism|encapsulation)\b/i, 'OOP fundamentals'],
  [/\b(collection|list|map|set|arraylist|hashmap)\b/i, 'Collections'],
  [/\b(exception|try|catch|finally|throw)\b/i, 'Exception handling'],
  [/\b(stream|lambda|functional interface)\b/i, 'Streams and lambdas'],
  [/\b(thread|concurrency|synchronized|async|promise)\b/i, 'Concurrency'],
]

export function inferQuestionTopic(question: QuestionLike | undefined, fallbackTopic = 'General') {
  const direct = question?.subtopic || question?.topic || question?.category || question?.skill || question?.tags?.[0]
  if (direct && String(direct).trim()) return String(direct).trim()

  const text = question?.question_text || ''
  for (const [pattern, topic] of TOPIC_KEYWORDS) {
    if (pattern.test(text)) return topic
  }

  return String(fallbackTopic || 'General').trim() || 'General'
}

export function analyzeAttemptTopicPerformance(input: {
  quiz: QuizLike
  answers: AnswerLike[]
  score: number
}): AttemptPerformanceAnalysis {
  const questions = Array.isArray(input.quiz.questions) ? input.quiz.questions : []
  const questionById = new Map(questions.map((question) => [question.id, question]))
  const stats = new Map<string, {
    total: number
    correct: number
    wrong: number
    time: number
    questionIds: Set<string>
  }>()

  for (const answer of input.answers || []) {
    if (!answer?.questionId) continue
    const question = questionById.get(answer.questionId)
    const topic = inferQuestionTopic(question, input.quiz.topic || 'General')
    const current = stats.get(topic) || { total: 0, correct: 0, wrong: 0, time: 0, questionIds: new Set<string>() }
    current.total += 1
    current.correct += answer.isCorrect ? 1 : 0
    current.wrong += answer.isCorrect ? 0 : 1
    current.time += Number(answer.timeSpent || 0)
    current.questionIds.add(answer.questionId)
    stats.set(topic, current)
  }

  const topicBreakdown = [...stats.entries()]
    .map(([topic, item]) => {
      const accuracy = item.total ? Math.round((item.correct / item.total) * 100) : 0
      return {
        topic,
        total: item.total,
        correct: item.correct,
        wrong: item.wrong,
        accuracy,
        wrongRate: 100 - accuracy,
        avgTime: item.total ? Math.round(item.time / item.total) : 0,
        questionIds: [...item.questionIds],
      }
    })
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)

  const weakTopics = topicBreakdown.filter((item) => item.accuracy < 70 || item.wrong > 0).slice(0, 4)
  const strongTopics = [...topicBreakdown].filter((item) => item.accuracy >= 80).sort((a, b) => b.accuracy - a.accuracy).slice(0, 4)
  const areasToImprove = weakTopics.map((item) => `${item.topic}: ${item.wrong}/${item.total} missed (${item.accuracy}% accuracy)`)
  const strengths = strongTopics.length
    ? strongTopics.map((item) => `${item.topic}: ${item.accuracy}% accuracy`)
    : ['You completed the assessment and now have a clear baseline to improve from.']
  const primaryWeak = weakTopics[0]
  const primaryStrong = strongTopics[0]

  const feedback = primaryWeak
    ? `Your main improvement area is ${primaryWeak.topic}. You missed ${primaryWeak.wrong} of ${primaryWeak.total} question(s), so revisit the concepts and retry practice questions before the next assessment.`
    : `Your topic coverage was steady across this quiz. Keep reinforcing ${input.quiz.topic || 'the topic'} with timed practice.`

  const suggestion = primaryWeak
    ? `Spend 20-30 minutes reviewing ${primaryWeak.topic}, write down the rule behind each missed question, then solve 5 similar questions without looking at the answer.`
    : primaryStrong
      ? `Build on ${primaryStrong.topic} by attempting a harder mixed-topic set and explaining your answer choices aloud.`
      : 'Review the explanation for each question and repeat the quiz topic with a shorter time limit.'

  return {
    score: input.score,
    totalQuestions: input.answers?.length || 0,
    strongTopics,
    weakTopics,
    topicBreakdown,
    areasToImprove,
    strengths,
    feedback,
    suggestion,
  }
}

export function buildCohortWeakTopicInsights(input: {
  attempts: Array<{ quiz_id: string; user_id?: string | null; answers?: AnswerLike[] | null }>
  quizzes: QuizLike[]
}): CohortWeakTopicPoint[] {
  const quizById = new Map((input.quizzes || []).map((quiz) => [quiz.id, quiz]))
  const stats = new Map<string, {
    topic: string
    quizTitle: string
    attempts: Set<string>
    employees: Set<string>
    total: number
    wrong: number
  }>()

  for (const attempt of input.attempts || []) {
    const quiz = quizById.get(attempt.quiz_id)
    if (!quiz) continue
    const questions = Array.isArray(quiz.questions) ? quiz.questions : []
    const questionById = new Map(questions.map((question) => [question.id, question]))
    const attemptKey = `${attempt.quiz_id}:${attempt.user_id || 'unknown'}`

    for (const answer of attempt.answers || []) {
      if (!answer?.questionId) continue
      const topic = inferQuestionTopic(questionById.get(answer.questionId), quiz.topic || 'General')
      const key = `${attempt.quiz_id}:${topic}`
      const current = stats.get(key) || {
        topic,
        quizTitle: quiz.title || 'Quiz',
        attempts: new Set<string>(),
        employees: new Set<string>(),
        total: 0,
        wrong: 0,
      }
      current.attempts.add(attemptKey)
      if (attempt.user_id) current.employees.add(attempt.user_id)
      current.total += 1
      current.wrong += answer.isCorrect ? 0 : 1
      stats.set(key, current)
    }
  }

  return [...stats.values()]
    .map((item) => ({
      topic: item.topic,
      quizTitle: item.quizTitle,
      attempts: item.attempts.size,
      questionsAnswered: item.total,
      wrongAnswers: item.wrong,
      wrongRate: item.total ? Math.round((item.wrong / item.total) * 100) : 0,
      affectedEmployees: item.employees.size,
    }))
    .filter((item) => item.questionsAnswered > 0 && item.wrongRate > 25)
    .sort((a, b) => b.wrongRate - a.wrongRate || b.wrongAnswers - a.wrongAnswers)
    .slice(0, 8)
}
