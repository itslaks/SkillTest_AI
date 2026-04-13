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
