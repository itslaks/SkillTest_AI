import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireManagerForApi } from '@/lib/rbac'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { buildCumulativeLeaderboard, formatDuration, type CumulativeAttempt } from '@/lib/leaderboard'

export async function GET() {
  try {
    const auth = await requireManagerForApi()
    if (auth instanceof NextResponse) return auth

    const { userId } = auth

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

    // Get global leaderboard (cumulative across all manager's quizzes)
    const { data: globalLeaderboard, error } = await dataClient
      .from('quiz_attempts')
      .select(`
        user_id,
        score,
        correct_answers,
        total_questions,
        time_taken_seconds,
        points_earned,
        quizzes!inner(created_by),
        profiles:user_id(full_name, email, employee_id, department)
      `)
      .eq('quizzes.created_by', userId)
      .eq('status', 'completed')
      .order('points_earned', { ascending: false })

    if (error) {
      console.error('Error fetching cumulative attempts:', error)
      return new NextResponse(
        JSON.stringify({ error: error.message }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const cumulativeLeaderboard = buildCumulativeLeaderboard(globalLeaderboard as CumulativeAttempt[])

    const rows = cumulativeLeaderboard.map((entry, index) => {
      return {
        'Rank': index + 1,
        'Employee Name': entry.full_name,
        'Email': entry.email || 'N/A',
        'Employee ID': entry.employee_id || 'N/A',
        'Department': entry.department || 'N/A',
        'Total Points': entry.total_points,
        'Avg Score (%)': entry.avg_score,
        'Total Quizzes Taken': entry.total_quizzes,
        'Total Correct Answers': entry.total_correct,
        'Total Questions Answered': entry.total_questions,
        'Total Time Spent': formatDuration(entry.total_time),
      }
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Message': 'No completed attempts yet' }])

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },  // Rank
      { wch: 25 }, // Name
      { wch: 30 }, // Email
      { wch: 15 }, // Employee ID
      { wch: 20 }, // Department
      { wch: 14 }, // Total Points
      { wch: 14 }, // Avg Score
      { wch: 20 }, // Total Quizzes
      { wch: 22 }, // Total Correct
      { wch: 24 }, // Total Questions
      { wch: 18 }, // Total Time
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Cumulative Report')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = `cumulative-leaderboard-report.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e: any) {
    console.error('Download error:', e)
    return NextResponse.json({ error: e.message || 'Failed to generate download' }, { status: 500 })
  }
}
