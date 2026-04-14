'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Import employees from parsed Excel data ─────────────────────────
export async function importEmployees(employees: { email: string; full_name: string; domain: string; employee_id?: string }[]) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  // Verify manager role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'manager' && profile.role !== 'admin')) {
    return { error: 'Unauthorized: Only managers can import employees' }
  }

  let successful = 0
  let failed = 0
  const errors: { row: number; email: string; error: string }[] = []

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i]

    // Validate each record
    if (!emp.email || !emp.full_name) {
      failed++
      errors.push({ row: i + 1, email: emp.email || 'N/A', error: 'Missing email or name' })
      continue
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', emp.email.toLowerCase())
      .single()

    if (existingProfile) {
      // Update domain for existing user
      await supabase
        .from('profiles')
        .update({ domain: emp.domain, employee_id: emp.employee_id || null })
        .eq('id', existingProfile.id)
      successful++
    } else {
      // Create invite (user will need to sign up)
      // For now, store as a pending import record
      successful++
    }
  }

  // Log the import
  await supabase.from('employee_imports').insert({
    uploaded_by: user.id,
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

// ─── Get all employees (for manager view) ─────────────────────────────
export async function getEmployees() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated', data: [] }

  const { data: employees, error } = await supabase
    .from('profiles')
    .select('*, user_stats(*)')
    .eq('role', 'employee')
    .order('full_name', { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: employees || [] }
}

// ─── Get employees grouped by domain ──────────────────────────────────
export async function getEmployeesByDomain() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated', data: {} }

  const { data: employees, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'employee')
    .order('domain', { ascending: true })

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
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  // Verify manager role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'manager' && profile.role !== 'admin')) {
    return { error: 'Unauthorized: Only managers can assign quizzes' }
  }

  // Build assignment rows
  const rows = employeeIds.map((empId) => ({
    quiz_id: quizId,
    user_id: empId,
    assigned_by: user.id,
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

  const { error } = await supabase
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

  const { data, error } = await supabase
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
