import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Verify manager role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'manager' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Use admin client to bypass RLS for comprehensive data fetching
  const adminClient = createAdminClient()

  // Get all quizzes created by this manager
  const { data: quizzes } = await adminClient
    .from('quizzes')
    .select('*')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  // Get all employees
  const { data: employees } = await adminClient
    .from('profiles')
    .select('*, user_stats(*)')
    .eq('role', 'employee')
    .order('full_name', { ascending: true })

  // Get all quiz attempts for manager's quizzes
  const quizIds = (quizzes || []).map((q: any) => q.id)
  let attempts: any[] = []
  if (quizIds.length > 0) {
    const { data } = await adminClient
      .from('quiz_attempts')
      .select(`
        *,
        profiles:user_id(full_name, email, employee_id, department),
        quizzes:quiz_id(title, topic, difficulty, passing_score)
      `)
      .in('quiz_id', quizIds)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
    attempts = data || []
  }

  // Create workbook with multiple sheets
  const wb = XLSX.utils.book_new()

  // ─── Sheet 1: Summary ───────────────────────────────────────────────
  const summaryData = [
    { 'Metric': 'Total Quizzes', 'Value': quizzes?.length || 0 },
    { 'Metric': 'Total Employees', 'Value': employees?.length || 0 },
    { 'Metric': 'Total Completions', 'Value': attempts.length },
    { 'Metric': 'Average Score', 'Value': attempts.length > 0 
      ? `${Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length)}%` 
      : '0%' 
    },
    { 'Metric': 'Report Generated', 'Value': new Date().toLocaleString() },
  ]
  const summarySheet = XLSX.utils.json_to_sheet(summaryData)
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // ─── Sheet 2: Quiz Performance ──────────────────────────────────────
  const quizPerformance = (quizzes || []).map((quiz: any) => {
    const quizAttempts = attempts.filter(a => a.quiz_id === quiz.id)
    const avgScore = quizAttempts.length > 0 
      ? Math.round(quizAttempts.reduce((sum, a) => sum + a.score, 0) / quizAttempts.length)
      : 0
    const passCount = quizAttempts.filter(a => a.score >= (quiz.passing_score || 70)).length
    const passRate = quizAttempts.length > 0 
      ? Math.round((passCount / quizAttempts.length) * 100)
      : 0

    return {
      'Quiz Title': quiz.title,
      'Topic': quiz.topic,
      'Difficulty': quiz.difficulty,
      'Passing Score': `${quiz.passing_score || 70}%`,
      'Total Attempts': quizAttempts.length,
      'Average Score': `${avgScore}%`,
      'Pass Rate': `${passRate}%`,
      'Status': quiz.is_active ? 'Active' : 'Inactive',
      'Created': new Date(quiz.created_at).toLocaleDateString(),
    }
  })
  const quizSheet = XLSX.utils.json_to_sheet(quizPerformance)
  quizSheet['!cols'] = [
    { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 15 }
  ]
  XLSX.utils.book_append_sheet(wb, quizSheet, 'Quiz Performance')

  // ─── Sheet 3: All Results ───────────────────────────────────────────
  const resultsData = attempts.map((a: any, i: number) => ({
    'S.No': i + 1,
    'Employee Name': a.profiles?.full_name || 'Unknown',
    'Email': a.profiles?.email || '',
    'Employee ID': a.profiles?.employee_id || 'N/A',
    'Department': a.profiles?.department || 'N/A',
    'Quiz': a.quizzes?.title || 'Unknown',
    'Topic': a.quizzes?.topic || '',
    'Score': `${a.score}%`,
    'Correct Answers': `${a.correct_answers}/${a.total_questions}`,
    'Time Taken': formatTime(a.time_taken_seconds),
    'Points Earned': a.points_earned,
    'Result': a.score >= (a.quizzes?.passing_score || 70) ? 'PASS' : 'FAIL',
    'Completed At': new Date(a.completed_at).toLocaleString(),
  }))
  const resultsSheet = XLSX.utils.json_to_sheet(resultsData)
  resultsSheet['!cols'] = [
    { wch: 6 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
    { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 12 },
    { wch: 12 }, { wch: 8 }, { wch: 20 }
  ]
  XLSX.utils.book_append_sheet(wb, resultsSheet, 'All Results')

  // ─── Sheet 4: Employee Stats ────────────────────────────────────────
  const employeeStats = (employees || []).map((emp: any) => {
    const stats = emp.user_stats?.[0]
    const empAttempts = attempts.filter(a => a.user_id === emp.id)
    const avgScore = empAttempts.length > 0
      ? Math.round(empAttempts.reduce((sum, a) => sum + a.score, 0) / empAttempts.length)
      : 0

    return {
      'Employee Name': emp.full_name || 'Unknown',
      'Email': emp.email,
      'Employee ID': emp.employee_id || 'N/A',
      'Department': emp.department || 'N/A',
      'Domain': emp.domain || 'N/A',
      'Total Points': stats?.total_points || 0,
      'Quizzes Completed': stats?.tests_completed || 0,
      'Average Score': `${avgScore}%`,
      'Current Streak': stats?.current_streak || 0,
      'Longest Streak': stats?.longest_streak || 0,
    }
  })
  const employeeSheet = XLSX.utils.json_to_sheet(employeeStats)
  employeeSheet['!cols'] = [
    { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
  ]
  XLSX.utils.book_append_sheet(wb, employeeSheet, 'Employee Stats')

  // Generate buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = `reports-${new Date().toISOString().split('T')[0]}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function formatTime(seconds: number): string {
  if (!seconds) return '0m 0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}
