import { createReportDbClient, createServiceDbClient } from '@/lib/backend/database/supabase'
import type { TrainingOpsDataset, TrainingOpsPdfSummary } from '@/lib/backend/entities/training-report.entity'

export async function fetchTrainingOpsDataset(userId: string): Promise<{ data?: TrainingOpsDataset; error?: string }> {
  const dataClient: any = await createReportDbClient()
  const { data: batches, error: batchError } = await dataClient
    .from('training_batches')
    .select(`
      *,
      trainer:trainer_id(full_name, email),
      coordinator:coordinator_id(full_name, email)
    `)
    .or(`created_by.eq.${userId},coordinator_id.eq.${userId},trainer_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (batchError) return { error: batchError.message }

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
  const [attendanceRes, uploadsRes, settingsRes, attemptsRes, projectRes, assessmentSetupRes, automationRes] =
    await Promise.all([
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
      dataClient.from('training_system_settings').select('key, value'),
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
        ? dataClient.from('training_assessment_setups').select('*').in('batch_id', batchIds)
        : Promise.resolve({ data: [] }),
      batchIds.length
        ? dataClient.from('training_automation_runs').select('*').in('batch_id', batchIds)
        : Promise.resolve({ data: [] }),
    ])

  const notifications = notificationsRes.data || []
  const notificationIds = notifications.map((item: any) => item.id).filter(Boolean)
  const notificationDispatchRes = notificationIds.length
    ? await dataClient
        .from('training_notification_dispatch_log')
        .select('*')
        .in('notification_id', notificationIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  return {
    data: {
      batches: batches || [],
      members: membersRes.data || [],
      sessions,
      attendance: attendanceRes.data || [],
      uploads: uploadsRes.data || [],
      notifications,
      notificationDispatchLogs: notificationDispatchRes.data || [],
      feedback: feedbackRes.data || [],
      quizzes: quizzesRes.data || [],
      settings: Object.fromEntries((settingsRes.data || []).map((item: any) => [item.key, item.value])),
      attempts: attemptsRes.data || [],
      projectEvaluations: projectRes.data || [],
      assessmentSetups: assessmentSetupRes.data || [],
      automationRuns: automationRes.data || [],
    },
  }
}

export async function fetchTrainingOpsPdfSummary(userId: string): Promise<TrainingOpsPdfSummary> {
  const admin = createServiceDbClient()
  const { data: batches } = await admin
    .from('training_batches')
    .select('id, title, status, start_date, end_date, batch_members(count), training_sessions(count), trainer:trainer_id(full_name, email)')
    .or(`created_by.eq.${userId},coordinator_id.eq.${userId},trainer_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(12)

  const batchIds = (batches || []).map((batch: any) => batch.id)
  const [feedbackRes, projectRes, automationRes, notificationsRes] = await Promise.all([
    batchIds.length ? admin.from('training_feedback').select('id, batch_id').in('batch_id', batchIds) : Promise.resolve({ data: [] }),
    batchIds.length ? admin.from('training_project_evaluations').select('id, batch_id').in('batch_id', batchIds) : Promise.resolve({ data: [] }),
    batchIds.length ? admin.from('training_automation_runs').select('id, batch_id, notifications_created').in('batch_id', batchIds) : Promise.resolve({ data: [] }),
    batchIds.length ? admin.from('training_notifications').select('id, batch_id, delivery_status').in('batch_id', batchIds) : Promise.resolve({ data: [] }),
  ])

  const notificationIds = (notificationsRes.data || []).map((item: any) => item.id).filter(Boolean)
  const dispatchRes = notificationIds.length
    ? await admin.from('training_notification_dispatch_log').select('provider_status').in('notification_id', notificationIds)
    : { data: [] }

  return {
    batches: batches || [],
    feedback: feedbackRes.data || [],
    projectEvaluations: projectRes.data || [],
    automationRuns: automationRes.data || [],
    notifications: notificationsRes.data || [],
    dispatchLogs: dispatchRes.data || [],
  }
}
