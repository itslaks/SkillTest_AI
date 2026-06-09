'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CreateQuizInput, CreateQuestionInput } from '@/lib/types/database'
import { requireTrainingStaff } from '@/lib/rbac'
import {
  createQuizSchema,
  updateQuizSchema,
  createQuestionSchema,
  updateQuestionSchema,
  bulkCreateQuestionsSchema,
  uuidSchema,
} from '@/lib/security/validation'

async function verifyQuizOwnership(supabase: ReturnType<typeof createAdminClient>, quizId: string, userId: string) {
  const { data: quiz, error } = await supabase
    .from('quizzes')
    .select('id')
    .eq('id', quizId)
    .eq('created_by', userId)
    .maybeSingle()

  if (error) return false
  return Boolean(quiz)
}

export async function createQuiz(input: CreateQuizInput) {
  // Validate input against strict schema
  const parsed = createQuizSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const { userId } = await requireTrainingStaff()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('quizzes')
    .insert({
      ...parsed.data,
      created_by: userId,
      is_active: parsed.data.status !== 'draft' && parsed.data.status !== 'archived',
    })
    .select()
    .single()

  if (error) {
    console.error('Quiz creation database error:', error.message, error.details)
    return { error: error.message }
  }

  console.log('Quiz created successfully:', data.id)
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

  const { userId, role } = await requireTrainingStaff()
  const supabase = createAdminClient()

  const updatePayload = {
    ...parsed.data,
    ...(parsed.data.status
      ? { is_active: parsed.data.status === 'active' }
      : {}),
    updated_at: new Date().toISOString(),
  }

  let updateQuery = supabase
    .from('quizzes')
    .update(updatePayload)
    .eq('id', idResult.data)
  if (role !== 'admin') updateQuery = updateQuery.eq('created_by', userId)
  const { data, error } = await updateQuery
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

  const { userId, role } = await requireTrainingStaff()
  const supabase = createAdminClient()

  const { count: activeAttemptCount, error: activeAttemptError } = await supabase
    .from('quiz_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('quiz_id', idResult.data)
    .eq('status', 'in_progress')

  if (activeAttemptError) {
    return { error: activeAttemptError.message }
  }

  if ((activeAttemptCount || 0) > 0) {
    return { error: `Cannot delete — ${activeAttemptCount} fresher(s) currently have active attempts.` }
  }

  let deleteQuery = supabase.from('quizzes').delete().eq('id', idResult.data)
  if (role !== 'admin') deleteQuery = deleteQuery.eq('created_by', userId)
  const { error } = await deleteQuery

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

  const { userId, role } = await requireTrainingStaff()
  const supabase = createAdminClient()

  let updateQuery = supabase
    .from('quizzes')
    .update({
      is_active: isActive,
      status: isActive ? 'active' : 'draft',
      updated_at: new Date().toISOString(),
    })
    .eq('id', idResult.data)
  if (role !== 'admin') updateQuery = updateQuery.eq('created_by', userId)
  const { error } = await updateQuery

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/manager/quizzes', 'layout')
  return { success: true }
}

export async function getQuizzes() {
  const { userId, role } = await requireTrainingStaff()
  const supabase = createAdminClient()

  let query = supabase
    .from('quizzes')
    .select('*, questions(count)')
    .order('created_at', { ascending: false })
  if (role !== 'admin') query = query.eq('created_by', userId)
  const { data, error } = await query

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

  const { userId, role } = await requireTrainingStaff()
  const supabase = createAdminClient()

  let quizQuery = supabase
    .from('quizzes')
    .select('*')
    .eq('id', idResult.data)
  if (role !== 'admin') quizQuery = quizQuery.eq('created_by', userId)
  const { data: quiz, error: quizError } = await quizQuery.single()

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

  const admin = createAdminClient()
  const { data: certificateRule } = await admin
    .from('certificate_rules')
    .select('*')
    .eq('quiz_id', idResult.data)
    .maybeSingle()

  return { data: { ...quiz, certificate_rule: certificateRule || null, questions } }
}

export async function saveQuizCertificateRule(formData: FormData) {
  const { userId, role } = await requireTrainingStaff()
  const admin = createAdminClient()
  const quizId = String(formData.get('quiz_id') || '')
  const enabled = String(formData.get('enabled') || '') === 'on'
  const minScore = Math.min(100, Math.max(0, Number(formData.get('min_score') || 70)))
  const title = String(formData.get('title') || 'Certificate of Achievement').trim()
  const certificateName = String(formData.get('certificate_name') || title || 'Course Completion Certificate').trim()
  const message = String(formData.get('message') || '').trim()
  const templateAccentColor = String(formData.get('template_accent_color') || '#d97706').trim()
  const templateNotes = String(formData.get('template_notes') || '').trim()
  const existingTemplate = String(formData.get('existing_template_image_url') || '').trim()
  const templateFile = formData.get('template_file')

  if (!uuidSchema.safeParse(quizId).success) return { error: 'Quiz is required.' }
  if (!title) return { error: 'Certificate title is required.' }
  if (!certificateName) return { error: 'Certificate name is required.' }

  const { data: quiz, error: quizError } = await admin
    .from('quizzes')
    .select('id, created_by')
    .eq('id', quizId)
    .maybeSingle()
  if (quizError) return { error: quizError.message }
  if (!quiz) return { error: 'Quiz was not found.' }
  if (role !== 'admin' && quiz.created_by !== userId) return { error: 'Not authorized for this quiz.' }

  let templateImageUrl = existingTemplate || null
  if (templateFile instanceof File && templateFile.size > 0) {
    if (!templateFile.type.startsWith('image/')) return { error: 'Certificate template must be an image file.' }
    if (templateFile.size > 1_500_000) return { error: 'Certificate template image must be below 1.5 MB.' }
    const bytes = Buffer.from(await templateFile.arrayBuffer())
    templateImageUrl = `data:${templateFile.type};base64,${bytes.toString('base64')}`
  }

  const { error } = await admin
    .from('certificate_rules')
    .upsert({
      quiz_id: quizId,
      enabled,
      min_score: minScore,
      title,
      certificate_name: certificateName,
      message: message || null,
      template_image_url: templateImageUrl,
      template_accent_color: templateAccentColor || '#d97706',
      template_notes: templateNotes || null,
      created_by: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'quiz_id' })

  if (error) return { error: error.message }
  revalidatePath('/manager/quizzes', 'layout')
  revalidatePath(`/manager/quizzes/${quizId}`)
  return { data: true }
}

export async function createQuestion(input: CreateQuestionInput) {
  // Validate input against strict schema
  const parsed = createQuestionSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const { userId } = await requireTrainingStaff()
  const supabase = createAdminClient()

  const ownsQuiz = await verifyQuizOwnership(supabase, parsed.data.quiz_id, userId)
  if (!ownsQuiz) {
    return { error: 'Not authorized for this quiz' }
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

  const { userId } = await requireTrainingStaff()
  const supabase = createAdminClient()

  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('quiz_id')
    .eq('id', idResult.data)
    .maybeSingle()

  if (questionError) return { error: questionError.message }
  const ownsQuestionQuiz = question ? await verifyQuizOwnership(supabase, question.quiz_id, userId) : false
  if (!question || !ownsQuestionQuiz) {
    return { error: 'Not authorized for this quiz' }
  }

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

  const { userId } = await requireTrainingStaff()
  const supabase = createAdminClient()

  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('quiz_id')
    .eq('id', idResult.data)
    .maybeSingle()

  if (questionError) return { error: questionError.message }
  const ownsQuestionQuiz = question ? await verifyQuizOwnership(supabase, question.quiz_id, userId) : false
  if (!question || !ownsQuestionQuiz) {
    return { error: 'Not authorized for this quiz' }
  }

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

export async function bulkCreateQuestions(questions: CreateQuestionInput[]) {
  // Validate the entire batch
  const parsed = bulkCreateQuestionsSchema.safeParse(questions)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const { userId } = await requireTrainingStaff()
  const supabase = createAdminClient()
  const quizIds = Array.from(new Set(parsed.data.map((question) => question.quiz_id)))

  for (const quizId of quizIds) {
    const ownsQuiz = await verifyQuizOwnership(supabase, quizId, userId)
    if (!ownsQuiz) {
      return { error: 'Not authorized for this quiz' }
    }
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

export async function getQuizStats() {
  const { userId, role } = await requireTrainingStaff()
  const supabase = createAdminClient()

  // Get all quizzes created by manager
  let quizQuery = supabase
    .from('quizzes')
    .select('id')
  if (role !== 'admin') quizQuery = quizQuery.eq('created_by', userId)
  const { data: quizzes, error: quizzesError } = await quizQuery

  if (quizzesError) return { error: quizzesError.message }

  const quizIds = quizzes?.map((q: any) => q.id) || []

  // Get total attempts
  const { count: totalAttempts, error: totalAttemptsError } = await supabase
    .from('quiz_attempts')
    .select('*', { count: 'exact', head: true })
    .in('quiz_id', quizIds)
    .not('completed_at', 'is', null)

  if (totalAttemptsError) return { error: totalAttemptsError.message }

  // Get average score
  const { data: attempts, error: attemptsError } = await supabase
    .from('quiz_attempts')
    .select('score')
    .in('quiz_id', quizIds)
    .not('completed_at', 'is', null)

  if (attemptsError) return { error: attemptsError.message }

  const averageScore = attempts && attempts.length > 0
    ? Math.round(attempts.reduce((sum: number, a: any) => sum + a.score, 0) / attempts.length)
    : 0

  // Get unique employees who took quizzes
  const { data: uniqueEmployees, error: uniqueEmployeesError } = await supabase
    .from('quiz_attempts')
    .select('user_id')
    .in('quiz_id', quizIds)
    .not('completed_at', 'is', null)

  if (uniqueEmployeesError) return { error: uniqueEmployeesError.message }

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

// Force redeploy: trivial comment for Vercel cache bust
