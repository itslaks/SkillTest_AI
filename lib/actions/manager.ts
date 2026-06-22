'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAdmin, requireManager, requireTrainingStaff } from '@/lib/rbac'
import { revalidatePath } from 'next/cache'
import type { ApiResponse, EmployeeImport, EmployeeImportError, EmployeeImportResult } from '@/lib/types/database'
import { approveTrainer, rejectTrainer } from '@/lib/actions/auth'
import { buildQuizAssignedEmail, sendEmail } from '@/lib/email'
import { createEmployeeWithSetupEmail, sendEmployeeSetupEmail } from '@/lib/employee-onboarding'
import { uuidSchema } from '@/lib/security/validation'

// ─── Pending Trainer Sign-Ups (Admin only) ────────────────────────────

export async function getPendingTrainerSignups() {
  await requireAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, full_name, department, created_at, rejection_reason')
    .eq('role', 'trainer')
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function approveTrainerSignup(formData: FormData) {
  const userId = String(formData.get('user_id') || '')
  if (!userId) return { error: 'User ID required' }
  const result = await approveTrainer(userId)
  revalidatePath('/manager/admin')
  return result
}

export async function rejectTrainerSignup(formData: FormData) {
  const userId = String(formData.get('user_id') || '')
  const reason = String(formData.get('reason') || '')
  if (!userId) return { error: 'User ID required' }
  const result = await rejectTrainer(userId, reason)
  revalidatePath('/manager/admin')
  return result
}

export async function getAdminUsers() {
  await requireAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, full_name, role, department, domain, employee_id, created_at')
    .in('role', ['trainer', 'training_coordinator', 'manager', 'admin'])
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function getAdminAuditLogs() {
  await requireAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('training_admin_audit')
    .select('*, actor:actor_id(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(25)

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function getAdminFeedbackReviews() {
  await requireAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('training_feedback')
    .select(`
      *,
      batch:batch_id(id, title, domain, status),
      session:session_id(id, title, session_date),
      trainee:user_id(id, full_name, email, employee_id, department, domain),
      reviewer:reviewed_by(id, full_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function updateAdminFeedbackReview(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId } = await requireAdmin()
  const admin = createAdminClient()
  const feedbackId = String(formData.get('feedback_id') || '').trim()
  const reviewStatus = String(formData.get('quick_status') || formData.get('review_status') || '').trim()
  const reviewNotes = String(formData.get('review_notes') || '').trim()
  const actionItem = String(formData.get('action_item') || '').trim()

  if (!feedbackId) return { error: 'Feedback record is required.' }
  if (!['pending', 'reviewed', 'dismissed'].includes(reviewStatus)) {
    return { error: 'Choose a valid review status.' }
  }

  const reviewedAt = reviewStatus === 'pending' ? null : new Date().toISOString()
  const reviewerId = reviewStatus === 'pending' ? null : userId

  const { error } = await admin
    .from('training_feedback')
    .update({
      review_status: reviewStatus,
      review_notes: reviewNotes || null,
      action_item: actionItem || null,
      reviewed_by: reviewerId,
      reviewed_at: reviewedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', feedbackId)

  if (error) return { error: error.message }

  await admin.from('training_admin_audit').insert({
    actor_id: userId,
    action: `feedback_${reviewStatus}`,
    target_table: 'training_feedback',
    target_id: feedbackId,
    details: { review_status: reviewStatus, review_notes: reviewNotes || null, action_item: actionItem || null },
  })

  revalidatePath('/manager/admin')
  revalidatePath('/manager/operations')
  return { data: true }
}

export async function deleteAdminFeedbackReview(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId } = await requireAdmin()
  const admin = createAdminClient()
  const feedbackId = String(formData.get('feedback_id') || '').trim()
  if (!feedbackId) return { error: 'Feedback record is required.' }

  const { data: previous } = await admin
    .from('training_feedback')
    .select('id, user_id, batch_id, session_id, rating, sentiment, review_status')
    .eq('id', feedbackId)
    .maybeSingle()

  const { error } = await admin
    .from('training_feedback')
    .delete()
    .eq('id', feedbackId)

  if (error) return { error: error.message }

  await admin.from('training_admin_audit').insert({
    actor_id: userId,
    action: 'feedback_delete',
    target_table: 'training_feedback',
    target_id: feedbackId,
    details: previous || {},
  })

  revalidatePath('/manager/admin')
  revalidatePath('/manager/operations')
  return { data: true }
}

function isMissingTrainerAssignmentsTable(error: any) {
  const message = String(error?.message || '').toLowerCase()
  return error?.code === '42P01' || message.includes('trainer_employee_assignments') || message.includes('does not exist')
}

async function getAssignedEmployeeIdsForTrainer(admin: ReturnType<typeof createAdminClient>, trainerId: string) {
  const { data, error } = await admin
    .from('trainer_employee_assignments')
    .select('employee_id')
    .eq('trainer_id', trainerId)

  if (error) {
    if (isMissingTrainerAssignmentsTable(error)) return { ids: [] as string[], missingTable: true }
    return { ids: [] as string[], error: error.message as string }
  }

  return { ids: (data || []).map((item: any) => item.employee_id).filter(Boolean) as string[] }
}

export async function getTrainerEmployeeAssignmentData() {
  await requireAdmin()
  const admin = createAdminClient()
  const [trainersResult, employeesResult, assignmentsResult] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, full_name, department, domain, created_at')
      .eq('role', 'trainer')
      .eq('approval_status', 'approved')
      .order('full_name', { ascending: true }),
    admin
      .from('profiles')
      .select('id, email, full_name, employee_id, department, domain, created_at')
      .eq('role', 'employee')
      .order('full_name', { ascending: true })
      .limit(250),
    admin
      .from('trainer_employee_assignments')
      .select('id, trainer_id, employee_id, assigned_at, notes, trainer:trainer_id(id, full_name, email), employee:employee_id(id, full_name, email, employee_id, domain, department)')
      .order('assigned_at', { ascending: false }),
  ])

  const assignmentError = assignmentsResult.error
  return {
    data: {
      trainers: trainersResult.data || [],
      employees: employeesResult.data || [],
      assignments: assignmentError && isMissingTrainerAssignmentsTable(assignmentError) ? [] : (assignmentsResult.data || []),
      warning: assignmentError && isMissingTrainerAssignmentsTable(assignmentError)
        ? 'Run database migration 041_trainer_employee_assignments.sql to enable trainer employee assignment storage.'
        : assignmentError?.message || null,
    },
  }
}

export async function assignEmployeesToTrainer(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId } = await requireAdmin()
  const admin = createAdminClient()
  const trainerId = String(formData.get('trainer_id') || '')
  const employeeIds = formData.getAll('employee_ids').map((value) => String(value)).filter(Boolean)
  const notes = String(formData.get('notes') || '').trim()

  if (!trainerId) return { error: 'Select a trainer.' }
  if (employeeIds.length === 0) return { error: 'Select at least one employee for this trainer.' }

  const [{ data: trainer }, { data: employees }] = await Promise.all([
    admin.from('profiles').select('id, role').eq('id', trainerId).maybeSingle(),
    admin.from('profiles').select('id, role').in('id', employeeIds),
  ])

  if (!trainer || trainer.role !== 'trainer') return { error: 'Selected trainer is not a trainer account.' }
  const validEmployeeIds = (employees || []).filter((employee: any) => employee.role === 'employee').map((employee: any) => employee.id)
  if (validEmployeeIds.length === 0) return { error: 'Selected users are not employee accounts.' }

  const rows = validEmployeeIds.map((employeeId: string) => ({
    trainer_id: trainerId,
    employee_id: employeeId,
    assigned_by: userId,
    notes: notes || null,
  }))

  const { error } = await admin
    .from('trainer_employee_assignments')
    .upsert(rows, { onConflict: 'trainer_id,employee_id' })

  if (error) return { error: error.message }

  await admin.from('training_admin_audit').insert({
    actor_id: userId,
    action: 'trainer_employee_assignment',
    target_table: 'trainer_employee_assignments',
    target_id: trainerId,
    details: { trainer_id: trainerId, employee_ids: validEmployeeIds, notes: notes || null },
  })

  revalidatePath('/manager/admin')
  revalidatePath('/manager/employees')
  revalidatePath('/manager/operations')
  return { data: true }
}

export async function removeTrainerEmployeeAssignment(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId } = await requireAdmin()
  const admin = createAdminClient()
  const assignmentId = String(formData.get('assignment_id') || '')
  if (!assignmentId) return { error: 'Assignment ID is required.' }

  const { data: assignment } = await admin
    .from('trainer_employee_assignments')
    .select('trainer_id, employee_id')
    .eq('id', assignmentId)
    .maybeSingle()

  const { error } = await admin
    .from('trainer_employee_assignments')
    .delete()
    .eq('id', assignmentId)

  if (error) return { error: error.message }

  await admin.from('training_admin_audit').insert({
    actor_id: userId,
    action: 'trainer_employee_unassignment',
    target_table: 'trainer_employee_assignments',
    target_id: assignmentId,
    details: assignment || {},
  })

  revalidatePath('/manager/admin')
  revalidatePath('/manager/employees')
  revalidatePath('/manager/operations')
  return { data: true }
}

export async function updateUserRole(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId } = await requireAdmin()
  const admin = createAdminClient()
  const targetUserId = String(formData.get('user_id') || '')
  const role = String(formData.get('role') || '')

  if (!targetUserId || !['employee', 'trainer', 'training_coordinator', 'manager', 'admin'].includes(role)) {
    return { error: 'User and valid role are required.' }
  }

  const { error } = await admin
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', targetUserId)

  if (error) return { error: error.message }

  await admin.from('training_admin_audit').insert({
    actor_id: userId,
    action: 'user_role_update',
    target_table: 'profiles',
    target_id: targetUserId,
    details: { role },
  })

  revalidatePath('/manager/admin')
  revalidatePath('/manager/settings')
  return { data: true }
}

// ─── Import employees from parsed Excel data ─────────────────────────
export async function importEmployees(employees: EmployeeImport[]): Promise<ApiResponse<EmployeeImportResult>> {
  const { userId } = await requireManager()

  const supabase = createAdminClient()

  let successful = 0
  let failed = 0
  const errors: EmployeeImportError[] = []
  const seenEmails = new Set<string>()

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i]
    const email = emp.email?.trim().toLowerCase()
    const fullName = emp.full_name?.trim()
    const employeeId = emp.employee_id?.trim()
    const domain = emp.domain?.trim()

    if (!email || !fullName) {
      failed++
      errors.push({ row: i + 1, email: email || 'N/A', error: 'Missing email or name' })
      continue
    }

    if (!employeeId || !domain) {
      failed++
      errors.push({ row: i + 1, email, error: 'Employee ID and domain are required' })
      continue
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      failed++
      errors.push({ row: i + 1, email, error: 'Invalid email address' })
      continue
    }

    if (seenEmails.has(email)) {
      failed++
      errors.push({ row: i + 1, email, error: 'Duplicate email in import file' })
      continue
    }
    seenEmails.add(email)

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingProfile) {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          domain,
          department: domain,
          employee_id: employeeId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProfile.id)
      if (error) {
        failed++
        errors.push({ row: i + 1, email, error: error.message })
        continue
      }
      const setupResult = await sendEmployeeSetupEmail(supabase, email, fullName)
      if (!setupResult.success) {
        errors.push({
          row: i + 1,
          email,
          error: `Profile updated, but setup email failed: ${setupResult.error}`,
        })
      }
      successful++
    } else {
      try {
        const { warning } = await createEmployeeWithSetupEmail(supabase, {
          email,
          fullName,
          employeeId,
          department: domain,
          domain,
        })

        if (warning) {
          errors.push({ row: i + 1, email, error: warning })
        }
        successful++
      } catch (error: any) {
        failed++
        errors.push({ row: i + 1, email, error: error.message })
        continue
      }
    }
  }

  // Log the import
  await supabase.from('employee_imports').insert({
    uploaded_by: userId,
    file_name: 'excel_import',
    total_records: employees.length,
    successful_imports: successful,
    failed_imports: failed,
    status: 'completed',
    error_log: errors.length > 0 ? errors : null,
  })

  await supabase.from('training_notifications').insert({
    title: 'Employee import processed',
    message: `${successful} of ${employees.length} employee row(s) were processed. ${failed} failed.${errors.length > failed ? ` ${errors.length - failed} setup email warning(s) need review.` : ''}`,
    audience: 'trainers',
    channel: 'in_app',
    delivery_status: failed === 0 ? 'sent' : 'logged',
    sent_at: failed === 0 ? new Date().toISOString() : null,
    created_by: userId,
  })

  revalidatePath('/manager/employees', 'layout')
  revalidatePath('/manager/notifications')
  return {
    data: {
      total: employees.length,
      successful,
      failed,
      errors,
    }
  }
}

// ─── Get all employees (for manager view) ─────────────────────────────
export async function getEmployees() {
  const { userId, role } = await requireTrainingStaff()

  const adminClient = createAdminClient()
  const { data: currentProfile } = await adminClient
    .from('profiles')
    .select('domain')
    .eq('id', userId)
    .maybeSingle()

  let query = adminClient
    .from('profiles')
    .select('*, user_stats(*)')
    .eq('role', 'employee')
    .order('full_name', { ascending: true })

  if (role === 'trainer') {
    const assigned = await getAssignedEmployeeIdsForTrainer(adminClient, userId)
    if (assigned.error) return { error: assigned.error, data: [] }
    if (assigned.ids.length === 0) return { data: [] }
    query = query.in('id', assigned.ids)
  } else if (role !== 'admin') {
    query = currentProfile?.domain
      ? query.eq('domain', currentProfile.domain)
      : query.eq('id', userId)
  }

  const { data: employees, error } = await query

  if (error) return { error: error.message, data: [] }
  return { data: employees || [] }
}

// ─── Get employees grouped by domain ──────────────────────────────────
export async function getEmployeesByDomain() {
  const { userId, role } = await requireTrainingStaff()

  const adminClient = createAdminClient()
  const { data: currentProfile } = await adminClient
    .from('profiles')
    .select('domain')
    .eq('id', userId)
    .maybeSingle()

  let query = adminClient
    .from('profiles')
    .select('*')
    .eq('role', 'employee')
    .order('domain', { ascending: true })

  if (role === 'trainer') {
    const assigned = await getAssignedEmployeeIdsForTrainer(adminClient, userId)
    if (assigned.error) return { error: assigned.error, data: {} }
    if (assigned.ids.length === 0) return { data: {} }
    query = query.in('id', assigned.ids)
  } else if (role !== 'admin') {
    query = currentProfile?.domain
      ? query.eq('domain', currentProfile.domain)
      : query.eq('id', userId)
  }

  const { data: employees, error } = await query

  if (error) return { error: error.message, data: {} }

  const grouped: Record<string, typeof employees> = {}
  for (const emp of employees || []) {
    const domain = emp.domain || 'Uncategorized'
    if (!grouped[domain]) grouped[domain] = []
    grouped[domain].push(emp)
  }

  return { data: grouped }
}

// ─── Get import history ───────────────────────────────────────────────
export async function getImportHistory() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated', data: [] }

  const { data, error } = await supabase
    .from('employee_imports')
    .select('*')
    .eq('uploaded_by', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

// ─── Assign a quiz to employees ───────────────────────────────────────
export async function assignQuizToEmployees(quizId: string, employeeIds: string[]) {
  const { userId, role } = await requireManager()

  const quizIdResult = uuidSchema.safeParse(quizId)
  if (!quizIdResult.success) return { error: 'Invalid quiz ID' }

  const uniqueEmployeeIds = Array.from(new Set(employeeIds))
  const validEmployeeIds = uniqueEmployeeIds.filter((id) => uuidSchema.safeParse(id).success)
  if (validEmployeeIds.length === 0) return { error: 'Select at least one employee.' }
  if (validEmployeeIds.length !== uniqueEmployeeIds.length) return { error: 'One or more selected employees are invalid.' }

  const supabase = createAdminClient()

  let quizQuery = supabase
    .from('quizzes')
    .select('id, title, topic, difficulty, created_by, is_active')
    .eq('id', quizIdResult.data)
  if (role !== 'admin') quizQuery = quizQuery.eq('created_by', userId)
  const { data: quiz, error: quizError } = await quizQuery.maybeSingle()

  if (quizError) return { error: quizError.message }
  if (!quiz) return { error: 'Quiz was not found or you do not have access to assign it.' }
  if (!quiz.is_active) return { error: 'Activate this quiz before assigning it to employees.' }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('id', validEmployeeIds)

  if (profilesError) return { error: profilesError.message }
  const employees = (profiles || []).filter((profile: any) => profile.role === 'employee')
  if (employees.length === 0) return { error: 'Selected users are not employee accounts.' }

  const rows = employees.map((profile: any) => ({
    quiz_id: quizIdResult.data,
    user_id: profile.id,
    assigned_by: userId,
  }))

  const { error } = await supabase
    .from('quiz_assignments')
    .upsert(rows, { onConflict: 'quiz_id,user_id', ignoreDuplicates: true })

  if (error) return { error: error.message }

  const successCount = rows.length

  revalidatePath('/manager/quizzes', 'page')
  revalidatePath('/manager/employees', 'page')

  if (successCount > 0) {
    await Promise.allSettled(employees.map((profile: any) =>
      Promise.allSettled([
        sendEmail({
          to: profile.email,
          subject: `Quiz Assigned: ${quiz.title || 'SkillTest_AI Assessment'}`,
          html: buildQuizAssignedEmail({
            employeeName: profile.full_name,
            quizTitle: quiz.title || 'SkillTest_AI Assessment',
            topic: quiz.topic || 'General',
            difficulty: quiz.difficulty || 'medium',
          }),
        }).catch((err) => console.warn('[assignQuizToEmployees] email failed:', err)),
        supabase.from('training_notifications').insert({
          recipient_user_id: profile.id,
          title: `Quiz assigned: ${quiz.title || 'SkillTest_AI Assessment'}`,
          message: `${profile.full_name || profile.email} was assigned ${quiz.title || 'a SkillTest_AI assessment'}.`,
          audience: 'individual',
          channel: 'in_app',
          delivery_status: 'sent',
          sent_at: new Date().toISOString(),
          created_by: userId,
        }),
      ])
    ))
  }

  return { data: true, assigned: successCount }
}

// ─── Unassign a quiz from an employee ─────────────────────────────────
export async function unassignQuizFromEmployee(quizId: string, employeeId: string) {
  await requireManager()
  const quizIdResult = uuidSchema.safeParse(quizId)
  const employeeIdResult = uuidSchema.safeParse(employeeId)
  if (!quizIdResult.success || !employeeIdResult.success) return { error: 'Invalid assignment.' }

  // Use admin client to bypass RLS — assignments are created via admin client
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('quiz_assignments')
    .delete()
    .eq('quiz_id', quizIdResult.data)
    .eq('user_id', employeeIdResult.data)

  if (error) return { error: error.message }

  revalidatePath('/manager/quizzes', 'page')
  revalidatePath('/manager/employees', 'page')
  return { success: true }
}

// ─── Get assignments for a quiz ───────────────────────────────────────
export async function getQuizAssignments(quizId: string) {
  await requireTrainingStaff()
  const quizIdResult = uuidSchema.safeParse(quizId)
  if (!quizIdResult.success) return { error: 'Invalid quiz ID', data: [] }

  // Use admin client to bypass RLS — assignments are created via admin client
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('quiz_assignments')
    .select('*, profiles:user_id(id, full_name, email, employee_id, department, domain, avatar_url)')
    .eq('quiz_id', quizIdResult.data)
    .order('assigned_at', { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

// ─── Get all quizzes with assignment info for manager ─────────────────
export async function getQuizzesForAssignment() {
  const { userId, role } = await requireManager()
  const supabase = createAdminClient()

  let query = supabase
    .from('quizzes')
    .select('id, title, topic, difficulty, is_active, questions(count)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (role !== 'admin') query = query.eq('created_by', userId)
  const { data: quizzes, error } = await query

  if (error) return { error: error.message, data: [] }
  return { data: quizzes || [] }
}

export async function getCertificateRulesForAdmin() {
  await requireAdmin()
  const admin = createAdminClient()
  const [{ data: quizzes }, { data: rules }] = await Promise.all([
    admin
      .from('quizzes')
      .select('id, title, topic, difficulty, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('certificate_rules')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  const ruleByQuiz = new Map((rules || []).map((rule: any) => [rule.quiz_id, rule]))
  return {
    data: (quizzes || []).map((quiz: any) => ({
      ...quiz,
      certificate_rule: ruleByQuiz.get(quiz.id) || null,
    })),
  }
}

export async function updateCertificateRule(formData: FormData) {
  const { userId } = await requireAdmin()
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

  if (!quizId) return { error: 'Quiz is required.' }
  if (!title) return { error: 'Certificate title is required.' }
  if (!certificateName) return { error: 'Certificate name is required.' }

  let templateImageUrl = existingTemplate || null
  if (templateFile instanceof File && templateFile.size > 0) {
    if (!templateFile.type.startsWith('image/')) {
      return { error: 'Certificate template must be an image file.' }
    }
    if (templateFile.size > 1_500_000) {
      return { error: 'Certificate template image must be below 1.5 MB.' }
    }
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
  revalidatePath('/manager/admin')
  return { data: true }
}
