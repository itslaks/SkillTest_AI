'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEmployee, requireManager } from '@/lib/rbac'
import type {
  ApiResponse,
  AttendanceStatus,
  FeedbackSentiment,
  NotificationAudience,
  NotificationChannel,
  SessionMode,
  SessionStatus,
  TrainingBatchStatus,
} from '@/lib/types/database'

function asOptionalString(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asRequiredString(value: FormDataEntryValue | null, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function asBoolean(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true'
}

function parseIds(values: FormDataEntryValue[]) {
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
}

export async function getTrainingOpsManagerData() {
  const { userId } = await requireManager()
  const admin = createAdminClient()

  const [batchesRes, sessionsRes, trainersRes, employeesRes, notificationsRes, feedbackRes] = await Promise.all([
    admin
      .from('training_batches')
      .select(`
        *,
        trainer:trainer_id(id, full_name, email),
        coordinator:coordinator_id(id, full_name, email),
        batch_members(count),
        training_sessions(count)
      `)
      .eq('created_by', userId)
      .order('created_at', { ascending: false }),
    admin
      .from('training_sessions')
      .select(`
        *,
        batch:batch_id(id, title, domain, status),
        trainer:trainer_id(id, full_name, email)
      `)
      .order('session_date', { ascending: true }),
    admin
      .from('profiles')
      .select('id, full_name, email, role, domain, department')
      .in('role', ['manager', 'admin'])
      .order('full_name', { ascending: true }),
    admin
      .from('profiles')
      .select('id, full_name, email, domain, department, employee_id')
      .eq('role', 'employee')
      .order('full_name', { ascending: true }),
    admin
      .from('training_notifications')
      .select(`
        *,
        batch:batch_id(id, title),
        session:session_id(id, title, session_date),
        recipient:recipient_user_id(id, full_name, email)
      `)
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(12),
    admin
      .from('training_feedback')
      .select(`
        *,
        batch:batch_id(id, title),
        session:session_id(id, title, session_date),
        trainee:user_id(id, full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  const batches = batchesRes.data || []
  const sessions = sessionsRes.data || []
  const trainers = trainersRes.data || []
  const employees = employeesRes.data || []
  const notifications = notificationsRes.data || []
  const feedback = feedbackRes.data || []

  const batchIds = batches.map((batch: any) => batch.id)
  const sessionIds = sessions.map((session: any) => session.id)

  const [membersRes, attendanceRes, quizzesRes] = await Promise.all([
    batchIds.length
      ? admin
          .from('batch_members')
          .select(`
            *,
            batch:batch_id(id, title),
            profile:user_id(id, full_name, email, domain, department, employee_id)
          `)
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
    sessionIds.length
      ? admin
          .from('session_attendance')
          .select(`
            *,
            session:session_id(id, title, session_date, batch_id),
            profile:user_id(id, full_name, email)
          `)
          .in('session_id', sessionIds)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('quizzes')
          .select('id, title, topic, difficulty, batch_id, is_active')
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
  ])

  const members = membersRes.data || []
  const attendance = attendanceRes.data || []
  const quizzes = quizzesRes.data || []

  const totalAttendance = attendance.length
  const positiveAttendance = attendance.filter((entry: any) => entry.status === 'present' || entry.status === 'late').length
  const attendanceRate = totalAttendance > 0 ? Math.round((positiveAttendance / totalAttendance) * 100) : 0

  const summary = {
    totalBatches: batches.length,
    activeBatches: batches.filter((batch: any) => batch.status === 'active').length,
    upcomingSessions: sessions.filter((session: any) => session.status === 'scheduled').length,
    attendanceRate,
    notificationsSent: notifications.filter((item: any) => item.delivery_status === 'sent').length,
    negativeFeedbackCount: feedback.filter((item: any) => item.sentiment === 'negative').length,
  }

  return {
    summary,
    batches,
    sessions,
    trainers,
    employees,
    members,
    attendance,
    notifications,
    feedback,
    quizzes,
  }
}

export async function getEmployeeTrainingData() {
  const { userId } = await requireEmployee()
  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('batch_members')
    .select(`
      *,
      batch:batch_id(*,
        trainer:trainer_id(id, full_name, email),
        coordinator:coordinator_id(id, full_name, email)
      )
    `)
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })

  const batchIds = (memberships || []).map((membership: any) => membership.batch_id)

  const [sessionsRes, attendanceRes, notificationsRes, feedbackRes, quizzesRes] = await Promise.all([
    batchIds.length
      ? admin
          .from('training_sessions')
          .select(`
            *,
            batch:batch_id(id, title, domain, status),
            trainer:trainer_id(id, full_name, email)
          `)
          .in('batch_id', batchIds)
          .order('session_date', { ascending: true })
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('session_attendance')
          .select(`
            *,
            session:session_id(id, title, session_date, batch_id)
          `)
          .eq('user_id', userId)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('training_notifications')
          .select(`
            *,
            batch:batch_id(id, title),
            session:session_id(id, title, session_date)
          `)
          .or(`recipient_user_id.eq.${userId},batch_id.in.(${batchIds.join(',')})`)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('training_feedback')
          .select(`
            *,
            batch:batch_id(id, title),
            session:session_id(id, title, session_date)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('quizzes')
          .select('id, title, topic, difficulty, batch_id, is_active')
          .in('batch_id', batchIds)
          .eq('is_active', true)
      : Promise.resolve({ data: [] }),
  ])

  const sessions = sessionsRes.data || []
  const attendance = attendanceRes.data || []
  const notifications = notificationsRes.data || []
  const feedback = feedbackRes.data || []
  const quizzes = quizzesRes.data || []

  const nextSession = sessions.find((session: any) => session.status === 'scheduled')
  const attendanceRate = attendance.length
    ? Math.round((attendance.filter((entry: any) => entry.status === 'present' || entry.status === 'late').length / attendance.length) * 100)
    : 0

  return {
    memberships: memberships || [],
    sessions,
    nextSession,
    attendance,
    attendanceRate,
    notifications,
    feedback,
    quizzes,
  }
}

export async function createTrainingBatch(formData: FormData): Promise<ApiResponse<{ id: string }>> {
  const { userId } = await requireManager()
  const admin = createAdminClient()

  const title = asRequiredString(formData.get('title'))
  const description = asOptionalString(formData.get('description'))
  const domain = asOptionalString(formData.get('domain'))
  const status = (asRequiredString(formData.get('status'), 'planned') || 'planned') as TrainingBatchStatus
  const startDate = asOptionalString(formData.get('start_date'))
  const endDate = asOptionalString(formData.get('end_date'))
  const trainerId = asOptionalString(formData.get('trainer_id'))
  const employeeIds = parseIds(formData.getAll('employee_ids'))
  const quizIds = parseIds(formData.getAll('quiz_ids'))

  if (!title) {
    return { error: 'Batch title is required.' }
  }

  const { data: batch, error } = await admin
    .from('training_batches')
    .insert({
      title,
      description,
      domain,
      status,
      start_date: startDate,
      end_date: endDate,
      trainer_id: trainerId,
      coordinator_id: userId,
      created_by: userId,
    })
    .select('id')
    .single()

  if (error || !batch) {
    return { error: error?.message || 'Unable to create training batch.' }
  }

  if (employeeIds.length > 0) {
    const memberRows = employeeIds.map((employeeId) => ({
      batch_id: batch.id,
      user_id: employeeId,
      enrollment_status: 'active',
      support_status: 'on_track',
    }))

    await admin.from('batch_members').upsert(memberRows, { onConflict: 'batch_id,user_id' })
  }

  if (quizIds.length > 0) {
    await admin
      .from('quizzes')
      .update({ batch_id: batch.id })
      .in('id', quizIds)
      .eq('created_by', userId)
  }

  await admin.from('training_notifications').insert({
    batch_id: batch.id,
    title: `Batch created: ${title}`,
    message: `A new training batch has been created with ${employeeIds.length} learner(s) and ${quizIds.length} linked assessment(s).`,
    audience: 'coordinators',
    channel: 'in_app',
    delivery_status: 'sent',
    sent_at: new Date().toISOString(),
    created_by: userId,
  })

  revalidatePath('/manager')
  revalidatePath('/manager/operations')
  revalidatePath('/manager/quizzes')
  revalidatePath('/employee')
  revalidatePath('/employee/training')

  return { data: { id: batch.id } }
}

export async function createTrainingSession(formData: FormData): Promise<ApiResponse<{ id: string }>> {
  const { userId } = await requireManager()
  const admin = createAdminClient()

  const batchId = asRequiredString(formData.get('batch_id'))
  const title = asRequiredString(formData.get('title'))
  const agenda = asOptionalString(formData.get('agenda'))
  const trainerId = asOptionalString(formData.get('trainer_id'))
  const sessionDate = asRequiredString(formData.get('session_date'))
  const mode = (asRequiredString(formData.get('mode'), 'virtual') || 'virtual') as SessionMode
  const status = (asRequiredString(formData.get('status'), 'scheduled') || 'scheduled') as SessionStatus
  const attendanceRequired = asBoolean(formData.get('attendance_required'))

  if (!batchId || !title || !sessionDate) {
    return { error: 'Batch, title, and session date are required.' }
  }

  const { data: session, error } = await admin
    .from('training_sessions')
    .insert({
      batch_id: batchId,
      trainer_id: trainerId,
      title,
      agenda,
      session_date: sessionDate,
      mode,
      status,
      attendance_required: attendanceRequired,
      created_by: userId,
    })
    .select('id')
    .single()

  if (error || !session) {
    return { error: error?.message || 'Unable to create session.' }
  }

  const { data: members } = await admin
    .from('batch_members')
    .select('user_id')
    .eq('batch_id', batchId)

  if (members && members.length > 0) {
    const attendanceRows = members.map((member) => ({
      session_id: session.id,
      user_id: member.user_id,
      status: 'absent',
      updated_by: userId,
    }))

    await admin.from('session_attendance').upsert(attendanceRows, { onConflict: 'session_id,user_id' })
  }

  await admin.from('training_notifications').insert({
    batch_id: batchId,
    session_id: session.id,
    title: `New session scheduled: ${title}`,
    message: `A ${mode} session has been scheduled for ${new Date(sessionDate).toLocaleString()}.`,
    audience: 'batch',
    channel: 'in_app',
    delivery_status: 'sent',
    sent_at: new Date().toISOString(),
    created_by: userId,
  })

  revalidatePath('/manager')
  revalidatePath('/manager/operations')
  revalidatePath('/employee')
  revalidatePath('/employee/training')

  return { data: { id: session.id } }
}

export async function updateAttendanceStatus(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId } = await requireManager()
  const admin = createAdminClient()

  const sessionId = asRequiredString(formData.get('session_id'))
  const userTargetId = asRequiredString(formData.get('user_id'))
  const status = asRequiredString(formData.get('status')) as AttendanceStatus
  const notes = asOptionalString(formData.get('notes'))

  if (!sessionId || !userTargetId || !status) {
    return { error: 'Session, learner, and status are required.' }
  }

  const payload = {
    session_id: sessionId,
    user_id: userTargetId,
    status,
    notes,
    updated_by: userId,
    check_in_time: status === 'present' || status === 'late' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await admin
    .from('session_attendance')
    .upsert(payload, { onConflict: 'session_id,user_id' })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/manager/operations')
  revalidatePath('/employee/training')
  return { data: true }
}

export async function createTrainingNotification(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId } = await requireManager()
  const admin = createAdminClient()

  const batchId = asOptionalString(formData.get('batch_id'))
  const sessionId = asOptionalString(formData.get('session_id'))
  const recipientUserId = asOptionalString(formData.get('recipient_user_id'))
  const title = asRequiredString(formData.get('title'))
  const message = asRequiredString(formData.get('message'))
  const audience = (asRequiredString(formData.get('audience'), 'batch') || 'batch') as NotificationAudience
  const channel = (asRequiredString(formData.get('channel'), 'in_app') || 'in_app') as NotificationChannel
  const scheduledFor = asOptionalString(formData.get('scheduled_for'))

  if (!title || !message) {
    return { error: 'Notification title and message are required.' }
  }

  const deliveryStatus = scheduledFor ? 'scheduled' : 'sent'
  const { error } = await admin.from('training_notifications').insert({
    batch_id: batchId,
    session_id: sessionId,
    recipient_user_id: recipientUserId,
    title,
    message,
    audience,
    channel,
    scheduled_for: scheduledFor,
    delivery_status: deliveryStatus,
    sent_at: deliveryStatus === 'sent' ? new Date().toISOString() : null,
    created_by: userId,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/manager')
  revalidatePath('/manager/operations')
  revalidatePath('/employee')
  revalidatePath('/employee/training')
  return { data: true }
}

export async function submitTrainingFeedback(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId } = await requireEmployee()
  const admin = createAdminClient()

  const batchId = asOptionalString(formData.get('batch_id'))
  const sessionId = asOptionalString(formData.get('session_id'))
  const rating = Number(asRequiredString(formData.get('rating'), '0'))
  const feedbackText = asRequiredString(formData.get('feedback_text'))
  const actionItem = asOptionalString(formData.get('action_item'))

  if (!feedbackText || !rating) {
    return { error: 'Rating and feedback are required.' }
  }

  let sentiment: FeedbackSentiment = 'neutral'
  if (rating >= 4) sentiment = 'positive'
  if (rating <= 2) sentiment = 'negative'

  const { error } = await admin.from('training_feedback').insert({
    batch_id: batchId,
    session_id: sessionId,
    user_id: userId,
    submitted_by: userId,
    rating,
    sentiment,
    feedback_text: feedbackText,
    action_item: actionItem,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/manager')
  revalidatePath('/manager/operations')
  revalidatePath('/employee/training')
  return { data: true }
}
