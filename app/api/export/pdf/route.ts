import { NextRequest, NextResponse } from 'next/server'
import { requireManagerForApi } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * PDF export for batch reports using jsPDF + jspdf-autotable.
 * Supports: attendance | assessment | toppers | feedback | consolidated
 */
export async function GET(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = request.nextUrl
  const reportType = searchParams.get('type') || 'consolidated'
  const batchId = searchParams.get('batchId') || undefined

  const admin = createAdminClient()

  // Dynamic import — jsPDF is ESM and large; only load server-side
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const timestamp = new Date().toLocaleString()
  const brandColor: [number, number, number] = [0, 0, 0]
  const accentColor: [number, number, number] = [30, 30, 30]

  function header(title: string, subtitle: string) {
    doc.setFillColor(...brandColor)
    doc.rect(0, 0, 297, 22, 'F')
    doc.setFontSize(14)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text('MAVERICK EXECUTION PLATFORM', 14, 9)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Training Management System', 14, 15)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...brandColor)
    doc.text(title, 14, 32)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(subtitle, 14, 38)
    doc.setFontSize(8)
    doc.text(`Generated: ${timestamp}`, 14, 44)
  }

  // ─── Governance settings ─────────────────────────────
  const { data: govRows } = await admin.from('training_system_settings').select('key, value').in('key', ['topper_assessment_weight', 'topper_project_weight', 'topper_min_attendance'])
  const govMap = new Map((govRows || []).map((r: any) => [r.key, Number(r.value)]))
  const weights = { assessment: govMap.get('topper_assessment_weight') ?? 70, project: govMap.get('topper_project_weight') ?? 30, minAttendance: govMap.get('topper_min_attendance') ?? 75 }

  let batchQuery = admin.from('training_batches').select('id, title, domain, status, start_date, end_date, trainer:trainer_id(full_name, email), coordinator:coordinator_id(full_name, email)').or(`created_by.eq.${userId},coordinator_id.eq.${userId},trainer_id.eq.${userId}`)
  if (batchId) batchQuery = batchQuery.eq('id', batchId)
  const { data: batches } = await batchQuery.order('created_at', { ascending: false })
  const batchIds = (batches || []).map((b: any) => b.id)
  const batchMap = new Map((batches || []).map((b: any) => [b.id, b]))

  if (!batchIds.length) return NextResponse.json({ error: 'No batches found' }, { status: 404 })

  const [{ data: allMembers }, { data: sessions }, { data: projectEvals }, { data: importResults }, { data: feedbackItems }] = await Promise.all([
    admin.from('batch_members').select('batch_id, user_id, enrollment_status, profile:user_id(full_name, email, employee_id, department)').in('batch_id', batchIds),
    admin.from('training_sessions').select('id, batch_id, attendance_required, status, session_date').in('batch_id', batchIds).neq('status', 'cancelled'),
    admin.from('training_project_evaluations').select('batch_id, user_id, score').in('batch_id', batchIds),
    admin.from('training_assessment_results').select('batch_id, candidate_email, percentage').in('batch_id', batchIds),
    admin.from('training_feedback').select('batch_id, user_id, rating, sentiment, content_quality_rating, trainer_effectiveness_rating').in('batch_id', batchIds),
  ])

  const sessionIds = (sessions || []).map((s: any) => s.id)
  const { data: attendance } = sessionIds.length ? await admin.from('session_attendance').select('session_id, user_id, status').in('session_id', sessionIds) : { data: [] }

  const sessionsByBatch = new Map<string, any[]>()
  for (const s of sessions || []) { const arr = sessionsByBatch.get(s.batch_id) || []; arr.push(s); sessionsByBatch.set(s.batch_id, arr) }
  const attendanceByUser = new Map<string, any[]>()
  for (const a of attendance || []) { const arr = attendanceByUser.get(a.user_id) || []; arr.push(a); attendanceByUser.set(a.user_id, arr) }
  const projectByKey = new Map<string, number>()
  for (const p of projectEvals || []) { projectByKey.set(`${p.batch_id}:${p.user_id}`, p.score) }
  const scoresByEmail = new Map<string, number[]>()
  for (const r of importResults || []) { const key = (r.candidate_email || '').toLowerCase(); if (!key) continue; const arr = scoresByEmail.get(key) || []; arr.push(r.percentage); scoresByEmail.set(key, arr) }

  const members = allMembers || []

  if (reportType === 'toppers' || reportType === 'consolidated') {
    const targetBatch = batchId ? batchMap.get(batchId) : null
    header(
      reportType === 'toppers' ? 'Topper Identification Report' : 'Consolidated Batch Report',
      targetBatch ? `Batch: ${targetBatch.title}` : 'All Managed Batches'
    )

    // Batch summary table
    const batchRows = (batches || []).map((b: any) => {
      const bm = members.filter((m: any) => m.batch_id === b.id)
      const bS = (sessionsByBatch.get(b.id) || []).filter((s: any) => s.attendance_required)
      let tp = 0, ts = 0
      for (const m of bm) { const ma = (attendanceByUser.get(m.user_id) || []).filter((a: any) => bS.some((s: any) => s.id === a.session_id)); tp += ma.filter((a: any) => a.status === 'present' || a.status === 'late').length; ts += bS.length }
      return [b.title, b.status, bm.length.toString(), bm.filter((m: any) => ['discontinued', 'dropped'].includes(m.enrollment_status)).length.toString(), bm.filter((m: any) => m.enrollment_status === 'not_cleared').length.toString(), bm.filter((m: any) => m.enrollment_status === 'offered').length.toString(), bm.filter((m: any) => ['onboarded', 'active'].includes(m.enrollment_status)).length.toString(), ts > 0 ? `${Math.round((tp / ts) * 100)}%` : 'N/A']
    })

    autoTable(doc, {
      startY: 50,
      head: [['Batch', 'Status', 'Total', 'Discontinued', 'Not Cleared', 'Offered', 'Onboarded', 'Attendance %']],
      body: batchRows,
      theme: 'grid',
      headStyles: { fillColor: accentColor, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      margin: { left: 14, right: 14 },
    })

    doc.addPage()
    doc.setFillColor(...brandColor)
    doc.rect(0, 0, 297, 10, 'F')
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
    doc.text(reportType === 'toppers' ? 'Candidate Rankings & Topper List' : 'All Candidates', 14, 7)

    const candidateRows = members.map((member: any) => {
      const profile = member.profile
      const batch = batchMap.get(member.batch_id)
      const bSessions = (sessionsByBatch.get(member.batch_id) || []).filter((s: any) => s.attendance_required)
      const ma = (attendanceByUser.get(member.user_id) || []).filter((a: any) => bSessions.some((s: any) => s.id === a.session_id))
      const presentCount = ma.filter((a: any) => a.status === 'present' || a.status === 'late').length
      const attendancePct = bSessions.length > 0 ? Math.round((presentCount / bSessions.length) * 100) : 0
      const emailScores = scoresByEmail.get((profile?.email || '').toLowerCase()) || []
      const assessmentAvg = emailScores.length ? Math.round(emailScores.reduce((a: number, b: number) => a + b, 0) / emailScores.length) : 0
      const projectScore = projectByKey.get(`${member.batch_id}:${member.user_id}`) ?? 0
      const totalW = weights.assessment + weights.project
      const topperScore = attendancePct >= weights.minAttendance && totalW > 0 ? Math.round((assessmentAvg * weights.assessment + projectScore * weights.project) / totalW) : 0
      return [batch?.title || '', profile?.full_name || '', profile?.employee_id || '', member.enrollment_status, `${attendancePct}%`, assessmentAvg.toString(), projectScore.toString(), topperScore.toString(), topperScore >= 80 ? '★ TOPPER' : '']
    }).sort((a: any[], b: any[]) => Number(b[7]) - Number(a[7]))

    autoTable(doc, {
      startY: 15,
      head: [['Batch', 'Name', 'Emp ID', 'Status', 'Attendance', 'Assessment Avg', 'Project', 'Topper Score', 'Topper']],
      body: candidateRows,
      theme: 'striped',
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 6.5 },
      margin: { left: 14, right: 14 },
      didParseCell: (data: any) => {
        if (data.cell.raw === '★ TOPPER') { data.cell.styles.textColor = [16, 128, 0]; data.cell.styles.fontStyle = 'bold' }
      },
    })

    // Scoring criteria
    doc.addPage()
    doc.setFillColor(...brandColor); doc.rect(0, 0, 297, 10, 'F')
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
    doc.text('Topper Scoring Criteria (Transparent & Reproducible)', 14, 7)
    autoTable(doc, {
      startY: 15,
      head: [['Parameter', 'Value']],
      body: [
        ['Assessment Score Weight', `${weights.assessment}%`],
        ['Project Evaluation Weight', `${weights.project}%`],
        ['Minimum Attendance Threshold', `${weights.minAttendance}%`],
        ['Topper Score Formula', `(Assessment_Avg × ${weights.assessment} + Project × ${weights.project}) ÷ ${weights.assessment + weights.project}`],
        ['Topper Threshold', 'Score ≥ 80'],
      ],
      theme: 'grid',
      headStyles: { fillColor: accentColor, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    })
  }

  if (reportType === 'attendance') {
    const targetBatch = batchId ? batchMap.get(batchId) : null
    header('Batch Attendance Report', targetBatch ? `Batch: ${targetBatch.title}` : 'All Batches')
    const attendanceRows = members.map((member: any) => {
      const profile = member.profile
      const batch = batchMap.get(member.batch_id)
      const bSessions = (sessionsByBatch.get(member.batch_id) || []).filter((s: any) => s.attendance_required)
      const ma = (attendanceByUser.get(member.user_id) || []).filter((a: any) => bSessions.some((s: any) => s.id === a.session_id))
      const present = ma.filter((a: any) => a.status === 'present' || a.status === 'late').length
      const attendancePct = bSessions.length > 0 ? Math.round((present / bSessions.length) * 100) : 0
      return [batch?.title || '', profile?.full_name || '', profile?.employee_id || '', profile?.department || '', bSessions.length.toString(), present.toString(), `${attendancePct}%`, attendancePct < 75 ? 'AT RISK' : 'OK']
    })
    autoTable(doc, {
      startY: 50,
      head: [['Batch', 'Name', 'Emp ID', 'Department', 'Sessions', 'Present', 'Attendance %', 'Status']],
      body: attendanceRows,
      theme: 'grid',
      headStyles: { fillColor: accentColor, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      margin: { left: 14, right: 14 },
      didParseCell: (data: any) => {
        if (data.cell.raw === 'AT RISK') { data.cell.styles.textColor = [200, 0, 0]; data.cell.styles.fontStyle = 'bold' }
      },
    })
  }

  if (reportType === 'feedback') {
    const targetBatch = batchId ? batchMap.get(batchId) : null
    header('Training Feedback Report', targetBatch ? `Batch: ${targetBatch.title}` : 'All Batches')
    const feedback = batchId ? (feedbackItems || []).filter((f: any) => f.batch_id === batchId) : feedbackItems || []
    const positive = feedback.filter((f: any) => f.sentiment === 'positive').length
    const negative = feedback.filter((f: any) => f.sentiment === 'negative').length
    const avgRating = feedback.length ? (feedback.reduce((s: number, f: any) => s + (f.rating || 0), 0) / feedback.length).toFixed(2) : 'N/A'
    const avgCQ = feedback.length ? (feedback.reduce((s: number, f: any) => s + (f.content_quality_rating || 0), 0) / feedback.length).toFixed(2) : 'N/A'
    const avgTE = feedback.length ? (feedback.reduce((s: number, f: any) => s + (f.trainer_effectiveness_rating || 0), 0) / feedback.length).toFixed(2) : 'N/A'
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Value']],
      body: [['Total Responses', feedback.length.toString()], ['Positive', positive.toString()], ['Negative', negative.toString()], ['Avg Overall Rating', avgRating], ['Avg Content Quality', avgCQ], ['Avg Trainer Effectiveness', avgTE]],
      theme: 'grid',
      headStyles: { fillColor: accentColor, textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 200 },
    })
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'normal')
    doc.text(`Maverick Execution Platform — Confidential | Page ${i} of ${pageCount}`, 14, 207)
    doc.text(`Generated ${timestamp}`, 200, 207)
  }

  const pdfBytes = doc.output('arraybuffer')
  const buffer = Buffer.from(pdfBytes)
  const ts = new Date().toISOString().split('T')[0]
  const filename = `maverick-tms-${reportType}-report-${ts}.pdf`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
