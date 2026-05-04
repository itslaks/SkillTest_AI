import { NextRequest, NextResponse } from 'next/server'
import { requireManagerForApi } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/server'
import { canAccessTrainingBatch, getAccessibleTrainingBatchIds } from '@/lib/training-access'
import { averageScore, computeTopperScore, isTopper, normalizeTopperWeights } from '@/lib/topper'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth
  const { userId, role } = auth

  const { searchParams } = request.nextUrl
  const batchId = searchParams.get('batchId') || undefined
  const filterStatus = searchParams.get('filter') || 'all' // all | discontinued | not_cleared | offered | onboarded
  if (batchId && !(await canAccessTrainingBatch(batchId, userId, role))) {
    return NextResponse.json({ error: 'Forbidden: batch access denied' }, { status: 403 })
  }

  const admin = createAdminClient()
  const accessibleBatchIds = await getAccessibleTrainingBatchIds(userId, role)
  if (!accessibleBatchIds.length) {
    return NextResponse.json({ error: 'No accessible batches found' }, { status: 404 })
  }

  // Governance weights
  const { data: govRows } = await admin
    .from('training_system_settings')
    .select('key, value')
    .in('key', ['topper_assessment_weight', 'topper_project_weight', 'topper_min_attendance'])
  const govMap = new Map((govRows || []).map((r: any) => [r.key, Number(r.value)]))
  const weights = normalizeTopperWeights({
    assessment: govMap.get('topper_assessment_weight') ?? 70,
    project: govMap.get('topper_project_weight') ?? 30,
    minAttendance: govMap.get('topper_min_attendance') ?? 75,
  })

  let batchQuery = admin
    .from('training_batches')
    .select('id, title, domain, status, start_date, end_date, trainer:trainer_id(full_name, email), coordinator:coordinator_id(full_name, email)')
  if (batchId) batchQuery = batchQuery.eq('id', batchId)
  if (!batchId) batchQuery = batchQuery.in('id', accessibleBatchIds)
  const { data: batches } = await batchQuery.order('created_at', { ascending: false })
  const batchIds = (batches || []).map((b: any) => b.id)
  const batchMap = new Map((batches || []).map((b: any) => [b.id, b]))

  if (!batchIds.length) {
    return NextResponse.json({ error: 'No batches found' }, { status: 404 })
  }

  const [{ data: allMembers }, { data: sessions }, { data: projectEvals }, { data: importResults }, { data: feedbackItems }] = await Promise.all([
    admin.from('batch_members').select('batch_id, user_id, enrollment_status, support_status, joined_at, profile:user_id(full_name, email, employee_id, department)').in('batch_id', batchIds),
    admin.from('training_sessions').select('id, batch_id, attendance_required, status').in('batch_id', batchIds).neq('status', 'cancelled'),
    admin.from('training_project_evaluations').select('batch_id, user_id, score, project_title').in('batch_id', batchIds),
    admin.from('assessment_results').select('batch_id, candidate_email, percentage, test_name').in('batch_id', batchIds),
    admin.from('training_feedback').select('batch_id, user_id, rating, sentiment').in('batch_id', batchIds),
  ])

  const sessionIds = (sessions || []).map((s: any) => s.id)
  const { data: attendance } = sessionIds.length
    ? await admin.from('session_attendance').select('session_id, user_id, status').in('session_id', sessionIds)
    : { data: [] }

  // Indexes
  const sessionsByBatch = new Map<string, any[]>()
  for (const s of sessions || []) {
    const arr = sessionsByBatch.get(s.batch_id) || []; arr.push(s); sessionsByBatch.set(s.batch_id, arr)
  }
  const attendanceByUser = new Map<string, any[]>()
  for (const a of attendance || []) {
    const arr = attendanceByUser.get(a.user_id) || []; arr.push(a); attendanceByUser.set(a.user_id, arr)
  }
  const projectByKey = new Map<string, any>()
  for (const p of projectEvals || []) {
    projectByKey.set(`${p.batch_id}:${p.user_id}`, p)
  }
  const scoresByEmail = new Map<string, number[]>()
  for (const r of importResults || []) {
    const key = (r.candidate_email || '').toLowerCase()
    if (!key) continue
    const arr = scoresByEmail.get(key) || []; arr.push(r.percentage); scoresByEmail.set(key, arr)
  }

  // Filter member statuses
  const statusFilters: Record<string, string[]> = {
    all: [],
    discontinued: ['discontinued', 'dropped'],
    not_cleared: ['not_cleared'],
    offered: ['offered'],
    onboarded: ['onboarded', 'active'],
  }
  const allowedStatuses = statusFilters[filterStatus] || []

  const members = (allMembers || []).filter((m: any) => {
    if (!allowedStatuses.length) return true
    return allowedStatuses.includes(m.enrollment_status)
  })

  // Build consolidated rows
  const rows = members.map((member: any) => {
    const profile = member.profile
    const batch = batchMap.get(member.batch_id)
    const batchSessions = (sessionsByBatch.get(member.batch_id) || []).filter((s: any) => s.attendance_required)
    const memberAttendance = (attendanceByUser.get(member.user_id) || []).filter((a: any) =>
      batchSessions.some((s: any) => s.id === a.session_id)
    )
    const presentCount = memberAttendance.filter((a: any) => a.status === 'present' || a.status === 'late').length
    const attendancePct = batchSessions.length > 0 ? Math.round((presentCount / batchSessions.length) * 100) : 0
    const emailScores = scoresByEmail.get((profile?.email || '').toLowerCase()) || []
    const assessmentAvg = averageScore(emailScores)
    const projectData = projectByKey.get(`${member.batch_id}:${member.user_id}`)
    const projectScore = projectData?.score ?? 0
    const topperScore = computeTopperScore({ assessmentAvg, projectScore, attendancePct, weights })
    const feedback = (feedbackItems || []).filter((f: any) => f.batch_id === member.batch_id && f.user_id === member.user_id)
    const avgFeedbackRating = feedback.length > 0 ? (feedback.reduce((s: number, f: any) => s + (f.rating || 0), 0) / feedback.length).toFixed(1) : ''

    return {
      Rank: 0, // filled below
      Batch: batch?.title || '',
      Batch_Status: batch?.status || '',
      Employee_ID: profile?.employee_id || '',
      Full_Name: profile?.full_name || '',
      Email: profile?.email || '',
      Department: profile?.department || '',
      Enrollment_Status: member.enrollment_status,
      Support_Status: member.support_status,
      Joined_At: member.joined_at ? new Date(member.joined_at).toLocaleDateString() : '',
      Sessions_Required: batchSessions.length,
      Present: presentCount,
      Attendance_Pct: `${attendancePct}%`,
      Attendance_Eligible: attendancePct >= weights.minAttendance ? 'YES' : 'NO',
      Assessments_Taken: emailScores.length,
      Assessment_Avg_Pct: assessmentAvg,
      Project_Title: projectData?.project_title || '',
      Project_Score: projectScore,
      Topper_Score: topperScore,
      Is_Topper: isTopper(topperScore, weights) ? 'YES' : '',
      Feedback_Responses: feedback.length,
      Avg_Feedback_Rating: avgFeedbackRating,
      Trainer: (batch?.trainer as any)?.full_name || (batch?.trainer as any)?.email || '',
      Coordinator: (batch?.coordinator as any)?.full_name || (batch?.coordinator as any)?.email || '',
    }
  })

  rows.sort((a: any, b: any) => b.Topper_Score - a.Topper_Score)
  rows.forEach((row: any, i: number) => { row.Rank = i + 1 })

  // Batch-level summary
  const batchSummary = (batches || []).map((batch: any) => {
    const batchMembers = (allMembers || []).filter((m: any) => m.batch_id === batch.id)
    const total = batchMembers.length
    const discontinued = batchMembers.filter((m: any) => ['discontinued', 'dropped'].includes(m.enrollment_status)).length
    const notCleared = batchMembers.filter((m: any) => m.enrollment_status === 'not_cleared').length
    const offered = batchMembers.filter((m: any) => m.enrollment_status === 'offered').length
    const onboarded = batchMembers.filter((m: any) => ['onboarded', 'active'].includes(m.enrollment_status)).length
    const remaining = batchMembers.filter((m: any) => ['invited', 'active'].includes(m.enrollment_status)).length
    const batchSessions = (sessionsByBatch.get(batch.id) || []).filter((s: any) => s.attendance_required)
    let totalPresent = 0, totalSessionSlots = 0
    for (const m of batchMembers) {
      const ma = (attendanceByUser.get(m.user_id) || []).filter((a: any) => batchSessions.some((s: any) => s.id === a.session_id))
      totalPresent += ma.filter((a: any) => a.status === 'present' || a.status === 'late').length
      totalSessionSlots += batchSessions.length
    }
    const overallAttendancePct = totalSessionSlots > 0 ? Math.round((totalPresent / totalSessionSlots) * 100) : 0
    return {
      Batch: batch.title,
      Domain: batch.domain || '',
      Status: batch.status,
      Start_Date: batch.start_date ? new Date(batch.start_date).toLocaleDateString() : '',
      End_Date: batch.end_date ? new Date(batch.end_date).toLocaleDateString() : '',
      Total_Candidates: total,
      Discontinued: discontinued,
      Not_Cleared: notCleared,
      Offered: offered,
      Onboarded: onboarded,
      Remaining_In_Training: remaining,
      Overall_Attendance_Pct: `${overallAttendancePct}%`,
    }
  })

  const wb = XLSX.utils.book_new()

  const batchSummaryWs = XLSX.utils.json_to_sheet(batchSummary)
  batchSummaryWs['!cols'] = Array(12).fill({ wch: 18 })
  XLSX.utils.book_append_sheet(wb, batchSummaryWs, 'Batch Summary')

  const consolidatedWs = XLSX.utils.json_to_sheet(rows)
  consolidatedWs['!cols'] = Array(24).fill({ wch: 18 })
  const sheetLabel = filterStatus === 'all' ? 'All Candidates' : filterStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  XLSX.utils.book_append_sheet(wb, consolidatedWs, sheetLabel)

  // Criteria sheet
  const criteriaWs = XLSX.utils.json_to_sheet([
    { Parameter: 'Filter Applied', Value: filterStatus === 'all' ? 'All candidates' : filterStatus.replace('_', ' ') },
    { Parameter: 'Assessment Weight', Value: `${weights.assessment}%` },
    { Parameter: 'Project Weight', Value: `${weights.project}%` },
    { Parameter: 'Min Attendance for Topper', Value: `${weights.minAttendance}%` },
    { Parameter: 'Scope', Value: batchId ? batchMap.get(batchId)?.title || batchId : 'All managed batches' },
    { Parameter: 'Report Generated', Value: new Date().toLocaleString() },
  ])
  criteriaWs['!cols'] = [{ wch: 36 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(wb, criteriaWs, 'Report Criteria')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `consolidated-report-${filterStatus}-${timestamp}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
