'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAdmin, requireManager } from '@/lib/rbac'
import { revalidatePath } from 'next/cache'
import type { ApiResponse, EmployeeImport, EmployeeImportError, EmployeeImportResult } from '@/lib/types/database'
import { approveTrainer, rejectTrainer } from '@/lib/actions/auth'

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

    if (!email || !fullName) {
      failed++
      errors.push({ row: i + 1, email: email || 'N/A', error: 'Missing email or name' })
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
      .single()

    if (existingProfile) {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          domain: emp.domain || 'General',
          department: emp.domain || 'General',
          employee_id: emp.employee_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProfile.id)
      if (error) {
        failed++
        errors.push({ row: i + 1, email, error: error.message })
        continue
      }
      successful++
    } else {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: generateTempPassword(),
        email_confirm: true,
        user_metadata: {
          role: 'employee',
          full_name: fullName,
        },
      })

      if (authError || !authData.user) {
        failed++
        errors.push({ row: i + 1, email, error: authError?.message || 'Could not create user' })
        continue
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email,
          full_name: fullName,
          employee_id: emp.employee_id || null,
          department: emp.domain || 'General',
          domain: emp.domain || 'General',
          role: 'employee',
        })

      if (profileError) {
        await supabase.auth.admin.deleteUser(authData.user.id)
        failed++
        errors.push({ row: i + 1, email, error: profileError.message })
        continue
      }

      successful++
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

  revalidatePath('/manager/employees', 'layout')
  return {
    data: {
      total: employees.length,
      successful,
      failed,
      errors,
    }
  }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${password}!`
}

// ─── Get all employees (for manager view) ─────────────────────────────
export async function getEmployees() {
  const { userId, role } = await requireManager()

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

  if (role !== 'admin') {
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
  const { userId, role } = await requireManager()

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

  if (role !== 'admin') {
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
  const { userId } = await requireManager()

  // Use admin client to bypass RLS which can cause infinite recursion on profiles policy
  let supabase: any
  try {
    supabase = createAdminClient()
  } catch {
    supabase = await createClient()
  }

  // Build assignment rows
  const rows = employeeIds.map((empId) => ({
    quiz_id: quizId,
    user_id: empId,
    assigned_by: userId,
  }))

  // Insert assignments one by one to handle duplicates gracefully
  let successCount = 0
  const errors: string[] = []

  for (const row of rows) {
    const { error } = await supabase
      .from('quiz_assignments')
      .insert(row)

    if (error) {
      // Duplicate (unique constraint violation) is fine — count as success
      if (error.code === '23505') {
        successCount++
      } else {
        errors.push(`${row.user_id}: ${error.message}`)
      }
    } else {
      successCount++
    }
  }

  revalidatePath('/manager/quizzes', 'layout')
  revalidatePath('/manager/employees', 'layout')

  if (errors.length > 0) {
    return { error: `Assigned ${successCount}/${rows.length}. Errors: ${errors.join('; ')}` }
  }

  return { data: true, assigned: successCount }
}

// ─── Unassign a quiz from an employee ─────────────────────────────────
export async function unassignQuizFromEmployee(quizId: string, employeeId: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  // Use admin client to bypass RLS — assignments are created via admin client
  let adminClient: any
  try { adminClient = createAdminClient() } catch { adminClient = supabase }

  const { error } = await adminClient
    .from('quiz_assignments')
    .delete()
    .eq('quiz_id', quizId)
    .eq('user_id', employeeId)

  if (error) return { error: error.message }

  revalidatePath('/manager/quizzes', 'layout')
  revalidatePath('/manager/employees', 'layout')
  return { success: true }
}

// ─── Get assignments for a quiz ───────────────────────────────────────
export async function getQuizAssignments(quizId: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated', data: [] }

  // Use admin client to bypass RLS — assignments are created via admin client
  let adminClient: any
  try { adminClient = createAdminClient() } catch { adminClient = supabase }

  const { data, error } = await adminClient
    .from('quiz_assignments')
    .select('*, profiles:user_id(id, full_name, email, employee_id, department, avatar_url)')
    .eq('quiz_id', quizId)
    .order('assigned_at', { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

// ─── Get all quizzes with assignment info for manager ─────────────────
export async function getQuizzesForAssignment() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated', data: [] }

  const { data: quizzes, error } = await supabase
    .from('quizzes')
    .select('id, title, topic, difficulty, is_active, questions(count)')
    .eq('created_by', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: quizzes || [] }
}
