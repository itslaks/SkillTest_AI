import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireManagerForApi } from '@/lib/rbac'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const supabase = await createClient()
  let dataClient: any = supabase
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    dataClient = createAdminClient()
  }

  const { data: batches, error: batchError } = await dataClient
    .from('training_batches')
    .select(`
      *,
      trainer:trainer_id(full_name, email),
      coordinator:coordinator_id(full_name, email)
    `)
    .or(`created_by.eq.${userId},coordinator_id.eq.${userId},trainer_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 })
  }

  const batchIds = (batches || []).map((batch: any) => batch.id)
  const [membersRes, sessionsRes, notificationsRes, feedbackRes, quizzesRes] = await Promise.all([
    batchIds.length
      ? dataClient
          .from('batch_members')
          .select('*, profile:user_id(full_name, email, employee_id, department, domain)')
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? dataClient
          .from('training_sessions')
          .select('*, batch:batch_id(title), trainer:trainer_id(full_name, email)')
          .in('batch_id', batchIds)
          .order('session_date', { ascending: true })
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? dataClient
          .from('training_notifications')
          .select('*, batch:batch_id(title), session:session_id(title), recipient:recipient_user_id(full_name, email)')
          .in('batch_id', batchIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? dataClient
          .from('training_feedback')
          .select('*, batch:batch_id(title), session:session_id(title), trainee:user_id(full_name, email)')
          .in('batch_id', batchIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? dataClient
          .from('quizzes')
          .select('id, title, topic, difficulty, passing_score, is_active, batch_id')
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
  ])

  const sessions = sessionsRes.data || []
  const sessionIds = sessions.map((session: any) => session.id)
  const [attendanceRes, uploadsRes, settingsRes, attemptsRes, projectRes, assessmentSetupRes, automationRes] = await Promise.all([
    sessionIds.length
      ? dataClient
          .from('session_attendance')
          .select('*, session:session_id(title, session_date, batch_id), profile:user_id(full_name, email, employee_id)')
          .in('session_id', sessionIds)
      : Promise.resolve({ data: [] }),
    sessionIds.length
      ? dataClient
          .from('training_attendance_uploads')
          .select('*, session:session_id(title), uploader:uploaded_by(full_name, email)')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    dataClient
      .from('training_system_settings')
      .select('key, value'),
    batchIds.length
      ? dataClient
          .from('quiz_attempts')
          .select('user_id, score, points_earned, time_taken_seconds, quizzes!inner(title, batch_id), profiles:user_id(full_name, email, employee_id)')
          .in('quizzes.batch_id', batchIds)
          .eq('status', 'completed')
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? dataClient
          .from('training_project_evaluations')
          .select('*, profile:user_id(full_name, email, employee_id), evaluator:evaluator_id(full_name, email)')
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? dataClient
          .from('training_assessment_setups')
          .select('*')
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? dataClient
          .from('training_automation_runs')
          .select('*')
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
  ])

  const members = membersRes.data || []
  const attendance = attendanceRes.data || []
  const uploads = uploadsRes.data || []
  const notifications = notificationsRes.data || []
  const feedback = feedbackRes.data || []
  const quizzes = quizzesRes.data || []
  const settings = Object.fromEntries((settingsRes.data || []).map((item: any) => [item.key, item.value]))

  const membersByBatch = groupBy(members, 'batch_id')
  const sessionsByBatch = groupBy(sessions, 'batch_id')
  const quizzesByBatch = groupBy(quizzes, 'batch_id')
  const attendanceBySession = groupBy(attendance, 'session_id')
  const feedbackByBatch = groupBy(feedback, 'batch_id')

  const wb = XLSX.utils.book_new()

  const batchRows = (batches || []).map((batch: any) => {
    const batchMembers = membersByBatch.get(batch.id) || []
    const batchSessions = sessionsByBatch.get(batch.id) || []
    const batchQuizzes = quizzesByBatch.get(batch.id) || []
    const batchAttendance = batchSessions.flatMap((session: any) => attendanceBySession.get(session.id) || [])
    const present = batchAttendance.filter((entry: any) => ['present', 'late'].includes(entry.status)).length
    const attendanceRate = batchAttendance.length ? Math.round((present / batchAttendance.length) * 100) : 0
    return {
      'Batch ID': batch.id,
      'Batch Name': batch.title,
      'Domain': batch.domain || 'N/A',
      'Status': normalizeStatus(batch.status),
      'Start Date': batch.start_date || 'TBD',
      'End Date': batch.end_date || 'TBD',
      'Trainer': batch.trainer?.full_name || batch.trainer?.email || 'Unassigned',
      'Coordinator': batch.coordinator?.full_name || batch.coordinator?.email || 'Unassigned',
      'Candidates': batchMembers.length,
      'Sessions': batchSessions.length,
      'Assessments': batchQuizzes.length,
      'Attendance Health (%)': attendanceRate,
      'Feedback Responses': (feedbackByBatch.get(batch.id) || []).length,
    }
  })

  addSheet(wb, 'Batch Summary', batchRows)
  addSheet(wb, 'Candidate Status', members.map((member: any) => ({
    'Batch': member.batch_id,
    'Candidate Name': member.profile?.full_name || 'Unknown',
    'Email': member.profile?.email || '',
    'Employee ID': member.profile?.employee_id || 'N/A',
    'Domain': member.profile?.domain || member.profile?.department || 'N/A',
    'Enrollment Status': member.enrollment_status,
    'Support Status': member.support_status,
    'Joined At': member.joined_at ? new Date(member.joined_at).toLocaleString() : 'N/A',
  })))
  addSheet(wb, 'Attendance', attendance.map((entry: any) => ({
    'Session': entry.session?.title || 'Session',
    'Session Date': entry.session?.session_date ? new Date(entry.session.session_date).toLocaleString() : 'N/A',
    'Candidate Name': entry.profile?.full_name || 'Unknown',
    'Email': entry.profile?.email || '',
    'Employee ID': entry.profile?.employee_id || 'N/A',
    'Status': entry.status,
    'Check In': entry.check_in_time ? new Date(entry.check_in_time).toLocaleString() : 'N/A',
    'Notes': entry.notes || '',
    'Last Updated': entry.updated_at ? new Date(entry.updated_at).toLocaleString() : 'N/A',
  })))
  addSheet(wb, 'Assessments', quizzes.map((quiz: any) => ({
    'Batch ID': quiz.batch_id,
    'Assessment': quiz.title,
    'Topic': quiz.topic,
    'Difficulty': quiz.difficulty,
    'Passing Score': quiz.passing_score,
    'Status': quiz.is_active ? 'Active' : 'Inactive',
  })))
  addSheet(wb, 'Assessment Setup', (assessmentSetupRes.data || []).map((setup: any) => ({
    'Batch ID': setup.batch_id,
    'Assessment': setup.title,
    'Type': setup.assessment_type,
    'Scheduled At': setup.scheduled_at ? new Date(setup.scheduled_at).toLocaleString() : 'TBD',
    'Template': setup.template_name || 'N/A',
    'Question File': setup.question_file_name || 'N/A',
    'Max Score': setup.max_score,
    'Passing Score': setup.passing_score,
    'Status': setup.status,
  })))
  addSheet(wb, 'Attendance Uploads', uploads.map((upload: any) => ({
    'Session': upload.session?.title || upload.session_id,
    'Uploaded By': upload.uploader?.full_name || upload.uploader?.email || 'Unknown',
    'File Name': upload.file_name || 'N/A',
    'Total Records': upload.total_records,
    'Successful Records': upload.successful_records,
    'Failed Records': upload.failed_records,
    'Uploaded At': upload.created_at ? new Date(upload.created_at).toLocaleString() : 'N/A',
  })))
  addSheet(wb, 'Topper Criteria', [
    {
      'Assessment Weight (%)': settings.topper_assessment_weight || 70,
      'Project Weight (%)': settings.topper_project_weight || 30,
      'Minimum Attendance (%)': settings.topper_min_attendance || 75,
      'Attendance Cutoff': settings.attendance_cutoff_time || '10:00',
      'Absence Alert Days': settings.absence_alert_days || 3,
    },
  ])
  addSheet(wb, 'Topper Candidates', buildTopperRows(attemptsRes.data || [], attendance, settings, projectRes.data || []))
  addSheet(wb, 'Project Evaluations', (projectRes.data || []).map((item: any) => ({
    'Batch ID': item.batch_id,
    'Candidate': item.profile?.full_name || item.profile?.email || 'Unknown',
    'Employee ID': item.profile?.employee_id || 'N/A',
    'Project Title': item.project_title,
    'Score': item.score,
    'Evidence File': item.evidence_file_name || 'N/A',
    'Evaluator': item.evaluator?.full_name || item.evaluator?.email || 'Unknown',
    'Remarks': item.remarks || '',
  })))
  addSheet(wb, 'Feedback', feedback.map((item: any) => ({
    'Batch': item.batch?.title || 'N/A',
    'Session': item.session?.title || 'N/A',
    'Candidate': item.trainee?.full_name || item.trainee?.email || 'Unknown',
    'Rating': item.rating,
    'Sentiment': item.sentiment,
    'Feedback': item.feedback_text,
    'Action Item': item.action_item || '',
    'Submitted At': item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A',
  })))
  addSheet(wb, 'Notifications', notifications.map((item: any) => ({
    'Title': item.title,
    'Batch': item.batch?.title || 'N/A',
    'Session': item.session?.title || 'N/A',
    'Recipient': item.recipient?.full_name || item.recipient?.email || item.audience,
    'Channel': item.channel,
    'Status': item.delivery_status,
    'Scheduled For': item.scheduled_for ? new Date(item.scheduled_for).toLocaleString() : 'N/A',
    'Sent At': item.sent_at ? new Date(item.sent_at).toLocaleString() : 'N/A',
    'Message': item.message,
  })))
  addSheet(wb, 'Automation Runs', (automationRes.data || []).map((item: any) => ({
    'Run Type': item.run_type,
    'Batch ID': item.batch_id || 'All',
    'Session ID': item.session_id || 'N/A',
    'Status': item.status,
    'Notifications Created': item.notifications_created,
    'Notes': item.notes || '',
    'Run At': item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A',
  })))

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `maverick-training-ops-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function groupBy(items: any[], key: string) {
  const grouped = new Map<string, any[]>()
  for (const item of items) {
    const groupKey = item[key]
    if (!groupKey) continue
    const group = grouped.get(groupKey) || []
    group.push(item)
    grouped.set(groupKey, group)
  }
  return grouped
}

function addSheet(wb: XLSX.WorkBook, name: string, rows: Record<string, any>[]) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Message: 'No data available yet' }])
  ws['!cols'] = Object.keys(rows[0] || { Message: '' }).map((key) => ({ wch: Math.max(14, Math.min(36, key.length + 8)) }))
  XLSX.utils.book_append_sheet(wb, ws, name)
}

function normalizeStatus(status: string) {
  if (status === 'active') return 'Running'
  if (status === 'at_risk') return 'Running - At Risk'
  return status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildTopperRows(attempts: any[], attendance: any[], settings: Record<string, any>, projectEvaluations: any[]) {
  const assessmentWeight = Number(settings.topper_assessment_weight || 70)
  const projectWeight = Number(settings.topper_project_weight || 30)
  const minAttendance = Number(settings.topper_min_attendance || 75)
  const byUser = new Map<string, any>()
  for (const attempt of attempts) {
    const current = byUser.get(attempt.user_id) || {
      profile: attempt.profiles,
      scores: [],
      points: 0,
      time: 0,
    }
    current.scores.push(Number(attempt.score || 0))
    current.points += Number(attempt.points_earned || 0)
    current.time += Number(attempt.time_taken_seconds || 0)
    byUser.set(attempt.user_id, current)
  }

  const attendanceByUser = new Map<string, { total: number; positive: number }>()
  for (const entry of attendance) {
    const current = attendanceByUser.get(entry.user_id) || { total: 0, positive: 0 }
    current.total += 1
    if (entry.status === 'present' || entry.status === 'late') current.positive += 1
    attendanceByUser.set(entry.user_id, current)
  }

  return Array.from(byUser.entries())
    .map(([userId, item]) => {
      const attendanceStats = attendanceByUser.get(userId)
      const attendanceRate = attendanceStats?.total ? Math.round((attendanceStats.positive / attendanceStats.total) * 100) : 0
      const averageScore = item.scores.length ? Math.round(item.scores.reduce((sum: number, score: number) => sum + score, 0) / item.scores.length) : 0
      const projectScores = projectEvaluations.filter((item: any) => item.user_id === userId).map((item: any) => Number(item.score || 0))
      const projectScore = projectScores.length ? Math.round(projectScores.reduce((sum: number, score: number) => sum + score, 0) / projectScores.length) : 0
      const topperScore = Math.round(((averageScore * assessmentWeight) + (projectScore * projectWeight)) / Math.max(1, assessmentWeight + projectWeight))
      return {
        'Candidate Name': item.profile?.full_name || 'Unknown',
        'Email': item.profile?.email || '',
        'Employee ID': item.profile?.employee_id || 'N/A',
        'Average Assessment Score': averageScore,
        'Average Project Score': projectScore,
        'Attendance (%)': attendanceRate,
        'Eligible': attendanceRate >= minAttendance ? 'Yes' : 'Attendance below threshold',
        'Transparent Topper Score': topperScore,
        'Attempts': item.scores.length,
        'Points': item.points,
      }
    })
    .sort((a, b) => b['Transparent Topper Score'] - a['Transparent Topper Score'])
}
