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
import { getAdminAlertEmail, getSiteUrl } from '@/lib/security/env'
import { analyzeAttemptTopicPerformance } from '@/lib/quiz-performance-analysis'
import { calculateProctoringRisk, shouldAutoSubmitForIntegrity } from '@/lib/proctoring'
import {
  buildProctoringSummary,
  createOrUpdateProctoringSession,
  eventRowsToSubmissionEvents,
  isProctoringRequired,
  requireActiveProctoringSession,
  sanitizeProctoringEvents,
} from '@/lib/proctoring-server'

const TOPIC_RISK_WRONG_THRESHOLD = 25

// ─── Start a quiz attempt ─────────────────────────────────────────────
export async function startQuizAttempt(quizId: string, precheck?: {
  cameraReady: boolean
  microphoneReady: boolean
  fullscreenReady: boolean
  consentAccepted: boolean
  baselineFace?: {
    capturedAt: string
    faceSignature: number[]
    confidence: number
    metadata?: Record<string, unknown>
  } | null
}) {
  const idResult = uuidSchema.safeParse(quizId)
  if (!idResult.success) return { error: 'Invalid quiz ID' }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  // Use admin client to bypass RLS on quiz_assignments (created by manager via admin client)
  let adminClient: any
  try { adminClient = createAdminClient() } catch { adminClient = supabase }
  const now = new Date().toISOString()

  // Verify this quiz is assigned to the employee
  const { data: assignment, error: assignmentError } = await adminClient
    .from('quiz_assignments')
    .select('id')
    .eq('quiz_id', idResult.data)
    .eq('user_id', user.id)
    .maybeSingle()

  if (assignmentError) return { error: assignmentError.message }
  if (!assignment) return { error: 'This quiz has not been assigned to you' }

  const { data: quiz, error: quizError } = await adminClient
    .from('quizzes')
    .select('id, proctoring_required, is_active, starts_at, ends_at')
    .eq('id', idResult.data)
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .maybeSingle()

  if (quizError) return { error: quizError.message }
  if (!quiz) return { error: 'This quiz is not currently available. Please check the scheduled time.' }
  const requiresProctoring = isProctoringRequired(quiz)
  if (requiresProctoring && (!precheck?.cameraReady || !precheck.microphoneReady || !precheck.fullscreenReady || !precheck.consentAccepted)) {
    return { error: 'Camera, microphone, fullscreen, and proctoring consent are required before launching this quiz.' }
  }

  const { data: questions, error: questionsError } = await adminClient
    .from('questions')
    .select('id')
    .eq('quiz_id', idResult.data)
    .limit(1)

  if (questionsError) return { error: questionsError.message }
  if (!questions || questions.length === 0) return { error: 'This quiz has no questions yet. Please contact your manager.' }

  // Check if there's already an attempt
  const { data: existing, error: existingError } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('quiz_id', idResult.data)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingError) return { error: existingError.message }

  if (existing?.status === 'completed') {
    return { error: 'You have already completed this quiz' }
  }

  if (existing?.status === 'suspicious') {
    return { error: 'Your assessment is under review.' }
  }

  if (existing?.status === 'in_progress') {
    if (!requiresProctoring) return { data: existing }
    const sessionResult = await createOrUpdateProctoringSession({
      admin: adminClient,
      attempt: existing,
      userId: user.id,
      quizId: idResult.data,
      precheck: precheck!,
    })
    if (sessionResult.error) return { error: sessionResult.error }
    return { data: existing, proctoringSession: sessionResult.data }
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

  if (requiresProctoring) {
    const sessionResult = await createOrUpdateProctoringSession({
      admin: adminClient,
      attempt: data,
      userId: user.id,
      quizId: idResult.data,
      precheck: precheck!,
    })
    if (sessionResult.error) return { error: sessionResult.error }
    return { data, proctoringSession: sessionResult.data }
  }

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
    const now = new Date().toISOString()
    const { data: assignment, error: assignmentError } = await adminClient
      .from('quiz_assignments')
      .select('id')
      .eq('quiz_id', quiz_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (assignmentError) return { error: assignmentError.message }
    if (!assignment) return { error: 'This quiz has not been assigned to you' }

    const { data: currentAttempt, error: currentAttemptError } = await adminClient
      .from('quiz_attempts')
      .select('*')
      .eq('quiz_id', quiz_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (currentAttemptError) return { error: currentAttemptError.message }
    if (currentAttempt?.status === 'completed' || currentAttempt?.status === 'suspicious') return { data: currentAttempt }

    // Fetch quiz to calculate score
    const { data: quiz, error: quizError } = await adminClient
      .from('quizzes')
      .select('*, questions(*)')
      .eq('id', quiz_id)
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .maybeSingle()

    if (quizError || !quiz) {
      console.error('Quiz fetch error:', quizError)
      return { error: 'This quiz is not currently available. Please check the scheduled time.' }
    }

    const { data: previousAttempts, error: previousAttemptsError } = await supabase
      .from('quiz_attempts')
      .select('quiz_id, score, answers, completed_at, quizzes:quiz_id(id, topic, difficulty, created_by)')
      .eq('user_id', user.id)
      .eq('status', 'completed')

    if (previousAttemptsError) return { error: previousAttemptsError.message }

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
    const attemptTopicAnalysis = analyzeAttemptTopicPerformance({
      quiz,
      answers: enrichedAnswers,
      score,
    })

    const { data: activeAttempt, error: activeAttemptError } = await adminClient
      .from('quiz_attempts')
      .select('id, status')
      .eq('quiz_id', quiz_id)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .maybeSingle()

    if (activeAttemptError) return { error: activeAttemptError.message }
    if (!activeAttempt) return { error: 'No active quiz attempt was found.' }

    const requiresProctoring = isProctoringRequired(quiz)
    let session: any = null
    let proctoringEvents = proctoring?.events || []
    let proctoringViolationCount = proctoring?.violationCount || 0
    let proctoringRisk = calculateProctoringRisk(proctoringEvents)
    let isIntegrityAutoSubmit = shouldAutoSubmitForIntegrity(proctoringEvents, proctoringViolationCount)

    if (requiresProctoring) {
      const sessionResult = await requireActiveProctoringSession(adminClient, proctoring?.sessionId, activeAttempt.id, user.id)
      if (sessionResult.error || !sessionResult.data) {
        return { error: sessionResult.error || 'A valid proctoring session is required for this quiz.' }
      }
      session = sessionResult.data
      const { data: eventRows, error: eventRowsError } = await adminClient
        .from('quiz_proctoring_events')
        .select('*')
        .eq('session_id', session.id)
        .order('occurred_at', { ascending: true })

      if (eventRowsError) return { error: eventRowsError.message }
      const persistedEvents = eventRowsToSubmissionEvents(eventRows || [])
      const submittedEvents = proctoring?.events || []
      const mergedEvents = new Map<string, typeof persistedEvents[number]>()
      for (const event of [...persistedEvents, ...submittedEvents]) {
        mergedEvents.set(`${event.type}:${event.occurredAt}:${event.questionIndex ?? ''}:${event.label}`, event)
      }
      proctoringEvents = Array.from(mergedEvents.values())
      const summary = buildProctoringSummary(proctoringEvents)
      proctoringViolationCount = summary.violationCount
      proctoringRisk = { score: summary.riskScore, level: summary.riskLevel }
      isIntegrityAutoSubmit = Boolean(proctoring?.autoSubmitted || summary.autoSubmit)
    }

    const isProctoringFlagged = Boolean(requiresProctoring && (isIntegrityAutoSubmit || proctoringRisk.level === 'high' || proctoringRisk.level === 'critical'))
    const safeProctoringEvents = sanitizeProctoringEvents(proctoringEvents)
    const integrityReport = requiresProctoring
      ? {
          generatedAt: new Date().toISOString(),
          quizId: quiz_id,
          userId: user.id,
          quizTitle: quiz.title,
          sessionId: session?.id || proctoring?.sessionId || null,
          status: isProctoringFlagged ? 'flagged_for_review' : 'clear',
          riskScore: proctoringRisk.score,
          riskLevel: proctoringRisk.level,
          violationCount: proctoringViolationCount,
          autoSubmitted: Boolean(proctoring?.autoSubmitted || isIntegrityAutoSubmit),
          timeline: safeProctoringEvents.map((event) => ({
            type: event.type,
            label: event.label,
            occurredAt: event.occurredAt,
            questionIndex: event.questionIndex,
            riskScore: event.riskScore,
            hasEvidence: Boolean(event.evidencePath),
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
        status: isProctoringFlagged ? 'suspicious' : 'completed',
        completed_at: new Date().toISOString(),
        proctoring_status: isProctoringFlagged ? 'suspicious' : (requiresProctoring ? 'clear' : null),
        proctoring_violations_count: proctoringViolationCount,
        proctoring_risk_score: proctoringRisk.score,
        proctoring_risk_level: requiresProctoring ? proctoringRisk.level : null,
        proctoring_events: safeProctoringEvents,
        integrity_report: integrityReport,
        auto_submitted: Boolean(proctoring?.autoSubmitted || isIntegrityAutoSubmit),
        ...(isProctoringFlagged ? { review_status: 'pending' } : {}),
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

    if (session) {
      await adminClient
        .from('proctoring_sessions')
        .update({
          status: Boolean(proctoring?.autoSubmitted || isIntegrityAutoSubmit) ? 'auto_submitted' : 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', session.id)
    }

    if (!isProctoringFlagged) {
      try {
        const [{ data: profile }, { data: earnedBadges }, { data: certificate }] = await Promise.all([
          adminClient.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle(),
          adminClient.from('user_badges').select('id').eq('user_id', user.id),
          adminClient.from('certificates').select('id').eq('quiz_id', quiz_id).eq('user_id', user.id).maybeSingle(),
        ])
        if (profile?.email) {
          const baseUrl = getSiteUrl().replace(/\/$/, '')
          await sendEmail({
            to: profile.email,
            subject: `Quiz Result: ${quiz.title} — ${score}%`,
            html: buildQuizCompletedEmail({
              employeeName: profile.full_name,
              quizTitle: quiz.title,
              score,
              points: pointsEarned,
              passingScore: quiz.passing_score ?? 60,
              badgesEarned: earnedBadges?.length || 0,
              certificateIssued: Boolean(certificate),
              certificateUrl: certificate ? `${baseUrl}/certificates/${certificate.id}` : undefined,
              resultUrl: `${baseUrl}/employee/quizzes/${quiz_id}/results`,
              analysis: attemptTopicAnalysis,
            }),
          })
        }
      } catch (mailError) {
        console.warn('Quiz completion email failed (non-fatal):', mailError)
      }
    }

    if (isProctoringFlagged) {
      try {
        const recipients = await getProctoringAlertRecipients()
        const [{ data: profile }] = await Promise.all([
          adminClient.from('profiles').select('full_name, email, employee_id').eq('id', user.id).maybeSingle(),
        ])

        const { data: notification } = await adminClient.from('training_notifications').insert({
          batch_id: quiz.batch_id || null,
          recipient_user_id: quiz.created_by || null,
          title: 'Quiz proctoring flag',
          message: `${profile?.full_name || profile?.email || 'An employee'} was flagged during ${quiz.title} after ${proctoringViolationCount} proctoring violation(s).`,
          audience: 'trainers',
          channel: 'email',
          delivery_status: recipients.length > 0 ? 'sent' : 'logged',
          sent_at: new Date().toISOString(),
          created_by: quiz.created_by || user.id,
        }).select('id').maybeSingle()

        if (recipients.length > 0) {
          const html = buildQuizProctoringFlagEmail({
            employeeName: profile?.full_name,
            employeeEmail: profile?.email,
            employeeId: profile?.employee_id,
            quizTitle: quiz.title,
            score,
            violationCount: proctoringViolationCount,
            riskScore: proctoringRisk.score,
            riskLevel: proctoringRisk.level,
            autoSubmitted: Boolean(proctoring?.autoSubmitted || isIntegrityAutoSubmit),
            events: safeProctoringEvents,
            reviewUrl: `${getSiteUrl().replace(/\/$/, '')}/manager/integrity?attempt=${data.id}`,
          })

          const mailResult = await sendEmail({
            to: recipients,
            subject: `Proctoring Flag: ${quiz.title} - ${profile?.full_name || profile?.email || 'Employee'}`,
            html,
          })

          if (notification?.id) {
            await adminClient.from('training_notification_dispatch_log').insert({
              notification_id: notification.id,
              recipient_email: recipients.join(','),
              channel: 'email',
              provider_status: mailResult.success ? 'sent' : 'failed',
              provider_message: mailResult.error || 'Sent via configured email provider',
            })
          }
        }
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

    if (data.status === 'completed') {
      try {
        await analyzeAndNotifyTopicRisk(adminClient, quiz, user.id)
      } catch (topicRiskError) {
        console.warn('Topic risk analysis failed (non-fatal):', topicRiskError)
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

async function analyzeAndNotifyTopicRisk(adminClient: any, quiz: any, fallbackCreatorId: string) {
  const questions = Array.isArray(quiz.questions) ? quiz.questions : []
  if (questions.length === 0) return

  const { data: attempts, error: attemptsError } = await adminClient
    .from('quiz_attempts')
    .select('id, user_id, answers')
    .eq('quiz_id', quiz.id)
    .eq('status', 'completed')

  if (attemptsError) throw attemptsError
  const completedAttempts = attempts || []
  const totalAttempts = completedAttempts.length
  if (totalAttempts === 0) return

  const questionById = new Map<string, any>(questions.map((question: any) => [question.id, question]))
  const wrongByQuestion = new Map<string, { wrongAttempts: number; wrongUserIds: Set<string> }>()

  for (const attempt of completedAttempts) {
    const attemptAnswers = Array.isArray(attempt.answers) ? attempt.answers : []
    for (const answer of attemptAnswers) {
      if (answer?.isCorrect !== false || !questionById.has(answer.questionId)) continue
      const current = wrongByQuestion.get(answer.questionId) || { wrongAttempts: 0, wrongUserIds: new Set<string>() }
      current.wrongAttempts += 1
      if (attempt.user_id) current.wrongUserIds.add(attempt.user_id)
      wrongByQuestion.set(answer.questionId, current)
    }
  }

  for (const [questionId, stats] of wrongByQuestion.entries()) {
    const wrongRate = Number(((stats.wrongAttempts / totalAttempts) * 100).toFixed(2))
    if (wrongRate <= TOPIC_RISK_WRONG_THRESHOLD) continue

    const question = questionById.get(questionId)
    const topic = String(quiz.topic || 'General').trim() || 'General'
    const wrongUserIds = [...stats.wrongUserIds]
    const metadata = {
      category: 'quiz_topic_risk',
      quiz_id: quiz.id,
      quiz_title: quiz.title,
      question_id: questionId,
      topic,
      wrong_rate: wrongRate,
      total_attempts: totalAttempts,
      wrong_attempts: stats.wrongAttempts,
      threshold: TOPIC_RISK_WRONG_THRESHOLD,
    }

    const { data: existingAlert, error: existingAlertError } = await adminClient
      .from('quiz_topic_risk_alerts')
      .select('id')
      .eq('quiz_id', quiz.id)
      .eq('question_id', questionId)
      .maybeSingle()

    if (existingAlertError) throw existingAlertError

    if (existingAlert?.id) {
      await adminClient
        .from('quiz_topic_risk_alerts')
        .update({
          topic,
          question_text: question.question_text,
          total_attempts: totalAttempts,
          wrong_attempts: stats.wrongAttempts,
          wrong_rate: wrongRate,
          threshold: TOPIC_RISK_WRONG_THRESHOLD,
          metadata,
        })
        .eq('id', existingAlert.id)
      continue
    }

    const staffRecipientIds = await getTopicRiskStaffRecipientIds(adminClient, quiz)
    const notifiedUserIds = [...new Set([...staffRecipientIds, ...wrongUserIds])]
    const { data: alert, error: alertError } = await adminClient
      .from('quiz_topic_risk_alerts')
      .insert({
        quiz_id: quiz.id,
        question_id: questionId,
        topic,
        question_text: question.question_text,
        total_attempts: totalAttempts,
        wrong_attempts: stats.wrongAttempts,
        wrong_rate: wrongRate,
        threshold: TOPIC_RISK_WRONG_THRESHOLD,
        notified_user_ids: notifiedUserIds,
        metadata,
      })
      .select('id')
      .maybeSingle()

    if (alertError) {
      if (alertError.code === '23505') continue
      throw alertError
    }

    await createTopicRiskNotifications({
      adminClient,
      quiz,
      topic,
      questionText: question.question_text,
      totalAttempts,
      wrongAttempts: stats.wrongAttempts,
      wrongRate,
      staffRecipientIds,
      employeeRecipientIds: wrongUserIds,
      createdBy: quiz.created_by || fallbackCreatorId,
      alertId: alert?.id || null,
      metadata,
    })
  }
}

async function getTopicRiskStaffRecipientIds(adminClient: any, quiz: any) {
  const recipientIds = new Set<string>()
  if (quiz.created_by) recipientIds.add(quiz.created_by)

  const [{ data: admins }, { data: batch }, { data: trainers }] = await Promise.all([
    adminClient.from('profiles').select('id').eq('role', 'admin').eq('approval_status', 'approved'),
    quiz.batch_id
      ? adminClient.from('training_batches').select('trainer_id, coordinator_id').eq('id', quiz.batch_id).maybeSingle()
      : Promise.resolve({ data: null }),
    quiz.batch_id
      ? adminClient.from('training_batch_trainers').select('trainer_id').eq('batch_id', quiz.batch_id)
      : Promise.resolve({ data: [] }),
  ])

  for (const admin of admins || []) if (admin.id) recipientIds.add(admin.id)
  if (batch?.trainer_id) recipientIds.add(batch.trainer_id)
  if (batch?.coordinator_id) recipientIds.add(batch.coordinator_id)
  for (const trainer of trainers || []) if (trainer.trainer_id) recipientIds.add(trainer.trainer_id)

  return [...recipientIds]
}

async function createTopicRiskNotifications({
  adminClient,
  quiz,
  topic,
  questionText,
  totalAttempts,
  wrongAttempts,
  wrongRate,
  staffRecipientIds,
  employeeRecipientIds,
  createdBy,
  alertId,
  metadata,
}: {
  adminClient: any
  quiz: any
  topic: string
  questionText: string
  totalAttempts: number
  wrongAttempts: number
  wrongRate: number
  staffRecipientIds: string[]
  employeeRecipientIds: string[]
  createdBy: string
  alertId: string | null
  metadata: Record<string, any>
}) {
  const questionSnippet = truncateText(questionText, 140)
  const sharedMetadata = { ...metadata, alert_id: alertId }
  const staffRows = [...new Set(staffRecipientIds)].map((recipientId) => ({
    batch_id: quiz.batch_id || null,
    recipient_user_id: recipientId,
    title: `Topic risk detected: ${topic}`,
    message: `${wrongAttempts}/${totalAttempts} employees (${wrongRate}%) answered a ${topic} question incorrectly in ${quiz.title}. Reinforce this topic; evidence question: "${questionSnippet}".`,
    audience: 'individual',
    channel: 'in_app',
    delivery_status: 'logged',
    sent_at: new Date().toISOString(),
    created_by: createdBy,
    metadata: { ...sharedMetadata, recipient_type: 'staff' },
  }))
  const employeeRows = [...new Set(employeeRecipientIds)].map((recipientId) => ({
    batch_id: quiz.batch_id || null,
    recipient_user_id: recipientId,
    title: `Focus area: ${topic}`,
    message: `A ${topic} question in ${quiz.title} was missed by more than ${TOPIC_RISK_WRONG_THRESHOLD}% of learners. Revisit this topic and review your result explanations before the next assessment.`,
    audience: 'individual',
    channel: 'in_app',
    delivery_status: 'logged',
    sent_at: new Date().toISOString(),
    created_by: createdBy,
    metadata: { ...sharedMetadata, recipient_type: 'employee' },
  }))

  const rows = [...staffRows, ...employeeRows]
  if (rows.length === 0) return
  const { error } = await adminClient.from('training_notifications').insert(rows)
  if (error) throw error
}

function truncateText(value: string, maxLength: number) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLength) return clean
  return `${clean.slice(0, maxLength - 3)}...`
}

async function getProctoringAlertRecipients() {
  return [getAdminAlertEmail()]
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
  const { data: attempts, error: attemptsError } = await supabase
    .from('quiz_attempts')
    .select('quiz_id, status, score, answers, completed_at, quizzes:quiz_id(id, topic, difficulty, created_by)')
    .eq('user_id', user.id)

  if (attemptsError) return { error: attemptsError.message, data: [] }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('domain, created_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) return { error: profileError.message, data: [] }

  const { data: userStats, error: userStatsError } = await supabase
    .from('user_stats')
    .select('current_streak')
    .eq('user_id', user.id)
    .maybeSingle()

  if (userStatsError) return { error: userStatsError.message, data: [] }

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
  const now = new Date().toISOString()

  // Verify this quiz is assigned to the employee
  const { data: assignment, error: assignmentError } = await adminClient
    .from('quiz_assignments')
    .select('id')
    .eq('quiz_id', idResult.data)
    .eq('user_id', user.id)
    .maybeSingle()

  if (assignmentError) return { error: assignmentError.message }
  if (!assignment) return { error: 'This quiz has not been assigned to you' }

  const { data: quiz, error: quizError } = await adminClient
    .from('quizzes')
    .select('*')
    .eq('id', idResult.data)
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .maybeSingle()

  if (quizError) return { error: quizError.message }
  if (!quiz) return { error: 'This quiz is not currently available. Please check the scheduled time.' }

  // Get all questions for the quiz
  const { data: questions, error: questionsError } = await adminClient
    .from('questions')
    .select('*')
    .eq('quiz_id', idResult.data)
    .order('order_index', { ascending: true })

  if (questionsError) return { error: questionsError.message }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('domain, created_at, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) return { error: profileError.message }

  const { data: userStats, error: userStatsError } = await supabase
    .from('user_stats')
    .select('current_streak')
    .eq('user_id', user.id)
    .maybeSingle()

  if (userStatsError) return { error: userStatsError.message }

  const { data: previousAttempts, error: previousAttemptsError } = await supabase
    .from('quiz_attempts')
    .select('quiz_id, score, answers, completed_at, quizzes:quiz_id(id, topic, difficulty, created_by)')
    .eq('user_id', user.id)
    .eq('status', 'completed')

  if (previousAttemptsError) return { error: previousAttemptsError.message }

  // Shuffle questions for randomness
  const shuffled = questions ? [...questions].sort(() => Math.random() - 0.5) : []

  // Shuffle options for each question and remove answer/explanation fields from pre-submit props.
  const questionsWithShuffledOptions = shuffled.map(question => {
      if (question.options && Array.isArray(question.options)) {
        const optionsWithIndex = question.options.map((option: any, index: number) => ({
          text: option.text,
          optionId: index,
        }))

      const shuffledOptions = [...optionsWithIndex].sort(() => Math.random() - 0.5)
      
      return {
        id: question.id,
        quiz_id: question.quiz_id,
        question_text: question.question_text,
        difficulty: question.difficulty,
        options: shuffledOptions
      }
    }
    return {
      id: question.id,
      quiz_id: question.quiz_id,
      question_text: question.question_text,
      difficulty: question.difficulty,
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
      viewerRole: profile?.role || null,
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

  const { data: stats, error: statsError } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (statsError) return { error: statsError.message }

  const { data: badges, error: badgesError } = await supabase
    .from('user_badges')
    .select('*, badges(*)')
    .eq('user_id', user.id)

  if (badgesError) return { error: badgesError.message }

  const { data: recentAttempts, error: recentAttemptsError } = await supabase
    .from('quiz_attempts')
    .select('*, quizzes(title, topic, difficulty, created_by)')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(10)

  if (recentAttemptsError) return { error: recentAttemptsError.message }

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
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated', data: [], certificates: [] }

  const { data: allBadges, error: allBadgesError } = await supabase
    .from('badges')
    .select('*')
    .order('points', { ascending: true })

  if (allBadgesError) return { error: allBadgesError.message, data: [], certificates: [] }

  const { data: earnedBadges, error: earnedBadgesError } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', user.id)

  if (earnedBadgesError) return { error: earnedBadgesError.message, data: [], certificates: [] }

  const adminClient = createAdminClient()
  const { data: certificates, error: certificatesError } = await adminClient
    .from('certificates')
    .select('id, title, score, issued_at, attempt:attempt_id(status), quiz:quiz_id(title, topic), rule:rule_id(certificate_name, min_score)')
    .eq('user_id', user.id)
    .order('issued_at', { ascending: false })

  if (certificatesError) return { error: certificatesError.message, data: [], certificates: [] }

  const earnedIds = new Set(earnedBadges?.map((b: any) => b.badge_id) || [])

  return {
    data: (allBadges || []).map((b: any) => ({
      ...b,
      earned: earnedIds.has(b.id),
    })),
    certificates: (certificates || []).filter((certificate: any) => !certificate.attempt?.status || certificate.attempt.status === 'completed'),
  }
}
