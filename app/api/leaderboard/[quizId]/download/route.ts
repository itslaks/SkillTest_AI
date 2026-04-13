import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const { quizId } = await params

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

  // Get quiz info
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('title')
    .eq('id', quizId)
    .single()

  // Get leaderboard data
  const { data: attempts, error } = await supabase
    .from('quiz_attempts')
    .select(`
      *,
      profiles:user_id(full_name, email, employee_id, department)
    `)
    .eq('quiz_id', quizId)
    .eq('status', 'completed')
    .order('score', { ascending: false })
    .order('time_taken_seconds', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Build Excel data
  const rows = (attempts || []).map((a: any, i: number) => ({
    'Rank': i + 1,
    'Employee ID': a.profiles?.employee_id || 'N/A',
    'Name': a.profiles?.full_name || 'Unknown',
    'Email': a.profiles?.email || '',
    'Department': a.profiles?.department || '',
    'Score (%)': a.score,
    'Correct Answers': a.correct_answers,
    'Total Questions': a.total_questions,
    'Time Taken (seconds)': a.time_taken_seconds,
    'Time Taken (formatted)': formatTime(a.time_taken_seconds),
    'Completed At': a.completed_at ? new Date(a.completed_at).toLocaleString() : '',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Set column widths
  ws['!cols'] = [
    { wch: 6 }, { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 20 },
    { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 22 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = `leaderboard-${quiz?.title?.replace(/[^a-zA-Z0-9]/g, '-') || quizId}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}
