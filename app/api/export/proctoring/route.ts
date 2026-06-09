import { NextResponse } from 'next/server'
import { requireManagerForApi } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function GET() {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth
  const { userId, role } = auth

  const admin = createAdminClient()

  // Scope quiz IDs the same way the integrity page does
  let scopedQuizIds: string[] | null = null
  if (role !== 'admin' && role !== 'manager' && role !== 'training_coordinator') {
    const [{ data: ownQuizzes }, { data: trainerBatches }] = await Promise.all([
      admin.from('quizzes').select('id').eq('created_by', userId),
      admin.from('training_batch_trainers').select('batch_id').eq('trainer_id', userId),
    ])
    const batchIds = (trainerBatches || []).map((r: any) => r.batch_id)
    const { data: batchQuizzes } = batchIds.length
      ? await admin.from('quizzes').select('id').in('batch_id', batchIds)
      : { data: [] }
    scopedQuizIds = Array.from(
      new Set([...(ownQuizzes || []), ...(batchQuizzes || [])].map((q: any) => q.id))
    )
  }

  const query = admin
    .from('quiz_attempts')
    .select(`
      id,
      status,
      score,
      started_at,
      completed_at,
      auto_submitted,
      proctoring_status,
      proctoring_violations_count,
      proctoring_risk_score,
      proctoring_risk_level,
      review_status,
      review_decision,
      review_notes,
      reviewed_at,
      quizzes:quiz_id(title, topic),
      profiles:user_id(full_name, email, employee_id, department)
    `)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(500)

  if (scopedQuizIds) {
    query.in(
      'quiz_id',
      scopedQuizIds.length ? scopedQuizIds : ['00000000-0000-0000-0000-000000000000']
    )
  }

  const { data: attempts, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build worksheet rows
  const rows = (attempts || []).map((a: any) => ({
    'Attempt ID': a.id,
    'Candidate Name': a.profiles?.full_name || '',
    'Email': a.profiles?.email || '',
    'Employee ID': a.profiles?.employee_id || '',
    'Department': a.profiles?.department || '',
    'Quiz Title': a.quizzes?.title || '',
    'Topic': a.quizzes?.topic || '',
    'Score (%)': a.score ?? '',
    'Status': a.status,
    'Proctoring Status': a.proctoring_status || '',
    'Risk Score': a.proctoring_risk_score ?? '',
    'Risk Level': a.proctoring_risk_level || '',
    'Violations': a.proctoring_violations_count ?? 0,
    'Auto Submitted': a.auto_submitted ? 'Yes' : 'No',
    'Review Status': a.review_status || 'pending',
    'Review Decision': a.review_decision || '',
    'Review Notes': a.review_notes || '',
    'Reviewed At': a.reviewed_at ? new Date(a.reviewed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
    'Started At': a.started_at ? new Date(a.started_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
    'Completed At': a.completed_at ? new Date(a.completed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
  }))

  // Summary sheet
  const total = rows.length
  const flagged = (attempts || []).filter((a: any) =>
    a.proctoring_status === 'suspicious' || a.proctoring_status === 'flagged' || a.status === 'suspicious'
  ).length
  const cleared = (attempts || []).filter((a: any) => a.proctoring_status === 'clear').length
  const autoSub = (attempts || []).filter((a: any) => a.auto_submitted).length
  const avgRisk = total > 0
    ? Math.round((attempts || []).reduce((s: number, a: any) => s + (a.proctoring_risk_score ?? 0), 0) / total)
    : 0

  const summary = [
    { Metric: 'Total proctored attempts', Value: total },
    { Metric: 'Flagged / suspicious', Value: flagged },
    { Metric: 'Cleared', Value: cleared },
    { Metric: 'Auto-submitted', Value: autoSub },
    { Metric: 'Average risk score', Value: avgRisk },
    { Metric: 'Exported at', Value: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Proctoring Records')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `proctoring-export-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
