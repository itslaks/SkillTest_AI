import { createServiceDbClient } from '@/lib/backend/database/supabase'
import type { EmployeeReportAuth, EmployeeReportRow } from '@/lib/backend/entities/employee-report.entity'

export async function fetchEmployeesForReport(auth: EmployeeReportAuth): Promise<{ data?: EmployeeReportRow[]; error?: string }> {
  const db = createServiceDbClient()
  const { data: currentProfile } = await db
    .from('profiles')
    .select('domain')
    .eq('id', auth.userId)
    .maybeSingle()

  let query = db
    .from('profiles')
    .select('id, full_name, email, employee_id, department, domain, created_at, user_stats(total_points, tests_completed, average_score, current_streak)')
    .eq('role', 'employee')
    .order('full_name', { ascending: true })

  if (auth.role !== 'admin') {
    if (!currentProfile?.domain) return { data: [] }
    query = query.eq('domain', currentProfile.domain)
  }

  const { data, error } = await query
  if (error) return { error: error.message }

  return { data: (data || []) as EmployeeReportRow[] }
}
