'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { uuidSchema, submitQuizSchema } from '@/lib/security/validation'
import type { SubmitQuizInput, LeaderboardEntry } from '@/lib/types/database'

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
    return { error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  const { quiz_id, answers, time_taken_seconds } = parsed.data

  // Fetch quiz to calculate score
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*, questions(*)')
    .eq('id', quiz_id)
    .single()

  if (!quiz) return { error: 'Quiz not found' }

  // Calculate score
  const totalQuestions = answers.length
  const correctAnswers = answers.filter(a => a.isCorrect).length
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0

  // Points: base 10 per correct + speed bonus
  const speedBonus = time_taken_seconds < (quiz.time_limit_minutes * 60 * 0.5) ? 25 : 0
  const streakBonus = correctAnswers >= totalQuestions ? 50 : 0
  const pointsEarned = (correctAnswers * 10) + speedBonus + streakBonus

  const { data, error } = await supabase
    .from('quiz_attempts')
    .update({
      answers,
      score,
      total_questions: totalQuestions,
      correct_answers: correctAnswers,
      time_taken_seconds,
      points_earned: pointsEarned,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('quiz_id', quiz_id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/employee', 'layout')
  return { data }
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
    .select('quiz_id, status, score')
    .eq('user_id', user.id)

  const attemptMap = new Map<string, { quiz_id: string; status: string; score: number }>(
    attempts?.map((a: any) => [a.quiz_id, a]) || []
  )

  const quizzesWithStatus = quizzes?.map((q: any) => ({
    ...q,
    attemptStatus: attemptMap.get(q.id)?.status || null,
    attemptScore: attemptMap.get(q.id)?.score || null,
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

  // Shuffle questions for randomness
  const shuffled = questions ? [...questions].sort(() => Math.random() - 0.5) : []

  return { data: { ...quiz, questions: shuffled } }
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
    .order('time_taken_seconds', { ascending: true })

  if (error) return { error: error.message, data: [] }

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
    .select('*, quizzes(title, topic)')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(10)

  return {
    data: {
      stats: stats || { total_points: 0, current_streak: 0, longest_streak: 0, tests_completed: 0, average_score: 0 },
      badges: badges || [],
      recentAttempts: recentAttempts || [],
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

  const earnedIds = new Set(earnedBadges?.map((b: any) => b.badge_id) || [])

  return {
    data: (allBadges || []).map((b: any) => ({
      ...b,
      earned: earnedIds.has(b.id),
    }))
  }
}
