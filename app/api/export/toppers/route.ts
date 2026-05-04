import { NextRequest, NextResponse } from 'next/server'
import { requireManagerForApi } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

/** Configurable topper scoring using governance settings */
function computeTopperScore(
  assessmentAvg: number,
  projectScore: number,
  attendancePct: number,
  weights: { assessment: number; project: number; minAttendance: number }
): number {
  if (attendancePct < weights.minAttendance) return 0
  const total = weights.assessment + weights.project
  if (total === 0) return 0
  return Math.round((assessmentAvg * weights.assessment + projectScore * weights.project) / total)
}

export async function GET(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = request.nextUrl
  const batchId = searchParams.get('batchId') || undefined // undefined = all batches

  const admin = createAdminClient()

  // Governance settings
  const { data: govRows } = await admin
    .from('training_system_settings')
    .select('key, value')
    .in('key', ['topper_assessment_weight', 'topper_project_weight', 'topper_min_attendance'])
  const govMap = new Map((govRows || []).map((r: any) => [r.key, Number(r.value)]))
  const weights = {
    assessment: govMap.get('topper_assessment_weight') ?? 70,
    project: govMap.get('topper_project_weight') ?? 30,
    minAttendance: govMap.get('topper_min_attendance') ?? 75,
  }

  let batchQuery = admin.from('training_batches').select('id, title, domain, status, start_date, end_date')
  if (batchId) batchQuery = batchQuery.eq('id', batchId)
  const { data: batches } = await batchQuery.order('created_at', { ascending: false })
  const batchIds = (batches || []).map((b: any) => b.id)
  const batchMap = new Map((batches || []).map((b: any) => [b.id, b]))

  if (!batchIds.length) {
    return NextResponse.json({ error: 'No batches found' }, { status: 404 })
  }

  const [{ data: members }, { data: sessions }, { data: projectEvals }, { data: importResults }] = await Promise.all([
    admin.from('batch_members').select('batch_id, user_id, enrollment_status, profile:user_id(full_name, email, employee_id, department)').in('batch_id', batchIds),
    admin.from('training_sessions').select('id, batch_id, attendance_required, status').in('batch_id', batchIds).neq('status', 'cancelled'),
    admin.from('training_project_evaluations').select('batch_id, user_id, score').in('batch_id', batchIds),
    admin.from('training_assessment_results').select('batch_id, candidate_email, percentage').in('batch_id', batchIds),
  ])

  const sessionIds = (sessions || []).map((s: any) => s.id)
  const { data: attendance } = sessionIds.length
    ? await admin.from('session_attendance').select('session_id, user_id, status').in('session_id', sessionIds)
    : { data: [] }

  // Index data
  const sessionsByBatch = new Map<string, any[]>()
  for (const s of sessions || []) {
    const arr = sessionsByBatch.get(s.batch_id) || []; arr.push(s); sessionsByBatch.set(s.batch_id, arr)
  }
  const attendanceByUser = new Map<string, any[]>()
  for (const a of attendance || []) {
    const arr = attendanceByUser.get(`${a.user_id}`) || []; arr.push(a); attendanceByUser.set(`${a.user_id}`, arr)
  }
  const projectByUser = new Map<string, number>()
  for (const p of projectEvals || []) {
    projectByUser.set(`${p.batch_id}:${p.user_id}`, p.score)
  }
  const scoresByEmail = new Map<string, number[]>()
  for (const r of importResults || []) {
    const key = r.candidate_email?.toLowerCase()
    if (!key) continue
    const arr = scoresByEmail.get(key) || []; arr.push(r.percentage); scoresByEmail.set(key, arr)
  }

  const topperRows: any[] = []
  for (const member of members || []) {
    const profile = (member as any).profile
    const batchSessions = (sessionsByBatch.get(member.batch_id) || []).filter((s: any) => s.attendance_required)
    const memberAttendance = attendanceByUser.get(member.user_id) || []
    const presentCount = memberAttendance.filter((a: any) => a.status === 'present' || a.status === 'late').length
    const attendancePct = batchSessions.length > 0 ? Math.round((presentCount / batchSessions.length) * 100) : 0
    const emailScores = scoresByEmail.get((profile?.email || '').toLowerCase()) || []
    const assessmentAvg = emailScores.length ? Math.round(emailScores.reduce((a: number, b: number) => a + b, 0) / emailScores.length) : 0
    const projectScore = projectByUser.get(`${member.batch_id}:${member.user_id}`) ?? 0
    const topperScore = computeTopperScore(assessmentAvg, projectScore, attendancePct, weights)
    const batch = batchMap.get(member.batch_id)

    topperRows.push({
      Batch: batch?.title || '',
      Batch_Domain: batch?.domain || '',
      Employee_ID: profile?.employee_id || '',
      Full_Name: profile?.full_name || '',
      Email: profile?.email || '',
      Department: profile?.department || '',
      Enrollment_Status: member.enrollment_status,
      Attendance_Pct: `${attendancePct}%`,
      Meets_Attendance_Threshold: attendancePct >= weights.minAttendance ? 'YES' : 'NO',
      Assessments_Taken: emailScores.length,
      Assessment_Avg_Score: assessmentAvg,
      Project_Score: projectScore,
      Assessment_Weight_Pct: weights.assessment,
      Project_Weight_Pct: weights.project,
      Topper_Score: topperScore,
      Is_Topper: topperScore >= 80 ? 'YES' : '',
    })
  }

  // Sort by topper score desc
  topperRows.sort((a, b) => b.Topper_Score - a.Topper_Score)
  topperRows.forEach((row, i) => { row.Rank = i + 1 })
  // Move Rank to front
  const ordered = topperRows.map(({ Rank, ...rest }) => ({ Rank, ...rest }))

  const wb = XLSX.utils.book_new()

  // Top performers sheet
  const topSheet = XLSX.utils.json_to_sheet(ordered.filter(r => r.Is_Topper === 'YES'))
  topSheet['!cols'] = Array(16).fill({ wch: 18 })
  XLSX.utils.book_append_sheet(wb, topSheet, 'Toppers')

  // All candidates ranked
  const allSheet = XLSX.utils.json_to_sheet(ordered)
  allSheet['!cols'] = Array(16).fill({ wch: 18 })
  XLSX.utils.book_append_sheet(wb, allSheet, 'All Candidates Ranked')

  // Criteria transparency sheet
  const criteriaSheet = XLSX.utils.json_to_sheet([
    { Parameter: 'Assessment Weight', Value: `${weights.assessment}%` },
    { Parameter: 'Project Evaluation Weight', Value: `${weights.project}%` },
    { Parameter: 'Minimum Attendance Threshold', Value: `${weights.minAttendance}%` },
    { Parameter: 'Topper Score Formula', Value: `(Assessment_Avg × ${weights.assessment} + Project_Score × ${weights.project}) / ${weights.assessment + weights.project}` },
    { Parameter: 'Topper Threshold (Score ≥)', Value: '80' },
    { Parameter: 'Report Generated', Value: new Date().toLocaleString() },
    { Parameter: 'Scope', Value: batchId ? `Single batch: ${batchMap.get(batchId)?.title}` : 'All batches' },
  ])
  criteriaSheet['!cols'] = [{ wch: 38 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, criteriaSheet, 'Scoring Criteria')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const timestamp = new Date().toISOString().split('T')[0]
  const batchLabel = batchId ? `-${(batchMap.get(batchId)?.title || batchId).replace(/\s+/g, '-').toLowerCase()}` : '-all-batches'
  const filename = `toppers${batchLabel}-${timestamp}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
