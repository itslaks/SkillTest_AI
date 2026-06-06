'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { uuidSchema, submitQuizSchema } from '@/lib/security/validation'
import {
  analyzeAttemptPattern,
  buildRetentionChecks,
  computeReadinessInsight,
  getDaysInTraining,
  getTopicAttempts,
} from '@/lib/insights'
import type { SubmitQuizInput, LeaderboardEntry, QuizAnswer, DifficultyLevel } from '@/lib/types/database'
import { buildCandidateProctoringNoticeEmail, buildQuizCompletedEmail, buildQuizProctoringFlagEmail, sendEmail } from '@/lib/email'
import { calculateProctoringRisk, shouldAutoSubmitForIntegrity } from '@/lib/proctoring'

// ─── Start a quiz attempt ─────────────────────────────────────────────
export async function startQuizAttempt(quizId: string) {
  const idResult = uuidSchema.safeParse(quizId)
  if (!idResult.success) return { error: 'Invalid quiz ID' }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  // Use admin client to bypass RLS on quiz_assignments (created by manager via admin client)
  let adminClient: any
  try { adminClient = createAdminClient() } catch { adminClient = supabase }

  // Verify this quiz is assigned to the employee
  const { data: assignment } = await adminClient
    .from('quiz_assignments')
    .select('id')
    .eq('quiz_id', idResult.data)
    .eq('user_id', user.id)
    .single()

  if (!assignment) return { error: 'This quiz has not been assigned to you' }

  // Check if there's already an attempt
  const { data: existing } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('quiz_id', idResult.data)
    .eq('user_id', user.id)
    .single()

  if (existing?.status === 'completed') {
    return { error: 'You have already completed this quiz' }
  }

  if (existing?.status === 'in_progress') {
    return { data: existing }
  }

  const { data, error } = await supabase
    .from('quiz_attempts')
    .insert({
      quiz_id: idResult.data,
      user_id: user.id,
      status: 'in_progress',
      score: 0,
      correct_answers: 0,
      points_earned: 0,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data }
}

// ─── Submit quiz answers ──────────────────────────────────────────────
export async function submitQuizAttempt(input: SubmitQuizInput) {
  const parsed = submitQuizSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    console.error('Quiz submission validation error:', firstError)
    return { error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error('Quiz submission auth error:', authError)
    return { error: 'Not authenticated' }
  }

  const { quiz_id, answers, time_taken_seconds, proctoring } = parsed.data

  try {
    const adminClient = createAdminClient()
    const { data: assignment } = await adminClient
      .from('quiz_assignments')
      .select('id')
      .eq('quiz_id', quiz_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!assignment) return { error: 'This quiz has not been assigned to you' }

    // Fetch quiz to calculate score
    const { data: quiz, error: quizError } = await adminClient
      .from('quizzes')
      .select('*, questions(*)')
      .eq('id', quiz_id)
      .eq('is_active', true)
      .single()

    if (quizError || !quiz) {
      console.error('Quiz fetch error:', quizError)
      return { error: 'Quiz not found' }
    }

    const { data: previousAttempts } = await supabase
      .from('quiz_attempts')
      .select('quiz_id, score, answers, completed_at, quizzes:quiz_id(id, topic, difficulty, created_by)')
      .eq('user_id', user.id)
      .eq('status', 'completed')

    const questions = Array.isArray(quiz.questions) ? quiz.questions : []
    const questionById = new Map<string, any>(questions.map((question: any) => [question.id, question]))
    const seenQuestionIds = new Set<string>()
    const topicAttempts = getTopicAttempts(previousAttempts || [], quiz.topic)
    const baselineInsight = analyzeAttemptPattern([], quiz.difficulty, topicAttempts)

    const enrichedAnswers: QuizAnswer[] = []
    for (const answer of answers) {
      const question = questionById.get(answer.questionId)
      if (!question) return { error: 'Submitted answer contains a question that does not belong to this quiz' }
      if (seenQuestionIds.has(answer.questionId)) return { error: 'Duplicate question answer submitted' }
      seenQuestionIds.add(answer.questionId)

      const options = Array.isArray(question.options) ? question.options : []
      const selectedOption = Number(answer.selectedOption)
      if (!Number.isInteger(selectedOption) || selectedOption < 0 || selectedOption >= options.length) {
        return { error: 'Submitted answer contains an invalid option' }
      }

      const questionDifficulty = (question.difficulty || quiz.difficulty || 'medium') as DifficultyLevel
      const isCorrect = options[selectedOption]?.isCorrect === true
      enrichedAnswers.push({
        questionId: answer.questionId,
        selectedOption,
        isCorrect,
        timeSpent: answer.timeSpent,
        questionDifficulty,
        cognitiveLoadFlag: questionDifficulty === 'easy' && answer.timeSpent > 15,
        panicSignal: !isCorrect && answer.timeSpent <= 5,
        adaptiveDifficulty: answer.adaptiveDifficulty || baselineInsight.suggestedNextDifficulty,
      })
    }

    const totalQuestions = questions.length
    const correctAnswers = enrichedAnswers.filter((answer) => answer.isCorrect).length
    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0
    const rawInsight = analyzeAttemptPattern(enrichedAnswers, quiz.difficulty, topicAttempts)
    const proctoringEvents = proctoring?.events || []
    const proctoringViolationCount = proctoring?.violationCount || 0
    const proctoringRisk = calculateProctoringRisk(proctoringEvents)
    const isIntegrityAutoSubmit = shouldAutoSubmitForIntegrity(proctoringEvents, proctoringViolationCount)
    const isProctoringFlagged = Boolean(proctoring?.enabled && (isIntegrityAutoSubmit || proctoringRisk.level === 'high' || proctoringRisk.level === 'critical'))
    const integrityReport = proctoring?.enabled
      ? {
          generatedAt: new Date().toISOString(),
          quizId: quiz_id,
          userId: user.id,
          quizTitle: quiz.title,
          status: isProctoringFlagged ? 'flagged_for_review' : 'clear',
          riskScore: proctoringRisk.score,
          riskLevel: proctoringRisk.level,
          violationCount: proctoringViolationCount,
          autoSubmitted: Boolean(proctoring?.autoSubmitted || isIntegrityAutoSubmit),
          timeline: proctoringEvents.map((event) => ({
            type: event.type,
            label: event.label,
            occurredAt: event.occurredAt,
            questionIndex: event.questionIndex,
            riskScore: event.riskScore,
            hasEvidence: Boolean(event.evidenceImage),
          })),
        }
      : null

    // Points: base 10 per correct + speed bonus
    const speedBonus = time_taken_seconds < (quiz.time_limit_minutes * 60 * 0.5) ? 25 : 0
    const streakBonus = totalQuestions > 0 && correctAnswers >= totalQuestions ? 50 : 0
    const composureBonus = rawInsight.panicModeDetected ? 0 : 15
    const learningPenalty = rawInsight.antiGamingDetected ? -15 : 0
    const pointsEarned = Math.max(0, (correctAnswers * 10) + speedBonus + streakBonus + composureBonus + learningPenalty)

    console.log(`Quiz submission for user ${user.id}: Score ${score}%, Points ${pointsEarned}`)

    const { data, error } = await supabase
      .from('quiz_attempts')
      .update({
        answers: enrichedAnswers,
        score,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        time_taken_seconds,
        points_earned: pointsEarned,
        status: 'completed',
        completed_at: new Date().toISOString(),
        proctoring_status: isProctoringFlagged ? 'flagged' : (proctoring?.enabled ? 'clear' : null),
        proctoring_violations_count: proctoringViolationCount,
        proctoring_risk_score: proctoringRisk.score,
        proctoring_risk_level: proctoring?.enabled ? proctoringRisk.level : null,
        proctoring_events: proctoringEvents,
        integrity_report: integrityReport,
        auto_submitted: Boolean(proctoring?.autoSubmitted || isIntegrityAutoSubmit),
      })
      .eq('quiz_id', quiz_id)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .select()
      .single()

    if (error) {
      console.error('Quiz submission update error:', error)
      return { error: error.message }
    }

    try {
      const [{ data: profile }, { data: earnedBadges }, { data: certificate }] = await Promise.all([
        adminClient.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle(),
        adminClient.from('user_badges').select('id').eq('user_id', user.id),
        adminClient.from('certificates').select('id').eq('quiz_id', quiz_id).eq('user_id', user.id).maybeSingle(),
      ])
      if (profile?.email) {
        await sendEmail({
          to: profile.email,
          subject: `Quiz Completed: ${quiz.title} - ${score}%`,
          html: buildQuizCompletedEmail({
            employeeName: profile.full_name,
            quizTitle: quiz.title,
            score,
            points: pointsEarned,
            badgesEarned: earnedBadges?.length || 0,
            certificateIssued: Boolean(certificate),
          }),
        })
      }
    } catch (mailError) {
      console.warn('Quiz completion email failed (non-fatal):', mailError)
    }

    if (isProctoringFlagged) {
      try {
        const recipients = await getProctoringAlertRecipients(adminClient, quiz)
        const [{ data: profile }] = await Promise.all([
          adminClient.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle(),
        ])

        if (recipients.length > 0) {
          const html = buildQuizProctoringFlagEmail({
            employeeName: profile?.full_name,
            employeeEmail: profile?.email,
            quizTitle: quiz.title,
            score,
            violationCount: proctoringViolationCount,
            riskScore: proctoringRisk.score,
            riskLevel: proctoringRisk.level,
            autoSubmitted: Boolean(proctoring?.autoSubmitted || isIntegrityAutoSubmit),
            events: proctoringEvents,
          })

          await sendEmail({
            to: recipients,
            subject: `Proctoring Flag: ${quiz.title} - ${profile?.full_name || profile?.email || 'Employee'}`,
            html,
          })
        }

        await adminClient.from('training_notifications').insert({
          batch_id: quiz.batch_id || null,
          recipient_user_id: quiz.created_by || null,
          title: 'Quiz proctoring flag',
          message: `${profile?.full_name || profile?.email || 'An employee'} was flagged during ${quiz.title} after ${proctoringViolationCount} proctoring violation(s).`,
          audience: 'trainers',
          channel: 'email',
          delivery_status: recipients.length > 0 ? 'sent' : 'logged',
          sent_at: new Date().toISOString(),
          created_by: quiz.created_by || user.id,
        })
        if (profile?.email) {
          await sendEmail({
            to: profile.email,
            subject: `Assessment Submitted for Review: ${quiz.title}`,
            html: buildCandidateProctoringNoticeEmail({
              employeeName: profile.full_name,
              quizTitle: quiz.title,
              violationCount: proctoringViolationCount,
              riskScore: proctoringRisk.score,
              riskLevel: proctoringRisk.level,
            }),
          })
        }
      } catch (mailError) {
        console.warn('Proctoring alert failed (non-fatal):', mailError)
      }
    }

    console.log(`Quiz submission successful for user ${user.id}, quiz ${quiz_id}`)
    revalidatePath('/employee', 'layout')
    revalidatePath('/employee/quizzes')
    revalidatePath('/employee/leaderboard')
    revalidatePath(`/employee/quizzes/${quiz_id}/leaderboard`)
    revalidatePath(`/employee/quizzes/${quiz_id}/results`)
    revalidatePath('/manager/leaderboard')
    revalidatePath('/manager/analytics')
    return { data }

  } catch (error) {
    console.error('Quiz submission unexpected error:', error)
    return { error: 'An unexpected error occurred during quiz submission' }
  }
}

async function getProctoringAlertRecipients(adminClient: ReturnType<typeof createAdminClient>, quiz: any) {
  const recipientIds = new Set<string>()
  if (quiz.created_by) recipientIds.add(quiz.created_by)

  const [{ data: admins }, { data: batchTrainers }] = await Promise.all([
    adminClient
      .from('profiles')
      .select('id, email')
      .in('role', ['admin'])
      .not('email', 'is', null),
    quiz.batch_id
      ? adminClient
          .from('training_batch_trainers')
          .select('trainer_id')
          .eq('batch_id', quiz.batch_id)
      : Promise.resolve({ data: [] }),
  ])

  for (const admin of admins || []) {
    if (admin.id) recipientIds.add(admin.id)
  }
  for (const trainer of batchTrainers || []) {
    if (trainer.trainer_id) recipientIds.add(trainer.trainer_id)
  }

  const ids = Array.from(recipientIds)
  if (ids.length === 0) return []

  const { data: profiles } = await adminClient
    .from('profiles')
    .select('email')
    .in('id', ids)
    .not('email', 'is', null)

  return Array.from(new Set((profiles || []).map((profile: any) => profile.email).filter(Boolean)))
}

// ─── Get available quizzes for employees (only assigned ones) ─────────
export async function getAvailableQuizzes() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated', data: [] }

  // Use admin client to bypass RLS on quiz_assignments (created by manager via admin client)
  let adminClient: any
  try { adminClient = createAdminClient() } catch { adminClient = supabase }

  // Get quiz IDs assigned to this employee
  const { data: assignments, error: assignError } = await adminClient
    .from('quiz_assignments')
    .select('quiz_id')
    .eq('user_id', user.id)

  if (assignError) return { error: assignError.message, data: [] }

  const assignedQuizIds = assignments?.map((a: any) => a.quiz_id) || []

  // If no quizzes assigned, return empty
  if (assignedQuizIds.length === 0) return { data: [] }

  // Get only active quizzes that are assigned to this employee
  const { data: quizzes, error } = await adminClient
    .from('quizzes')
    .select('*, questions(count)')
    .in('id', assignedQuizIds)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, data: [] }

  // Get user's attempts
  const { data: attempts } = await supabase
    .from('quiz_attempts')
    .select('quiz_id, status, score, answers, completed_at, quizzes:quiz_id(id, topic, difficulty, created_by)')
    .eq('user_id', user.id)

  const { data: profile } = await adminClient
    .from('profiles')
    .select('domain, created_at')
    .eq('id', user.id)
    .single()

  const { data: userStats } = await supabase
    .from('user_stats')
    .select('current_streak')
    .eq('user_id', user.id)
    .single()

  const attemptMap = new Map<string, { quiz_id: string; status: string; score: number }>(
    attempts?.map((a: any) => [a.quiz_id, a]) || []
  )

  const completedAttempts = (attempts || []).filter((attempt: any) => attempt.status === 'completed')
  const retentionChecks = buildRetentionChecks(completedAttempts)
  const retentionByTopic = new Map(retentionChecks.map((item) => [item.topic.toLowerCase(), item]))

  const quizzesWithStatus = quizzes?.map((q: any) => ({
    ...q,
    attemptStatus: attemptMap.get(q.id)?.status || null,
    attemptScore: attemptMap.get(q.id)?.score || null,
    readiness: computeReadinessInsight({
      attempts: completedAttempts,
      quiz: q,
      currentStreak: userStats?.current_streak || 0,
      domain: profile?.domain || null,
      daysInTraining: getDaysInTraining(profile?.created_at),
    }),
    retentionCheck: retentionByTopic.get((q.topic || '').toLowerCase()) || null,
    challengeMode: analyzeAttemptPattern([], q.difficulty, getTopicAttempts(completedAttempts, q.topic)).antiGamingDetected,
  })) || []

  return { data: quizzesWithStatus }
}

// ─── Get quiz for taking (with questions) — checks assignment ─────────
export async function getQuizForAttempt(quizId: string) {
  const idResult = uuidSchema.safeParse(quizId)
  if (!idResult.success) return { error: 'Invalid quiz ID' }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  // Use admin client to bypass RLS on quiz_assignments (created by manager via admin client)
  let adminClient: any
  try { adminClient = createAdminClient() } catch { adminClient = supabase }

  // Verify this quiz is assigned to the employee
  const { data: assignment } = await adminClient
    .from('quiz_assignments')
    .select('id')
    .eq('quiz_id', idResult.data)
    .eq('user_id', user.id)
    .single()

  if (!assignment) return { error: 'This quiz has not been assigned to you' }

  const { data: quiz, error: quizError } = await adminClient
    .from('quizzes')
    .select('*')
    .eq('id', idResult.data)
    .eq('is_active', true)
    .single()

  if (quizError || !quiz) return { error: 'Quiz not found or not active' }

  // Get all questions for the quiz
  const { data: questions, error: questionsError } = await adminClient
    .from('questions')
    .select('*')
    .eq('quiz_id', idResult.data)
    .order('order_index', { ascending: true })

  if (questionsError) return { error: questionsError.message }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('domain, created_at')
    .eq('id', user.id)
    .single()

  const { data: userStats } = await supabase
    .from('user_stats')
    .select('current_streak')
    .eq('user_id', user.id)
    .single()

  const { data: previousAttempts } = await supabase
    .from('quiz_attempts')
    .select('quiz_id, score, answers, completed_at, quizzes:quiz_id(id, topic, difficulty, created_by)')
    .eq('user_id', user.id)
    .eq('status', 'completed')

  // Shuffle questions for randomness
  const shuffled = questions ? [...questions].sort(() => Math.random() - 0.5) : []

  // Shuffle options for each question; the UI uses the answer flag only after confirmation.
  const questionsWithShuffledOptions = shuffled.map(question => {
    if (question.options && Array.isArray(question.options)) {
      const optionsWithIndex = question.options.map((option: any, index: number) => ({
        text: option.text,
        optionId: index,
        isCorrect: option.isCorrect === true,
      }))

      const shuffledOptions = [...optionsWithIndex].sort(() => Math.random() - 0.5)
      
      return {
        ...question,
        explanation: question.explanation || null,
        options: shuffledOptions
      }
    }
    return {
      ...question,
      explanation: question.explanation || null,
      options: [],
    }
  })

  const topicAttempts = getTopicAttempts(previousAttempts || [], quiz.topic)
  const readiness = computeReadinessInsight({
    attempts: previousAttempts || [],
    quiz,
    currentStreak: userStats?.current_streak || 0,
    domain: profile?.domain || null,
    daysInTraining: getDaysInTraining(profile?.created_at),
  })
  const retentionCheck = buildRetentionChecks(topicAttempts).find((item) => item.topic.toLowerCase() === (quiz.topic || '').toLowerCase()) || null
  const pattern = analyzeAttemptPattern([], quiz.difficulty, topicAttempts)

  return {
    data: {
      ...quiz,
      questions: questionsWithShuffledOptions,
      insights: {
        readiness,
        retentionCheck,
        antiGamingDetected: pattern.antiGamingDetected,
        suggestedNextDifficulty: pattern.suggestedNextDifficulty,
      },
    },
  }
}

// ─── Get leaderboard for a quiz ───────────────────────────────────────
export async function getQuizLeaderboard(quizId: string) {
  const idResult = uuidSchema.safeParse(quizId)
  if (!idResult.success) return { error: 'Invalid quiz ID' }

  // Use admin client to bypass RLS for leaderboard data
  const adminClient = createAdminClient()

  const { data: attempts, error } = await adminClient
    .from('quiz_attempts')
    .select(`
      *,
      profiles:user_id(full_name, email, employee_id, avatar_url, department)
    `)
    .eq('quiz_id', idResult.data)
    .eq('status', 'completed')
    .order('score', { ascending: false })
    .order('completed_at', { ascending: true }) // Earlier completion wins for same score
    .order('time_taken_seconds', { ascending: true })

  if (error) {
    console.error('Quiz leaderboard error:', error)
    return { error: error.message, data: [] }
  }

  const leaderboard: LeaderboardEntry[] = (attempts || []).map((a: any, i: number) => ({
    user_id: a.user_id,
    full_name: a.profiles?.full_name || 'Unknown',
    email: a.profiles?.email || '',
    employee_id: a.profiles?.employee_id || null,
    avatar_url: a.profiles?.avatar_url || null,
    department: a.profiles?.department || null,
    score: a.score,
    correct_answers: a.correct_answers,
    total_questions: a.total_questions,
    time_taken_seconds: a.time_taken_seconds,
    points_earned: a.points_earned,
    completed_at: a.completed_at,
    rank: i + 1,
  }))

  return { data: leaderboard }
}

// ─── Get employee stats ───────────────────────────────────────────────
export async function getEmployeeStats() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  const { data: stats } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { data: badges } = await supabase
    .from('user_badges')
    .select('*, badges(*)')
    .eq('user_id', user.id)

  const { data: recentAttempts } = await supabase
    .from('quiz_attempts')
    .select('*, quizzes(title, topic, difficulty, created_by)')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(10)

  const retentionChecks = buildRetentionChecks(recentAttempts || [])

  return {
    data: {
      stats: stats || { total_points: 0, current_streak: 0, longest_streak: 0, tests_completed: 0, average_score: 0 },
      badges: badges || [],
      recentAttempts: recentAttempts || [],
      retentionChecks,
    }
  }
}

// ─── Get all badges ───────────────────────────────────────────────────
export async function getAllBadges() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: allBadges } = await supabase
    .from('badges')
    .select('*')
    .order('points', { ascending: true })

  const { data: earnedBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', user?.id)

  const adminClient = createAdminClient()
  const { data: certificates } = user?.id
    ? await adminClient
        .from('certificates')
        .select('id, title, score, issued_at, quiz:quiz_id(title, topic), rule:rule_id(certificate_name, min_score)')
        .eq('user_id', user.id)
        .order('issued_at', { ascending: false })
    : { data: [] }

  const earnedIds = new Set(earnedBadges?.map((b: any) => b.badge_id) || [])

  return {
    data: (allBadges || []).map((b: any) => ({
      ...b,
      earned: earnedIds.has(b.id),
    })),
    certificates: certificates || [],
  }
}
