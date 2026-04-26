import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireManagerForApi } from '@/lib/rbac'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  try {
    const auth = await requireManagerForApi()
    if (auth instanceof NextResponse) return auth

    const supabase = await createClient()

    // Try admin client first, fall back to regular client
    let dataClient = supabase
    try {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceKey) {
        dataClient = createAdminClient()
      }
    } catch {
      console.warn('Using regular client for data fetch')
    }

    // Get all quizzes
    const { data: quizzes } = await dataClient
      .from('quizzes')
      .select('*')
      .order('created_at', { ascending: false })

    // Get all attempts (without join first)
    const { data: rawAttempts } = await dataClient
      .from('quiz_attempts')
      .select('*')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })

    // Get all employees/profiles
    const { data: employees } = await dataClient
      .from('profiles')
      .select('*')

    // Build profiles map for quick lookup
    const profilesMap: Record<string, any> = {}
    const quizzesMap: Record<string, any> = {}
    
    if (employees) {
      employees.forEach((p: any) => { profilesMap[p.id] = p })
    }
    if (quizzes) {
      quizzes.forEach((q: any) => { quizzesMap[q.id] = q })
    }

    // Enrich attempts with profile and quiz data
    const attempts = (rawAttempts || []).map((a: any) => ({
      ...a,
      profiles: profilesMap[a.user_id] || null,
      quizzes: quizzesMap[a.quiz_id] || null,
    }))

    // Filter to only employees
    const employeeList = (employees || []).filter((e: any) => e.role === 'employee')

    // Create workbook with multiple sheets
    const wb = XLSX.utils.book_new()

    // Sheet 1: Summary
    const summaryData = [
      { Metric: 'Total Quizzes', Value: quizzes?.length || 0 },
      { Metric: 'Total Attempts', Value: attempts?.length || 0 },
      { Metric: 'Total Employees', Value: employeeList?.length || 0 },
      { Metric: 'Average Score', Value: attempts?.length ? Math.round(attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / attempts.length) + '%' : 'N/A' },
      { Metric: 'Report Generated', Value: new Date().toLocaleString() },
    ]
    const wsSummary = XLSX.utils.json_to_sheet(summaryData)
    wsSummary['!cols'] = [{ wch: 20 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

    // Sheet 2: Quiz Performance
    const quizPerformance = (quizzes || []).map((quiz: any) => {
      const quizAttempts = (attempts || []).filter((a: any) => a.quiz_id === quiz.id)
      const avgScore = quizAttempts.length > 0 
        ? Math.round(quizAttempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / quizAttempts.length)
        : 0
      const passRate = quizAttempts.length > 0
        ? Math.round(quizAttempts.filter((a: any) => a.score >= (quiz.passing_score || 70)).length / quizAttempts.length * 100)
        : 0
      return {
        'Quiz Title': quiz.title,
        'Total Attempts': quizAttempts.length,
        'Average Score (%)': avgScore,
        'Pass Rate (%)': passRate,
        'Status': quiz.is_active ? 'Active' : 'Inactive',
        'Created': new Date(quiz.created_at).toLocaleDateString(),
      }
    })
    const wsQuizPerf = XLSX.utils.json_to_sheet(quizPerformance)
    wsQuizPerf['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsQuizPerf, 'Quiz Performance')

    // Sheet 3: All Results
    const allResults = (attempts || []).map((a: any, i: number) => ({
      'S.No': i + 1,
      'Employee Name': a.profiles?.full_name || 'Unknown',
      'Email': a.profiles?.email || '',
      'Employee ID': a.profiles?.employee_id || 'N/A',
      'Department': a.profiles?.department || 'N/A',
      'Quiz': a.quizzes?.title || 'Unknown Quiz',
      'Score (%)': a.score || 0,
      'Time Taken': formatTime(a.time_taken_seconds || 0),
      'Completed At': a.completed_at ? new Date(a.completed_at).toLocaleString() : 'N/A',
    }))
    const wsResults = XLSX.utils.json_to_sheet(allResults)
    wsResults['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsResults, 'All Results')

    // Sheet 4: Employee Stats
    const employeeStats = (employeeList || []).map((emp: any) => {
      const empAttempts = (attempts || []).filter((a: any) => a.user_id === emp.id)
      const avgScore = empAttempts.length > 0
        ? Math.round(empAttempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / empAttempts.length)
        : 0
      return {
        'Name': emp.full_name || 'Unknown',
        'Email': emp.email,
        'Employee ID': emp.employee_id || 'N/A',
        'Department': emp.department || 'N/A',
        'Quizzes Taken': empAttempts.length,
        'Average Score (%)': avgScore,
      }
    })
    const wsEmployees = XLSX.utils.json_to_sheet(employeeStats)
    wsEmployees['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsEmployees, 'Employee Stats')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `skilltest-report-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e: any) {
    console.error('Report download error:', e)
    return NextResponse.json({ error: e.message || 'Failed to generate report' }, { status: 500 })
  }
}

function formatTime(seconds: number): string {
  if (!seconds) return 'N/A'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}
