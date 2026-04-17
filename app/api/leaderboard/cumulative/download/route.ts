import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireManagerForApi } from '@/lib/rbac'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
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
    } catch (e) {
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

    // Aggregate by user for cumulative leaderboard
    const userAggregates = new Map<string, {
      user_id: string
      full_name: string
      email: string
      employee_id: string | null
      department: string | null
      total_points: number
      total_quizzes: number
      avg_score: number
      total_correct: number
      total_questions: number
      total_time: number
    }>()

    globalLeaderboard?.forEach((attempt: any) => {
      const uId = attempt.user_id
      const existing = userAggregates.get(uId)
      
      if (existing) {
        existing.total_points += attempt.points_earned || 0
        existing.total_quizzes += 1
        existing.total_correct += attempt.correct_answers || 0
        existing.total_questions += attempt.total_questions || 0
        existing.total_time += attempt.time_taken_seconds || 0
        existing.avg_score = existing.total_questions > 0 
          ? Math.round((existing.total_correct / existing.total_questions) * 100) 
          : 0
      } else {
        userAggregates.set(uId, {
          user_id: uId,
          full_name: attempt.profiles?.full_name || 'Unknown',
          email: attempt.profiles?.email || '',
          employee_id: attempt.profiles?.employee_id || null,
          department: attempt.profiles?.department || null,
          total_points: attempt.points_earned || 0,
          total_quizzes: 1,
          total_correct: attempt.correct_answers || 0,
          total_questions: attempt.total_questions || 0,
          total_time: attempt.time_taken_seconds || 0,
          avg_score: attempt.score || 0,
        })
      }
    })

    const cumulativeLeaderboard = Array.from(userAggregates.values())
      .sort((a, b) => b.total_points - a.total_points)

    const rows = cumulativeLeaderboard.map((entry, index) => {
      const mins = Math.floor(entry.total_time / 60)
      const secs = entry.total_time % 60
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
        'Total Time Spent': `${mins}m ${secs}s`,
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
