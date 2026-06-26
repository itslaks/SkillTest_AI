import test from 'node:test'
import assert from 'node:assert/strict'

import {
  analyzeAttemptTopicPerformance,
  buildCohortWeakTopicInsights,
  inferQuestionTopic,
} from '../lib/quiz-performance-analysis.ts'

test('quiz performance analysis identifies weak and strong response topics', () => {
  const quiz = {
    id: 'quiz-1',
    title: 'SQL Assessment',
    topic: 'SQL',
    questions: [
      { id: 'q1', question_text: 'Use ROW_NUMBER() OVER (PARTITION BY department) to rank employees.' },
      { id: 'q2', question_text: 'Which JOIN returns matching rows from both tables?' },
      { id: 'q3', question_text: 'What does GROUP BY do with COUNT(*)?' },
    ],
  }

  const analysis = analyzeAttemptTopicPerformance({
    quiz,
    score: 67,
    answers: [
      { questionId: 'q1', isCorrect: false, timeSpent: 42 },
      { questionId: 'q2', isCorrect: true, timeSpent: 12 },
      { questionId: 'q3', isCorrect: true, timeSpent: 15 },
    ],
  })

  assert.equal(inferQuestionTopic(quiz.questions[0], 'SQL'), 'SQL window functions')
  assert.equal(analysis.weakTopics[0].topic, 'SQL window functions')
  assert.match(analysis.feedback, /SQL window functions/)
  assert.ok(analysis.strengths.some((item) => item.includes('SQL joins')))
})

test('cohort weak-topic insights rank topics by wrong-answer rate', () => {
  const insights = buildCohortWeakTopicInsights({
    quizzes: [{
      id: 'quiz-1',
      title: 'SQL Assessment',
      topic: 'SQL',
      questions: [
        { id: 'q1', question_text: 'Use RANK() OVER (PARTITION BY team) correctly.' },
        { id: 'q2', question_text: 'Pick the correct INNER JOIN output.' },
      ],
    }],
    attempts: [
      { quiz_id: 'quiz-1', user_id: 'u1', answers: [{ questionId: 'q1', isCorrect: false }, { questionId: 'q2', isCorrect: true }] },
      { quiz_id: 'quiz-1', user_id: 'u2', answers: [{ questionId: 'q1', isCorrect: false }, { questionId: 'q2', isCorrect: false }] },
    ],
  })

  assert.equal(insights[0].topic, 'SQL window functions')
  assert.equal(insights[0].wrongRate, 100)
  assert.equal(insights[0].affectedEmployees, 2)
})
