import type { UserRole } from '@/lib/types/database'

export interface EmployeeReportAuth {
  userId: string
  role: UserRole
}

export interface EmployeeReportRow {
  id: string
  full_name: string | null
  email: string
  employee_id: string | null
  department: string | null
  domain: string | null
  created_at: string | null
  user_stats?: Array<{
    total_points: number | null
    tests_completed: number | null
    average_score: number | null
    current_streak: number | null
  }>
}
