import { NextResponse } from 'next/server'
import { requireManagerForApi } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/server'
import { averageScore, computeTopperScore, isTopper, normalizeTopperWeights } from '@/lib/topper'
import * as XLSX from 'xlsx'

export async function GET() {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const admin = createAdminClient()

  const { data: batches } = await admin
    .from('training_batches')
    .select('id, title, domain, status, start_date, end_date, trainer:trainer_id(full_name, email), coordinator:coordinator_id(full_name, email)')
    .or(`created_by.eq.${userId},coordinator_id.eq.${userId},trainer_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  const batchIds = (batches || []).map((b: any) => b.id)
  const batchMap = new Map((batches || []).map((b: any) => [b.id, b]))

  const [{ data: allMembers }, { data: sessions }, { data: projectEvals }, { data: importResults }, { data: feedbackItems }, { data: notifications }] = batchIds.length
    ? await Promise.all([
        admin.from('batch_members').select('batch_id, user_id, enrollment_status, support_status, joined_at, profile:user_id(full_name, email, employee_id, department)').in('batch_id', batchIds),
        admin.from('training_sessions').select('id, batch_id, attendance_required, status, session_date, mode').in('batch_id', batchIds),
        admin.from('training_project_evaluations').select('batch_id, user_id, score, project_title').in('batch_id', batchIds),
        admin.from('assessment_results').select('batch_id, candidate_email, percentage, test_name, candidate_id').in('batch_id', batchIds),
        admin.from('training_feedback').select('batch_id, user_id, rating, sentiment, content_quality_rating, trainer_effectiveness_rating').in('batch_id', batchIds),
        admin.from('training_notifications').select('batch_id, delivery_status, channel, created_at').in('batch_id', batchIds).order('created_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }]

  const sessionIds = (sessions || []).map((s: any) => s.id)
  const { data: attendance } = sessionIds.length
    ? await admin.from('session_attendance').select('session_id, user_id, status').in('session_id', sessionIds)
    : { data: [] }

  const { data: govRows } = await admin.from('training_system_settings').select('key, value').in('key', ['topper_assessment_weight', 'topper_project_weight', 'topper_min_attendance'])
  const govMap = new Map((govRows || []).map((r: any) => [r.key, Number(r.value)]))
  const weights = normalizeTopperWeights({ assessment: govMap.get('topper_assessment_weight') ?? 70, project: govMap.get('topper_project_weight') ?? 30, minAttendance: govMap.get('topper_min_attendance') ?? 75 })

  const sessionsByBatch = new Map<string, any[]>()
  for (const s of sessions || []) { const arr = sessionsByBatch.get(s.batch_id) || []; arr.push(s); sessionsByBatch.set(s.batch_id, arr) }
  const attendanceByUser = new Map<string, any[]>()
  for (const a of attendance || []) { const arr = attendanceByUser.get(a.user_id) || []; arr.push(a); attendanceByUser.set(a.user_id, arr) }
  const projectByKey = new Map<string, number>()
  for (const p of projectEvals || []) { projectByKey.set(`${p.batch_id}:${p.user_id}`, p.score) }
  const scoresByEmail = new Map<string, number[]>()
  for (const r of importResults || []) { const key = (r.candidate_email || '').toLowerCase(); if (!key) continue; const arr = scoresByEmail.get(key) || []; arr.push(r.percentage); scoresByEmail.set(key, arr) }

  const members = allMembers || []
  const discontinued = members.filter((m: any) => ['discontinued', 'dropped'].includes(m.enrollment_status)).length
  const notCleared = members.filter((m: any) => m.enrollment_status === 'not_cleared').length
  const offered = members.filter((m: any) => m.enrollment_status === 'offered').length
  const onboarded = members.filter((m: any) => ['onboarded', 'active'].includes(m.enrollment_status)).length

  let tp = 0, ts = 0
  for (const m of members) {
    const bSessions = (sessionsByBatch.get(m.batch_id) || []).filter((s: any) => s.attendance_required)
    const ma = (attendanceByUser.get(m.user_id) || []).filter((a: any) => bSessions.some((s: any) => s.id === a.session_id))
    tp += ma.filter((a: any) => a.status === 'present' || a.status === 'late').length
    ts += bSessions.length
  }

  const overviewRows = [
    { Metric: 'Total Batches', Value: (batches || []).length },
    { Metric: 'Active Batches', Value: (batches || []).filter((b: any) => ['running', 'active', 'at_risk'].includes(b.status)).length },
    { Metric: 'Total Candidates', Value: members.length },
    { Metric: 'Discontinued', Value: discontinued },
    { Metric: 'Not Cleared', Value: notCleared },
    { Metric: 'Offered', Value: offered },
    { Metric: 'Onboarded', Value: onboarded },
    { Metric: 'Overall Attendance Rate', Value: ts > 0 ? `${Math.round((tp / ts) * 100)}%` : 'N/A' },
    { Metric: 'Total Assessment Records', Value: (importResults || []).length },
    { Metric: 'Total Feedback Responses', Value: (feedbackItems || []).length },
    { Metric: 'Avg Feedback Rating', Value: (feedbackItems || []).length > 0 ? ((feedbackItems || []).reduce((s: number, f: any) => s + (f.rating || 0), 0) / (feedbackItems || []).length).toFixed(2) : 'N/A' },
    { Metric: 'Notifications Sent', Value: (notifications || []).filter((n: any) => n.delivery_status === 'sent').length },
    { Metric: 'Report Generated', Value: new Date().toLocaleString() },
  ]

  const batchSummary = (batches || []).map((batch: any) => {
    const bm = members.filter((m: any) => m.batch_id === batch.id)
    const bSessions = (sessionsByBatch.get(batch.id) || []).filter((s: any) => s.attendance_required)
    let btp = 0, bts = 0
    for (const m of bm) { const ma = (attendanceByUser.get(m.user_id) || []).filter((a: any) => bSessions.some((s: any) => s.id === a.session_id)); btp += ma.filter((a: any) => a.status === 'present' || a.status === 'late').length; bts += bSessions.length }
    const bFeedback = (feedbackItems || []).filter((f: any) => f.batch_id === batch.id)
    return {
      Batch: batch.title, Domain: batch.domain || '', Status: batch.status,
      Start: batch.start_date ? new Date(batch.start_date).toLocaleDateString() : '',
      End: batch.end_date ? new Date(batch.end_date).toLocaleDateString() : '',
      Total: bm.length,
      Discontinued: bm.filter((m: any) => ['discontinued', 'dropped'].includes(m.enrollment_status)).length,
      Not_Cleared: bm.filter((m: any) => m.enrollment_status === 'not_cleared').length,
      Offered: bm.filter((m: any) => m.enrollment_status === 'offered').length,
      Onboarded: bm.filter((m: any) => ['onboarded', 'active'].includes(m.enrollment_status)).length,
      Attendance_Pct: bts > 0 ? `${Math.round((btp / bts) * 100)}%` : 'N/A',
      Feedback_Responses: bFeedback.length,
      Avg_Feedback: bFeedback.length ? (bFeedback.reduce((s: number, f: any) => s + (f.rating || 0), 0) / bFeedback.length).toFixed(1) : '',
      Trainer: (batch.trainer as any)?.full_name || (batch.trainer as any)?.email || '',
      Coordinator: (batch.coordinator as any)?.full_name || (batch.coordinator as any)?.email || '',
    }
  })

  const candidateRows = members.map((member: any) => {
    const profile = member.profile
    const batch = batchMap.get(member.batch_id)
    const batchSessions = (sessionsByBatch.get(member.batch_id) || []).filter((s: any) => s.attendance_required)
    const ma = (attendanceByUser.get(member.user_id) || []).filter((a: any) => batchSessions.some((s: any) => s.id === a.session_id))
    const presentCount = ma.filter((a: any) => a.status === 'present' || a.status === 'late').length
    const attendancePct = batchSessions.length > 0 ? Math.round((presentCount / batchSessions.length) * 100) : 0
    const emailScores = scoresByEmail.get((profile?.email || '').toLowerCase()) || []
    const assessmentAvg = averageScore(emailScores)
    const projectScore = projectByKey.get(`${member.batch_id}:${member.user_id}`) ?? 0
    const topperScore = computeTopperScore({ assessmentAvg, projectScore, attendancePct, weights })
    return { Batch: batch?.title || '', Employee_ID: profile?.employee_id || '', Full_Name: profile?.full_name || '', Email: profile?.email || '', Department: profile?.department || '', Enrollment_Status: member.enrollment_status, Attendance_Pct: `${attendancePct}%`, Assessments_Taken: emailScores.length, Assessment_Avg: assessmentAvg, Project_Score: projectScore, Topper_Score: topperScore, Is_Topper: isTopper(topperScore, weights) ? 'YES' : '' }
  }).sort((a: any, b: any) => b.Topper_Score - a.Topper_Score)

  const scoreRows = (importResults || []).map((r: any) => ({ Batch: batchMap.get(r.batch_id)?.title || '', Candidate_ID: r.candidate_id || '', Candidate_Email: r.candidate_email || '', Test_Name: r.test_name || '', Score_Pct: `${r.percentage}%` }))
  const feedbackRows = (feedbackItems || []).map((f: any) => ({ Batch: batchMap.get(f.batch_id)?.title || '', Rating: f.rating, Content_Quality: f.content_quality_rating, Trainer_Effectiveness: f.trainer_effectiveness_rating, Sentiment: f.sentiment }))

  const wb = XLSX.utils.book_new()
  const addSheet = (name: string, data: any[]) => {
    if (!data.length) return
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = Array(Object.keys(data[0] || {}).length).fill({ wch: 22 })
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  addSheet('Platform Overview', overviewRows)
  addSheet('Batch Summary', batchSummary)
  addSheet('Candidates Ranked', candidateRows)
  addSheet('Assessment Scores', scoreRows)
  addSheet('Feedback', feedbackRows)
  if (wb.SheetNames.length === 0) { const ws = XLSX.utils.json_to_sheet([{ Message: 'No data found.' }]); XLSX.utils.book_append_sheet(wb, ws, 'No Data') }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const timestamp = new Date().toISOString().split('T')[0]
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="skilltest-ai-mavericks-comprehensive-report-${timestamp}.xlsx"`,
    },
  })
}
