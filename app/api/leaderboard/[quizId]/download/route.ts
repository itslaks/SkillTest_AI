import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireManagerForApi } from '@/lib/rbac'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const auth = await requireManagerForApi()
    if (auth instanceof NextResponse) return auth

    const { quizId } = await params
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

    // Get quiz info
    const { data: quiz } = await dataClient
      .from('quizzes')
      .select('title')
      .eq('id', quizId)
      .single()

    // Get leaderboard data - fetch attempts first
    const { data: attempts, error: attemptsError } = await dataClient
      .from('quiz_attempts')
      .select('id, user_id, score, correct_answers, total_questions, time_taken_seconds, points_earned, completed_at')
      .eq('quiz_id', quizId)
      .eq('status', 'completed')
      .order('score', { ascending: false })
      .order('time_taken_seconds', { ascending: true })

    if (attemptsError) {
      console.error('Error fetching attempts:', attemptsError)
      return new NextResponse(
        JSON.stringify({ error: attemptsError.message }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Fetch profiles separately if we have attempts
    let profilesMap: Record<string, any> = {}
    if (attempts && attempts.length > 0) {
      const userIds = [...new Set(attempts.map((a: any) => a.user_id))]
      const { data: profiles } = await dataClient
        .from('profiles')
        .select('id, full_name, email, employee_id, department')
        .in('id', userIds)
      
      if (profiles) {
        profilesMap = profiles.reduce((acc: Record<string, any>, p: any) => {
          acc[p.id] = p
          return acc
        }, {})
      }
    }

    // Build Excel data with full details
    const rows = (attempts || []).map((a: any, i: number) => {
      const profile = profilesMap[a.user_id] || {}
      const mins = Math.floor((a.time_taken_seconds || 0) / 60)
      const secs = (a.time_taken_seconds || 0) % 60
      return {
        'Rank': i + 1,
        'Employee Name': profile.full_name || 'Unknown',
        'Email': profile.email || 'N/A',
        'Employee ID': profile.employee_id || 'N/A',
        'Department': profile.department || 'N/A',
        'Score (%)': a.score || 0,
        'Correct Answers': a.correct_answers || 0,
        'Total Questions': a.total_questions || 0,
        'Completion Time': `${mins}m ${secs}s`,
        'Points Earned': a.points_earned || 0,
        'Completed At': a.completed_at ? new Date(a.completed_at).toLocaleString() : 'N/A',
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
      { wch: 12 }, // Score
      { wch: 16 }, // Correct Answers
      { wch: 16 }, // Total Questions
      { wch: 18 }, // Time
      { wch: 14 }, // Points
      { wch: 22 }, // Completed At
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Quiz Report')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = `quiz-report-${quiz?.title?.replace(/[^a-zA-Z0-9]/g, '-') || quizId}.xlsx`

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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}
