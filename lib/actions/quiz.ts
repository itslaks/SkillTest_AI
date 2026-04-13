'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CreateQuizInput, CreateQuestionInput, DifficultyLevel } from '@/lib/types/database'
import {
  createQuizSchema,
  updateQuizSchema,
  createQuestionSchema,
  updateQuestionSchema,
  bulkCreateQuestionsSchema,
  uuidSchema,
} from '@/lib/security/validation'

export async function createQuiz(input: CreateQuizInput) {
  // Validate input against strict schema
  const parsed = createQuizSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('quizzes')
    .insert({
      ...parsed.data,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/manager/quizzes', 'layout')
  return { data }
}

export async function updateQuiz(id: string, input: Partial<CreateQuizInput>) {
  // Validate ID
  const idResult = uuidSchema.safeParse(id)
  if (!idResult.success) {
    return { error: 'Invalid quiz ID' }
  }

  // Validate input against strict schema
  const parsed = updateQuizSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('quizzes')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', idResult.data)
    .eq('created_by', user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/manager/quizzes', 'layout')
  return { data }
}

export async function deleteQuiz(id: string) {
  // Validate ID
  const idResult = uuidSchema.safeParse(id)
  if (!idResult.success) {
    return { error: 'Invalid quiz ID' }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('quizzes')
    .delete()
    .eq('id', idResult.data)
    .eq('created_by', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/manager/quizzes', 'layout')
  return { success: true }
}

export async function toggleQuizActive(id: string, isActive: boolean) {
  // Validate ID
  const idResult = uuidSchema.safeParse(id)
  if (!idResult.success) {
    return { error: 'Invalid quiz ID' }
  }

  // Validate boolean
  if (typeof isActive !== 'boolean') {
    return { error: 'isActive must be a boolean' }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('quizzes')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', idResult.data)
    .eq('created_by', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/manager/quizzes', 'layout')
  return { success: true }
}

export async function getQuizzes() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated', data: [] }
  }

  const { data, error } = await supabase
    .from('quizzes')
    .select('*, questions(count)')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data }
}

export async function getQuizWithQuestions(quizId: string) {
  // Validate ID
  const idResult = uuidSchema.safeParse(quizId)
  if (!idResult.success) {
    return { error: 'Invalid quiz ID' }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', idResult.data)
    .single()

  if (quizError) {
    return { error: quizError.message }
  }

  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .eq('quiz_id', idResult.data)
    .order('created_at', { ascending: true })

  if (questionsError) {
    return { error: questionsError.message }
  }

  return { data: { ...quiz, questions } }
}

export async function createQuestion(input: CreateQuestionInput) {
  // Validate input against strict schema
  const parsed = createQuestionSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('questions')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/manager/quizzes', 'layout')
  return { data }
}

export async function updateQuestion(id: string, input: Partial<CreateQuestionInput>) {
  // Validate ID
  const idResult = uuidSchema.safeParse(id)
  if (!idResult.success) {
    return { error: 'Invalid question ID' }
  }

  // Validate input
  const parsed = updateQuestionSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('questions')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', idResult.data)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/manager/quizzes', 'layout')
  return { data }
}

export async function deleteQuestion(id: string) {
  // Validate ID
  const idResult = uuidSchema.safeParse(id)
  if (!idResult.success) {
    return { error: 'Invalid question ID' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('questions')
    .delete()
    .eq('id', idResult.data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/manager/quizzes', 'layout')
  return { success: true }
}

export async function approveQuestion(id: string) {
  const idResult = uuidSchema.safeParse(id)
  if (!idResult.success) {
    return { error: 'Invalid question ID' }
  }
  return updateQuestion(idResult.data, { status: 'approved' })
}

export async function rejectQuestion(id: string) {
  const idResult = uuidSchema.safeParse(id)
  if (!idResult.success) {
    return { error: 'Invalid question ID' }
  }
  return updateQuestion(idResult.data, { status: 'rejected' })
}

export async function bulkCreateQuestions(questions: CreateQuestionInput[]) {
  // Validate the entire batch
  const parsed = bulkCreateQuestionsSchema.safeParse(questions)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('questions')
    .insert(parsed.data)
    .select()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/manager/quizzes', 'layout')
  return { data }
}

// Get quiz statistics for manager dashboard
export async function getQuizStats() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  // Get all quizzes created by manager
  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id')
    .eq('created_by', user.id)

  const quizIds = quizzes?.map((q: any) => q.id) || []

  // Get total attempts
  const { count: totalAttempts } = await supabase
    .from('quiz_attempts')
    .select('*', { count: 'exact', head: true })
    .in('quiz_id', quizIds)
    .not('completed_at', 'is', null)

  // Get average score
  const { data: attempts } = await supabase
    .from('quiz_attempts')
    .select('score')
    .in('quiz_id', quizIds)
    .not('completed_at', 'is', null)

  const averageScore = attempts && attempts.length > 0
    ? Math.round(attempts.reduce((sum: number, a: any) => sum + a.score, 0) / attempts.length)
    : 0

  // Get unique employees who took quizzes
  const { data: uniqueEmployees } = await supabase
    .from('quiz_attempts')
    .select('user_id')
    .in('quiz_id', quizIds)
    .not('completed_at', 'is', null)

  const uniqueEmployeeCount = new Set(uniqueEmployees?.map((e: any) => e.user_id)).size

  return {
    data: {
      totalQuizzes: quizzes?.length || 0,
      totalAttempts: totalAttempts || 0,
      averageScore,
      uniqueEmployees: uniqueEmployeeCount,
    }
  }
}
