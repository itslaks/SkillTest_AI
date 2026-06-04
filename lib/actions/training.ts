'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEmployee, requireManager, requireTrainingStaff } from '@/lib/rbac'
import {
  sendEmail,
  buildAttendanceCutoffEmail,
  buildAbsenceStreakEmail,
  buildAssessmentReminderEmail,
  buildFeedbackRequestEmail,
} from '@/lib/email'
import type {
  ApiResponse,
  AttendanceStatus,
  FeedbackSentiment,
  NotificationAudience,
  NotificationChannel,
  SessionMode,
  SessionStatus,
  TrainingAssessmentType,
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

function normalizeBatchStatus(status: string): TrainingBatchStatus {
  if (status === 'active') return 'running'
  if (status === 'at_risk') return 'running'
  if (status === 'closed') return 'closed'
  if (status === 'completed') return 'completed'
  return 'planned'
}

function isBatchRunning(status: string) {
  return status === 'running' || status === 'active' || status === 'at_risk'
}

const BATCH_STATUS_FLOW: Record<TrainingBatchStatus, TrainingBatchStatus[]> = {
  planned: ['running'],
  running: ['completed'],
  completed: ['closed'],
  closed: [],
  active: ['completed'],
  at_risk: ['completed'],
}

const DEFAULT_GOVERNANCE_SETTINGS = {
  attendanceCutoffTime: '10:00',
  absenceAlertDays: 3,
  topperAssessmentWeight: 70,
  topperProjectWeight: 30,
  topperMinAttendance: 75,
  feedbackWindowDays: 5,
}

function settingNumber(value: unknown, fallback: number) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

async function readGovernanceSettings(admin = createAdminClient()) {
  const { data } = await admin
    .from('training_system_settings')
    .select('key, value')
    .in('key', [
      'attendance_cutoff_time',
      'absence_alert_days',
      'topper_assessment_weight',
      'topper_project_weight',
      'topper_min_attendance',
      'feedback_window_days',
    ])

  const map = new Map((data || []).map((item: any) => [item.key, item.value]))
  return {
    attendanceCutoffTime: String(map.get('attendance_cutoff_time') || DEFAULT_GOVERNANCE_SETTINGS.attendanceCutoffTime),
    absenceAlertDays: settingNumber(map.get('absence_alert_days'), DEFAULT_GOVERNANCE_SETTINGS.absenceAlertDays),
    topperAssessmentWeight: settingNumber(map.get('topper_assessment_weight'), DEFAULT_GOVERNANCE_SETTINGS.topperAssessmentWeight),
    topperProjectWeight: settingNumber(map.get('topper_project_weight'), DEFAULT_GOVERNANCE_SETTINGS.topperProjectWeight),
    topperMinAttendance: settingNumber(map.get('topper_min_attendance'), DEFAULT_GOVERNANCE_SETTINGS.topperMinAttendance),
    feedbackWindowDays: settingNumber(map.get('feedback_window_days'), DEFAULT_GOVERNANCE_SETTINGS.feedbackWindowDays),
  }
}

function attendanceCutoffForTime(date: Date, cutoffTime: string) {
  const [hoursRaw, minutesRaw] = cutoffTime.split(':')
  const cutoff = new Date(date)
  cutoff.setHours(Number(hoursRaw) || 10, Number(minutesRaw) || 0, 0, 0)
  return cutoff
}

function canTransitionBatchStatus(previous: string | null | undefined, next: TrainingBatchStatus) {
  const current = normalizeBatchStatus(previous || 'planned')
  return current === next || BATCH_STATUS_FLOW[current]?.includes(next)
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File && value.size > 0
}

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 120)
}

async function uploadTrainingDocument(admin: ReturnType<typeof createAdminClient>, file: File, folder: string) {
  const bucket = 'training-evidence'
  await admin.storage.createBucket(bucket, { public: false }).catch(() => null)
  const path = `${folder}/${crypto.randomUUID()}-${cleanFileName(file.name)}`
  const { error } = await admin.storage.from(bucket).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return `${bucket}/${path}`
}

async function resolveAutomationActor(admin: ReturnType<typeof createAdminClient>, triggeredBy: string | null) {
  if (triggeredBy) return triggeredBy
  const { data } = await admin
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'manager', 'training_coordinator'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.id || null
}

async function finalizeEmailNotification(
  admin: ReturnType<typeof createAdminClient>,
  notificationId: string | undefined | null,
  sendAttempts: number,
  sendFailures: number
) {
  if (!notificationId) return
  const deliveryStatus = sendAttempts === 0 ? 'logged' : sendFailures > 0 ? 'failed' : 'sent'
  await admin
    .from('training_notifications')
    .update({
      delivery_status: deliveryStatus,
      sent_at: deliveryStatus === 'sent' ? new Date().toISOString() : null,
    })
    .eq('id', notificationId)
}

export async function getTrainingOpsManagerData() {
  const { userId, role } = await requireTrainingStaff()
  const admin = createAdminClient()

  const { data: trainerAssignments } = await admin
    .from('training_batch_trainers')
    .select('batch_id')
    .eq('trainer_id', userId)
  const assignedBatchIds = (trainerAssignments || []).map((item: any) => item.batch_id)

  let batchQuery = admin
    .from('training_batches')
    .select(`
      *,
      trainer:trainer_id(id, full_name, email),
      coordinator:coordinator_id(id, full_name, email),
      batch_members(count),
      training_sessions(count)
    `)
    .order('created_at', { ascending: false })

  if (role === 'admin') {
    // Admin sees the full TMS estate.
  } else if (role === 'trainer') {
    const filters = [`trainer_id.eq.${userId}`]
    if (assignedBatchIds.length) filters.push(`id.in.(${assignedBatchIds.join(',')})`)
    batchQuery = batchQuery.or(filters.join(','))
  } else {
    const filters = [`created_by.eq.${userId}`, `coordinator_id.eq.${userId}`, `trainer_id.eq.${userId}`]
    if (assignedBatchIds.length) filters.push(`id.in.(${assignedBatchIds.join(',')})`)
    batchQuery = batchQuery.or(filters.join(','))
  }

  const [batchesRes, trainersRes, employeesRes] = await Promise.all([
    batchQuery,
    admin
      .from('profiles')
      .select('id, full_name, email, role, domain, department')
      .in('role', ['trainer', 'training_coordinator', 'manager', 'admin'])
      .order('full_name', { ascending: true }),
    admin
      .from('profiles')
      .select('id, full_name, email, domain, department, employee_id')
      .eq('role', 'employee')
      .order('full_name', { ascending: true }),
  ])

  const batches = batchesRes.data || []
  const trainers = trainersRes.data || []
  const employees = employeesRes.data || []
  const governanceSettings = await readGovernanceSettings(admin)

  const batchIds = batches.map((batch: any) => batch.id)

  const [membersRes, sessionsRes, notificationsRes, feedbackRes, quizzesRes, batchTrainersRes, assessmentSetupsRes, projectEvaluationsRes, automationRunsRes, attendanceVersionsRes, assessmentUploadsRes, batchChangeAuditRes] = await Promise.all([
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
          .from('training_notifications')
          .select(`
            *,
            batch:batch_id(id, title),
            session:session_id(id, title, session_date),
            recipient:recipient_user_id(id, full_name, email)
          `)
          .in('batch_id', batchIds)
          .order('created_at', { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('training_feedback')
          .select(`
            *,
            batch:batch_id(id, title),
            session:session_id(id, title, session_date),
            trainee:user_id(id, full_name, email)
          `)
          .in('batch_id', batchIds)
          .order('created_at', { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('quizzes')
          .select('id, title, topic, difficulty, batch_id, is_active')
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('training_batch_trainers')
          .select('*, trainer:trainer_id(id, full_name, email)')
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('training_assessment_setups')
          .select('*')
          .in('batch_id', batchIds)
          .order('scheduled_at', { ascending: true })
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('training_project_evaluations')
          .select('*, trainee:user_id(id, full_name, email), evaluator:evaluator_id(id, full_name, email)')
          .in('batch_id', batchIds)
          .order('created_at', { ascending: false })
          .limit(25)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('training_automation_runs')
          .select('*')
          .in('batch_id', batchIds)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('session_attendance_versions')
          .select('*, profile:user_id(id, full_name, email), changer:changed_by(id, full_name, email), session:session_id(id, title, batch_id)')
          .order('changed_at', { ascending: false })
          .limit(25)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('training_assessment_uploads')
          .select('*')
          .in('batch_id', batchIds)
          .order('created_at', { ascending: false })
          .limit(25)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('training_batch_change_audit')
          .select('*, batch:batch_id(id, title), changer:changed_by(id, full_name, email)')
          .in('batch_id', batchIds)
          .order('changed_at', { ascending: false })
          .limit(25)
      : Promise.resolve({ data: [] }),
  ])

  const members = membersRes.data || []
  const sessions = sessionsRes.data || []
  const notifications = notificationsRes.data || []
  const feedback = feedbackRes.data || []
  const quizzes = quizzesRes.data || []
  const batchTrainers = batchTrainersRes.data || []
  const assessmentSetups = assessmentSetupsRes.data || []
  const projectEvaluations = projectEvaluationsRes.data || []
  const automationRuns = automationRunsRes.data || []
  const attendanceVersions = attendanceVersionsRes.data || []
  const assessmentUploads = assessmentUploadsRes.data || []
  const batchChangeAudit = batchChangeAuditRes.data || []
  const notificationIds = notifications.map((notification: any) => notification.id).filter(Boolean)
  const notificationDispatchLogsRes = notificationIds.length
    ? await admin
        .from('training_notification_dispatch_log')
        .select('*')
        .in('notification_id', notificationIds)
        .order('created_at', { ascending: false })
        .limit(30)
    : { data: [] }
  const notificationDispatchLogs = notificationDispatchLogsRes.data || []
  const sessionIds = sessions.map((session: any) => session.id)
  const attendanceRes = sessionIds.length
    ? await admin
        .from('session_attendance')
        .select(`
          *,
          session:session_id(id, title, session_date, batch_id),
          profile:user_id(id, full_name, email)
        `)
        .in('session_id', sessionIds)
    : { data: [] }
  const attendance = attendanceRes.data || []

  const totalAttendance = attendance.length
  const positiveAttendance = attendance.filter((entry: any) => entry.status === 'present' || entry.status === 'late').length
  const attendanceRate = totalAttendance > 0 ? Math.round((positiveAttendance / totalAttendance) * 100) : 0
  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  const now = new Date()
  const attendanceDueToday = sessions.filter((session: any) => {
    if (!session.attendance_required || session.status === 'cancelled') return false
    const sessionDate = new Date(session.session_date)
    if (sessionDate.toISOString().slice(0, 10) !== todayKey) return false
    if (now < attendanceCutoffForTime(sessionDate, governanceSettings.attendanceCutoffTime)) return false
    const records = attendance.filter((entry: any) => entry.session_id === session.id)
    return records.length === 0 || records.every((entry: any) => entry.status === 'absent' && !entry.check_in_time)
  }).length

  const sessionsByBatch = new Map<string, any[]>()
  for (const session of sessions) {
    const items = sessionsByBatch.get(session.batch_id) || []
    items.push(session)
    sessionsByBatch.set(session.batch_id, items)
  }

  const attendanceBySessionUser = new Map<string, any>()
  for (const entry of attendance) {
    attendanceBySessionUser.set(`${entry.session_id}:${entry.user_id}`, entry)
  }

  let absenceAlerts = 0
  for (const member of members) {
    const batchSessions = (sessionsByBatch.get(member.batch_id) || [])
      .filter((session: any) => session.attendance_required && session.status !== 'cancelled')
      .sort((a: any, b: any) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
      .slice(0, governanceSettings.absenceAlertDays)
    if (batchSessions.length < governanceSettings.absenceAlertDays) continue
    const absentThreeDays = batchSessions.every((session: any) => {
      const entry = attendanceBySessionUser.get(`${session.id}:${member.user_id}`)
      return !entry || entry.status === 'absent'
    })
    if (absentThreeDays) absenceAlerts++
  }

  const summary = {
    totalBatches: batches.length,
    activeBatches: batches.filter((batch: any) => isBatchRunning(batch.status)).length,
    atRiskBatches: batches.filter((batch: any) => batch.status === 'at_risk').length,
    totalCandidates: members.length,
    discontinuedCandidates: members.filter((member: any) => member.enrollment_status === 'discontinued' || member.enrollment_status === 'dropped').length,
    notClearedCandidates: members.filter((member: any) => member.enrollment_status === 'not_cleared').length,
    offeredCandidates: members.filter((member: any) => member.enrollment_status === 'offered').length,
    onboardedCandidates: members.filter((member: any) => member.enrollment_status === 'onboarded' || member.enrollment_status === 'active').length,
    remainingCandidates: members.filter((member: any) => ['invited', 'active', 'onboarded'].includes(member.enrollment_status)).length,
    upcomingSessions: sessions.filter((session: any) => session.status === 'scheduled').length,
    attendanceRate,
    attendanceDueToday,
    absenceAlerts,
    notificationsSent: notifications.filter((item: any) => item.delivery_status === 'sent').length,
    negativeFeedbackCount: feedback.filter((item: any) => item.sentiment === 'negative').length,
    assessmentSetups: assessmentSetups.length,
    projectEvaluations: projectEvaluations.length,
    automationRuns: automationRuns.length,
  }

  return {
    role,
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
    batchTrainers,
    assessmentSetups,
    projectEvaluations,
    automationRuns,
    attendanceVersions,
    assessmentUploads,
    batchChangeAudit,
    notificationDispatchLogs,
    governanceSettings,
  }
}

export async function getTrainingGovernanceSettings() {
  await requireManager()
  const admin = createAdminClient()
  return readGovernanceSettings(admin)
}

export async function updateTrainingGovernanceSettings(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId } = await requireManager()
  const admin = createAdminClient()

  const cutoff = asRequiredString(formData.get('attendance_cutoff_time'), DEFAULT_GOVERNANCE_SETTINGS.attendanceCutoffTime)
  const absenceDays = Math.max(1, Number(asRequiredString(formData.get('absence_alert_days'), String(DEFAULT_GOVERNANCE_SETTINGS.absenceAlertDays))) || DEFAULT_GOVERNANCE_SETTINGS.absenceAlertDays)
  const assessmentWeight = Math.max(0, Number(asRequiredString(formData.get('topper_assessment_weight'), String(DEFAULT_GOVERNANCE_SETTINGS.topperAssessmentWeight))) || DEFAULT_GOVERNANCE_SETTINGS.topperAssessmentWeight)
  const projectWeight = Math.max(0, Number(asRequiredString(formData.get('topper_project_weight'), String(DEFAULT_GOVERNANCE_SETTINGS.topperProjectWeight))) || DEFAULT_GOVERNANCE_SETTINGS.topperProjectWeight)
  const minAttendance = Math.max(0, Number(asRequiredString(formData.get('topper_min_attendance'), String(DEFAULT_GOVERNANCE_SETTINGS.topperMinAttendance))) || DEFAULT_GOVERNANCE_SETTINGS.topperMinAttendance)
  const feedbackDays = Math.max(1, Number(asRequiredString(formData.get('feedback_window_days'), String(DEFAULT_GOVERNANCE_SETTINGS.feedbackWindowDays))) || DEFAULT_GOVERNANCE_SETTINGS.feedbackWindowDays)

  const rows = [
    { key: 'attendance_cutoff_time', value: cutoff, updated_by: userId, updated_at: new Date().toISOString() },
    { key: 'absence_alert_days', value: absenceDays, updated_by: userId, updated_at: new Date().toISOString() },
    { key: 'topper_assessment_weight', value: assessmentWeight, updated_by: userId, updated_at: new Date().toISOString() },
    { key: 'topper_project_weight', value: projectWeight, updated_by: userId, updated_at: new Date().toISOString() },
    { key: 'topper_min_attendance', value: minAttendance, updated_by: userId, updated_at: new Date().toISOString() },
    { key: 'feedback_window_days', value: feedbackDays, updated_by: userId, updated_at: new Date().toISOString() },
  ]

  const { error } = await admin.from('training_system_settings').upsert(rows, { onConflict: 'key' })
  if (error) return { error: error.message }

  revalidatePath('/manager/settings')
  revalidatePath('/manager/operations')
  return { data: true }
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

  const [sessionsRes, attendanceRes, notificationsRes, feedbackRes, quizzesRes, feedbackWindowsRes] = await Promise.all([
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
    batchIds.length
      ? admin
          .from('training_feedback_windows')
          .select('id, batch_id, session_id, title, opens_at, closes_at, status, batch:batch_id(id, title)')
          .in('batch_id', batchIds)
          .eq('status', 'open')
          .lte('opens_at', new Date().toISOString())
          .gte('closes_at', new Date().toISOString())
          .order('closes_at', { ascending: true })
      : Promise.resolve({ data: [] }),
  ])

  const sessions = sessionsRes.data || []
  const attendance = attendanceRes.data || []
  const notifications = notificationsRes.data || []
  const feedback = feedbackRes.data || []
  const quizzes = quizzesRes.data || []
  const feedbackWindows = feedbackWindowsRes.data || []

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
    feedbackWindows,
    quizzes,
  }
}

export async function createTrainingBatch(formData: FormData): Promise<ApiResponse<{ id: string }>> {
  const { userId } = await requireManager()
  const admin = createAdminClient()

  const title = asRequiredString(formData.get('title'))
  const description = asOptionalString(formData.get('description'))
  const domain = asOptionalString(formData.get('domain'))
  const cadence = asOptionalString(formData.get('cadence'))
  const capacity = asOptionalString(formData.get('capacity'))
  const priority = asOptionalString(formData.get('priority'))
  const supportModel = asOptionalString(formData.get('support_model'))
  const timezone = asOptionalString(formData.get('timezone'))
  const status: TrainingBatchStatus = 'planned'
  const startDate = asOptionalString(formData.get('start_date'))
  const endDate = asOptionalString(formData.get('end_date'))
  const trainerId = asOptionalString(formData.get('trainer_id'))
  const trainerIds = Array.from(new Set([trainerId, ...parseIds(formData.getAll('trainer_ids'))].filter(Boolean) as string[]))
  const employeeIds = parseIds(formData.getAll('employee_ids'))
  const quizIds = parseIds(formData.getAll('quiz_ids'))

  if (!title) {
    return { error: 'Batch title is required.' }
  }

  const customDetails = [
    cadence ? `Cadence: ${cadence}` : null,
    capacity ? `Capacity: ${capacity}` : null,
    priority ? `Priority: ${priority}` : null,
    supportModel ? `Support model: ${supportModel}` : null,
    timezone ? `Timezone: ${timezone}` : null,
  ].filter(Boolean)

  const batchDescription = [description, customDetails.length ? customDetails.join(' | ') : null]
    .filter(Boolean)
    .join('\n\n')

  const { data: batch, error } = await admin
    .from('training_batches')
    .insert({
      title,
      description: batchDescription || null,
      domain,
      status,
      start_date: startDate,
      end_date: endDate,
      trainer_id: trainerIds[0] || trainerId,
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

    const { error: memberError } = await admin.from('batch_members').upsert(memberRows, { onConflict: 'batch_id,user_id' })
    if (memberError) return { error: `Batch created, but learner enrollment failed: ${memberError.message}` }
  }

  if (trainerIds.length > 0) {
    const { error: trainerError } = await admin.from('training_batch_trainers').upsert(
      trainerIds.map((id, index) => ({
        batch_id: batch.id,
        trainer_id: id,
        role_label: index === 0 ? 'Lead Trainer' : 'Trainer',
        assigned_by: userId,
      })),
      { onConflict: 'batch_id,trainer_id' }
    )
    if (trainerError) return { error: `Batch created, but trainer assignment failed: ${trainerError.message}` }
  }

  if (quizIds.length > 0) {
    const { error: quizError } = await admin
      .from('quizzes')
      .update({ batch_id: batch.id })
      .in('id', quizIds)
    if (quizError) return { error: `Batch created, but assessment linking failed: ${quizError.message}` }
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

  await admin.from('training_batch_change_audit').insert({
    batch_id: batch.id,
    change_type: 'batch_created',
    previous_value: null,
    new_value: {
      title,
      domain,
      status,
      start_date: startDate,
      end_date: endDate,
      trainer_ids: trainerIds,
      learner_count: employeeIds.length,
      linked_assessment_count: quizIds.length,
    },
    changed_by: userId,
  })

  revalidatePath('/manager')
  revalidatePath('/manager/operations')
  revalidatePath('/manager/quizzes')
  revalidatePath('/employee')
  revalidatePath('/employee/training')

  return { data: { id: batch.id } }
}

export async function updateBatchMemberStatus(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId } = await requireManager()
  const admin = createAdminClient()

  const memberId = asRequiredString(formData.get('member_id'))
  const status = asRequiredString(formData.get('enrollment_status'))

  const validStatuses = ['onboarded', 'active', 'dropped', 'discontinued', 'not_cleared', 'offered']
  if (!validStatuses.includes(status)) {
    return { error: 'Invalid enrollment status' }
  }

  const { data: previous } = await admin
    .from('batch_members')
    .select('*')
    .eq('id', memberId)
    .single()

  const { error } = await admin
    .from('batch_members')
    .update({ 
      enrollment_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', memberId)

  if (error) return { error: error.message }

  await admin.from('training_batch_change_audit').insert({
    batch_id: previous?.batch_id || null,
    change_type: 'batch_member_status_update',
    previous_value: previous || null,
    new_value: {
      member_id: memberId,
      user_id: previous?.user_id || null,
      enrollment_status: status,
    },
    changed_by: userId,
  })

  revalidatePath('/manager')
  revalidatePath('/manager/operations')
  revalidatePath('/manager/reports')

  return { data: true }
}

export async function updateTrainingBatchStatus(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId, role } = await requireManager()
  const admin = createAdminClient()

  const batchId = asRequiredString(formData.get('batch_id'))
  const status = normalizeBatchStatus(asRequiredString(formData.get('status'), 'planned') || 'planned')

  if (!batchId) {
    return { error: 'Batch is required.' }
  }

  const { data: currentBatch } = await admin
    .from('training_batches')
    .select('id, title, status')
    .eq('id', batchId)
    .single()

  if (currentBatch && !canTransitionBatchStatus(currentBatch.status, status)) {
    return { error: `Invalid lifecycle transition: ${normalizeBatchStatus(currentBatch.status)} cannot move directly to ${status}.` }
  }

  let updateQuery = admin
    .from('training_batches')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', batchId)
    .select('id')

  if (role !== 'admin') {
    updateQuery = updateQuery.or(`created_by.eq.${userId},coordinator_id.eq.${userId}`)
  }

  const { data: updatedRows, error } = await updateQuery

  if (error) {
    return { error: error.message }
  }
  if (!updatedRows?.length) {
    return { error: 'You do not have permission to update this batch.' }
  }

  await admin.from('training_notifications').insert({
    batch_id: batchId,
    title: `Batch status changed: ${currentBatch?.title || 'Training batch'}`,
    message: `Lifecycle moved from ${(currentBatch?.status || 'planned').replace('_', ' ')} to ${status}.`,
    audience: 'coordinators',
    channel: 'in_app',
    delivery_status: 'sent',
    sent_at: new Date().toISOString(),
    created_by: userId,
  })

  revalidatePath('/manager')
  revalidatePath('/manager/operations')
  revalidatePath('/employee')
  revalidatePath('/employee/training')
  return { data: true }
}

export async function updateTrainingBatchDetails(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId, role } = await requireManager()
  const admin = createAdminClient()

  const batchId = asRequiredString(formData.get('batch_id'))
  const title = asRequiredString(formData.get('title'))
  const description = asOptionalString(formData.get('description'))
  const domain = asOptionalString(formData.get('domain'))
  const startDate = asOptionalString(formData.get('start_date'))
  const endDate = asOptionalString(formData.get('end_date'))
  const status = normalizeBatchStatus(asRequiredString(formData.get('status'), 'planned') || 'planned')
  const trainerIds = parseIds(formData.getAll('trainer_ids'))

  if (!batchId || !title) {
    return { error: 'Batch and title are required.' }
  }

  const { data: previous } = await admin
    .from('training_batches')
    .select('*')
    .eq('id', batchId)
    .single()

  if (previous && !canTransitionBatchStatus(previous.status, status)) {
    return { error: `Invalid lifecycle transition: ${normalizeBatchStatus(previous.status)} cannot move directly to ${status}.` }
  }

  let updateQuery = admin
    .from('training_batches')
    .update({
      title,
      description,
      domain,
      status,
      start_date: startDate,
      end_date: endDate,
      trainer_id: trainerIds[0] || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId)
    .select('id')

  if (role !== 'admin') {
    updateQuery = updateQuery.or(`created_by.eq.${userId},coordinator_id.eq.${userId}`)
  }

  const { data: updatedRows, error } = await updateQuery

  if (error) return { error: error.message }
  if (!updatedRows?.length) return { error: 'You do not have permission to update this batch.' }

  if (trainerIds.length > 0) {
    await admin.from('training_batch_trainers').delete().eq('batch_id', batchId)
    await admin.from('training_batch_trainers').insert(
      trainerIds.map((trainerId, index) => ({
        batch_id: batchId,
        trainer_id: trainerId,
        role_label: index === 0 ? 'Lead Trainer' : 'Trainer',
        assigned_by: userId,
      }))
    )
  }

  await admin.from('training_batch_change_audit').insert({
    batch_id: batchId,
    change_type: 'batch_details_update',
    previous_value: previous || null,
    new_value: { title, description, domain, status, startDate, endDate, trainerIds },
    changed_by: userId,
  })

  revalidatePath('/manager/operations')
  revalidatePath('/employee/training')
  return { data: true }
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
  const { userId, role } = await requireTrainingStaff()
  const admin = createAdminClient()

  const sessionId = asRequiredString(formData.get('session_id'))
  const userTargetId = asRequiredString(formData.get('user_id'))
  const status = asRequiredString(formData.get('status')) as AttendanceStatus
  const notes = asOptionalString(formData.get('notes'))

  if (!sessionId || !userTargetId || !status) {
    return { error: 'Session, learner, and status are required.' }
  }

  const { data: session } = await admin
    .from('training_sessions')
    .select('id, batch_id, trainer_id, batch:batch_id(created_by, coordinator_id, trainer_id)')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: 'Session not found.' }

  const { data: membership } = await admin
    .from('batch_members')
    .select('id')
    .eq('batch_id', session.batch_id)
    .eq('user_id', userTargetId)
    .maybeSingle()

  if (!membership) {
    return { error: 'Learner is not enrolled in this session batch.' }
  }

  if (role === 'trainer') {
    const { data: assignment } = await admin
      .from('training_batch_trainers')
      .select('id')
      .eq('batch_id', session.batch_id)
      .eq('trainer_id', userId)
      .maybeSingle()
    const isAssigned = session.trainer_id === userId || (session.batch as any)?.trainer_id === userId || Boolean(assignment)
    if (!isAssigned) return { error: 'Trainer access is limited to assigned batches.' }
  }

  const { data: previous } = await admin
    .from('session_attendance')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', userTargetId)
    .maybeSingle()

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

  const { data: current } = await admin
    .from('session_attendance')
    .select('id')
    .eq('session_id', sessionId)
    .eq('user_id', userTargetId)
    .single()

  await admin.from('session_attendance_versions').insert({
    attendance_id: current?.id || previous?.id || null,
    session_id: sessionId,
    user_id: userTargetId,
    previous_status: previous?.status || null,
    new_status: status,
    previous_notes: previous?.notes || null,
    new_notes: notes,
    changed_by: userId,
    source: 'manual',
  })

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

  const deliveryStatus = scheduledFor ? 'scheduled' : channel === 'in_app' ? 'sent' : 'logged'
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

export async function createTrainingAssessmentSetup(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId } = await requireManager()
  const admin = createAdminClient()

  const batchId = asRequiredString(formData.get('batch_id'))
  const title = asRequiredString(formData.get('title'))
  const assessmentType = (asRequiredString(formData.get('assessment_type'), 'sprint_review') || 'sprint_review') as TrainingAssessmentType
  const scheduledAt = asOptionalString(formData.get('scheduled_at'))
  const templateName = asOptionalString(formData.get('template_name'))
  const questionFileInput = formData.get('question_file')
  let questionFileName = asOptionalString(formData.get('question_file_name'))
  const maxScore = Number(asRequiredString(formData.get('max_score'), '100')) || 100
  const passingScore = Number(asRequiredString(formData.get('passing_score'), '70')) || 70

  if (!batchId || !title) return { error: 'Batch and assessment title are required.' }
  if (maxScore <= 0 || passingScore < 0 || passingScore > maxScore) {
    return { error: 'Score ranges are invalid.' }
  }

  if (isUploadFile(questionFileInput)) {
    try {
      questionFileName = await uploadTrainingDocument(admin, questionFileInput, `assessments/${batchId}`)
    } catch (error: any) {
      return { error: `Question file upload failed: ${error.message}` }
    }
  }

  const { error } = await admin.from('training_assessment_setups').insert({
    batch_id: batchId,
    title,
    assessment_type: assessmentType,
    scheduled_at: scheduledAt,
    template_name: templateName,
    question_file_name: questionFileName,
    max_score: maxScore,
    passing_score: passingScore,
    status: 'planned',
    created_by: userId,
  })

  if (error) return { error: error.message }

  await admin.from('training_notifications').insert({
    batch_id: batchId,
    title: `Assessment scheduled: ${title}`,
    message: scheduledAt ? `Assessment is scheduled for ${new Date(scheduledAt).toLocaleString()}.` : 'Assessment setup has been created.',
    audience: 'batch',
    channel: 'email',
    delivery_status: scheduledAt ? 'scheduled' : 'logged',
    scheduled_for: scheduledAt,
    created_by: userId,
  })

  revalidatePath('/manager/operations')
  return { data: true }
}

export async function createProjectEvaluation(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId, role } = await requireTrainingStaff()
  const admin = createAdminClient()

  const batchId = asRequiredString(formData.get('batch_id'))
  const targetUserId = asRequiredString(formData.get('user_id'))
  const projectTitle = asRequiredString(formData.get('project_title'))
  const score = Number(asRequiredString(formData.get('score'), '0'))
  const evidenceFileInput = formData.get('evidence_file')
  let evidenceFileName = asOptionalString(formData.get('evidence_file_name'))
  const remarks = asOptionalString(formData.get('remarks'))

  if (!batchId || !targetUserId || !projectTitle) return { error: 'Batch, candidate, and project title are required.' }
  if (!Number.isFinite(score) || score < 0 || score > 100) return { error: 'Project score must be between 0 and 100.' }

  if (role === 'trainer') {
    const { data: assignment } = await admin
      .from('training_batch_trainers')
      .select('id')
      .eq('batch_id', batchId)
      .eq('trainer_id', userId)
      .maybeSingle()
    const { data: batch } = await admin
      .from('training_batches')
      .select('trainer_id')
      .eq('id', batchId)
      .single()
    if (!assignment && batch?.trainer_id !== userId) return { error: 'Trainer access is limited to assigned batches.' }
  }

  if (isUploadFile(evidenceFileInput)) {
    try {
      evidenceFileName = await uploadTrainingDocument(admin, evidenceFileInput, `projects/${batchId}/${targetUserId}`)
    } catch (error: any) {
      return { error: `Evidence file upload failed: ${error.message}` }
    }
  }

  const { error } = await admin.from('training_project_evaluations').upsert({
    batch_id: batchId,
    user_id: targetUserId,
    evaluator_id: userId,
    project_title: projectTitle,
    score,
    evidence_file_name: evidenceFileName,
    remarks,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'batch_id,user_id,project_title' })

  if (error) return { error: error.message }

  revalidatePath('/manager/operations')
  revalidatePath('/employee/training')
  return { data: true }
}

export type TrainingAutomationRunType = 'attendance_cutoff' | 'absence_streak' | 'assessment_reminder' | 'feedback_reminder'

export async function runTrainingAutomationSweep({
  runType = 'attendance_cutoff',
  batchId = null,
  triggeredBy = null,
  notes = 'Scheduled governance sweep.',
}: {
  runType?: TrainingAutomationRunType
  batchId?: string | null
  triggeredBy?: string | null
  notes?: string
}) {
  const admin = createAdminClient()
  const actorId = await resolveAutomationActor(admin, triggeredBy)
  if (!actorId) {
    throw new Error('No admin, manager, or training coordinator profile is available to own the automation audit trail.')
  }
  const settings = await readGovernanceSettings(admin)
  const now = new Date()
  let notificationsCreated = 0

  const { data: sessions } = await admin
    .from('training_sessions')
    .select('id, title, batch_id, session_date, attendance_required, status, batch:batch_id(title, coordinator_id)')
    .eq(batchId ? 'batch_id' : 'attendance_required', batchId || true)
    .neq('status', 'cancelled')
    .limit(100)

  if (runType === 'attendance_cutoff') {
    for (const session of sessions || []) {
      const sessionDate = new Date(session.session_date)
      if (now < attendanceCutoffForTime(sessionDate, settings.attendanceCutoffTime)) continue
      const { count } = await admin
        .from('session_attendance')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .in('status', ['present', 'late'])
      if ((count || 0) > 0) continue

      const { data: notif } = await admin.from('training_notifications').insert({
        batch_id: session.batch_id,
        session_id: session.id,
        title: `Attendance cut-off missed: ${session.title}`,
        message: `No positive attendance was found after ${settings.attendanceCutoffTime}. Coordinator follow-up required.`,
        audience: 'coordinators',
        channel: 'email',
        delivery_status: 'queued',
        created_by: actorId,
      }).select('id').single()

      // Send real email to coordinator
      let sendAttempts = 0
      let sendFailures = 0
      const coordinatorId = (session.batch as any)?.coordinator_id
      if (coordinatorId) {
        const { data: coord } = await admin.from('profiles').select('full_name, email').eq('id', coordinatorId).single()
        if (coord?.email) {
          const html = buildAttendanceCutoffEmail({
            batchTitle: (session.batch as any)?.title || 'Training Batch',
            sessionTitle: session.title,
            sessionDate: new Date(session.session_date).toLocaleString(),
            cutoffTime: settings.attendanceCutoffTime,
            coordinatorName: coord.full_name || coord.email,
          })
          const emailResult = await sendEmail({ to: coord.email, subject: `Attendance Cut-off Missed - ${session.title}`, html })
          sendAttempts++
          if (!emailResult.success) sendFailures++
          if (notif?.id) {
            await admin.from('training_notification_dispatch_log').insert({
              notification_id: notif.id,
              recipient_email: coord.email,
              channel: 'email',
              provider_status: emailResult.success ? 'sent' : 'failed',
              provider_message: emailResult.error || 'Sent via Resend',
            })
          }
        }
      }
      await finalizeEmailNotification(admin, notif?.id, sendAttempts, sendFailures)
      notificationsCreated++
    }
  }

  if (runType === 'assessment_reminder') {
    const { data: setups } = await admin
      .from('training_assessment_setups')
      .select('id, title, batch_id, scheduled_at, batch:batch_id(title)')
      .gte('scheduled_at', new Date().toISOString())
      .lte('scheduled_at', new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString())
      .limit(100)
    for (const setup of setups || []) {
      if (batchId && setup.batch_id !== batchId) continue

      const { data: notif } = await admin.from('training_notifications').insert({
        batch_id: setup.batch_id,
        title: `Upcoming assessment: ${setup.title}`,
        message: `Assessment is coming up on ${new Date(setup.scheduled_at).toLocaleString()}.`,
        audience: 'batch',
        channel: 'email',
        delivery_status: 'queued',
        created_by: actorId,
      }).select('id').single()

      // Email every batch member
      let sendAttempts = 0
      let sendFailures = 0
      const { data: members } = await admin
        .from('batch_members')
        .select('profile:user_id(full_name, email)')
        .eq('batch_id', setup.batch_id)
      for (const member of members || []) {
        const profile = (member as any).profile
        if (!profile?.email) continue
        const html = buildAssessmentReminderEmail({
          assessmentTitle: setup.title,
          batchTitle: (setup.batch as any)?.title || 'Training Batch',
          scheduledAt: new Date(setup.scheduled_at).toLocaleString(),
          candidateName: profile.full_name || profile.email,
        })
        const emailResult = await sendEmail({ to: profile.email, subject: `Upcoming Assessment: ${setup.title}`, html })
        sendAttempts++
        if (!emailResult.success) sendFailures++
        if (notif?.id) {
          await admin.from('training_notification_dispatch_log').insert({
            notification_id: notif.id,
            recipient_email: profile.email,
            channel: 'email',
            provider_status: emailResult.success ? 'sent' : 'failed',
            provider_message: emailResult.error || 'Sent via Resend',
          })
        }
      }
      await finalizeEmailNotification(admin, notif?.id, sendAttempts, sendFailures)
      notificationsCreated++
    }
  }

  if (runType === 'absence_streak') {
    const targetBatchIds = batchId ? [batchId] : (await admin.from('training_batches').select('id').limit(100)).data?.map((batch: any) => batch.id) || []
    for (const targetBatchId of targetBatchIds) {
      const { data: batchSessions } = await admin
        .from('training_sessions')
        .select('id, title, session_date')
        .eq('batch_id', targetBatchId)
        .eq('attendance_required', true)
        .neq('status', 'cancelled')
        .order('session_date', { ascending: false })
        .limit(settings.absenceAlertDays)
      if (!batchSessions || batchSessions.length < settings.absenceAlertDays) continue

      const { data: batchMembers } = await admin
        .from('batch_members')
        .select('user_id, profile:user_id(full_name, email)')
        .eq('batch_id', targetBatchId)

      for (const member of batchMembers || []) {
        const memberProfile = (member as any).profile
        const attendanceEntriesRes: any = await admin
          .from('session_attendance')
          .select('session_id, status')
          .eq('user_id', member.user_id)
          .in('session_id', batchSessions.map((session: any) => session.id))
        const entries = attendanceEntriesRes.data || []
        const absentAcrossWindow = batchSessions.every((session: any) => {
          const entry = (entries || []).find((item: any) => item.session_id === session.id)
          return !entry || entry.status === 'absent'
        })
        if (!absentAcrossWindow) continue
        const { data: notif } = await admin.from('training_notifications').insert({
          batch_id: targetBatchId,
          title: `Absence streak: ${memberProfile?.full_name || memberProfile?.email || 'Candidate'}`,
          message: `Candidate is absent across the latest ${settings.absenceAlertDays} attendance-required sessions. Coordinator follow-up required.`,
          audience: 'coordinators',
          channel: 'email',
          delivery_status: 'queued',
          created_by: actorId,
        }).select('id').single()

        // Email coordinator
        let sendAttempts = 0
        let sendFailures = 0
        const { data: batchRec } = await admin.from('training_batches').select('coordinator_id, title').eq('id', targetBatchId).single()
        if (batchRec?.coordinator_id) {
          const { data: coord } = await admin.from('profiles').select('full_name, email').eq('id', batchRec.coordinator_id).single()
          if (coord?.email) {
            const html = buildAbsenceStreakEmail({
              candidateName: memberProfile?.full_name || memberProfile?.email || 'Candidate',
              candidateEmail: memberProfile?.email || '',
              batchTitle: batchRec.title || 'Training Batch',
              absenceDays: settings.absenceAlertDays,
              coordinatorName: coord.full_name || coord.email,
            })
            const emailResult = await sendEmail({ to: coord.email, subject: `Absence Alert - ${memberProfile?.full_name || memberProfile?.email}`, html })
            sendAttempts++
            if (!emailResult.success) sendFailures++
            if (notif?.id) {
              await admin.from('training_notification_dispatch_log').insert({
                notification_id: notif.id,
                recipient_email: coord.email,
                channel: 'email',
                provider_status: emailResult.success ? 'sent' : 'failed',
                provider_message: emailResult.error || 'Sent via Resend',
              })
            }
          }
        }
        await finalizeEmailNotification(admin, notif?.id, sendAttempts, sendFailures)
        notificationsCreated++
      }
    }
  }

  if (runType === 'feedback_reminder') {
    const { data: windows } = await admin
      .from('training_feedback_windows')
      .select('id, title, batch_id, closes_at, status, batch:batch_id(title)')
      .eq('status', 'open')
      .gte('closes_at', new Date().toISOString())
      .lte('closes_at', new Date(Date.now() + settings.feedbackWindowDays * 24 * 60 * 60 * 1000).toISOString())
      .limit(100)
    for (const window of windows || []) {
      if (batchId && window.batch_id !== batchId) continue

      const { data: notif } = await admin.from('training_notifications').insert({
        batch_id: window.batch_id,
        title: `Feedback reminder: ${window.title}`,
        message: `Feedback window closes on ${new Date(window.closes_at).toLocaleString()}. Please complete training content and trainer effectiveness feedback.`,
        audience: 'batch',
        channel: 'email',
        delivery_status: 'queued',
        created_by: actorId,
      }).select('id').single()

      // Email every batch member
      let sendAttempts = 0
      let sendFailures = 0
      const { data: members } = await admin
        .from('batch_members')
        .select('profile:user_id(full_name, email)')
        .eq('batch_id', window.batch_id)
      for (const member of members || []) {
        const profile = (member as any).profile
        if (!profile?.email) continue
        const html = buildFeedbackRequestEmail({
          batchTitle: (window.batch as any)?.title || 'Training Batch',
          windowTitle: window.title,
          closesAt: new Date(window.closes_at).toLocaleString(),
          candidateName: profile.full_name || profile.email,
        })
        const emailResult = await sendEmail({ to: profile.email, subject: `Feedback Requested - ${(window.batch as any)?.title || window.title}`, html })
        sendAttempts++
        if (!emailResult.success) sendFailures++
        if (notif?.id) {
          await admin.from('training_notification_dispatch_log').insert({
            notification_id: notif.id,
            recipient_email: profile.email,
            channel: 'email',
            provider_status: emailResult.success ? 'sent' : 'failed',
            provider_message: emailResult.error || 'Sent via Resend',
          })
        }
      }
      await finalizeEmailNotification(admin, notif?.id, sendAttempts, sendFailures)
      notificationsCreated++
    }
  }

  await admin.from('training_automation_runs').insert({
    run_type: runType,
    batch_id: batchId,
    status: 'completed',
    notifications_created: notificationsCreated,
    notes,
    triggered_by: actorId,
  })

  return { notificationsCreated }
}

export async function runTrainingAutomation(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId } = await requireManager()
  const runType = (asRequiredString(formData.get('run_type'), 'attendance_cutoff') || 'attendance_cutoff') as TrainingAutomationRunType
  const batchId = asOptionalString(formData.get('batch_id'))

  await runTrainingAutomationSweep({
    runType,
    batchId,
    triggeredBy: userId,
    notes: 'Manual governance run from operations console.',
  })

  revalidatePath('/manager/operations')
  return { data: true }
}

export async function createFeedbackWindow(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId } = await requireManager()
  const admin = createAdminClient()

  const batchId = asRequiredString(formData.get('batch_id'))
  const sessionId = asOptionalString(formData.get('session_id'))
  const title = asRequiredString(formData.get('title'), 'Training feedback request')
  const closesAt = asRequiredString(formData.get('closes_at'))

  if (!batchId || !closesAt) {
    return { error: 'Batch and closure date are required.' }
  }

  const { data: window, error } = await admin
    .from('training_feedback_windows')
    .insert({
      batch_id: batchId,
      session_id: sessionId,
      title,
      closes_at: closesAt,
      status: 'open',
      created_by: userId,
    })
    .select('id')
    .single()

  if (error || !window) {
    return { error: error?.message || 'Unable to open feedback window.' }
  }

  const { data: notification } = await admin
    .from('training_notifications')
    .insert({
      batch_id: batchId,
      session_id: sessionId,
      title: `Feedback open: ${title}`,
      message: `Feedback collection is open until ${new Date(closesAt).toLocaleString()}.`,
      audience: 'batch',
      channel: 'email',
      delivery_status: 'queued',
      created_by: userId,
    })
    .select('id')
    .single()

  const { data: members } = await admin
    .from('batch_members')
    .select('profile:user_id(full_name, email)')
    .eq('batch_id', batchId)

  // Send real feedback request emails to all batch members
  const { data: batchInfo } = await admin.from('training_batches').select('title').eq('id', batchId).single()
  let sendAttempts = 0
  let sendFailures = 0
  for (const member of members || []) {
    const profile = (member as any).profile
    if (!profile?.email) continue
    const html = buildFeedbackRequestEmail({
      batchTitle: batchInfo?.title || 'Training Batch',
      windowTitle: title,
      closesAt: new Date(closesAt).toLocaleString(),
      candidateName: profile.full_name || profile.email,
    })
    const emailResult = await sendEmail({
      to: profile.email,
      subject: `Feedback Requested - ${batchInfo?.title || title}`,
      html,
    })
    sendAttempts++
    if (!emailResult.success) sendFailures++
    if (notification?.id) {
      await admin.from('training_notification_dispatch_log').insert({
        notification_id: notification.id,
        recipient_email: profile.email,
        channel: 'email',
        provider_status: emailResult.success ? 'sent' : 'failed',
        provider_message: emailResult.error || 'Sent via Resend',
      })
    }
  }

  await finalizeEmailNotification(admin, notification?.id, sendAttempts, sendFailures)

  revalidatePath('/manager/operations')
  revalidatePath('/employee/training')
  return { data: true }
}

export async function submitTrainingFeedback(formData: FormData): Promise<ApiResponse<boolean>> {
  const { userId } = await requireEmployee()
  const admin = createAdminClient()

  const feedbackWindowId = asOptionalString(formData.get('feedback_window_id'))
  let batchId = asOptionalString(formData.get('batch_id'))
  let sessionId = asOptionalString(formData.get('session_id'))
  const rating = Number(asRequiredString(formData.get('rating'), '0'))
  const contentQualityRating = Number(asRequiredString(formData.get('content_quality_rating'), String(rating))) || rating
  const trainerEffectivenessRating = Number(asRequiredString(formData.get('trainer_effectiveness_rating'), String(rating))) || rating
  const feedbackText = asRequiredString(formData.get('feedback_text'))
  const actionItem = asOptionalString(formData.get('action_item'))

  if (!feedbackText || !rating) {
    return { error: 'Rating and feedback are required.' }
  }

  if (!feedbackWindowId) {
    return { error: 'Feedback can only be submitted from an open feedback window.' }
  }

  const now = new Date().toISOString()
  const { data: feedbackWindow, error: feedbackWindowError } = await admin
    .from('training_feedback_windows')
    .select('id, batch_id, session_id, title, opens_at, closes_at, status')
    .eq('id', feedbackWindowId)
    .maybeSingle()

  if (feedbackWindowError || !feedbackWindow) {
    return { error: feedbackWindowError?.message || 'Feedback window was not found.' }
  }

  if (feedbackWindow.status !== 'open' || feedbackWindow.opens_at > now || feedbackWindow.closes_at < now) {
    return { error: 'This feedback window is closed.' }
  }

  const { data: membership } = await admin
    .from('batch_members')
    .select('id')
    .eq('batch_id', feedbackWindow.batch_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    return { error: 'You can only submit feedback for batches assigned to you.' }
  }

  batchId = feedbackWindow.batch_id
  sessionId = feedbackWindow.session_id || sessionId

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
    content_quality_rating: contentQualityRating,
    trainer_effectiveness_rating: trainerEffectivenessRating,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/manager')
  revalidatePath('/manager/operations')
  revalidatePath('/employee/training')
  return { data: true }
}
