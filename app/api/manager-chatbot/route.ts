import { NextRequest, NextResponse } from 'next/server'
import { requireTrainingStaffForApi } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/server'
import { getAccessibleTrainingBatchIds } from '@/lib/training-access'
import { callAI, stripCodeFences } from '@/lib/ai'
import { analyzeAttemptPattern } from '@/lib/insights'
import { buildAdminGuideSearchIndex, findAdminGuideAnswer } from '@/lib/manager-docs'
import { createEmployeeWithSetupEmail, deleteEmployeeAccount } from '@/lib/employee-onboarding'
import type { DifficultyLevel, QuizAnswer } from '@/lib/types/database'
import { revalidatePath } from 'next/cache'

export async function POST(request: NextRequest) {
  const auth = await requireTrainingStaffForApi()
  if (auth instanceof NextResponse) return auth

  const { message, history = [], confirmToken, decision } = await request.json()
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const batchIds = await getAccessibleTrainingBatchIds(auth.userId, auth.role)

  if (confirmToken && typeof confirmToken === 'string') {
    const result = await handlePendingActionDecision(
      admin,
      auth,
      confirmToken,
      decision === 'cancel' ? 'cancel' : 'confirm',
    )
    return NextResponse.json({
      message: result.error ? `Command failed: ${result.error}` : result.message,
      provider: result.error ? 'skilltest_ai_error' : 'skilltest_ai_command',
      result,
    }, { status: result.error ? 400 : 200 })
  }

  if (isExportRequest(message)) {
    const exportPayload = buildExportPayload(message, history, auth.userId)
    await logAiCommand(admin, {
      userId: auth.userId,
      role: auth.role,
      originalPrompt: message,
      detectedIntent: 'REPORT_GENERATION',
      actionType: 'export',
      actionStatus: 'previewed',
      affectedEntityType: 'chat_response',
      affectedCount: 1,
      resultSummary: `Prepared ${exportPayload.format.toUpperCase()} export from chat context.`,
      metadata: exportPayload,
    })
    return NextResponse.json({
      message: `Export ready: ${exportPayload.title}\nUse the download button to save this as ${exportPayload.format.toUpperCase()}.`,
      provider: 'skilltest_ai_export',
      export: exportPayload,
    })
  }

  const adminCommand = resolveAdminCommand(message)
  if (adminCommand) {
    if (auth.role !== 'admin') {
      return NextResponse.json({ error: 'AI Command mutations require admin access.' }, { status: 403 })
    }
    const preview = await createActionPreview(admin, auth, message, adminCommand)
    return NextResponse.json({
      message: preview.error ? `Command failed: ${preview.error}` : preview.message,
      provider: 'skilltest_ai_preview',
      preview,
    }, { status: preview.error ? 400 : 200 })
  }

  const [
    quizzes,
    attempts,
    profiles,
    badges,
    certificates,
    certificateRules,
    attendance,
    assignments,
    batches,
    batchMembers,
    sessions,
    assessmentResults,
    projectEvaluations,
    feedback,
    proctoringEvents,
  ] = await Promise.all([
    safeSelect(admin
      .from('quizzes')
      .select('id, title, topic, difficulty, passing_score, created_by, batch_id, status, is_active')
      .or(`created_by.eq.${auth.userId}${batchIds.length ? `,batch_id.in.(${batchIds.join(',')})` : ''}`)
      .limit(120), 'quizzes'),
    safeSelect(admin
      .from('quiz_attempts')
      .select('quiz_id, user_id, score, status, correct_answers, total_questions, time_taken_seconds, points_earned, completed_at, answers, quizzes:quiz_id(title, topic, difficulty)')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1000), 'quiz_attempts'),
    safeSelect(admin
      .from('profiles')
      .select('id, full_name, email, employee_id, department, domain, role, approval_status, created_at, updated_at')
      .limit(1000), 'profiles'),
    safeSelect(admin
      .from('user_badges')
      .select('user_id, badges(name, category, rarity)')
      .limit(500), 'user_badges'),
    safeSelect(admin
      .from('certificates')
      .select('user_id, quiz_id, title, score, issued_at')
      .limit(250), 'certificates'),
    safeSelect(admin
      .from('certificate_rules')
      .select('quiz_id, enabled, min_score, title, certificate_name, quizzes:quiz_id(title, topic)')
      .limit(120), 'certificate_rules'),
    safeSelect(admin
      .from('session_attendance')
      .select('user_id, status, session:session_id(batch_id, title, session_date)')
      .limit(1000), 'session_attendance'),
    safeSelect(admin
      .from('quiz_assignments')
      .select('quiz_id, user_id, due_date, assigned_at, quizzes:quiz_id(title, topic, passing_score)')
      .limit(1000), 'quiz_assignments'),
    safeSelect(admin
      .from('training_batches')
      .select('id, title, domain, status, start_date, end_date, trainer_id, coordinator_id, created_by')
      .in('id', batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000'])
      .limit(200), 'training_batches'),
    safeSelect(admin
      .from('batch_members')
      .select('batch_id, user_id, enrollment_status, support_status, joined_at, completed_at')
      .limit(2000), 'batch_members'),
    safeSelect(admin
      .from('training_sessions')
      .select('id, batch_id, title, session_date, status, attendance_required')
      .limit(1000), 'training_sessions'),
    safeSelect(admin
      .from('assessment_results')
      .select('batch_id, quiz_id, candidate_email, candidate_name, candidate_id, test_name, test_status, percentage, performance_category, appeared_on, proctoring_flag, created_at')
      .limit(1000), 'assessment_results'),
    safeSelect(admin
      .from('training_project_evaluations')
      .select('batch_id, user_id, project_title, score, remarks, created_at')
      .limit(500), 'training_project_evaluations'),
    safeSelect(admin
      .from('training_feedback')
      .select('batch_id, session_id, user_id, rating, sentiment, feedback_text, created_at')
      .limit(500), 'training_feedback'),
    safeSelect(admin
      .from('quiz_proctoring_events')
      .select('employee_id, quiz_id, violation_type, severity, risk_score, occurred_at, metadata, profiles:employee_id(full_name,email,employee_id), quizzes:quiz_id(title,topic)')
      .order('occurred_at', { ascending: false })
      .limit(500), 'quiz_proctoring_events'),
  ])

  const data = scopeCopilotData({
    quizzes,
    attempts,
    profiles,
    badges,
    certificates,
    certificateRules,
    attendance,
    assignments,
    batches,
    batchMembers,
    sessions,
    assessmentResults,
    projectEvaluations,
    feedback,
    proctoringEvents,
  }, auth, batchIds)

  const effectiveMessage = buildEffectiveMessage(message, history)
  const schedulePreview = await maybeCreateSchedulePreview(admin, auth, message)
  if (schedulePreview) {
    return NextResponse.json({
      message: schedulePreview.error ? `Command failed: ${schedulePreview.error}` : schedulePreview.message,
      provider: 'skilltest_ai_preview',
      preview: schedulePreview,
    }, { status: schedulePreview.error ? 400 : 200 })
  }

  const reminderResult = await maybeExecuteReminderIntent(admin, auth, message, history, data)
  if (reminderResult) {
    return NextResponse.json({
      message: reminderResult.error ? `Command failed: ${reminderResult.error}` : reminderResult.message,
      provider: 'skilltest_ai_preview',
      preview: reminderResult,
    }, { status: reminderResult.error ? 400 : 200 })
  }

  const deterministicAnswer = buildDeterministicAnswer(effectiveMessage, data)
  if (deterministicAnswer) {
    return NextResponse.json({ message: deterministicAnswer, provider: 'skilltest_ai_copilot', intent: classifyCopilotIntent(effectiveMessage) })
  }

  const docsAnswer = isHowToRequest(message) ? findAdminGuideAnswer(message) : null
  if (docsAnswer) {
    return NextResponse.json({ message: docsAnswer, provider: 'skilltest_ai_docs' })
  }

  const context = buildChatbotContext(data)
  const docsContext = buildAdminGuideSearchIndex()

  try {
    const { text, provider } = await callAI([
      {
        role: 'system',
        content:
          'You are SkillTest_AI Operations Copilot. First infer intent: DATA_RETRIEVAL, DATA_ANALYSIS, OPERATIONAL_ACTION, REPORT_GENERATION, or SYSTEM_EXPLANATION. Use only the provided SkillTest_AI database context and chat history. Never invent numbers, names, attempts, proctoring flags, scores, certificates, or emails. Do not give generic onboarding instructions unless the user explicitly asks how to use the app. If matching data is missing, say "I could not find any matching records" and ask one targeted clarification. Prefer concise KPI lines, compact tables, rankings, and recommendations.',
      },
      {
        role: 'user',
        content: `DATABASE CONTEXT:\n${context}\n\nADMIN GUIDE CONTEXT:\n${docsContext}\n\nRECENT CHAT:\n${formatHistory(history)}\n\nQUESTION:\n${message}\n\nRESOLVED QUESTION:\n${effectiveMessage}`,
      },
    ], { maxTokens: 420, temperature: 0.1 })

    return NextResponse.json({ message: text, provider })
  } catch (error: any) {
    return NextResponse.json({
      message: localFallback(message),
      provider: 'skilltest_ai_local',
      error: error.message,
    })
  }
}

type ChatHistoryEntry = { role?: string; content?: string }
type CommandResult = { message?: string; error?: string; data?: any }
type ParsedCommand = { action: string; args: Record<string, string>; source: 'explicit' | 'natural' }
type AiActionPreview = CommandResult & {
  requiresConfirmation?: boolean
  confirmToken?: string
  actionType?: string
  affectedCount?: number
  affectedEntityType?: string
  messagePreview?: string
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  affected?: Array<{ id: string; label: string; detail?: string }>
}

async function safeSelect(query: PromiseLike<{ data: any[] | null; error: any }>, label: string) {
  const { data, error } = await query
  if (error) {
    console.warn(`[manager-chatbot] optional data load failed for ${label}:`, error.message)
    return []
  }
  return data || []
}

function classifyCopilotIntent(message: string) {
  const lower = normalize(message)
  if (/\b(create|add|update|edit|delete|remove|assign|approve|reject|mark|send|remind|archive|extend|run|execute)\b/.test(lower)) return 'OPERATIONAL_ACTION'
  if (/\b(report|summary|weekly|monthly|compliance|status)\b/.test(lower)) return 'REPORT_GENERATION'
  if (/\b(why|explain|reason|blocked|failed|not generated|not issued)\b/.test(lower)) return 'SYSTEM_EXPLANATION'
  if (/\b(compare|trend|struggling|poorly|highest|lowest|weak|risk|performing)\b/.test(lower)) return 'DATA_ANALYSIS'
  return 'DATA_RETRIEVAL'
}

async function logAiCommand(admin: ReturnType<typeof createAdminClient>, input: {
  userId: string
  role: string
  originalPrompt: string
  detectedIntent: string
  actionType?: string
  actionStatus: 'previewed' | 'confirmed' | 'executed' | 'failed' | 'cancelled' | 'expired'
  affectedEntityType?: string
  affectedEntityIds?: string[]
  affectedCount?: number
  resultSummary?: string
  errorMessage?: string
  metadata?: Record<string, any>
}) {
  try {
    const { data, error } = await admin.from('ai_command_audit_logs').insert({
      user_id: input.userId,
      role: input.role,
      original_prompt: input.originalPrompt,
      detected_intent: input.detectedIntent,
      action_type: input.actionType || null,
      action_status: input.actionStatus,
      affected_entity_type: input.affectedEntityType || null,
      affected_entity_ids: input.affectedEntityIds || [],
      affected_count: input.affectedCount || 0,
      result_summary: input.resultSummary || null,
      error_message: input.errorMessage || null,
      metadata: input.metadata || {},
    }).select('id').maybeSingle()
    if (error) {
      console.warn('[manager-chatbot] audit log write failed:', error.message)
      return undefined
    }
    return data?.id as string | undefined
  } catch (error: any) {
    console.warn('[manager-chatbot] audit log write failed:', error?.message || error)
    return undefined
  }
}

function isExportRequest(message: string) {
  const lower = normalize(message)
  return /\b(export|download)\b/.test(lower) && /\b(csv|pdf|report|this|list|employees|summary)\b/.test(lower)
}

function buildExportPayload(message: string, history: ChatHistoryEntry[], requestedBy: string) {
  const lower = normalize(message)
  const format = /\bpdf\b/.test(lower) ? 'pdf' : 'csv'
  const lastAssistant = Array.isArray(history)
    ? [...history].reverse().find((entry) => entry.role === 'assistant' && entry.content?.trim())
    : null
  const content = lastAssistant?.content?.trim() || 'No previous AI response was available to export.'
  const title = lower.includes('inactive')
    ? 'Inactive Employees'
    : lower.includes('failed')
      ? 'Failed Employees'
      : lower.includes('proctor')
        ? 'Proctoring Summary'
        : 'AI Command Export'
  return {
    id: crypto.randomUUID(),
    format,
    title,
    generatedAt: new Date().toISOString(),
    requestedBy,
    filters: inferExportFilters(message),
    content,
  }
}

function inferExportFilters(message: string) {
  const filters: Record<string, string> = {}
  const days = message.match(/\b(\d+)\s+days?\b/i)?.[1]
  if (days) filters.days = days
  const domain = message.match(/\b(?:from|domain)\s+([A-Za-z][A-Za-z\s&+-]{1,40})/i)?.[1]?.trim()
  if (domain) filters.domain = domain
  return filters
}

function scopeCopilotData(data: Record<string, any[]>, auth: { userId: string; role: string }, batchIds: string[]) {
  if (auth.role === 'admin') return data
  const batchSet = new Set(batchIds)
  const scopedMembers = (data.batchMembers || []).filter((member) => batchSet.has(member.batch_id))
  const employeeIds = new Set(scopedMembers.map((member) => member.user_id).filter(Boolean))
  employeeIds.add(auth.userId)
  const employeeEmails = new Set((data.profiles || []).filter((profile) => employeeIds.has(profile.id)).map((profile) => normalize(profile.email || '')))

  return {
    ...data,
    profiles: (data.profiles || []).filter((profile) => employeeIds.has(profile.id) || profile.id === auth.userId),
    attempts: (data.attempts || []).filter((attempt) => employeeIds.has(attempt.user_id)),
    badges: (data.badges || []).filter((badge) => employeeIds.has(badge.user_id)),
    certificates: (data.certificates || []).filter((certificate) => employeeIds.has(certificate.user_id)),
    attendance: (data.attendance || []).filter((item) => employeeIds.has(item.user_id) || batchSet.has(item.session?.batch_id)),
    assignments: (data.assignments || []).filter((assignment) => employeeIds.has(assignment.user_id)),
    batches: (data.batches || []).filter((batch) => batchSet.has(batch.id)),
    batchMembers: scopedMembers,
    sessions: (data.sessions || []).filter((session) => batchSet.has(session.batch_id)),
    assessmentResults: (data.assessmentResults || []).filter((result) => batchSet.has(result.batch_id) || employeeEmails.has(normalize(result.candidate_email || ''))),
    projectEvaluations: (data.projectEvaluations || []).filter((evaluation) => batchSet.has(evaluation.batch_id) || employeeIds.has(evaluation.user_id)),
    feedback: (data.feedback || []).filter((item) => batchSet.has(item.batch_id) || employeeIds.has(item.user_id)),
    proctoringEvents: (data.proctoringEvents || []).filter((event) => employeeIds.has(event.employee_id)),
  }
}

async function maybeCreateSchedulePreview(
  admin: ReturnType<typeof createAdminClient>,
  auth: { userId: string; role: string },
  message: string,
): Promise<AiActionPreview | null> {
  const schedule = parseScheduleRequest(message)
  if (!schedule) return null
  if (auth.role !== 'admin') return { error: 'Scheduled AI commands require admin access.' }

  const token = crypto.randomUUID()
  const auditLogId = await logAiCommand(admin, {
    userId: auth.userId,
    role: auth.role,
    originalPrompt: message,
    detectedIntent: 'OPERATIONAL_ACTION',
    actionType: 'create schedule',
    actionStatus: 'previewed',
    affectedEntityType: 'ai_command_schedule',
    affectedCount: 1,
    resultSummary: `Schedule preview: ${schedule.title}`,
    metadata: { schedule },
  })

  const { error } = await admin.from('ai_command_pending_actions').insert({
    token,
    user_id: auth.userId,
    role: auth.role,
    original_prompt: message,
    detected_intent: 'OPERATIONAL_ACTION',
    action_type: 'create schedule',
    action_payload: { schedule },
    affected_entity_type: 'ai_command_schedule',
    affected_entity_ids: [],
    affected_count: 1,
    preview_summary: `Create recurring AI command: ${schedule.title}`,
    message_preview: schedule.commandText,
    risk_level: schedule.commandText.match(/\b(send|delete|assign|archive|extend|approve|reject)\b/i) ? 'high' : 'medium',
    audit_log_id: auditLogId || null,
  })
  if (error) return { error: `Could not create schedule preview: ${error.message}` }

  return {
    message: [
      `Schedule preview: ${schedule.title}`,
      `Cadence: ${schedule.cadence}${schedule.dayLabel ? ` (${schedule.dayLabel})` : ''} at ${schedule.timeOfDay} ${schedule.timezone}`,
      `Command: ${schedule.commandText}`,
      'Confirm creating this recurring command?',
    ].join('\n'),
    requiresConfirmation: true,
    confirmToken: token,
    actionType: 'create schedule',
    affectedCount: 1,
    affectedEntityType: 'ai_command_schedule',
    messagePreview: schedule.commandText,
    riskLevel: schedule.commandText.match(/\b(send|delete|assign|archive|extend|approve|reject)\b/i) ? 'high' : 'medium',
  }
}

function parseScheduleRequest(message: string) {
  const lower = normalize(message)
  if (!/\b(every|daily|weekly|monthly)\b/.test(lower)) return null
  if (!/\b(send|generate|show|list|report|reminder|command)\b/.test(lower)) return null

  const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
  const dayName = Object.keys(dayMap).find((day) => lower.includes(day))
  const cadence = lower.includes('monthly') ? 'monthly' : lower.includes('daily') ? 'daily' : 'weekly'
  const timeMatch = message.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
  let hour = timeMatch ? Number(timeMatch[1]) : 9
  const minute = timeMatch?.[2] ? Number(timeMatch[2]) : 0
  const meridiem = timeMatch?.[3]?.toLowerCase()
  if (meridiem === 'pm' && hour < 12) hour += 12
  if (meridiem === 'am' && hour === 12) hour = 0
  const timeOfDay = `${String(Math.min(Math.max(hour, 0), 23)).padStart(2, '0')}:${String(Math.min(Math.max(minute, 0), 59)).padStart(2, '0')}`
  const commandText = message
    .replace(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, '')
    .replace(/\b(daily|weekly|monthly)\b/i, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)?\b/i, '')
    .replace(/^[,\s]+/, '')
    .trim() || 'Generate SkillTest_AI operations summary'
  const title = commandText.length > 72 ? `${commandText.slice(0, 69)}...` : commandText
  return {
    title,
    commandText,
    cadence,
    dayOfWeek: cadence === 'weekly' ? dayMap[dayName || 'monday'] : null,
    dayOfMonth: cadence === 'monthly' ? 1 : null,
    dayLabel: cadence === 'weekly' ? (dayName || 'monday') : undefined,
    timeOfDay,
    timezone: 'Asia/Calcutta',
  }
}

async function handlePendingActionDecision(
  admin: ReturnType<typeof createAdminClient>,
  auth: { userId: string; role: string },
  token: string,
  decision: 'confirm' | 'cancel',
): Promise<CommandResult> {
  const { data: pending, error } = await admin
    .from('ai_command_pending_actions')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (error) return { error: `Could not load pending action: ${error.message}` }
  if (!pending) return { error: 'Confirmation expired or was not found.' }
  if (pending.user_id !== auth.userId) return { error: 'This confirmation belongs to another user session.' }
  if (pending.status !== 'pending') return { error: `This action is already ${pending.status}.` }
  if (new Date(pending.expires_at).getTime() < Date.now()) {
    await updatePendingAction(admin, pending.id, 'expired', 'Confirmation expired before execution.')
    await logAiCommand(admin, {
      userId: auth.userId,
      role: auth.role,
      originalPrompt: pending.original_prompt,
      detectedIntent: pending.detected_intent,
      actionType: pending.action_type,
      actionStatus: 'expired',
      affectedEntityType: pending.affected_entity_type,
      affectedEntityIds: pending.affected_entity_ids || [],
      affectedCount: pending.affected_count || 0,
      resultSummary: 'Pending action expired.',
    })
    return { error: 'Confirmation expired. Please run the command again.' }
  }

  if (decision === 'cancel') {
    await updatePendingAction(admin, pending.id, 'cancelled', 'Cancelled by user.')
    await logAiCommand(admin, {
      userId: auth.userId,
      role: auth.role,
      originalPrompt: pending.original_prompt,
      detectedIntent: pending.detected_intent,
      actionType: pending.action_type,
      actionStatus: 'cancelled',
      affectedEntityType: pending.affected_entity_type,
      affectedEntityIds: pending.affected_entity_ids || [],
      affectedCount: pending.affected_count || 0,
      resultSummary: 'Action cancelled before execution.',
    })
    return { message: 'Action cancelled. No changes were made.' }
  }

  if (auth.role !== 'admin') return { error: 'Only admins can confirm data-changing AI actions.' }

  await updatePendingAction(admin, pending.id, 'confirmed', 'Confirmed by user.')
  const result = await executePendingAction(admin, auth.userId, pending)
  if (result.error) {
    await updatePendingAction(admin, pending.id, 'failed', result.error)
    await logAiCommand(admin, {
      userId: auth.userId,
      role: auth.role,
      originalPrompt: pending.original_prompt,
      detectedIntent: pending.detected_intent,
      actionType: pending.action_type,
      actionStatus: 'failed',
      affectedEntityType: pending.affected_entity_type,
      affectedEntityIds: pending.affected_entity_ids || [],
      affectedCount: pending.affected_count || 0,
      errorMessage: result.error,
    })
    return result
  }

  await updatePendingAction(admin, pending.id, 'executed', result.message || 'Executed.')
  await logAiCommand(admin, {
    userId: auth.userId,
    role: auth.role,
    originalPrompt: pending.original_prompt,
    detectedIntent: pending.detected_intent,
    actionType: pending.action_type,
    actionStatus: 'executed',
    affectedEntityType: pending.affected_entity_type,
    affectedEntityIds: pending.affected_entity_ids || [],
    affectedCount: pending.affected_count || 0,
    resultSummary: result.message || 'Action executed.',
  })
  return result
}

async function updatePendingAction(admin: ReturnType<typeof createAdminClient>, id: string, status: string, summary: string) {
  await admin
    .from('ai_command_pending_actions')
    .update({ status, preview_summary: summary, updated_at: new Date().toISOString() })
    .eq('id', id)
}

async function executePendingAction(admin: ReturnType<typeof createAdminClient>, actorId: string, pending: any): Promise<CommandResult> {
  if (pending.action_type === 'send reminder') {
    const ids = Array.isArray(pending.affected_entity_ids) ? pending.affected_entity_ids : []
    if (!ids.length) return { error: 'No reminder recipients remained available.' }
    const rows = ids.map((userId: string) => ({
      recipient_user_id: userId,
      title: 'SkillTest_AI reminder',
      message: pending.action_payload?.messagePreview || 'Please complete your pending SkillTest_AI assessment or training activity.',
      audience: 'individual',
      channel: 'in_app',
      delivery_status: 'sent',
      sent_at: new Date().toISOString(),
      created_by: actorId,
    }))
    const { error } = await admin.from('training_notifications').insert(rows)
    if (error) return { error: error.message }
    revalidatePath('/manager/ai-command')
    return { message: `Reminder sent to ${rows.length} employee(s).` }
  }

  if (pending.action_type === 'create schedule') {
    const schedule = pending.action_payload?.schedule
    if (!schedule?.commandText || !schedule?.cadence) return { error: 'Schedule payload is incomplete.' }
    const { error } = await admin.from('ai_command_schedules').insert({
      created_by: actorId,
      role: pending.role,
      title: schedule.title || schedule.commandText,
      command_text: schedule.commandText,
      cadence: schedule.cadence,
      day_of_week: schedule.dayOfWeek,
      day_of_month: schedule.dayOfMonth,
      time_of_day: schedule.timeOfDay || '09:00',
      timezone: schedule.timezone || 'Asia/Calcutta',
      enabled: true,
      metadata: { source: 'ai_command' },
    })
    if (error) return { error: error.message }
    revalidatePath('/manager/ai-command')
    return { message: `Scheduled command created: ${schedule.title || schedule.commandText}.` }
  }

  const command = pending.action_payload?.command as ParsedCommand | undefined
  if (!command?.action) return { error: 'Pending command payload is incomplete.' }
  const result = await executeAdminCommand(admin, actorId, command)
  if (!result.error) revalidatePath('/manager/ai-command')
  return result
}

async function createActionPreview(
  admin: ReturnType<typeof createAdminClient>,
  auth: { userId: string; role: string },
  prompt: string,
  command: ParsedCommand,
): Promise<AiActionPreview> {
  const meta = await describeAdminCommandImpact(admin, command)
  if (meta.error) {
    await logAiCommand(admin, {
      userId: auth.userId,
      role: auth.role,
      originalPrompt: prompt,
      detectedIntent: 'OPERATIONAL_ACTION',
      actionType: command.action,
      actionStatus: 'failed',
      errorMessage: meta.error,
    })
    return { error: meta.error }
  }

  const token = crypto.randomUUID()
  const auditLogId = await logAiCommand(admin, {
    userId: auth.userId,
    role: auth.role,
    originalPrompt: prompt,
    detectedIntent: 'OPERATIONAL_ACTION',
    actionType: command.action,
    actionStatus: 'previewed',
    affectedEntityType: meta.affectedEntityType,
    affectedEntityIds: meta.affectedIds,
    affectedCount: meta.affectedCount,
    resultSummary: meta.summary,
    metadata: { command, preview: meta },
  })

  const { error } = await admin.from('ai_command_pending_actions').insert({
    token,
    user_id: auth.userId,
    role: auth.role,
    original_prompt: prompt,
    detected_intent: 'OPERATIONAL_ACTION',
    action_type: command.action,
    action_payload: { command },
    affected_entity_type: meta.affectedEntityType,
    affected_entity_ids: meta.affectedIds,
    affected_count: meta.affectedCount,
    preview_summary: meta.summary,
    message_preview: meta.messagePreview || null,
    risk_level: meta.riskLevel,
    audit_log_id: auditLogId || null,
  })
  if (error) return { error: `Could not create action preview: ${error.message}` }

  return {
    message: [
      `Action preview: ${meta.summary}`,
      meta.messagePreview ? `Message preview: ${meta.messagePreview}` : '',
      meta.riskLevel === 'critical' || meta.riskLevel === 'high' ? `Risk: ${meta.riskLevel.toUpperCase()} - confirm only if you are sure.` : `Risk: ${meta.riskLevel}`,
      `Confirm this action?`,
    ].filter(Boolean).join('\n'),
    requiresConfirmation: true,
    confirmToken: token,
    actionType: command.action,
    affectedCount: meta.affectedCount,
    affectedEntityType: meta.affectedEntityType,
    messagePreview: meta.messagePreview,
    riskLevel: meta.riskLevel,
    affected: meta.affected,
  }
}

async function describeAdminCommandImpact(admin: ReturnType<typeof createAdminClient>, command: ParsedCommand) {
  const { action, args } = command
  if (action.includes('employee')) {
    const profile = await findProfileByArgs(admin, args)
    const count = profile ? 1 : action.startsWith('create') ? 1 : 0
    if (!profile && !action.startsWith('create')) return { error: 'No matching employee/profile found for preview.' }
    return {
      summary: `${action} ${profile?.full_name || args.name || args.email || 'new employee'}`,
      affectedEntityType: 'profile',
      affectedIds: profile?.id ? [profile.id] : [],
      affectedCount: count,
      affected: profile ? [{ id: profile.id, label: profile.full_name || profile.email, detail: profile.email }] : [],
      riskLevel: action.includes('delete') ? 'critical' as const : 'medium' as const,
      messagePreview: action.startsWith('create') ? 'Employee setup email may be sent after confirmation.' : undefined,
    }
  }

  if (action.includes('quiz') || action.includes('question')) {
    const quiz = await findQuizByArgs(admin, args)
    const affectedEmails = splitList(args.employee_emails || args.employees || args.email)
    return {
      summary: `${action}${quiz ? ` "${quiz.title}"` : ''}${affectedEmails.length ? ` for ${affectedEmails.length} employee(s)` : ''}`,
      affectedEntityType: action.includes('assign') ? 'quiz_assignment' : 'quiz',
      affectedIds: quiz?.id ? [quiz.id] : [],
      affectedCount: Math.max(affectedEmails.length, quiz ? 1 : 0),
      affected: quiz ? [{ id: quiz.id, label: quiz.title, detail: quiz.topic }] : [],
      riskLevel: action.includes('delete') ? 'critical' as const : affectedEmails.length > 1 ? 'high' as const : 'medium' as const,
    }
  }

  if (action.includes('batch') || action.includes('session') || action.includes('feedback') || action.includes('training') || action.includes('scheduled')) {
    const batch = await findBatchByArgs(admin, args)
    return {
      summary: `${action}${batch ? ` "${batch.title}"` : ''}`,
      affectedEntityType: 'training_operation',
      affectedIds: batch?.id ? [batch.id] : [],
      affectedCount: batch ? 1 : 0,
      affected: batch ? [{ id: batch.id, label: batch.title, detail: batch.domain || batch.status }] : [],
      riskLevel: /\b(delete|clear|remove)\b/.test(action) ? 'critical' as const : 'medium' as const,
    }
  }

  return {
    summary: action,
    affectedEntityType: 'operation',
    affectedIds: [],
    affectedCount: 0,
    affected: [],
    riskLevel: 'medium' as const,
  }
}

function isHowToRequest(message: string) {
  const lower = normalize(message)
  return /\b(how\s+(do|to|can)|steps?|guide|help|where\s+do|where\s+can|show\s+me\s+how)\b/.test(lower)
}

function formatHistory(history: ChatHistoryEntry[]) {
  if (!Array.isArray(history) || !history.length) return 'none'
  return history
    .slice(-8)
    .map((entry) => `${entry.role === 'assistant' ? 'assistant' : 'user'}: ${String(entry.content || '').slice(0, 500)}`)
    .join('\n')
}

function buildEffectiveMessage(message: string, history: ChatHistoryEntry[]) {
  const lower = normalize(message)
  const lastUser = Array.isArray(history)
    ? [...history].reverse().find((entry) => entry.role === 'user' && entry.content && entry.content.trim().toLowerCase() !== message.trim().toLowerCase())
    : null
  if (!lastUser?.content) return message

  if (/^(only|filter|from|for|just)\b/.test(lower) || (/\b(data engineering|cloud|java|frontend|testing|ai|python|react|sql)\b/.test(lower) && lower.split(/\s+/).length <= 6)) {
    return `${lastUser.content}. Follow-up filter: ${message}`
  }

  if (/\b(them|those|these|same employees|same learners|that batch|that quiz)\b/.test(lower)) {
    return `${lastUser.content}. Follow-up request: ${message}`
  }

  return message
}

async function maybeExecuteReminderIntent(
  admin: ReturnType<typeof createAdminClient>,
  auth: { userId: string; role: string },
  message: string,
  history: ChatHistoryEntry[],
  data: Record<string, any[]>,
): Promise<AiActionPreview | null> {
  const lower = normalize(message)
  if (!/\b(send|queue|create)\b.*\b(reminder|reminders|notification|notifications)\b/.test(lower)) return null
  if (auth.role !== 'admin') return { error: 'Reminder actions require admin access.' }

  const targetQuestion = buildEffectiveMessage(message, history)
  const targets = resolveEmployeeTargetsForReminder(targetQuestion, data)
  if (!targets.length) {
    return { error: 'I could not find matching employees to remind. Try: send reminder to employees who have not taken tests in 10 days.' }
  }

  const limitedTargets = targets.slice(0, 200)
  const messagePreview = 'Please complete your pending SkillTest_AI assessment or training activity.'
  const token = crypto.randomUUID()
  const auditLogId = await logAiCommand(admin, {
    userId: auth.userId,
    role: auth.role,
    originalPrompt: message,
    detectedIntent: 'OPERATIONAL_ACTION',
    actionType: 'send reminder',
    actionStatus: 'previewed',
    affectedEntityType: 'profile',
    affectedEntityIds: limitedTargets.map((profile) => profile.id),
    affectedCount: limitedTargets.length,
    resultSummary: `Reminder preview for ${limitedTargets.length} employee(s).`,
    metadata: { targetQuestion },
  })

  const { error } = await admin.from('ai_command_pending_actions').insert({
    token,
    user_id: auth.userId,
    role: auth.role,
    original_prompt: message,
    detected_intent: 'OPERATIONAL_ACTION',
    action_type: 'send reminder',
    action_payload: { targetQuestion, messagePreview },
    affected_entity_type: 'profile',
    affected_entity_ids: limitedTargets.map((profile) => profile.id),
    affected_count: limitedTargets.length,
    preview_summary: `Send reminder to ${limitedTargets.length} employee(s).`,
    message_preview: messagePreview,
    risk_level: limitedTargets.length > 1 ? 'high' : 'medium',
    audit_log_id: auditLogId || null,
  })
  if (error) return { error: error.message }

  return {
    message: [
      `Action preview: send reminder to ${limitedTargets.length} employee(s).`,
      ...limitedTargets.slice(0, 8).map((profile, index) => `${index + 1}. ${displayName(profile)} - ${profile.email}`),
      limitedTargets.length > 8 ? `Showing first 8; ${limitedTargets.length - 8} more recipient(s).` : '',
      `Message preview: ${messagePreview}`,
      'Confirm sending this reminder?',
    ].filter(Boolean).join('\n'),
    requiresConfirmation: true,
    confirmToken: token,
    actionType: 'send reminder',
    affectedCount: limitedTargets.length,
    affectedEntityType: 'profile',
    messagePreview,
    riskLevel: limitedTargets.length > 1 ? 'high' : 'medium',
    affected: limitedTargets.slice(0, 12).map((profile) => ({ id: profile.id, label: displayName(profile), detail: profile.email })),
  }
}

function resolveEmployeeTargetsForReminder(message: string, data: Record<string, any[]>) {
  const inactive = getInactiveEmployeeRows(message, data)
  if (inactive.length) return inactive.map((item) => item.profile)

  const failed = getFailedEmployees(message, data)
  if (failed.length) return failed.map((item) => item.profile)

  const low = getLowScoreEmployees(message, data)
  if (low.length) return low.map((item) => item.profile)

  return []
}

async function executeAdminCommand(admin: ReturnType<typeof createAdminClient>, actorId: string, command: ParsedCommand): Promise<CommandResult> {
  const { action, args } = command
  try {
    switch (action) {
      case 'create employee':
        return createEmployeeCommand(admin, args)
      case 'update employee':
        return updateProfileCommand(admin, args, 'employee')
      case 'delete employee':
        return deleteProfileCommand(admin, args, 'employee')
      case 'create trainer':
        return createProfileCommand(admin, args, 'trainer')
      case 'update trainer':
        return updateProfileCommand(admin, args, 'trainer')
      case 'delete trainer':
      case 'remove trainer':
        return deleteProfileCommand(admin, args, 'trainer')
      case 'create quiz':
        return createQuizCommand(admin, actorId, args)
      case 'update quiz':
        return updateQuizCommand(admin, args)
      case 'delete quiz':
        return deleteQuizCommand(admin, args)
      case 'activate quiz':
        return toggleQuizCommand(admin, args, true)
      case 'deactivate quiz':
        return toggleQuizCommand(admin, args, false)
      case 'create question':
        return createQuestionCommand(admin, args)
      case 'update question':
        return updateQuestionCommand(admin, args)
      case 'delete question':
        return deleteQuestionCommand(admin, args)
      case 'assign quiz':
        return assignQuizCommand(admin, actorId, args)
      case 'create batch':
        return createBatchCommand(admin, actorId, args)
      case 'update batch':
        return updateBatchCommand(admin, args)
      case 'delete batch':
      case 'remove batch':
        return deleteBatchCommand(admin, args)
      case 'add batch member':
      case 'add member':
        return updateBatchMemberCommand(admin, args, true)
      case 'remove batch member':
      case 'remove member':
        return updateBatchMemberCommand(admin, args, false)
      case 'assign trainer':
      case 'add trainer':
        return assignTrainerCommand(admin, actorId, args)
      case 'approve trainer':
        return updateTrainerApprovalCommand(admin, args, 'approved')
      case 'reject trainer':
        return updateTrainerApprovalCommand(admin, args, 'rejected')
      case 'create session':
      case 'create roadmap':
        return createSessionCommand(admin, actorId, args)
      case 'update session':
      case 'update roadmap':
        return updateSessionCommand(admin, args)
      case 'delete session':
      case 'delete roadmap':
        return deleteSessionCommand(admin, args)
      case 'mark attendance':
        return markAttendanceCommand(admin, actorId, args)
      case 'create feedback':
      case 'create feedback form':
        return createFeedbackWindowCommand(admin, actorId, args)
      case 'update feedback':
      case 'update feedback form':
        return updateFeedbackWindowCommand(admin, args)
      case 'delete feedback':
      case 'delete feedback form':
        return deleteFeedbackWindowCommand(admin, args)
      case 'delete training':
      case 'clear training':
        return clearTrainingCommand(admin, args)
      case 'clear scheduled':
      case 'delete scheduled':
        return clearScheduledCommand(admin, args)
      default:
        return { error: `Unknown command "${action}". Open AI Command > Admin Ops for supported examples.` }
    }
  } catch (error: any) {
    return { error: error?.message || 'Command execution failed.' }
  }
}

function resolveAdminCommand(message: string): ParsedCommand | null {
  const trimmed = message.trim()
  if (/^(run|execute)\s+/i.test(trimmed)) {
    return { ...parseCommand(trimmed.replace(/^(run|execute)\s+/i, '')), source: 'explicit' }
  }

  return parseNaturalCommand(trimmed)
}

function parseCommand(text: string): Omit<ParsedCommand, 'source'> {
  const knownActions = [
    'create employee', 'update employee', 'delete employee', 'create trainer', 'update trainer', 'delete trainer', 'remove trainer',
    'create quiz', 'update quiz', 'delete quiz', 'activate quiz', 'deactivate quiz', 'create question', 'update question', 'delete question', 'assign quiz',
    'create batch', 'update batch', 'delete batch', 'remove batch', 'add batch member', 'remove batch member', 'add member', 'remove member',
    'assign trainer', 'add trainer', 'approve trainer', 'reject trainer',
    'create session', 'update session', 'delete session', 'create roadmap', 'update roadmap', 'delete roadmap',
    'mark attendance', 'create feedback form', 'create feedback', 'update feedback form', 'update feedback', 'delete feedback form', 'delete feedback',
    'delete training', 'clear training', 'clear scheduled', 'delete scheduled',
  ]
  const lower = text.toLowerCase()
  const action = knownActions.find((item) => lower === item || lower.startsWith(`${item} `)) || lower.split(/\s+/).slice(0, 2).join(' ')
  const rest = text.slice(action.length).trim()
  const args: Record<string, string> = {}
  const pattern = /([a-zA-Z_][\w-]*)=(?:"([^"]*)"|'([^']*)'|([^"'\s][^\s]*))/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(rest))) {
    args[normalizeArgKey(match[1])] = (match[2] ?? match[3] ?? match[4] ?? '').trim()
  }
  return { action, args }
}

function parseNaturalCommand(text: string): ParsedCommand | null {
  const lower = normalize(text)
  const args: Record<string, string> = {}

  if (/\b(remove|delete|clear)\b.*\bscheduled\b.*\b(training|session|sessions|roadmap|roadmaps)\b/.test(lower)) {
    args.confirmation = 'DELETE SCHEDULED'
    return { action: 'clear scheduled', args, source: 'natural' }
  }

  if (/\b(delete|clear|remove)\b.*\b(all\s+)?training\b/.test(lower)) {
    args.confirmation = 'DELETE TRAINING'
    return { action: 'clear training', args, source: 'natural' }
  }

  const createEmployee = text.match(/\b(?:create|add)\s+employee\b/i)
  if (createEmployee && !/\bbatch\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.email ||= firstEmail(text)
    args.name ||= quotedValueAfter(text, 'name') || phraseAfter(text, /\b(?:named|name)\b/i)
    return { action: 'create employee', args, source: 'natural' }
  }

  if (/\b(update|edit)\s+employee\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.email ||= firstEmail(text)
    args.name ||= quotedValueAfter(text, 'employee') || afterWords(text, ['employee'])
    return { action: 'update employee', args, source: 'natural' }
  }

  if (/\b(delete|remove)\s+employee\b/i.test(text) && !/\bbatch\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.email ||= firstEmail(text)
    args.name ||= quotedValueAfter(text, 'employee') || afterWords(text, ['employee'])
    return { action: 'delete employee', args, source: 'natural' }
  }

  if (/\b(create|add)\s+trainer\b/i.test(text) && !/\b(assign|batch)\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.email ||= firstEmail(text)
    args.name ||= quotedValueAfter(text, 'name') || phraseAfter(text, /\b(?:named|name)\b/i)
    return { action: 'create trainer', args, source: 'natural' }
  }

  if (/\b(update|edit)\s+trainer\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.email ||= firstEmail(text)
    args.name ||= quotedValueAfter(text, 'trainer') || afterWords(text, ['trainer'])
    return { action: 'update trainer', args, source: 'natural' }
  }

  if (/\b(delete|remove)\s+trainer\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.email ||= firstEmail(text)
    args.name ||= quotedValueAfter(text, 'trainer') || afterWords(text, ['trainer'])
    return { action: 'delete trainer', args, source: 'natural' }
  }

  if (/\b(create|add)\s+quiz\b/i.test(text) || /\bgenerate\b.*\bquestions?\b/i.test(text)) {
    mergeKeyValues(args, text)
    const intent = extractQuizCreationIntent(text)
    Object.assign(args, { ...intent, ...args })
    args.title ||= quotedValueAfter(text, 'title') || `${args.topic || 'General'} Assessment`
    return { action: 'create quiz', args, source: 'natural' }
  }

  if (/\b(delete|remove)\s+quiz\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.title ||= quotedValueAfter(text, 'quiz') || afterWords(text, ['quiz'])
    return { action: 'delete quiz', args, source: 'natural' }
  }

  if (/\b(update|edit)\s+quiz\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.title ||= quotedValueAfter(text, 'quiz') || afterWords(text, ['quiz'])
    return { action: 'update quiz', args, source: 'natural' }
  }

  if (/\b(activate|publish)\s+quiz\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.title ||= quotedValueAfter(text, 'quiz') || afterWords(text, ['quiz'])
    return { action: 'activate quiz', args, source: 'natural' }
  }

  if (/\b(deactivate|unpublish|draft)\s+quiz\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.title ||= quotedValueAfter(text, 'quiz') || afterWords(text, ['quiz'])
    return { action: 'deactivate quiz', args, source: 'natural' }
  }

  if (/\b(create|add)\s+question\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.quiz ||= quotedValueAfter(text, 'quiz')
    args.question ||= quotedValueAfter(text, 'question') || quotedValueAfter(text, 'text')
    return { action: 'create question', args, source: 'natural' }
  }

  if (/\b(update|edit)\s+question\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.question ||= quotedValueAfter(text, 'question') || quotedValueAfter(text, 'text')
    return { action: 'update question', args, source: 'natural' }
  }

  if (/\b(delete|remove)\s+question\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.question ||= quotedValueAfter(text, 'question') || afterWords(text, ['question'])
    args.quiz ||= quotedValueAfter(text, 'quiz')
    return { action: 'delete question', args, source: 'natural' }
  }

  if (/\b(assign)\s+quiz\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.email ||= firstEmail(text)
    args.quiz ||= quotedValueAfter(text, 'quiz')
    return { action: 'assign quiz', args, source: 'natural' }
  }

  if (/\b(create|add)\s+batch\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.title ||= quotedValueAfter(text, 'batch') || quotedValueAfter(text, 'title') || phraseAfter(text, /\bbatch\s+(?:called|named|title)?\b/i)
    args.domain ||= valueAfterWord(text, 'domain')
    args.trainer_email ||= emailAfterWord(text, 'trainer')
    return { action: 'create batch', args, source: 'natural' }
  }

  if (/\b(delete|remove)\s+batch\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.batch ||= quotedValueAfter(text, 'batch') || afterWords(text, ['batch'])
    return { action: 'delete batch', args, source: 'natural' }
  }

  if (/\b(update|edit)\s+batch\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.batch ||= quotedValueAfter(text, 'batch') || afterWords(text, ['batch'])
    return { action: 'update batch', args, source: 'natural' }
  }

  if (/\b(add|enroll)\b.*\b(employee|member|candidate)\b.*\bbatch\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.email ||= firstEmail(text)
    args.batch ||= quotedValueAfter(text, 'batch')
    return { action: 'add batch member', args, source: 'natural' }
  }

  if (/\b(remove|delete)\b.*\b(employee|member|candidate)\b.*\bbatch\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.email ||= firstEmail(text)
    args.batch ||= quotedValueAfter(text, 'batch')
    return { action: 'remove batch member', args, source: 'natural' }
  }

  if (/\b(assign|add)\s+trainer\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.trainer_email ||= firstEmail(text)
    args.batch ||= quotedValueAfter(text, 'batch')
    return { action: 'assign trainer', args, source: 'natural' }
  }

  if (/\bapprove\s+trainer\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.email ||= firstEmail(text)
    args.name ||= afterWords(text, ['trainer'])
    return { action: 'approve trainer', args, source: 'natural' }
  }

  if (/\breject\s+trainer\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.email ||= firstEmail(text)
    args.name ||= afterWords(text, ['trainer'])
    return { action: 'reject trainer', args, source: 'natural' }
  }

  if (/\b(create|add)\s+(session|roadmap)\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.title ||= quotedValueAfter(text, 'session') || quotedValueAfter(text, 'roadmap') || quotedValueAfter(text, 'title')
    args.batch ||= quotedValueAfter(text, 'batch')
    args.date ||= valueAfterWord(text, 'date')
    args.trainer_email ||= emailAfterWord(text, 'trainer')
    return { action: 'create session', args, source: 'natural' }
  }

  if (/\b(update|edit)\s+(session|roadmap)\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.title ||= quotedValueAfter(text, 'session') || quotedValueAfter(text, 'roadmap')
    args.status ||= valueAfterWord(text, 'status')
    return { action: 'update session', args, source: 'natural' }
  }

  if (/\b(delete|remove)\s+(session|roadmap)\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.title ||= quotedValueAfter(text, 'session') || quotedValueAfter(text, 'roadmap') || afterWords(text, ['session', 'roadmap'])
    return { action: 'delete session', args, source: 'natural' }
  }

  if (/\bmark\b.*\battendance\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.email ||= firstEmail(text)
    args.session ||= quotedValueAfter(text, 'session')
    args.status ||= lower.match(/\b(present|late|absent|excused)\b/)?.[1] || 'present'
    return { action: 'mark attendance', args, source: 'natural' }
  }

  if (/\b(create|open|add)\b.*\bfeedback\b.*\b(form|window)?\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.batch ||= quotedValueAfter(text, 'batch')
    args.session ||= quotedValueAfter(text, 'session')
    args.title ||= quotedValueAfter(text, 'feedback') || quotedValueAfter(text, 'title')
    args.closes_at ||= valueAfterWord(text, 'closes') || valueAfterWord(text, 'close')
    return { action: 'create feedback form', args, source: 'natural' }
  }

  if (/\b(update|edit)\b.*\bfeedback\b.*\b(form|window)?\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.title ||= quotedValueAfter(text, 'feedback') || quotedValueAfter(text, 'title')
    args.closes_at ||= valueAfterWord(text, 'closes') || valueAfterWord(text, 'close')
    return { action: 'update feedback form', args, source: 'natural' }
  }

  if (/\b(delete|remove)\b.*\bfeedback\b.*\b(form|forms|window|windows)?\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.title ||= quotedValueAfter(text, 'feedback') || quotedValueAfter(text, 'title')
    if (/\ball\b/i.test(text)) args.all = 'true'
    return { action: 'delete feedback form', args, source: 'natural' }
  }

  return null
}

function mergeKeyValues(target: Record<string, string>, text: string) {
  const parsed = parseCommand(`noop ${text}`)
  Object.assign(target, parsed.args)
}

function firstEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ''
}

function emailAfterWord(text: string, word: string) {
  const index = text.toLowerCase().indexOf(word.toLowerCase())
  return index >= 0 ? firstEmail(text.slice(index)) : ''
}

function quotedValueAfter(text: string, word: string) {
  const match = text.match(new RegExp(`${word}[^"'\\n]*["']([^"']+)["']`, 'i'))
  return match?.[1]?.trim() || ''
}

function valueAfterWord(text: string, word: string) {
  const match = text.match(new RegExp(`${word}\\s*(?:=|is|as|to)?\\s*["']?([^"',\\s]+)`, 'i'))
  return match?.[1]?.trim() || ''
}

function phraseAfter(text: string, pattern: RegExp) {
  const match = text.match(pattern)
  if (!match || match.index === undefined) return ''
  return text.slice(match.index + match[0].length).replace(/\s+(with|for|in|on|date|domain|trainer)\b.*$/i, '').trim().replace(/^["']|["']$/g, '')
}

function afterWords(text: string, words: string[]) {
  const lower = text.toLowerCase()
  const word = words.find((item) => lower.includes(item))
  if (!word) return ''
  return text.slice(lower.indexOf(word) + word.length).replace(/\b(email|id|named|called)\b/gi, '').trim().replace(/^["']|["']$/g, '')
}

function normalizeArgKey(key: string) {
  return key.toLowerCase().replace(/-/g, '_')
}

async function createEmployeeCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  const email = args.email
  const fullName = args.name || args.full_name
  const employeeId = args.employee_id || args.emp_id
  const domain = args.domain
  if (!email || !fullName || !employeeId || !domain) return { error: 'Use: run create employee email=... name="..." employee_id=... domain=...' }
  const { profile, warning } = await createEmployeeWithSetupEmail(admin, {
    email,
    fullName,
    employeeId,
    department: args.department || null,
    domain,
  })
  return { message: `Employee ${profile.full_name || email} created or updated.${warning ? ` Warning: ${warning}` : ''}`, data: profile }
}

async function createProfileCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>, role: 'trainer' | 'employee' | 'manager' | 'training_coordinator' | 'admin') {
  const email = args.email?.trim().toLowerCase()
  const fullName = args.name || args.full_name
  if (!email || !fullName) return { error: `Use: run create ${role} email=... name="..." domain=... department=...` }

  if (role === 'employee') {
    const employeeId = args.employee_id || args.emp_id
    const domain = args.domain
    if (!employeeId || !domain) return { error: 'Use: run create employee email=... name="..." employee_id=... domain=...' }
    const { profile, warning } = await createEmployeeWithSetupEmail(admin, {
      email,
      fullName,
      employeeId,
      department: args.department || null,
      domain,
    })
    return { message: `Employee ${profile.full_name || email} created or updated.${warning ? ` Warning: ${warning}` : ''}`, data: profile }
  }

  const { data: existing } = await admin.from('profiles').select('*').eq('email', email).maybeSingle()
  if (existing) {
    const { data, error } = await admin
      .from('profiles')
      .update({
        full_name: fullName,
        role,
        domain: args.domain || existing.domain,
        department: args.department || existing.department || args.domain || null,
        approval_status: role === 'trainer' ? (args.approval_status || 'approved') : existing.approval_status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id, email, full_name, role, approval_status')
      .single()
    if (error) return { error: error.message }
    revalidateManagerPaths()
    return { message: `${role} ${data.full_name || data.email} updated and ${data.approval_status || 'approved'}.`, data }
  }

  const tempPassword = `SkillTest${Math.floor(100000 + Math.random() * 900000)}!`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { role, full_name: fullName },
  })
  if (authError || !authData.user) return { error: authError?.message || `Could not create ${role}.` }

  const { data, error } = await admin
    .from('profiles')
    .insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      employee_id: args.employee_id || args.emp_id || null,
      department: args.department || args.domain || null,
      domain: args.domain || null,
      role,
      approval_status: role === 'trainer' ? (args.approval_status || 'approved') : 'approved',
    })
    .select('id, email, full_name, role, approval_status')
    .single()

  if (error) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: error.message }
  }
  revalidateManagerPaths()
  return { message: `${role} ${data.full_name || data.email} created and ready. Temporary password is ${tempPassword}`, data }
}

async function updateProfileCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>, expectedRole?: string) {
  const profile = await findProfileByArgs(admin, args)
  if (!profile) return { error: 'No profile matched email/id/name.' }
  if (expectedRole && profile.role !== expectedRole) return { error: `Matched profile is ${profile.role}, not ${expectedRole}.` }

  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (args.name || args.full_name) update.full_name = args.name || args.full_name
  if (args.employee_id || args.emp_id) update.employee_id = args.employee_id || args.emp_id
  if (args.department) update.department = args.department
  if (args.domain) update.domain = args.domain
  if (args.role) update.role = args.role
  if (args.approval_status) update.approval_status = args.approval_status
  if (Object.keys(update).length === 1) return { error: 'Tell me what to update: name, employee_id, department, domain, role, or approval_status.' }

  const { data, error } = await admin.from('profiles').update(update).eq('id', profile.id).select('id, email, full_name, role').single()
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `${data.role} ${data.full_name || data.email} updated.`, data }
}

async function deleteProfileCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>, role: string) {
  const profile = await findProfileByArgs(admin, args)
  if (!profile) return { error: `No ${role} matched email/id/name.` }
  if (profile.role !== role) return { error: `Matched profile is ${profile.role}, not ${role}.` }
  if (role === 'employee') {
    const deletion = await deleteEmployeeAccount(admin, { id: profile.id, email: profile.email })
    if (deletion.warnings.length > 0) console.warn('[manager-chatbot] employee deletion warnings:', deletion.warnings)
  } else {
    const { error } = await admin.from('profiles').delete().eq('id', profile.id)
    if (error) return { error: error.message }
    await admin.auth.admin.deleteUser(profile.id).catch(() => null)
  }
  revalidateManagerPaths()
  return { message: `${role} ${profile.full_name || profile.email} deleted.` }
}

async function createQuizCommand(admin: ReturnType<typeof createAdminClient>, actorId: string, args: Record<string, string>) {
  const title = args.title
  const topic = args.topic || args.domain
  if (!title || !topic) return { error: 'Use: run create quiz title="..." topic="..." difficulty=medium question_count=10 passing_score=70' }
  const questionCount = clampNumber(Number(args.question_count || args.questions || 10), 1, 50, 10)
  const difficulty = normalizeDifficultyArg(args.difficulty)
  const payload = {
    title,
    topic,
    description: args.description || null,
    difficulty,
    question_count: questionCount,
    time_limit_minutes: clampNumber(Number(args.time_limit || args.time_limit_minutes || args.duration || 30), 1, 480, 30),
    passing_score: clampNumber(Number(args.passing_score || 70), 0, 100, 70),
    status: args.status || 'active',
    is_active: (args.status || 'active') !== 'draft' && (args.status || 'active') !== 'archived',
    created_by: actorId,
    batch_id: args.batch_id || null,
  }
  const { data, error } = await admin.from('quizzes').insert(payload).select('id, title').single()
  if (error) return { error: error.message }

  const generation = await generateQuestionsForChatbotQuiz(admin, {
    quizId: data.id,
    topic,
    difficulty,
    count: questionCount,
    objective: args.objective || args.description || `Assess practical understanding of ${topic}`,
  })

  let assignmentMessage = ''
  const assignee = args.assigned_to || args.assigned_employee || args.employee || args.name || args.email
  const dueDate = normalizeNaturalDueDate(args.due_date)
  if (assignee) {
    const assigned = await assignQuizToNaturalAssignee(admin, actorId, data.id, assignee, dueDate)
    assignmentMessage = assigned.error ? ` Assignment skipped: ${assigned.error}` : ` Assigned to ${assigned.count} employee(s).`
  } else if (args.department || args.team) {
    const assigned = await assignQuizToDepartment(admin, actorId, data.id, args.department || args.team, dueDate)
    assignmentMessage = assigned.error ? ` Assignment skipped: ${assigned.error}` : ` Assigned to ${assigned.count} employee(s).`
  }

  revalidateManagerPaths()
  return {
    message: `Quiz "${data.title}" created with ${generation.count} ${generation.method} question(s).${assignmentMessage}`,
    data: { ...data, generated_questions: generation.count, generation_method: generation.method },
  }
}

async function updateQuizCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  const quiz = await findQuizByArgs(admin, args)
  if (!quiz) return { error: 'No quiz matched id/title.' }
  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (args.new_title) update.title = args.new_title
  if (args.topic) update.topic = args.topic
  if (args.description) update.description = args.description
  if (args.difficulty) update.difficulty = args.difficulty
  if (args.question_count || args.questions) update.question_count = Number(args.question_count || args.questions)
  if (args.time_limit || args.time_limit_minutes) update.time_limit_minutes = Number(args.time_limit || args.time_limit_minutes)
  if (args.passing_score) update.passing_score = Number(args.passing_score)
  if (args.feedback_form_url) update.feedback_form_url = args.feedback_form_url
  if (args.status) {
    update.status = args.status
    update.is_active = args.status === 'active'
  }
  if (Object.keys(update).length === 1) return { error: 'Tell me what to update: topic, difficulty, passing_score, time_limit, feedback_form_url, or status.' }
  const { data, error } = await admin.from('quizzes').update(update).eq('id', quiz.id).select('id, title').single()
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `Quiz "${data.title}" updated.`, data }
}

async function deleteQuizCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  const quiz = await findQuizByArgs(admin, args)
  if (!quiz) return { error: 'No quiz matched id/title.' }
  await admin.from('questions').delete().eq('quiz_id', quiz.id)
  await admin.from('quiz_attempts').delete().eq('quiz_id', quiz.id)
  const { error } = await admin.from('quizzes').delete().eq('id', quiz.id)
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `Quiz "${quiz.title}" deleted.` }
}

async function toggleQuizCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>, active: boolean) {
  const quiz = await findQuizByArgs(admin, args)
  if (!quiz) return { error: 'No quiz matched id/title.' }
  const { error } = await admin.from('quizzes').update({ is_active: active, status: active ? 'active' : 'draft', updated_at: new Date().toISOString() }).eq('id', quiz.id)
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `Quiz "${quiz.title}" ${active ? 'activated' : 'deactivated'}.` }
}

async function createQuestionCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  const quiz = await findQuizByArgs(admin, args)
  const questionText = args.question || args.question_text || args.text
  if (!quiz || !questionText) return { error: 'Use: run create question quiz="..." question="..." option_a="..." option_b="..." option_c="..." option_d="..." correct_answer=A' }
  const options = buildQuestionOptions(args)
  if (!options) return { error: 'Provide option_a, option_b, option_c, option_d and correct_answer=A/B/C/D.' }
  const { data, error } = await admin.from('questions').insert({
    quiz_id: quiz.id,
    question_text: questionText,
    options,
    difficulty: args.difficulty || quiz.difficulty || 'medium',
    explanation: args.explanation || null,
    is_ai_generated: false,
    order_index: Number(args.order_index || 0),
  }).select('id, question_text').single()
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `Question added to "${quiz.title}".`, data }
}

async function updateQuestionCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  const question = await findQuestionByArgs(admin, args)
  if (!question) return { error: 'No question matched id/text.' }
  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (args.new_question || args.question_text || args.text) update.question_text = args.new_question || args.question_text || args.text
  const options = buildQuestionOptions(args)
  if (options) update.options = options
  if (args.difficulty) update.difficulty = args.difficulty
  if (args.explanation) update.explanation = args.explanation
  if (Object.keys(update).length === 1) return { error: 'Tell me what to update: question_text, options, difficulty, or explanation.' }
  const { data, error } = await admin.from('questions').update(update).eq('id', question.id).select('id, question_text').single()
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `Question "${data.question_text}" updated.`, data }
}

async function deleteQuestionCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  const question = await findQuestionByArgs(admin, args)
  if (!question) return { error: 'No question matched id/text.' }
  const { error } = await admin.from('questions').delete().eq('id', question.id)
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `Question deleted.` }
}

async function assignQuizCommand(admin: ReturnType<typeof createAdminClient>, actorId: string, args: Record<string, string>) {
  const quiz = await findQuizByArgs(admin, args)
  const employeeEmails = splitList(args.employee_emails || args.employees || args.email)
  if (!quiz || !employeeEmails.length) return { error: 'Use: run assign quiz quiz="..." employee_emails=a@x.com,b@x.com due_date=2026-06-30' }
  const { data: employees } = await admin.from('profiles').select('id, email').in('email', employeeEmails)
  if (!employees?.length) return { error: 'No employees matched the provided email(s).' }
  const rows = employees.map((employee: any) => ({
    quiz_id: quiz.id,
    user_id: employee.id,
    assigned_by: actorId,
    due_date: args.due_date || null,
  }))
  const { error } = await admin.from('quiz_assignments').upsert(rows, { onConflict: 'quiz_id,user_id' })
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `Quiz "${quiz.title}" assigned to ${employees.length} employee(s).`, data: rows }
}

async function createBatchCommand(admin: ReturnType<typeof createAdminClient>, actorId: string, args: Record<string, string>) {
  if (!args.title) return { error: 'Use: run create batch title="..." domain=... trainer_email=... employee_emails=a@x.com,b@x.com' }
  const trainer = args.trainer_email ? await findProfileByArgs(admin, { email: args.trainer_email }) : null
  const { data: batch, error } = await admin.from('training_batches').insert({
    title: args.title,
    domain: args.domain || null,
    description: args.description || null,
    status: args.status || 'planned',
    trainer_id: trainer?.id || null,
    coordinator_id: actorId,
    created_by: actorId,
    start_date: args.start_date || null,
    end_date: args.end_date || null,
  }).select('id, title').single()
  if (error || !batch) return { error: error?.message || 'Batch creation failed.' }

  if (trainer?.id) {
    await admin.from('training_batch_trainers').upsert({ batch_id: batch.id, trainer_id: trainer.id, role_label: 'Lead Trainer', assigned_by: actorId }, { onConflict: 'batch_id,trainer_id' })
  }
  const employeeEmails = splitList(args.employee_emails || args.employees)
  if (employeeEmails.length) {
    const { data: employees } = await admin.from('profiles').select('id, email').in('email', employeeEmails)
    if (employees?.length) {
      await admin.from('batch_members').upsert(employees.map((employee: any) => ({ batch_id: batch.id, user_id: employee.id, enrollment_status: 'active' })), { onConflict: 'batch_id,user_id' })
    }
  }
  revalidateManagerPaths()
  return { message: `Batch "${batch.title}" created${trainer ? ` with trainer ${trainer.email}` : ''}.`, data: batch }
}

async function updateBatchCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  const batch = await findBatchByArgs(admin, args)
  if (!batch) return { error: 'No batch matched id/title.' }
  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (args.new_title) update.title = args.new_title
  if (args.description) update.description = args.description
  if (args.domain) update.domain = args.domain
  if (args.status) update.status = args.status
  if (args.start_date) update.start_date = args.start_date
  if (args.end_date) update.end_date = args.end_date
  if (args.trainer_email) {
    const trainer = await findProfileByArgs(admin, { email: args.trainer_email })
    if (!trainer) return { error: 'Trainer email did not match a profile.' }
    update.trainer_id = trainer.id
  }
  if (Object.keys(update).length === 1) return { error: 'Tell me what to update: title, description, domain, status, dates, or trainer_email.' }
  const { data, error } = await admin.from('training_batches').update(update).eq('id', batch.id).select('id, title').single()
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `Batch "${data.title}" updated.`, data }
}

async function deleteBatchCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  const batch = await findBatchByArgs(admin, args)
  if (!batch) return { error: 'No batch matched id/title.' }
  await deleteBatchCascade(admin, batch.id)
  revalidateManagerPaths()
  return { message: `Batch "${batch.title}" deleted.` }
}

async function updateBatchMemberCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>, add: boolean) {
  const batch = await findBatchByArgs(admin, args)
  const employeeEmails = splitList(args.employee_emails || args.employees || args.email)
  if (!batch || !employeeEmails.length) return { error: `Use: run ${add ? 'add' : 'remove'} batch member batch="..." email=person@company.com` }
  const { data: employees } = await admin.from('profiles').select('id, email, full_name').in('email', employeeEmails)
  if (!employees?.length) return { error: 'No employees matched the provided email(s).' }
  if (add) {
    const { error } = await admin.from('batch_members').upsert(
      employees.map((employee: any) => ({
        batch_id: batch.id,
        user_id: employee.id,
        enrollment_status: args.enrollment_status || 'active',
        support_status: args.support_status || 'on_track',
      })),
      { onConflict: 'batch_id,user_id' }
    )
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('batch_members').delete().eq('batch_id', batch.id).in('user_id', employees.map((employee: any) => employee.id))
    if (error) return { error: error.message }
  }
  revalidateManagerPaths()
  return { message: `${employees.length} member(s) ${add ? 'added to' : 'removed from'} ${batch.title}.` }
}

async function assignTrainerCommand(admin: ReturnType<typeof createAdminClient>, actorId: string, args: Record<string, string>) {
  const batch = await findBatchByArgs(admin, args)
  const trainer = await findProfileByArgs(admin, { email: args.trainer_email || args.email, name: args.trainer || args.name })
  if (!batch || !trainer) return { error: 'Use: run assign trainer batch="..." trainer_email=trainer@example.com' }
  if (trainer.role !== 'trainer') return { error: 'Matched user is not a trainer.' }
  await admin.from('training_batches').update({ trainer_id: trainer.id, updated_at: new Date().toISOString() }).eq('id', batch.id)
  const { error } = await admin.from('training_batch_trainers').upsert({ batch_id: batch.id, trainer_id: trainer.id, role_label: args.role_label || 'Trainer', assigned_by: actorId }, { onConflict: 'batch_id,trainer_id' })
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `${trainer.full_name || trainer.email} assigned to ${batch.title}.` }
}

async function updateTrainerApprovalCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>, status: 'approved' | 'rejected') {
  const trainer = await findProfileByArgs(admin, args)
  if (!trainer) return { error: 'No trainer matched email/id/name.' }
  if (trainer.role !== 'trainer') return { error: 'Matched user is not a trainer.' }
  const { error } = await admin.from('profiles').update({ approval_status: status, updated_at: new Date().toISOString() }).eq('id', trainer.id)
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `Trainer ${trainer.full_name || trainer.email} ${status}.` }
}

async function createSessionCommand(admin: ReturnType<typeof createAdminClient>, actorId: string, args: Record<string, string>) {
  const batch = await findBatchByArgs(admin, args)
  if (!batch || !args.title || !args.date) return { error: 'Use: run create session batch="..." title="..." date=2026-06-10T10:00 trainer_email=...' }
  const trainer = args.trainer_email ? await findProfileByArgs(admin, { email: args.trainer_email }) : null
  const { data, error } = await admin.from('training_sessions').insert({
    batch_id: batch.id,
    title: args.title,
    agenda: args.agenda || null,
    session_date: args.date,
    mode: args.mode || 'virtual',
    status: args.status || 'scheduled',
    trainer_id: trainer?.id || null,
    attendance_required: args.attendance_required !== 'false',
    created_by: actorId,
  }).select('id, title').single()
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `Session "${data.title}" created for ${batch.title}.`, data }
}

async function updateSessionCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  const session = await findSessionByArgs(admin, args)
  if (!session) return { error: 'No session matched id/title.' }
  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (args.title) update.title = args.title
  if (args.date) update.session_date = args.date
  if (args.status) update.status = args.status
  if (args.mode) update.mode = args.mode
  if (args.agenda) update.agenda = args.agenda
  const { error } = await admin.from('training_sessions').update(update).eq('id', session.id)
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `Session "${session.title}" updated.` }
}

async function deleteSessionCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  const session = await findSessionByArgs(admin, args)
  if (!session) return { error: 'No session matched id/title.' }
  await deleteSessionCascade(admin, session.id)
  revalidateManagerPaths()
  return { message: `Session "${session.title}" deleted.` }
}

async function markAttendanceCommand(admin: ReturnType<typeof createAdminClient>, actorId: string, args: Record<string, string>) {
  const session = await findSessionByArgs(admin, args)
  const employee = await findProfileByArgs(admin, { email: args.email, employee_id: args.employee_id, name: args.name })
  const status = args.status || 'present'
  if (!session || !employee || !['present', 'late', 'excused', 'absent'].includes(status)) {
    return { error: 'Use: run mark attendance session="..." email=employee@example.com status=present' }
  }
  const { error } = await admin.from('session_attendance').upsert({
    session_id: session.id,
    user_id: employee.id,
    status,
    updated_by: actorId,
    check_in_time: status === 'present' || status === 'late' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'session_id,user_id' })
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `${employee.full_name || employee.email} marked ${status} for ${session.title}.` }
}

async function createFeedbackWindowCommand(admin: ReturnType<typeof createAdminClient>, actorId: string, args: Record<string, string>) {
  const batch = await findBatchByArgs(admin, args)
  if (!batch) return { error: 'Use: run create feedback form batch="..." title="..." closes_at=2026-06-10T18:00' }
  const session = args.session || args.session_id || args.title ? await findSessionByArgs(admin, { session: args.session, session_id: args.session_id }) : null
  const closesAt = args.closes_at || args.close_at || args.closes || args.close
  if (!closesAt) return { error: 'Feedback form needs closes_at=2026-06-10T18:00.' }
  const title = args.title || 'Training content and trainer feedback'
  const { data, error } = await admin.from('training_feedback_windows').insert({
    batch_id: batch.id,
    session_id: session?.id || null,
    title,
    closes_at: closesAt,
    status: args.status || 'open',
    created_by: actorId,
  }).select('id, title').single()
  if (error) return { error: error.message }
  const { data: members } = await admin.from('batch_members').select('id').eq('batch_id', batch.id)
  await admin.from('training_notifications').insert({
    batch_id: batch.id,
    session_id: session?.id || null,
    title: `Feedback open: ${title}`,
    message: `Feedback collection is open until ${new Date(closesAt).toLocaleString()}.`,
    audience: 'batch',
    channel: 'email',
    delivery_status: 'queued',
    created_by: actorId,
  })
  revalidateManagerPaths()
  return { message: `Feedback form "${data.title}" created for ${batch.title}. Notification queued for ${members?.length || 0} member(s).`, data }
}

async function updateFeedbackWindowCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  const window = await findFeedbackWindowByArgs(admin, args)
  if (!window) return { error: 'No feedback form matched id/title.' }
  const update: Record<string, any> = {}
  if (args.title || args.new_title) update.title = args.new_title || args.title
  if (args.closes_at || args.close_at) update.closes_at = args.closes_at || args.close_at
  if (args.status) update.status = args.status
  if (!Object.keys(update).length) return { error: 'Tell me what to update: title, closes_at, or status.' }
  const { data, error } = await admin.from('training_feedback_windows').update(update).eq('id', window.id).select('id, title').single()
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `Feedback form "${data.title}" updated.`, data }
}

async function deleteFeedbackWindowCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  if (args.all === 'true') {
    const { data } = await admin.from('training_feedback_windows').select('id')
    const { error } = await admin.from('training_feedback_windows').delete().not('id', 'is', null)
    if (error) return { error: error.message }
    revalidateManagerPaths()
    return { message: `${data?.length || 0} feedback form(s) deleted.` }
  }
  const window = await findFeedbackWindowByArgs(admin, args)
  if (!window) return { error: 'No feedback form matched id/title. Use all=true to delete all feedback forms.' }
  const { error } = await admin.from('training_feedback_windows').delete().eq('id', window.id)
  if (error) return { error: error.message }
  revalidateManagerPaths()
  return { message: `Feedback form "${window.title}" deleted.` }
}

async function clearScheduledCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  if ((args.confirmation || '').replace(/_/g, ' ') !== 'DELETE SCHEDULED') return { error: 'Add confirmation="DELETE SCHEDULED".' }
  const batch = args.batch || args.title || args.batch_id ? await findBatchByArgs(admin, args) : null
  let query = admin.from('training_sessions').select('id').eq('status', 'scheduled')
  if (batch) query = query.eq('batch_id', batch.id)
  const { data } = await query
  for (const session of data || []) await deleteSessionCascade(admin, session.id)
  revalidateManagerPaths()
  return { message: `${data?.length || 0} scheduled session(s) deleted.` }
}

async function clearTrainingCommand(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  if ((args.confirmation || '').replace(/_/g, ' ') !== 'DELETE TRAINING') return { error: 'Add confirmation="DELETE TRAINING".' }
  const { data: batches } = await admin.from('training_batches').select('id')
  for (const batch of batches || []) await deleteBatchCascade(admin, batch.id)
  revalidateManagerPaths()
  return { message: `${batches?.length || 0} training batch(es) deleted.` }
}

async function findProfileByArgs(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  let query = admin.from('profiles').select('*').limit(1)
  if (args.id || args.user_id) query = query.eq('id', args.id || args.user_id)
  else if (args.email) query = query.ilike('email', args.email)
  else if (args.employee_id || args.emp_id) query = query.eq('employee_id', args.employee_id || args.emp_id)
  else if (args.name) query = query.ilike('full_name', `%${args.name}%`)
  else return null
  const { data } = await query
  return data?.[0] || null
}

async function findQuizByArgs(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  let query = admin.from('quizzes').select('*').limit(1)
  if (args.id || args.quiz_id) query = query.eq('id', args.id || args.quiz_id)
  else if (args.title || args.quiz) query = query.ilike('title', `%${args.title || args.quiz}%`)
  else return null
  const { data } = await query
  return data?.[0] || null
}

async function findBatchByArgs(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  let query = admin.from('training_batches').select('*').limit(1)
  if (args.batch_id || args.id) query = query.eq('id', args.batch_id || args.id)
  else if (args.batch || args.title) query = query.ilike('title', `%${args.batch || args.title}%`)
  else return null
  const { data } = await query
  return data?.[0] || null
}

async function findSessionByArgs(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  let query = admin.from('training_sessions').select('*').limit(1)
  if (args.session_id || args.id) query = query.eq('id', args.session_id || args.id)
  else if (args.session || args.title) query = query.ilike('title', `%${args.session || args.title}%`)
  else return null
  const { data } = await query
  return data?.[0] || null
}

async function findQuestionByArgs(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  let query = admin.from('questions').select('*').limit(1)
  if (args.question_id || args.id) query = query.eq('id', args.question_id || args.id)
  else if (args.question || args.question_text || args.text) query = query.ilike('question_text', `%${args.question || args.question_text || args.text}%`)
  else return null
  if (args.quiz || args.quiz_id) {
    const quiz = await findQuizByArgs(admin, args)
    if (quiz) query = query.eq('quiz_id', quiz.id)
  }
  const { data } = await query
  return data?.[0] || null
}

async function findFeedbackWindowByArgs(admin: ReturnType<typeof createAdminClient>, args: Record<string, string>) {
  let query = admin.from('training_feedback_windows').select('*').limit(1)
  if (args.feedback_window_id || args.window_id || args.id) query = query.eq('id', args.feedback_window_id || args.window_id || args.id)
  else if (args.title || args.feedback) query = query.ilike('title', `%${args.title || args.feedback}%`)
  else if (args.batch || args.batch_id) {
    const batch = await findBatchByArgs(admin, args)
    if (!batch) return null
    query = query.eq('batch_id', batch.id).order('created_at', { ascending: false })
  } else return null
  const { data } = await query
  return data?.[0] || null
}

async function deleteSessionCascade(admin: ReturnType<typeof createAdminClient>, sessionId: string) {
  await admin.from('session_attendance_versions').delete().eq('session_id', sessionId)
  await admin.from('training_attendance_uploads').delete().eq('session_id', sessionId)
  await admin.from('session_attendance').delete().eq('session_id', sessionId)
  await admin.from('training_feedback_windows').update({ session_id: null }).eq('session_id', sessionId)
  await admin.from('training_feedback').delete().eq('session_id', sessionId)
  await admin.from('training_notifications').delete().eq('session_id', sessionId)
  const { error } = await admin.from('training_sessions').delete().eq('id', sessionId)
  if (error) throw new Error(error.message)
}

async function deleteBatchCascade(admin: ReturnType<typeof createAdminClient>, batchId: string) {
  const { data: sessions } = await admin.from('training_sessions').select('id').eq('batch_id', batchId)
  for (const session of sessions || []) await deleteSessionCascade(admin, session.id)
  await admin.from('quizzes').update({ batch_id: null }).eq('batch_id', batchId)
  await admin.from('assessment_results').delete().eq('batch_id', batchId)
  await admin.from('training_assessment_uploads').delete().eq('batch_id', batchId)
  await admin.from('training_automation_runs').delete().eq('batch_id', batchId)
  await admin.from('training_project_evaluations').delete().eq('batch_id', batchId)
  await admin.from('training_feedback').delete().eq('batch_id', batchId)
  await admin.from('training_feedback_windows').delete().eq('batch_id', batchId)
  await admin.from('training_notifications').delete().eq('batch_id', batchId)
  await admin.from('training_assessment_setups').delete().eq('batch_id', batchId)
  await admin.from('training_batch_trainers').delete().eq('batch_id', batchId)
  await admin.from('batch_members').delete().eq('batch_id', batchId)
  await admin.from('training_batch_change_audit').delete().eq('batch_id', batchId)
  const { error } = await admin.from('training_batches').delete().eq('id', batchId)
  if (error) throw new Error(error.message)
}

function splitList(value: string | undefined) {
  return (value || '').split(',').map((item) => item.trim()).filter(Boolean)
}

function extractQuizCreationIntent(text: string) {
  const args: Record<string, string> = {}
  const lower = normalize(text)
  const difficulty = lower.match(/\b(easy|medium|hard|advanced|hardcore)\b/)?.[1]
  if (difficulty) args.difficulty = difficulty

  const count = lower.match(/\b(\d{1,3})\s+(?:questions?|mcqs?)\b/)?.[1]
  if (count) args.question_count = count

  const duration = lower.match(/\b(\d{1,3})\s*(?:minutes?|mins?)\b/)?.[1]
  if (duration) args.time_limit_minutes = duration

  const passing = lower.match(/\b(?:passing|pass)\s*(?:score|mark)?\s*(?:is|=|:)?\s*(\d{1,3})\b/)?.[1]
  if (passing) args.passing_score = passing

  const due = text.match(/\bdue\s+(.+?)(?:,|\.|$)/i)?.[1]?.trim()
  if (due) args.due_date = due

  const department = text.match(/\bfor\s+(.+?)\s+(?:team|department)\b/i)?.[1]?.trim()
  if (department) args.department = cleanEntity(department)

  const assigned = text.match(/\bassign(?:ed)?\s+(?:it\s+)?to\s+(.+?)(?:\s+due\b|,|\.|$)/i)?.[1]?.trim()
  if (assigned) args.assigned_to = cleanEntity(assigned)

  const topicPatterns = [
    /\b(?:create|add)\s+(?:a\s+|an\s+)?(?:easy|medium|hard|advanced|hardcore)?\s*(?:quiz|assessment)\s+on\s+(.+?)(?:\s*,|\s+difficulty\b|\s+and\s+assign\b|\s+for\b|\s+due\b|$)/i,
    /\b(?:create|add)\s+(?:a\s+|an\s+)?(?:easy|medium|hard|advanced|hardcore)?\s*(.+?)\s+(?:quiz|assessment)\b/i,
    /\bgenerate\s+(?:\d{1,3}\s+)?(?:easy|medium|hard|advanced|hardcore)?\s*(.+?)\s+questions?\b/i,
    /\bgenerate\s+(?:\d{1,3}\s+)?questions?\s+on\s+(.+?)(?:\s*,|\s+difficulty\b|\s+and\s+assign\b|\s+for\b|\s+due\b|$)/i,
  ]
  for (const pattern of topicPatterns) {
    const topic = text.match(pattern)?.[1]?.trim()
    if (topic) {
      args.topic = cleanTopic(topic)
      break
    }
  }

  if (!args.topic && args.title && !/^create\b/i.test(args.title)) args.topic = cleanTopic(args.title)
  if (args.topic) {
    args.title = `${args.topic} Assessment`
    args.description ||= `AI generated ${args.difficulty || 'medium'} assessment on ${args.topic}.`
  }
  return args
}

function cleanTopic(value: string) {
  return cleanEntity(value)
    .replace(/\b(?:difficulty|level)\s+(?:easy|medium|hard|advanced|hardcore)\b/ig, '')
    .replace(/\b(?:easy|medium|hard|advanced|hardcore)\b/ig, '')
    .replace(/\b(?:quiz|assessment|questions?|mcqs?)\b/ig, '')
    .trim()
    .replace(/\s+/g, ' ')
}

function cleanEntity(value: string) {
  return value.replace(/^["']|["']$/g, '').replace(/\b(and|with)\b.*$/i, '').replace(/^(the|a|an)\s+/i, '').trim()
}

function normalizeDifficultyArg(value?: string): DifficultyLevel {
  const normalized = String(value || '').toLowerCase().trim() as DifficultyLevel
  return ['easy', 'medium', 'hard', 'advanced', 'hardcore'].includes(normalized) ? normalized : 'medium'
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function normalizeNaturalDueDate(value?: string) {
  if (!value) return undefined
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const lower = normalize(trimmed)
  const today = new Date()
  const addDays = (days: number) => {
    const date = new Date(today)
    date.setDate(today.getDate() + days)
    return date.toISOString().slice(0, 10)
  }
  if (lower === 'today') return addDays(0)
  if (lower === 'tomorrow') return addDays(1)

  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const weekdayIndex = weekdays.indexOf(lower)
  if (weekdayIndex >= 0) {
    const current = today.getDay()
    const delta = (weekdayIndex - current + 7) % 7 || 7
    return addDays(delta)
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return undefined
}

async function generateQuestionsForChatbotQuiz(
  admin: ReturnType<typeof createAdminClient>,
  input: { quizId: string; topic: string; difficulty: DifficultyLevel; count: number; objective: string },
) {
  const hasAI = Boolean(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.GOOGLE_GEMINI_API_KEY)
  const questions = hasAI
    ? await generateChatbotQuestionsWithAI(input).catch(() => generateTemplateChatbotQuestions(input))
    : generateTemplateChatbotQuestions(input)

  const uniqueQuestions = questions
    .filter((question, index, collection) => collection.findIndex((item) => item.question_text.toLowerCase() === question.question_text.toLowerCase()) === index)
    .slice(0, input.count)

  while (uniqueQuestions.length < input.count) {
    uniqueQuestions.push(...generateTemplateChatbotQuestions({ ...input, count: input.count - uniqueQuestions.length }))
  }

  const rows = uniqueQuestions.slice(0, input.count).map((question, index) => ({
    quiz_id: input.quizId,
    question_text: question.question_text,
    options: question.options,
    explanation: question.explanation || null,
    difficulty: question.difficulty || input.difficulty,
    is_ai_generated: hasAI,
    order_index: index,
  }))

  const { data, error } = await admin.from('questions').insert(rows).select('id')
  if (error) return { count: 0, method: `failed (${error.message})` }
  return { count: data?.length || 0, method: hasAI ? 'AI-generated' : 'template-generated' }
}

async function generateChatbotQuestionsWithAI(input: { topic: string; difficulty: DifficultyLevel; count: number; objective: string }) {
  const prompt = `Generate ${input.count} unique multiple-choice questions about ${input.topic}.
Difficulty: ${input.difficulty}
Assessment objective: ${input.objective}
Question types: practical understanding, applied scenarios, terminology, troubleshooting, and evaluation.
Requirements:
- Exactly 4 options per question
- Exactly one correct option
- Include a concise explanation
- Avoid duplicate questions
- Return JSON only as an array of {"question_text":string,"options":[{"text":string,"isCorrect":boolean}],"explanation":string,"difficulty":"${input.difficulty}"}`

  const { text } = await callAI(
    [
      { role: 'system', content: 'You generate valid quiz JSON only. Do not include markdown.' },
      { role: 'user', content: prompt },
    ],
    { maxTokens: 4000, temperature: 0.5 }
  )
  const parsed = JSON.parse(stripCodeFences(text))
  return normalizeGeneratedQuestions(Array.isArray(parsed) ? parsed : [parsed], input)
}

function normalizeGeneratedQuestions(raw: any[], input: { topic: string; difficulty: DifficultyLevel; count: number }) {
  return raw
    .filter((question) =>
      question?.question_text
      && Array.isArray(question.options)
      && question.options.length === 4
      && question.options.filter((option: any) => option?.isCorrect === true).length === 1
    )
    .map((question) => ({
      question_text: String(question.question_text).slice(0, 397),
      options: question.options.map((option: any) => ({ text: String(option.text || '').slice(0, 397), isCorrect: option.isCorrect === true })),
      explanation: question.explanation ? String(question.explanation).slice(0, 397) : `This answer best fits ${input.topic}.`,
      difficulty: normalizeDifficultyArg(question.difficulty || input.difficulty),
    }))
}

function generateTemplateChatbotQuestions(input: { topic: string; difficulty: DifficultyLevel; count: number }) {
  return Array.from({ length: input.count }, (_, index) => ({
    question_text: `${input.topic}: ${templateQuestionStem(index)}`,
    options: [
      { text: templateCorrectAnswer(input.topic, index), isCorrect: true },
      { text: `A loosely related but incorrect ${input.topic} statement`, isCorrect: false },
      { text: `An outdated or incomplete ${input.topic} approach`, isCorrect: false },
      { text: `A misconception that ignores ${input.topic} constraints`, isCorrect: false },
    ].sort(() => Math.random() - 0.5),
    explanation: `The correct option reflects practical ${input.topic} understanding.`,
    difficulty: input.difficulty,
  }))
}

function templateQuestionStem(index: number) {
  const stems = [
    'which option best describes the core concept?',
    'which scenario shows the most appropriate use?',
    'what is the safest troubleshooting step?',
    'which trade-off should a practitioner evaluate first?',
    'which metric best confirms the expected outcome?',
  ]
  return stems[index % stems.length]
}

function templateCorrectAnswer(topic: string, index: number) {
  const answers = [
    `A principle-based explanation grounded in ${topic}`,
    `Applying ${topic} to a realistic business or engineering scenario`,
    `Checking assumptions, inputs, and outputs before changing the system`,
    `Balancing accuracy, reliability, cost, and maintainability`,
    `Using measurable evidence to validate ${topic} performance`,
  ]
  return answers[index % answers.length]
}

async function assignQuizToNaturalAssignee(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  quizId: string,
  assignee: string,
  dueDate?: string,
) {
  const emails = splitList(assignee).filter((item) => item.includes('@'))
  let employees: any[] | null = null
  if (emails.length) {
    const { data } = await admin.from('profiles').select('id, email').in('email', emails).eq('role', 'employee')
    employees = data || []
  } else {
    const { data } = await admin.from('profiles').select('id, email').ilike('full_name', `%${assignee}%`).eq('role', 'employee').limit(10)
    employees = data || []
  }
  if (!employees.length) return { error: `No employee matched "${assignee}".`, count: 0 }
  const { error } = await admin.from('quiz_assignments').upsert(employees.map((employee) => ({
    quiz_id: quizId,
    user_id: employee.id,
    assigned_by: actorId,
    due_date: dueDate || null,
  })), { onConflict: 'quiz_id,user_id' })
  return { error: error?.message, count: error ? 0 : employees.length }
}

async function assignQuizToDepartment(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  quizId: string,
  department: string,
  dueDate?: string,
) {
  const { data: employees } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'employee')
    .or(`department.ilike.%${department}%,domain.ilike.%${department}%`)
    .limit(200)
  if (!employees?.length) return { error: `No employees matched department/team "${department}".`, count: 0 }
  const { error } = await admin.from('quiz_assignments').upsert(employees.map((employee: any) => ({
    quiz_id: quizId,
    user_id: employee.id,
    assigned_by: actorId,
    due_date: dueDate || null,
  })), { onConflict: 'quiz_id,user_id' })
  return { error: error?.message, count: error ? 0 : employees.length }
}

function buildQuestionOptions(args: Record<string, string>) {
  const optionValues = [
    args.option_a || args.a,
    args.option_b || args.b,
    args.option_c || args.c,
    args.option_d || args.d,
  ]
  if (optionValues.some((option) => !option)) return null
  const correct = (args.correct_answer || args.correct || args.answer || 'A').trim().toUpperCase().charAt(0)
  const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correct)
  if (correctIndex < 0) return null
  return optionValues.map((text, index) => ({ text, isCorrect: index === correctIndex }))
}

function revalidateManagerPaths() {
  revalidatePath('/manager', 'layout')
  revalidatePath('/manager/ai-command')
  revalidatePath('/manager/operations')
  revalidatePath('/manager/quizzes')
  revalidatePath('/manager/employees')
  revalidatePath('/manager/admin')
  revalidatePath('/employee', 'layout')
}

function buildChatbotContext(data: Record<string, any[]>) {
  const profileById = new Map(data.profiles.map((profile) => [profile.id, profile]))
  const rows = data.attempts.slice(0, 120).map((attempt) => {
    const profile = profileById.get(attempt.user_id)
    const behavior = analyzeAttemptPattern((attempt.answers || []) as QuizAnswer[], attempt.quizzes?.difficulty as DifficultyLevel)
    return [
      profile?.full_name || profile?.email || 'Unknown',
      profile?.employee_id || 'no-id',
      profile?.domain || profile?.department || 'General',
      attempt.quizzes?.title || 'Quiz',
      attempt.quizzes?.topic || 'General',
      `${attempt.score}%`,
      `${attempt.correct_answers}/${attempt.total_questions}`,
      `${attempt.points_earned || 0}pts`,
      `focus=${behavior.focusScore}`,
      `risk=${behavior.riskLevel}`,
    ].join('|')
  })

  const quizSummary = data.quizzes.slice(0, 60).map((quiz) =>
    `${quiz.title}|${quiz.topic}|${quiz.difficulty}|pass=${quiz.passing_score}`
  )

  const badgeSummary = data.badges.slice(0, 80).map((entry) =>
    `${entry.user_id}|${entry.badges?.name}|${entry.badges?.category}|${entry.badges?.rarity}`
  )

  const certSummary = data.certificates.slice(0, 60).map((cert) =>
    `${cert.user_id}|${cert.title}|${cert.score}%|${cert.issued_at}`
  )
  const certRuleSummary = data.certificateRules.slice(0, 80).map((rule) =>
    `${rule.quizzes?.title || rule.quiz_id}|${rule.quizzes?.topic || 'General'}|enabled=${rule.enabled}|min=${rule.min_score}|name=${rule.certificate_name || rule.title}`
  )
  const assignmentSummary = data.assignments.slice(0, 100).map((assignment) => {
    const profile = profileById.get(assignment.user_id)
    return `${profile?.full_name || profile?.email || assignment.user_id}|${assignment.quizzes?.title || assignment.quiz_id}|due=${assignment.due_date || 'none'}|assigned=${assignment.assigned_at || 'unknown'}`
  })
  const batchSummary = data.batches.slice(0, 80).map((batch) => {
    const members = data.batchMembers.filter((member) => member.batch_id === batch.id)
    return `${batch.title}|${batch.domain || 'General'}|status=${batch.status}|members=${members.length}|start=${batch.start_date || 'none'}|end=${batch.end_date || 'none'}`
  })
  const assessmentSummary = data.assessmentResults.slice(0, 100).map((result) =>
    `${result.candidate_name || result.candidate_email}|${result.test_name || result.quiz_id || 'Assessment'}|${result.percentage ?? result.test_score ?? 'N/A'}%|status=${result.test_status || 'unknown'}|proctor=${result.proctoring_flag || 'none'}`
  )
  const proctoringSummary = data.proctoringEvents.slice(0, 80).map((event) =>
    `${event.profiles?.full_name || event.profiles?.email || event.employee_id}|${event.quizzes?.title || event.quiz_id}|${event.violation_type}|severity=${event.severity || 'unknown'}|risk=${event.risk_score || 0}|${event.occurred_at}`
  )

  return [
    'ATTEMPTS name|empId|domain|quiz|topic|score|correct|points|focus|risk',
    rows.join('\n') || 'none',
    'QUIZZES title|topic|difficulty|passing',
    quizSummary.join('\n') || 'none',
    'BADGES userId|badge|category|rarity',
    badgeSummary.join('\n') || 'none',
    'CERTIFICATES userId|title|score|issued',
    certSummary.join('\n') || 'none',
    'CERTIFICATE_RULES quiz|topic|enabled|minScore|certificateName',
    certRuleSummary.join('\n') || 'none',
    'ASSIGNMENTS name|quiz|due|assigned',
    assignmentSummary.join('\n') || 'none',
    'BATCHES title|domain|status|members|start|end',
    batchSummary.join('\n') || 'none',
    'IMPORTED_ASSESSMENTS candidate|test|score|status|proctor',
    assessmentSummary.join('\n') || 'none',
    'PROCTORING employee|quiz|violation|severity|risk|time',
    proctoringSummary.join('\n') || 'none',
  ].join('\n')
}

function buildDeterministicAnswer(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  const proactive = summarizeProactiveBriefing(message, data)
  if (proactive) return proactive

  const executive = summarizeExecutiveMode(message, data)
  if (executive) return executive

  const riskPlan = summarizeTrainingRiskReport(message, data)
  if (riskPlan) return riskPlan

  const anomalies = summarizeAnomalies(message, data)
  if (anomalies) return anomalies

  const recovery = summarizeRecoveryPlan(message, data)
  if (recovery) return recovery

  const rootCause = explainBusinessRuleQuestion(message, data)
  if (rootCause) return rootCause

  const insights = summarizeInsightsEngine(message, data)
  if (insights) return insights

  const inactiveEmployees = summarizeInactiveEmployees(message, data)
  if (inactiveEmployees) return inactiveEmployees

  const report = summarizeOperationsReport(message, data)
  if (report) return report

  const pending = summarizePendingAssessments(message, data)
  if (pending) return pending

  const failed = summarizeFailedEmployees(message, data)
  if (failed) return failed

  const lowScores = summarizeLowScores(message, data)
  if (lowScores) return lowScores

  const topPerformers = summarizeTopPerformers(message, data)
  if (topPerformers) return topPerformers

  const batchAnalysis = summarizeBatchOperations(message, data)
  if (batchAnalysis) return batchAnalysis

  const domainAnalysis = summarizeDomainPerformance(message, data)
  if (domainAnalysis) return domainAnalysis

  const attendance = summarizeAttendance(message, data)
  if (attendance) return attendance

  const proctoring = summarizeProctoring(message, data)
  if (proctoring) return proctoring

  const roleTarget = extractRoleRecommendationTarget(message)
  if (roleTarget) {
    return summarizeRoleRecommendations(roleTarget, data)
  }

  const profile = findProfile(lower, data.profiles)
  const quiz = findQuiz(lower, data.quizzes, data.attempts)
  const asksForResult = /\b(result|score|marks?|performance|analysis|attempt)\b/.test(lower)
  const asksForLatest = /\b(latest|last|recent|most recent)\b/.test(lower)

  if ((lower.includes('average') || lower.includes('avg')) && lower.includes('score')) {
    const quizAverage = quiz ? summarizeQuiz(quiz, data.attempts, data.certificateRules) : null
    if (quizAverage) return quizAverage
  }

  if (profile && quiz) {
    return summarizeEmployeeQuiz(profile, quiz, data.attempts)
  }

  if (profile && (asksForResult || asksForLatest || lower.includes('quiz'))) {
    return asksForLatest ? summarizeEmployeeLatestAttempt(profile, data.attempts) : summarizeEmployee(profile, data.attempts)
  }

  if (quiz && (asksForResult || lower.includes('pass'))) {
    return summarizeQuiz(quiz, data.attempts, data.certificateRules)
  }

  if (lower.includes('certificate')) {
    return summarizeCertificates(data.profiles, data.attempts, data.certificateRules, data.certificates)
  }

  if (lower.includes('weak') || lower.includes('lowest') || lower.includes('risk')) {
    return summarizeWeakAreas(data.attempts)
  }

  return null
}

function summarizeInactiveEmployees(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  const asksForInactive =
    /\b(not\s+(taken|attempted|completed)|no\s+(test|quiz|attempt)|never\s+(taken|attempted|completed)|inactive|idle|missed|haven't\s+(taken|attempted)|hasn't\s+(taken|attempted))\b/.test(lower)
    && /\b(employee|employees|learner|learners|test|quiz|assessment|attempt)\b/.test(lower)

  if (!asksForInactive) return null

  const days = extractLookbackDays(message) ?? 10
  const employees = data.profiles.filter((profile) => profile.role === 'employee')
  if (!employees.length) return 'No employee profiles are available.'
  const inactive = getInactiveEmployeeRows(message, data, days)

  if (!inactive.length) {
    return `All ${employees.length} employee(s) have completed at least one test in the past ${days} day(s).`
  }

  const visible = inactive.slice(0, 12)
  const lines = visible.map((item, index) => {
    const profile = item.profile
    const lastSeen = item.latest?.completed_at ? formatDateTime(item.latest.completed_at) : 'never'
    const lastQuiz = item.latest?.quizzes?.title ? `; last quiz: ${item.latest.quizzes.title}` : ''
    const empId = profile.employee_id ? ` (${profile.employee_id})` : ''
    const domain = profile.domain || profile.department ? ` - ${profile.domain || profile.department}` : ''
    return `${index + 1}. ${displayName(profile)}${empId}${domain} - last test: ${lastSeen}${lastQuiz}`
  })

  return [
    `${inactive.length} of ${employees.length} employee(s) have not taken any test in the past ${days} day(s).`,
    ...lines,
    inactive.length > visible.length ? `Showing first ${visible.length}; ${inactive.length - visible.length} more inactive employee(s) not shown.` : '',
    `Next action: open /manager/employees to assign a quiz or send reminders.`,
  ].filter(Boolean).join('\n')
}

function summarizeProactiveBriefing(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/^\/?(briefing|proactive|morning brief|good morning|daily brief)\b/.test(lower)) return null
  const inactive = getInactiveEmployeeRows('inactive employees past 10 days', data, 10)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = tomorrow.toISOString().slice(0, 10)
  const attempts = new Set(data.attempts.map((attempt) => `${attempt.quiz_id}:${attempt.user_id}`))
  const expiring = data.assignments.filter((assignment) =>
    assignment.due_date?.slice(0, 10) === tomorrowKey && !attempts.has(`${assignment.quiz_id}:${assignment.user_id}`)
  )
  const highRisk = data.proctoringEvents.filter((event) => ['high', 'critical'].includes(String(event.severity)))
  const atRisk = getEmployeeRiskRows(data).filter((row) => row.risk >= 70)

  return [
    'Good morning.',
    '',
    `${inactive.length || expiring.length || highRisk.length || atRisk.length ? 'Critical items need attention:' : 'No critical training operations alerts found in the loaded data.'}`,
    `KPI | Value`,
    `Inactive > 10 days | ${inactive.length}`,
    `Assessments expiring tomorrow | ${expiring.length}`,
    `High-risk proctoring incidents | ${highRisk.length}`,
    `Employees at critical training risk | ${atRisk.length}`,
    '',
    'Recommended actions:',
    inactive.length ? '- Send reminders to inactive employees' : '- No inactivity reminder needed',
    expiring.length ? '- Review or extend assignments expiring tomorrow' : '- No assignment deadline action needed for tomorrow',
    highRisk.length ? '- Review integrity incidents before certificate issuance' : '- No high-risk proctoring review queue found',
  ].join('\n')
}

function summarizeExecutiveMode(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!(/^\/exec\b/.test(lower) || /\b(executive summary|entire training organization|c-level|leadership summary|organization summary)\b/.test(lower))) return null
  const employees = data.profiles.filter((profile) => profile.role === 'employee')
  const activeWindow = new Date()
  activeWindow.setDate(activeWindow.getDate() - 30)
  const activeLearners = new Set(data.attempts.filter((attempt) => new Date(attempt.completed_at || 0) >= activeWindow).map((attempt) => attempt.user_id))
  const inactive = getInactiveEmployeeRows('inactive employees past 10 days', data, 10)
  const attemptedUsers = new Set(data.attempts.map((attempt) => attempt.user_id))
  const riskRows = getEmployeeRiskRows(data)
  const critical = riskRows.filter((row) => row.risk >= 70)
  const domainRows = getDomainHealthRows(data)
  const topDomain = domainRows.slice().sort((a, b) => b.avg - a.avg || b.completion - a.completion)[0]
  const weakDomain = domainRows.slice().sort((a, b) => a.avg - b.avg || a.completion - b.completion)[0]
  const highRiskEvents = data.proctoringEvents.filter((event) => ['high', 'critical'].includes(String(event.severity))).length
  const pending = summarizePendingCount(data)
  const completionRate = employees.length ? Math.round((attemptedUsers.size / employees.length) * 100) : 0

  return [
    'Executive Summary',
    `KPI | Value`,
    `Total learners | ${employees.length}`,
    `Active learners, 30 days | ${activeLearners.size}`,
    `Inactive learners > 10 days | ${inactive.length}`,
    `Assessment completion coverage | ${completionRate}%`,
    `Average score | ${average(data.attempts.map((attempt) => Number(attempt.score || 0))) || 'N/A'}%`,
    `Pending assignments | ${pending}`,
    `Critical at-risk employees | ${critical.length}`,
    `Top domain | ${topDomain ? `${topDomain.domain} (${topDomain.avg}% avg, ${topDomain.completion}% completion)` : 'N/A'}`,
    `Weakest domain | ${weakDomain ? `${weakDomain.domain} (${weakDomain.avg}% avg, ${weakDomain.completion}% completion)` : 'N/A'}`,
    `High/Critical proctoring events | ${highRiskEvents}`,
    '',
    'Insight:',
    buildExecutiveInsight(domainRows, inactive, data),
    '',
    'Recommendations:',
    '- Clear overdue and pending assignments before adding new assessments.',
    '- Review critical at-risk employees with trainer notes and attendance evidence.',
    '- Resolve high-risk proctoring events before issuing final outcomes.',
  ].join('\n')
}

function summarizeTrainingRiskReport(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/\b(at risk|risk of failing|failing.*training goals|training goals|likely to fail|risk report)\b/.test(lower)) return null
  const rows = getEmployeeRiskRows(data).filter((row) => row.risk > 0).sort((a, b) => b.risk - a.risk)
  if (!rows.length) return 'No employees show measurable training risk in the loaded data.'
  const critical = rows.filter((row) => row.risk >= 70).length
  const high = rows.filter((row) => row.risk >= 50 && row.risk < 70).length
  return [
    `Training Goal Risk Report: ${rows.length} employee(s) have at least one risk signal.`,
    `KPI | Value`,
    `Critical risk | ${critical}`,
    `High risk | ${high}`,
    `Medium risk | ${rows.filter((row) => row.risk >= 30 && row.risk < 50).length}`,
    '',
    `Rank | Employee | Risk | Key drivers`,
    ...rows.slice(0, 15).map((row, index) => `${index + 1} | ${displayName(row.profile)} | ${row.risk}% | ${row.reasons.slice(0, 4).join('; ')}`),
    '',
    'Planning steps used: attendance, assessment attempts, scores, pending assignments, inactivity, and proctoring risk.',
    'Recommendation: start with critical-risk employees, then create recovery groups by domain and weakest assessment topic.',
  ].join('\n')
}

function summarizeAnomalies(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/\b(anything unusual|unusual|anomal|red flag|red flags|what changed|this week|problem this week)\b/.test(lower)) return null
  const now = new Date()
  const weekAgo = daysAgo(7)
  const twoWeeksAgo = daysAgo(14)
  const thisWeekAttempts = data.attempts.filter((attempt) => dateBetween(attempt.completed_at, weekAgo, now))
  const previousAttempts = data.attempts.filter((attempt) => dateBetween(attempt.completed_at, twoWeeksAgo, weekAgo))
  const thisWeekAvg = average(thisWeekAttempts.map((attempt) => Number(attempt.score || 0)))
  const previousAvg = average(previousAttempts.map((attempt) => Number(attempt.score || 0)))
  const thisWeekAttendance = data.attendance.filter((item) => dateBetween(item.session?.session_date, weekAgo, now))
  const previousAttendance = data.attendance.filter((item) => dateBetween(item.session?.session_date, twoWeeksAgo, weekAgo))
  const thisAttendanceRate = overallAttendanceRate(thisWeekAttendance)
  const prevAttendanceRate = overallAttendanceRate(previousAttendance)
  const thisWeekProctoring = data.proctoringEvents.filter((event) => dateBetween(event.occurred_at, weekAgo, now))
  const previousProctoring = data.proctoringEvents.filter((event) => dateBetween(event.occurred_at, twoWeeksAgo, weekAgo))
  const inactive = getInactiveEmployeeRows('inactive employees past 10 days', data, 10)
  const certGap = getCertificateGapRows(data).length
  const findings: string[] = []

  if (previousAvg && thisWeekAvg && previousAvg - thisWeekAvg >= 10) findings.push(`Score drop: average fell from ${previousAvg}% to ${thisWeekAvg}% this week.`)
  if (prevAttendanceRate && thisAttendanceRate && prevAttendanceRate - thisAttendanceRate >= 12) findings.push(`Attendance drop: attendance fell from ${prevAttendanceRate}% to ${thisAttendanceRate}%.`)
  if (thisWeekProctoring.length >= Math.max(3, previousProctoring.length * 2)) findings.push(`Proctoring spike: ${thisWeekProctoring.length} event(s) this week vs ${previousProctoring.length} in the previous week.`)
  if (inactive.length >= 10) findings.push(`Inactivity concentration: ${inactive.length} employee(s) inactive for more than 10 days.`)
  if (certGap >= 5) findings.push(`Certificate gap: ${certGap} eligible certificate(s) not issued.`)

  if (!findings.length) {
    return [
      'Anomaly Scan',
      'No major unusual pattern was detected in the loaded weekly data.',
      `Signals checked: score movement, attendance movement, proctoring spikes, inactivity, and certificate gaps.`,
    ].join('\n')
  }

  return [
    'Anomaly Scan',
    ...findings.map((finding) => `- ${finding}`),
    '',
    'Recommendation:',
    'Investigate the largest movement first, then generate a focused recovery plan for the affected domain or quiz.',
  ].join('\n')
}

function summarizeRecoveryPlan(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/\b(recovery plan|remediation plan|catch-up plan|improvement plan)\b/.test(lower)) return null
  const threshold = extractScoreThreshold(message) ?? 50
  const rows = getLowScoreEmployees(`below ${threshold}`, data)
  if (!rows.length) return `No employees below ${threshold}% were found in the loaded records.`
  const grouped = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = row.profile.domain || row.profile.department || 'Unassigned'
    grouped.set(key, [...(grouped.get(key) || []), row])
  }
  const groups = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)
  return [
    `Recovery Plan for Employees Below ${threshold}%`,
    `KPI | Value`,
    `Employees needing recovery | ${rows.length}`,
    `Domains affected | ${groups.length}`,
    `Lowest score | ${Math.min(...rows.map((row) => row.score))}%`,
    '',
    'Recovery groups:',
    ...groups.slice(0, 8).map(([domain, items]) => `- ${domain}: ${items.length} employee(s), avg ${average(items.map((item) => item.score))}%`),
    '',
    'Recommended workflow:',
    '1. Send reminder and support note to the recovery group.',
    '2. Assign a remedial assessment for the weakest topic.',
    '3. Schedule a catch-up session within 3 working days.',
    '4. Re-test and review proctoring flags before certificate decisions.',
    '',
    'To execute messaging safely, ask: "Send reminder to employees below 50%" and confirm the preview.',
  ].join('\n')
}

function explainBusinessRuleQuestion(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/\bwhy\b/.test(lower)) return null
  if (/\b(blocked|cannot login|access denied|pending approval)\b/.test(lower)) return explainUserAccess(message, data)
  if (/\bcertificate|cert\b/.test(lower)) return explainCertificateIssue(message, data)
  if (/\b(assessment|test|quiz|attempt)\b.*\b(fail|failed|not pass|rejected)\b/.test(lower)) return explainAssessmentFailure(message, data)
  if (/\bquiz\b.*\b(hidden|not visible|invisible|draft|unavailable)\b/.test(lower)) return explainQuizVisibility(message, data)
  return null
}

function summarizeInsightsEngine(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/\b(insight|insights|root cause|potential cause|recommendation|recommendations|why is .*performing poorly|struggling most)\b/.test(lower)) return null
  const domainRows = getDomainHealthRows(data)
  if (!domainRows.length) return 'I could not find enough domain data to generate insights.'
  const weakest = domainRows.slice().sort((a, b) => a.avg - b.avg || a.completion - b.completion)[0]
  const strongest = domainRows.slice().sort((a, b) => b.avg - a.avg || b.completion - a.completion)[0]
  const inactiveByDomain = new Map<string, number>()
  for (const item of getInactiveEmployeeRows('inactive employees past 10 days', data, 10)) {
    const domain = item.profile.domain || item.profile.department || 'Unassigned'
    inactiveByDomain.set(domain, (inactiveByDomain.get(domain) || 0) + 1)
  }
  const mostInactive = [...inactiveByDomain.entries()].sort((a, b) => b[1] - a[1])[0]
  const weakTopic = getWeakestTopic(data.attempts)
  return [
    'AI Insights',
    `Insight: ${weakest.domain} is the weakest loaded domain at ${weakest.avg || 'N/A'}% average and ${weakest.completion}% completion.`,
    strongest && strongest.domain !== weakest.domain ? `Benchmark: ${strongest.domain} is leading at ${strongest.avg || 'N/A'}% average and ${strongest.completion}% completion.` : '',
    mostInactive ? `Inactivity signal: ${mostInactive[0]} has the highest inactive count (${mostInactive[1]} learner(s) inactive > 10 days).` : '',
    weakTopic ? `Potential cause: ${weakTopic.topic} is the weakest assessment topic (${weakTopic.avg}% avg across ${weakTopic.count} attempt(s)).` : '',
    'Recommendation: combine reminders with a targeted catch-up session, then re-assess only the weak topic instead of re-running the full program.',
  ].filter(Boolean).join('\n')
}

function extractLookbackDays(message: string) {
  const explicit = message.match(/\b(?:past|last|previous|in)\s+(\d{1,3})\s*(day|days|week|weeks|month|months)\b/i)
  const loose = message.match(/\b(\d{1,3})\s*(day|days|week|weeks|month|months)\b/i)
  const match = explicit || loose
  if (!match) return null
  const value = Number(match[1])
  if (!Number.isFinite(value) || value <= 0) return null
  const unit = match[2].toLowerCase()
  if (unit.startsWith('week')) return value * 7
  if (unit.startsWith('month')) return value * 30
  return value
}

function getInactiveEmployeeRows(message: string, data: Record<string, any[]>, fallbackDays = 10) {
  const days = extractLookbackDays(message) ?? fallbackDays
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const domainFilter = extractDomainFilter(message)
  const attemptsByUser = groupBy(data.attempts, 'user_id')

  return data.profiles
    .filter((profile) => profile.role === 'employee')
    .filter((profile) => matchesDomain(profile, domainFilter))
    .map((profile) => {
      const attempts = (attemptsByUser.get(profile.id) || []).slice().sort(byLatest)
      const latest = attempts[0] || null
      const hasRecentAttempt = attempts.some((attempt) => {
        if (!attempt.completed_at) return false
        const completed = new Date(attempt.completed_at)
        return !Number.isNaN(completed.getTime()) && completed >= cutoff
      })
      return { profile, latest, attemptsCount: attempts.length, hasRecentAttempt }
    })
    .filter((item) => !item.hasRecentAttempt)
    .sort((left, right) => {
      if (!left.latest && right.latest) return -1
      if (left.latest && !right.latest) return 1
      return new Date(left.latest?.completed_at || 0).getTime() - new Date(right.latest?.completed_at || 0).getTime()
    })
}

function summarizePendingAssessments(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/\b(pending|due|overdue|not completed|incomplete|missed)\b.*\b(assessment|quiz|test|assignment)\b/.test(lower)) return null
  const now = new Date()
  const attempts = new Set(data.attempts.map((attempt) => `${attempt.quiz_id}:${attempt.user_id}`))
  const rows = data.assignments
    .filter((assignment) => !attempts.has(`${assignment.quiz_id}:${assignment.user_id}`))
    .map((assignment) => ({
      assignment,
      profile: data.profiles.find((profile) => profile.id === assignment.user_id),
      overdue: assignment.due_date ? new Date(assignment.due_date) < now : false,
    }))
    .filter((item) => item.profile?.role === 'employee')
    .filter((item) => matchesDomain(item.profile, extractDomainFilter(message)))
    .sort((left, right) => Number(right.overdue) - Number(left.overdue) || new Date(left.assignment.due_date || 8640000000000000).getTime() - new Date(right.assignment.due_date || 8640000000000000).getTime())

  if (!rows.length) return 'I could not find any pending assessment assignments in the loaded records.'
  const overdue = rows.filter((row) => row.overdue).length
  return [
    `Pending assessments: ${rows.length} employee assignment(s), ${overdue} overdue.`,
    ...rows.slice(0, 12).map((row, index) => `${index + 1}. ${displayName(row.profile)} - ${row.assignment.quizzes?.title || 'Quiz'} - due ${row.assignment.due_date || 'not set'}${row.overdue ? ' - OVERDUE' : ''}`),
    rows.length > 12 ? `Showing first 12; ${rows.length - 12} more pending assignment(s).` : '',
    'Recommendation: send reminders for overdue items and review due dates for assignments without deadlines.',
  ].filter(Boolean).join('\n')
}

function summarizeFailedEmployees(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/\b(failed|failures|did not pass|below passing)\b/.test(lower)) return null
  const rows = getFailedEmployees(message, data)
  if (!rows.length) return 'I could not find any matching failed assessment records.'
  return [
    `${rows.length} employee(s) failed the matching assessment criteria.`,
    ...rows.slice(0, 12).map((row, index) => `${index + 1}. ${displayName(row.profile)} - ${row.quizTitle} - ${row.score}% (pass ${row.passScore}%)`),
    rows.length > 12 ? `Showing first 12; ${rows.length - 12} more failure record(s).` : '',
    'Recommendation: assign a remedial quiz and notify the reporting trainer.',
  ].filter(Boolean).join('\n')
}

function getFailedEmployees(message: string, data: Record<string, any[]>) {
  const domainFilter = extractDomainFilter(message)
  const quizFilter = extractTopicFilter(message, data)
  return data.attempts
    .map((attempt) => {
      const profile = data.profiles.find((item) => item.id === attempt.user_id)
      const quiz = data.quizzes.find((item) => item.id === attempt.quiz_id)
      const passScore = Number(quiz?.passing_score || 60)
      return { profile, attempt, quizTitle: attempt.quizzes?.title || quiz?.title || 'Quiz', quizTopic: attempt.quizzes?.topic || quiz?.topic || '', score: Number(attempt.score || 0), passScore }
    })
    .filter((row) => row.profile?.role === 'employee' && row.score < row.passScore)
    .filter((row) => matchesDomain(row.profile, domainFilter))
    .filter((row) => !quizFilter || normalize(`${row.quizTitle} ${row.quizTopic}`).includes(quizFilter))
    .sort((left, right) => left.score - right.score)
}

function summarizeLowScores(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/\b(low score|low scores|below|under|less than|scored below|need improvement)\b/.test(lower)) return null
  const rows = getLowScoreEmployees(message, data)
  if (!rows.length) return 'I could not find any matching low-score records.'
  const threshold = extractScoreThreshold(message) ?? 70
  return [
    `${rows.length} employee(s) scored below ${threshold}%.`,
    ...rows.slice(0, 12).map((row, index) => `${index + 1}. ${displayName(row.profile)} - ${row.quizTitle} - ${row.score}%`),
    rows.length > 12 ? `Showing first 12; ${rows.length - 12} more low-score record(s).` : '',
    'Recommendation: review weak topics and schedule a catch-up assessment.',
  ].filter(Boolean).join('\n')
}

function getLowScoreEmployees(message: string, data: Record<string, any[]>) {
  const threshold = extractScoreThreshold(message) ?? 70
  const domainFilter = extractDomainFilter(message)
  const quizFilter = extractTopicFilter(message, data)
  return data.attempts
    .map((attempt) => ({
      profile: data.profiles.find((profile) => profile.id === attempt.user_id),
      attempt,
      quizTitle: attempt.quizzes?.title || 'Quiz',
      quizTopic: attempt.quizzes?.topic || '',
      score: Number(attempt.score || 0),
    }))
    .filter((row) => row.profile?.role === 'employee' && row.score < threshold)
    .filter((row) => matchesDomain(row.profile, domainFilter))
    .filter((row) => !quizFilter || normalize(`${row.quizTitle} ${row.quizTopic}`).includes(quizFilter))
    .sort((left, right) => left.score - right.score)
}

function summarizeTopPerformers(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/\b(top|best|highest|leaderboard|rank)\b/.test(lower) || !/\b(performer|performers|score|scorers|employees|learners)\b/.test(lower)) return null
  const monthOnly = /\b(month|monthly|this month)\b/.test(lower)
  const cutoff = new Date()
  if (monthOnly) cutoff.setDate(cutoff.getDate() - 30)
  const domainFilter = extractDomainFilter(message)
  const attemptsByUser = groupBy(data.attempts.filter((attempt) => !monthOnly || new Date(attempt.completed_at || 0) >= cutoff), 'user_id')
  const rows = data.profiles
    .filter((profile) => profile.role === 'employee')
    .filter((profile) => matchesDomain(profile, domainFilter))
    .map((profile) => {
      const attempts = attemptsByUser.get(profile.id) || []
      return { profile, count: attempts.length, avg: average(attempts.map((attempt) => Number(attempt.score || 0))), best: Math.max(0, ...attempts.map((attempt) => Number(attempt.score || 0))) }
    })
    .filter((row) => row.count > 0)
    .sort((left, right) => right.avg - left.avg || right.best - left.best)

  if (!rows.length) return 'I could not find any completed attempts for top performer analysis.'
  return [
    `Top performers${monthOnly ? ' in the last 30 days' : ''}:`,
    ...rows.slice(0, 10).map((row, index) => `${index + 1}. ${displayName(row.profile)} - avg ${row.avg}% across ${row.count} test(s), best ${row.best}%`),
    'Recommendation: use these learners as peer mentors or shortlist them for advanced tracks.',
  ].join('\n')
}

function summarizeBatchOperations(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/\bbatch|batches\b/.test(lower) || !/\b(completion|highest|lowest|performing|poorly|status|summary|compare|at risk|risk)\b/.test(lower)) return null
  if (!data.batches.length) return 'I could not find any matching batch records.'
  const attemptsByUser = groupBy(data.attempts, 'user_id')
  const rows = data.batches.map((batch) => {
    const members = data.batchMembers.filter((member) => member.batch_id === batch.id)
    const attempted = members.filter((member) => (attemptsByUser.get(member.user_id) || []).length > 0)
    const scores = members.flatMap((member) => (attemptsByUser.get(member.user_id) || []).map((attempt) => Number(attempt.score || 0)))
    const completion = members.length ? Math.round((attempted.length / members.length) * 100) : 0
    const attendanceRate = attendanceRateForBatch(batch.id, data)
    return { batch, members: members.length, completion, avg: average(scores), attendanceRate }
  }).sort((left, right) => {
    if (/\bhighest|best\b/.test(lower)) return right.completion - left.completion || right.avg - left.avg
    if (/\blowest|poorly|worst|risk|at risk\b/.test(lower)) return left.completion - right.completion || left.avg - right.avg
    return right.members - left.members
  })

  return [
    `Batch operations summary (${rows.length} batch(es)):`,
    ...rows.slice(0, 10).map((row, index) => `${index + 1}. ${row.batch.title} - status ${row.batch.status}, members ${row.members}, completion ${row.completion}%, avg score ${row.avg || 'N/A'}%, attendance ${row.attendanceRate}%`),
    'Recommendation: prioritize batches with low completion plus low attendance for trainer follow-up.',
  ].join('\n')
}

function summarizeDomainPerformance(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/\b(domain|domains|department|departments|data engineering|cloud|java|frontend|testing|compare|struggling|weakest)\b/.test(lower)) return null
  if (!/\b(compare|performance|performing|struggling|weakest|highest|lowest|trend|summary)\b/.test(lower)) return null
  const attemptsByUser = groupBy(data.attempts, 'user_id')
  const rows = new Map<string, { domain: string; employees: number; attempted: number; scores: number[] }>()
  for (const profile of data.profiles.filter((item) => item.role === 'employee')) {
    const domain = profile.domain || profile.department || 'Unassigned'
    const row = rows.get(domain) || { domain, employees: 0, attempted: 0, scores: [] as number[] }
    const attempts = attemptsByUser.get(profile.id) || []
    row.employees += 1
    if (attempts.length) row.attempted += 1
    row.scores.push(...attempts.map((attempt) => Number(attempt.score || 0)))
    rows.set(domain, row)
  }
  const ranked = [...rows.values()]
    .map((row) => ({ ...row, avg: average(row.scores), completion: row.employees ? Math.round((row.attempted / row.employees) * 100) : 0 }))
    .sort((left, right) => /\bstruggling|weakest|lowest\b/.test(lower) ? left.avg - right.avg : right.avg - left.avg)
  if (!ranked.length) return 'I could not find domain performance data.'
  return [
    'Domain performance:',
    ...ranked.slice(0, 10).map((row, index) => `${index + 1}. ${row.domain} - avg ${row.avg || 'N/A'}%, completion ${row.completion}%, employees ${row.employees}`),
    `Recommendation: ${ranked[0].domain} needs the first review if you are looking at ${/\bstruggling|weakest|lowest\b/.test(lower) ? 'weakness' : 'performance leadership'}.`,
  ].join('\n')
}

function summarizeAttendance(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/\battendance|absent|absence|present|late\b/.test(lower)) return null
  if (!data.attendance.length) return 'I could not find attendance records.'
  const byUser = groupBy(data.attendance, 'user_id')
  const rows = data.profiles
    .filter((profile) => profile.role === 'employee')
    .map((profile) => {
      const records = byUser.get(profile.id) || []
      const present = records.filter((item) => ['present', 'late', 'excused'].includes(String(item.status))).length
      return { profile, total: records.length, rate: records.length ? Math.round((present / records.length) * 100) : 0, absent: records.filter((item) => item.status === 'absent').length }
    })
    .filter((row) => row.total > 0)
    .sort((left, right) => left.rate - right.rate || right.absent - left.absent)
  if (!rows.length) return 'I could not find attendance records linked to employees.'
  const overall = Math.round(rows.reduce((sum, row) => sum + row.rate, 0) / rows.length)
  return [
    `Attendance summary: overall ${overall}% across ${rows.length} employee(s).`,
    ...rows.slice(0, 10).map((row, index) => `${index + 1}. ${displayName(row.profile)} - ${row.rate}% attendance, ${row.absent} absent record(s)`),
    'Recommendation: follow up with employees below 75% attendance.',
  ].join('\n')
}

function summarizeProctoring(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/\b(proctor|proctoring|flag|flags|violation|violations|security|integrity|risk|suspicious)\b/.test(lower)) return null
  const rows = data.proctoringEvents
  if (!rows.length) return 'I could not find any proctoring or integrity violation records.'
  const highRisk = rows.filter((event) => ['high', 'critical'].includes(String(event.severity)))
  const byEmployee = new Map<string, { profile: any; count: number; risk: number; latest: string; types: Set<string> }>()
  for (const event of rows) {
    const profile = event.profiles || data.profiles.find((item) => item.id === event.employee_id)
    const key = event.employee_id || profile?.email || 'unknown'
    const row = byEmployee.get(key) || { profile, count: 0, risk: 0, latest: event.occurred_at, types: new Set<string>() }
    row.count += 1
    row.risk += Number(event.risk_score || 0)
    row.latest = new Date(event.occurred_at || 0) > new Date(row.latest || 0) ? event.occurred_at : row.latest
    row.types.add(String(event.violation_type || 'violation'))
    byEmployee.set(key, row)
  }
  const ranked = [...byEmployee.values()].sort((left, right) => right.risk - left.risk || right.count - left.count)
  return [
    `Proctoring integrity summary: ${rows.length} event(s), ${highRisk.length} high/critical event(s).`,
    ...ranked.slice(0, 10).map((row, index) => `${index + 1}. ${displayName(row.profile)} - ${row.count} event(s), risk ${row.risk}, latest ${formatDateTime(row.latest)}, types: ${[...row.types].slice(0, 4).join(', ')}`),
    'Recommendation: review high-risk attempts before issuing certificates or final results.',
  ].join('\n')
}

function summarizeOperationsReport(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  if (!/\b(report|summary|weekly|monthly|compliance|ops|operations)\b/.test(lower)) return null
  const employees = data.profiles.filter((profile) => profile.role === 'employee')
  const attemptedUsers = new Set(data.attempts.map((attempt) => attempt.user_id))
  const avgScore = average(data.attempts.map((attempt) => Number(attempt.score || 0)))
  const pending = summarizePendingCount(data)
  const attendanceRate = overallAttendanceRate(data.attendance)
  const highRisk = data.proctoringEvents.filter((event) => ['high', 'critical'].includes(String(event.severity))).length
  return [
    'SkillTest_AI Operations Report',
    `KPI | Value`,
    `Employees | ${employees.length}`,
    `Completed Attempts | ${data.attempts.length}`,
    `Employee Coverage | ${employees.length ? Math.round((attemptedUsers.size / employees.length) * 100) : 0}%`,
    `Average Score | ${avgScore || 'N/A'}%`,
    `Pending Assignments | ${pending}`,
    `Batches | ${data.batches.length}`,
    `Attendance | ${attendanceRate}%`,
    `High/Critical Proctoring Events | ${highRisk}`,
    'Recommendation: clear pending assignments first, then review low-score domains and high-risk proctoring cases.',
  ].join('\n')
}

function extractRoleRecommendationTarget(message: string) {
  const lower = normalize(message)
  const isRecommendationIntent = /\b(recommend|ready|fit|suitable|promote|push|opening|role|position|candidate|candidates|bench|shortlist)\b/.test(lower)
  if (!isRecommendationIntent) return null

  const patterns = [
    /\b(?:opening|vacancy|position|role)\s+(?:in|for|on|as)\s+(.+?)(?:\s+role|\s+position|\s+opening|,|\.|\?|$)/i,
    /\b(?:recommend|shortlist|find|show|who(?:\s+all)?)\b.*?\b(?:for|to|into|as)\s+(.+?)(?:\s+role|\s+position|\s+opening|,|\.|\?|$)/i,
    /\b(?:ready|suitable|fit)\b.*?\b(?:for|to|into|as)\s+(.+?)(?:\s+role|\s+position|\s+opening|,|\.|\?|$)/i,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)?.[1]?.trim()
    if (match) return cleanRoleTarget(match)
  }

  const known = ROLE_FAMILY_KEYWORDS.flatMap((item) => [item.family, ...item.terms])
    .sort((a, b) => b.length - a.length)
    .find((term) => lower.includes(term))
  return known || null
}

function cleanRoleTarget(value: string) {
  return cleanEntity(value)
    .replace(/\b(?:employee|employees|candidate|candidates|people|person|role|position|opening|vacancy|job|who|all|are|is|ready|good|best|for|to|be|pushed|promoted)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const ROLE_FAMILY_KEYWORDS = [
  { family: 'data engineering', terms: ['data engineering', 'rag', 'retrieval augmented generation', 'vector database', 'vector db', 'etl', 'pipeline', 'data pipeline', 'spark', 'sql', 'airflow', 'analytics', 'data lake'] },
  { family: 'java', terms: ['java', 'spring', 'spring boot', 'jvm', 'hibernate', 'microservice', 'microservices'] },
  { family: 'frontend', terms: ['react', 'next.js', 'nextjs', 'javascript', 'typescript', 'frontend', 'ui', 'web'] },
  { family: 'cloud', terms: ['azure', 'aws', 'cloud', 'devops', 'docker', 'kubernetes', 'aks', 'ci cd'] },
  { family: 'ai', terms: ['ai', 'ml', 'machine learning', 'llm', 'genai', 'prompt engineering', 'openai'] },
  { family: 'testing', terms: ['testing', 'qa', 'automation testing', 'selenium', 'playwright'] },
]

function summarizeRoleRecommendations(target: string, data: Record<string, any[]>) {
  const role = normalizeRoleTarget(target)
  const employees = data.profiles.filter((profile) => profile.role === 'employee')
  if (!employees.length) return 'No employee profiles are available for role-fit analysis.'

  const scored = employees
    .map((profile) => scoreEmployeeForRole(profile, role, data))
    .filter((item) => item.evidenceCount > 0)
    .sort((a, b) => b.fitScore - a.fitScore || b.directAverage - a.directAverage || b.attemptCount - a.attemptCount)

  if (!scored.length) {
    return `No completed assessment evidence found for ${role.label}. Create or assign ${role.label} / ${role.family} quizzes before shortlisting.`
  }

  const top = scored.slice(0, 5)
  const lines = top.map((item, index) =>
    `${index + 1}. ${displayName(item.profile)} - fit ${item.fitScore}% (${item.confidence} confidence). ${item.reason}`
  )
  return [
    `Best candidates for ${role.label} (${role.family}):`,
    ...lines,
    `Decision basis: direct topic scores first, related ${role.family} evidence next, then overall consistency, certificates/badges, attendance, and recency.`,
  ].join('\n')
}

function normalizeRoleTarget(target: string) {
  const normalized = normalize(target)
  const match = ROLE_FAMILY_KEYWORDS.find((item) =>
    item.family === normalized || item.terms.some((term) => normalized.includes(term))
  )
  return {
    label: target.trim() || match?.family || 'target role',
    family: match?.family || normalized || 'general',
    terms: match ? [match.family, ...match.terms] : normalized.split(/\s+/).filter(Boolean),
  }
}

function scoreEmployeeForRole(profile: any, role: { label: string; family: string; terms: string[] }, data: Record<string, any[]>) {
  const attempts = data.attempts.filter((attempt) => attempt.user_id === profile.id)
  const attendanceRows = data.attendance.filter((row) => row.user_id === profile.id)
  const badges = data.badges.filter((entry) => entry.user_id === profile.id)
  const certs = data.certificates.filter((cert) => cert.user_id === profile.id)
  const direct = attempts.filter((attempt) => isDirectRoleTopic(attempt.quizzes?.topic || attempt.quizzes?.title || '', role))
  const related = attempts.filter((attempt) => !direct.includes(attempt) && getRoleFamily(attempt.quizzes?.topic || attempt.quizzes?.title || '') === role.family)
  const overall = attempts.length ? average(attempts.map((attempt) => Number(attempt.score || 0))) : 0
  const directAverage = direct.length ? average(direct.map((attempt) => Number(attempt.score || 0))) : 0
  const relatedAverage = related.length ? average(related.map((attempt) => Number(attempt.score || 0))) : 0
  const bestRelevant = Math.max(directAverage, relatedAverage, overall)
  const latestRelevant = [...direct, ...related].sort(byLatest)[0] || attempts.slice().sort(byLatest)[0]
  const behavior = latestRelevant
    ? analyzeAttemptPattern((latestRelevant.answers || []) as QuizAnswer[], latestRelevant.quizzes?.difficulty as DifficultyLevel)
    : null
  const attendanceRate = attendanceRows.length
    ? Math.round((attendanceRows.filter((row) => ['present', 'late', 'excused'].includes(String(row.status))).length / attendanceRows.length) * 100)
    : 70
  const credentialBonus = Math.min(8, certs.length * 3 + badges.length)
  const domainBonus = getRoleFamily(profile.domain || profile.department || '') === role.family ? 5 : 0
  const focusBonus = behavior ? clampNumber((behavior.focusScore - 65) * 0.12, -5, 5, 0) : 0
  const evidenceCount = direct.length + related.length
  const evidencePenalty = direct.length >= 2 ? 0 : evidenceCount >= 2 ? 4 : 10
  const confidence = direct.length >= 2 ? 'high' : evidenceCount >= 2 ? 'medium' : 'low'
  const evidenceScore = direct.length
    ? directAverage * 0.72 + (relatedAverage || directAverage) * 0.18 + overall * 0.1
    : related.length
      ? relatedAverage * 0.76 + overall * 0.24
      : overall
  const fitScore = clampNumber(
    evidenceScore + credentialBonus + domainBonus + focusBonus + (attendanceRate - 75) * 0.08 - evidencePenalty,
    0,
    100,
    0
  )
  const directText = direct.length ? `${direct.length} direct ${role.label} attempt(s), avg ${directAverage}%` : 'no direct role attempts'
  const relatedText = related.length ? `${related.length} related ${role.family} attempt(s), avg ${relatedAverage}%` : 'no related domain attempts'
  const reason = `${directText}; ${relatedText}; overall avg ${overall}%; attendance ${attendanceRate}%; best evidence ${bestRelevant}%.`

  return {
    profile,
    fitScore,
    confidence,
    directAverage,
    relatedAverage,
    attemptCount: attempts.length,
    evidenceCount,
    reason,
  }
}

function isDirectRoleTopic(topic: string, role: { terms: string[] }) {
  const normalized = normalize(topic)
  return role.terms.some((term) => normalized.includes(normalize(term)))
}

function getRoleFamily(topic: string) {
  const normalized = normalize(topic)
  return ROLE_FAMILY_KEYWORDS.find((item) => item.terms.some((term) => normalized.includes(term)) || normalized.includes(item.family))?.family || normalized
}

function summarizeEmployeeLatestAttempt(profile: any, attempts: any[]) {
  const latest = attempts
    .filter((attempt) => attempt.user_id === profile.id)
    .sort(byLatest)[0]
  if (!latest) return `No completed quiz attempts found for ${displayName(profile)}.`

  const behavior = analyzeAttemptPattern((latest.answers || []) as QuizAnswer[], latest.quizzes?.difficulty as DifficultyLevel)
  return [
    `${displayName(profile)} latest quiz result: ${latest.score}% in ${latest.quizzes?.title || 'quiz'}.`,
    `Correct: ${latest.correct_answers}/${latest.total_questions}; points: ${latest.points_earned || 0}; time: ${formatDuration(latest.time_taken_seconds)}.`,
    `Completed: ${formatDateTime(latest.completed_at)}. Behavior: ${behavior.riskLevel} risk, focus ${behavior.focusScore}%.`,
  ].join('\n')
}

function summarizeEmployeeQuiz(profile: any, quiz: any, attempts: any[]) {
  const matches = attempts
    .filter((attempt) => attempt.user_id === profile.id && attempt.quiz_id === quiz.id)
    .sort(byLatest)
  const attempt = matches[0]
  if (!attempt) {
    return `No completed attempt found for ${displayName(profile)} in ${quiz.title}.`
  }
  const behavior = analyzeAttemptPattern((attempt.answers || []) as QuizAnswer[], attempt.quizzes?.difficulty as DifficultyLevel)
  return [
    `${displayName(profile)} scored ${attempt.score}% in ${quiz.title}.`,
    `Correct: ${attempt.correct_answers}/${attempt.total_questions}; avg answer time: ${behavior.averageAnswerTime}s.`,
    `Behavior: ${behavior.riskLevel} risk, focus ${behavior.focusScore}%, confidence ${behavior.confidenceScore}%. ${behavior.masterySignal}`,
  ].join('\n')
}

function summarizeEmployee(profile: any, attempts: any[]) {
  const rows = attempts.filter((attempt) => attempt.user_id === profile.id)
  if (!rows.length) return `No completed quiz attempts found for ${displayName(profile)}.`
  const avg = average(rows.map((attempt) => Number(attempt.score || 0)))
  const latest = rows.slice().sort(byLatest)[0]
  return `${displayName(profile)} average score is ${avg}% across ${rows.length} completed quiz(es). Latest: ${latest.quizzes?.title || 'quiz'} ${latest.score}%.`
}

function summarizeQuiz(quiz: any, attempts: any[], rules: any[]) {
  const rows = attempts.filter((attempt) => attempt.quiz_id === quiz.id)
  if (!rows.length) return `No completed attempts found for ${quiz.title}.`
  const avg = average(rows.map((attempt) => Number(attempt.score || 0)))
  const passLine = Number(quiz.passing_score || 60)
  const passRate = Math.round((rows.filter((attempt) => Number(attempt.score || 0) >= passLine).length / rows.length) * 100)
  const certRule = rules.find((rule) => rule.quiz_id === quiz.id)
  const certText = certRule?.enabled ? ` Certificate threshold: ${certRule.min_score}%.` : ''
  return `${quiz.title} average score is ${avg}% from ${rows.length} completed attempt(s). Pass rate: ${passRate}% at ${passLine}%.${certText}`
}

function summarizeCertificates(profiles: any[], attempts: any[], rules: any[], certificates: any[]) {
  const enabledRules = rules.filter((rule) => rule.enabled)
  if (!enabledRules.length) return 'No certificate rules are enabled. Enable a rule for the required quiz before certificates can be issued.'
  const certKeys = new Set(certificates.map((cert) => `${cert.quiz_id}:${cert.user_id}`))
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const eligibleMissing = attempts.filter((attempt) => {
    const rule = enabledRules.find((item) => item.quiz_id === attempt.quiz_id)
    return rule && Number(attempt.score || 0) >= Number(rule.min_score || 0) && !certKeys.has(`${attempt.quiz_id}:${attempt.user_id}`)
  })
  if (!eligibleMissing.length) return `Certificate rules are active for ${enabledRules.length} quiz(es). All eligible loaded attempts already have certificates.`
  const names = eligibleMissing.slice(0, 5).map((attempt) => `${displayName(profileById.get(attempt.user_id))} scored ${attempt.score}%`)
  return `${eligibleMissing.length} eligible certificate(s) need review. Priority candidates: ${names.join(', ')}.`
}

function summarizeWeakAreas(attempts: any[]) {
  const byTopic = new Map<string, number[]>()
  for (const attempt of attempts) {
    const topic = attempt.quizzes?.topic || attempt.quizzes?.title || 'General'
    byTopic.set(topic, [...(byTopic.get(topic) || []), Number(attempt.score || 0)])
  }
  const weakest = [...byTopic.entries()]
    .map(([topic, scores]) => ({ topic, avg: average(scores), count: scores.length }))
    .sort((a, b) => a.avg - b.avg)[0]
  if (!weakest) return 'No completed attempts found to identify weak areas.'
  return `Weakest loaded topic: ${weakest.topic}, average ${weakest.avg}% across ${weakest.count} attempt(s).`
}

function findProfile(query: string, profiles: any[]) {
  const tokens = significantTokens(query)
  return profiles.find((profile) => {
    const haystack = normalize([profile.full_name, profile.email, profile.employee_id].filter(Boolean).join(' '))
    return tokens.some((token) => token.length >= 3 && haystack.includes(token))
  })
}

function findQuiz(query: string, quizzes: any[], attempts: any[]) {
  const quizPool = quizzes.length
    ? quizzes
    : uniqueBy(attempts.map((attempt) => ({
        id: attempt.quiz_id,
        title: attempt.quizzes?.title,
        topic: attempt.quizzes?.topic,
        difficulty: attempt.quizzes?.difficulty,
      })), 'id')
  const tokens = significantTokens(query)
  return quizPool.find((quiz) => {
    const haystack = normalize([quiz.title, quiz.topic].filter(Boolean).join(' '))
    return tokens.some((token) => token.length >= 3 && haystack.includes(token))
  })
}

function getEmployeeRiskRows(data: Record<string, any[]>) {
  const attemptsByUser = groupBy(data.attempts, 'user_id')
  const attendanceByUser = groupBy(data.attendance, 'user_id')
  const proctoringByUser = groupBy(data.proctoringEvents, 'employee_id')
  const completedAssignmentKeys = new Set(data.attempts.map((attempt) => `${attempt.quiz_id}:${attempt.user_id}`))
  const now = new Date()
  const assignmentsByUser = groupBy(data.assignments, 'user_id')

  return data.profiles
    .filter((profile) => profile.role === 'employee')
    .map((profile) => {
      const attempts = (attemptsByUser.get(profile.id) || []).slice().sort(byLatest)
      const latest = attempts[0]
      const scores = attempts.map((attempt) => Number(attempt.score || 0))
      const avg = average(scores)
      const latestScore = latest ? Number(latest.score || 0) : 0
      const latestDate = latest?.completed_at ? new Date(latest.completed_at) : null
      const inactiveDays = latestDate && !Number.isNaN(latestDate.getTime())
        ? Math.floor((now.getTime() - latestDate.getTime()) / 86400000)
        : 999
      const assignments = assignmentsByUser.get(profile.id) || []
      const pending = assignments.filter((assignment) => !completedAssignmentKeys.has(`${assignment.quiz_id}:${assignment.user_id}`))
      const overdue = pending.filter((assignment) => assignment.due_date && new Date(assignment.due_date) < now)
      const attendanceRows = attendanceByUser.get(profile.id) || []
      const attendanceRate = attendanceRows.length
        ? Math.round((attendanceRows.filter((row) => ['present', 'late', 'excused'].includes(String(row.status))).length / attendanceRows.length) * 100)
        : 100
      const proctoring = proctoringByUser.get(profile.id) || []
      const highRiskEvents = proctoring.filter((event) => ['high', 'critical'].includes(String(event.severity))).length
      const reasons: string[] = []
      let risk = 0

      if (!attempts.length) { risk += 25; reasons.push('no completed assessments') }
      if (inactiveDays > 10) { risk += inactiveDays > 30 ? 25 : 15; reasons.push(`inactive ${inactiveDays === 999 ? 'never attempted' : `${inactiveDays} days`}`) }
      if (attempts.length && avg < 60) { risk += 25; reasons.push(`average score ${avg}%`) }
      if (latest && latestScore < 50) { risk += 20; reasons.push(`latest score ${latestScore}%`) }
      if (attendanceRows.length && attendanceRate < 75) { risk += 15; reasons.push(`attendance ${attendanceRate}%`) }
      if (pending.length) { risk += Math.min(20, pending.length * 5); reasons.push(`${pending.length} pending assignment(s)`) }
      if (overdue.length) { risk += 15; reasons.push(`${overdue.length} overdue assignment(s)`) }
      if (highRiskEvents) { risk += Math.min(25, highRiskEvents * 12); reasons.push(`${highRiskEvents} high-risk proctoring event(s)`) }

      return {
        profile,
        risk: clampNumber(risk, 0, 100, 0),
        reasons,
        avg,
        latestScore,
        inactiveDays,
        pending: pending.length,
        overdue: overdue.length,
        attendanceRate,
        highRiskEvents,
      }
    })
}

function getDomainHealthRows(data: Record<string, any[]>) {
  const attemptsByUser = groupBy(data.attempts, 'user_id')
  const rows = new Map<string, { domain: string; employees: number; attempted: number; scores: number[] }>()
  for (const profile of data.profiles.filter((item) => item.role === 'employee')) {
    const domain = profile.domain || profile.department || 'Unassigned'
    const row = rows.get(domain) || { domain, employees: 0, attempted: 0, scores: [] as number[] }
    const attempts = attemptsByUser.get(profile.id) || []
    row.employees += 1
    if (attempts.length) row.attempted += 1
    row.scores.push(...attempts.map((attempt) => Number(attempt.score || 0)))
    rows.set(domain, row)
  }
  return [...rows.values()].map((row) => ({
    ...row,
    avg: average(row.scores),
    completion: row.employees ? Math.round((row.attempted / row.employees) * 100) : 0,
  }))
}

function buildExecutiveInsight(domainRows: Array<{ domain: string; avg: number; completion: number }>, inactive: any[], data: Record<string, any[]>) {
  const weakest = domainRows.slice().sort((a, b) => a.avg - b.avg || a.completion - b.completion)[0]
  const inactiveByDomain = new Map<string, number>()
  for (const item of inactive) {
    const domain = item.profile.domain || item.profile.department || 'Unassigned'
    inactiveByDomain.set(domain, (inactiveByDomain.get(domain) || 0) + 1)
  }
  const mostInactive = [...inactiveByDomain.entries()].sort((a, b) => b[1] - a[1])[0]
  const weakTopic = getWeakestTopic(data.attempts)
  const parts = []
  if (weakest) parts.push(`${weakest.domain} needs attention because it has ${weakest.avg || 'N/A'}% average and ${weakest.completion}% completion.`)
  if (mostInactive) parts.push(`${mostInactive[0]} has the highest inactivity concentration (${mostInactive[1]} learner(s)).`)
  if (weakTopic) parts.push(`${weakTopic.topic} is the weakest assessment topic.`)
  return parts.join(' ') || 'No dominant risk pattern was visible in the loaded records.'
}

function getWeakestTopic(attempts: any[]) {
  const byTopic = new Map<string, number[]>()
  for (const attempt of attempts) {
    const topic = attempt.quizzes?.topic || attempt.quizzes?.title || 'General'
    byTopic.set(topic, [...(byTopic.get(topic) || []), Number(attempt.score || 0)])
  }
  return [...byTopic.entries()]
    .map(([topic, scores]) => ({ topic, avg: average(scores), count: scores.length }))
    .filter((row) => row.count >= 1)
    .sort((a, b) => a.avg - b.avg)[0] || null
}

function getCertificateGapRows(data: Record<string, any[]>) {
  const enabledRules = data.certificateRules.filter((rule) => rule.enabled)
  const certKeys = new Set(data.certificates.map((cert) => `${cert.quiz_id}:${cert.user_id}`))
  return data.attempts.filter((attempt) => {
    const rule = enabledRules.find((item) => item.quiz_id === attempt.quiz_id)
    return rule && Number(attempt.score || 0) >= Number(rule.min_score || 0) && !certKeys.has(`${attempt.quiz_id}:${attempt.user_id}`)
  })
}

function explainUserAccess(message: string, data: Record<string, any[]>) {
  const profile = findProfile(normalize(message), data.profiles)
  if (!profile) return 'I could not identify the employee/user in that access question.'
  const reasons = []
  if (profile.approval_status && !['approved', 'active'].includes(String(profile.approval_status))) reasons.push(`approval_status is ${profile.approval_status}`)
  if (profile.role === 'employee' && !profile.employee_id) reasons.push('employee_id is missing')
  if (!reasons.length) reasons.push('profile looks active in the loaded application records; check Supabase Auth email confirmation or disabled user state if login is still blocked')
  return [
    `Access explanation for ${displayName(profile)}:`,
    ...reasons.map((reason) => `- ${reason}`),
    'Recommendation: verify profile status, role, employee ID, and Supabase Auth confirmation state.',
  ].join('\n')
}

function explainCertificateIssue(message: string, data: Record<string, any[]>) {
  const profile = findProfile(normalize(message), data.profiles)
  const quiz = findQuiz(normalize(message), data.quizzes, data.attempts)
  const attempts = data.attempts.filter((attempt) => (!profile || attempt.user_id === profile.id) && (!quiz || attempt.quiz_id === quiz.id)).sort(byLatest)
  const attempt = attempts[0]
  if (!attempt) return 'Certificate explanation: no matching completed attempt was found for the employee/quiz in the loaded data.'
  const rule = data.certificateRules.find((item) => item.quiz_id === attempt.quiz_id)
  const cert = data.certificates.find((item) => item.quiz_id === attempt.quiz_id && item.user_id === attempt.user_id)
  const owner = profile || data.profiles.find((item) => item.id === attempt.user_id)
  const quizTitle = quiz?.title || attempt.quizzes?.title || 'the quiz'
  const reasons = []
  if (cert) reasons.push('certificate already exists')
  if (!rule) reasons.push('no certificate rule exists for this quiz')
  if (rule && !rule.enabled) reasons.push('certificate rule is disabled')
  if (rule && Number(attempt.score || 0) < Number(rule.min_score || 0)) reasons.push(`score ${attempt.score}% is below certificate threshold ${rule.min_score}%`)
  if (!reasons.length) reasons.push('employee appears eligible; certificate issuance job or manual review may not have run yet')
  return [
    `Certificate explanation for ${displayName(owner)} in ${quizTitle}:`,
    ...reasons.map((reason) => `- ${reason}`),
    'Recommendation: enable the certificate rule, verify minimum score, then regenerate/issue certificate if eligible.',
  ].join('\n')
}

function explainAssessmentFailure(message: string, data: Record<string, any[]>) {
  const profile = findProfile(normalize(message), data.profiles)
  const quiz = findQuiz(normalize(message), data.quizzes, data.attempts)
  const attempts = data.attempts.filter((attempt) => (!profile || attempt.user_id === profile.id) && (!quiz || attempt.quiz_id === quiz.id)).sort(byLatest)
  const attempt = attempts[0]
  if (!attempt) return 'Assessment explanation: no matching completed attempt was found.'
  const quizRow = quiz || data.quizzes.find((item) => item.id === attempt.quiz_id)
  const passScore = Number(quizRow?.passing_score || 60)
  const proctoring = data.proctoringEvents.filter((event) => event.employee_id === attempt.user_id && event.quiz_id === attempt.quiz_id)
  return [
    `Assessment explanation for ${displayName(profile || data.profiles.find((item) => item.id === attempt.user_id))}:`,
    `- Score was ${attempt.score}% against passing score ${passScore}%.`,
    Number(attempt.score || 0) < passScore ? '- Result failed because score is below the configured passing score.' : '- Score meets the passing threshold; check integrity review or certificate logic if status still shows failed.',
    proctoring.length ? `- ${proctoring.length} proctoring event(s) exist for this quiz attempt context.` : '- No proctoring events were found for this quiz context.',
    'Recommendation: review answer breakdown, retry policy, and integrity status before retest assignment.',
  ].join('\n')
}

function explainQuizVisibility(message: string, data: Record<string, any[]>) {
  const quiz = findQuiz(normalize(message), data.quizzes, data.attempts)
  if (!quiz) return 'Quiz visibility explanation: no matching quiz was found.'
  const assignedCount = data.assignments.filter((assignment) => assignment.quiz_id === quiz.id).length
  const reasons = []
  if (quiz.is_active === false) reasons.push('is_active is false')
  if (quiz.status && !['active', 'published'].includes(String(quiz.status))) reasons.push(`status is ${quiz.status}`)
  if (!assignedCount) reasons.push('no loaded employee assignments exist for this quiz')
  if (!reasons.length) reasons.push('quiz appears active and assigned in loaded data; check route permissions or employee batch scope')
  return [
    `Quiz visibility explanation for "${quiz.title}":`,
    ...reasons.map((reason) => `- ${reason}`),
    'Recommendation: activate/publish the quiz and verify assignments for the intended employees.',
  ].join('\n')
}

function groupBy(items: any[], key: string) {
  const groups = new Map<string, any[]>()
  for (const item of items || []) {
    const value = item?.[key]
    if (!value) continue
    const rows = groups.get(value) || []
    rows.push(item)
    groups.set(value, rows)
  }
  return groups
}

function extractDomainFilter(message: string) {
  const lower = normalize(message)
  const known = ['data engineering', 'cloud', 'java', 'frontend', 'testing', 'ai', 'python', 'react', 'sql']
    .find((domain) => lower.includes(domain))
  if (known) return known
  const match = message.match(/\b(?:from|in|for|domain|department)\s+([A-Za-z][A-Za-z0-9 ._-]{2,40})(?:\s+team|\s+domain|\s+department|,|\.|\?|$)/i)?.[1]
  return match ? normalize(match) : null
}

function matchesDomain(profile: any, domainFilter: string | null) {
  if (!domainFilter) return true
  const haystack = normalize([profile?.domain, profile?.department].filter(Boolean).join(' '))
  return haystack.includes(domainFilter)
}

function extractTopicFilter(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  const knownTopic = ROLE_FAMILY_KEYWORDS.flatMap((item) => [item.family, ...item.terms])
    .sort((a, b) => b.length - a.length)
    .find((term) => lower.includes(normalize(term)))
  if (knownTopic) return normalize(knownTopic)

  const quiz = findQuiz(lower, data.quizzes, data.attempts)
  if (quiz) return normalize([quiz.title, quiz.topic].filter(Boolean).join(' '))
  return null
}

function extractScoreThreshold(message: string) {
  const match = message.match(/\b(?:below|under|less than|score[d]? below|<)\s*(\d{1,3})\b/i) || message.match(/\b(\d{1,3})\s*%\b/)
  if (!match) return null
  const score = Number(match[1])
  return Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : null
}

function summarizePendingCount(data: Record<string, any[]>) {
  const attempts = new Set(data.attempts.map((attempt) => `${attempt.quiz_id}:${attempt.user_id}`))
  return data.assignments.filter((assignment) => !attempts.has(`${assignment.quiz_id}:${assignment.user_id}`)).length
}

function overallAttendanceRate(attendance: any[]) {
  if (!attendance.length) return 0
  const present = attendance.filter((item) => ['present', 'late', 'excused'].includes(String(item.status))).length
  return Math.round((present / attendance.length) * 100)
}

function attendanceRateForBatch(batchId: string, data: Record<string, any[]>) {
  const sessionIds = new Set(data.sessions.filter((session) => session.batch_id === batchId && session.attendance_required).map((session) => session.id))
  const rows = data.attendance.filter((item) => sessionIds.has(item.session?.id) || item.session?.batch_id === batchId)
  return overallAttendanceRate(rows)
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

function dateBetween(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date >= start && date < end
}

function significantTokens(value: string) {
  const stop = new Set(['score', 'scores', 'marks', 'result', 'results', 'analysis', 'average', 'avg', 'quiz', 'test', 'latest', 'last', 'recent', 'attempt', 'of', 'in', 'his', 'her', 'for', 'the', 'and', 'performance', 'show', 'tell', 'me', 'what', 'is'])
  return normalize(value).split(/\s+/).filter((token) => token && !stop.has(token))
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9@._ -]/g, ' ').replace(/\s+/g, ' ').trim()
}

function displayName(profile: any) {
  return profile?.full_name || profile?.email || 'Unknown employee'
}

function average(values: number[]) {
  if (!values.length) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function byLatest(left: any, right: any) {
  return new Date(right.completed_at || 0).getTime() - new Date(left.completed_at || 0).getTime()
}

function formatDuration(seconds?: number | null) {
  const total = Math.max(0, Number(seconds || 0))
  const minutes = Math.floor(total / 60)
  const remainder = total % 60
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`
}

function formatDateTime(value?: string | null) {
  if (!value) return 'unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function uniqueBy(items: any[], key: string) {
  const seen = new Set()
  return items.filter((item) => {
    const value = item[key]
    if (!value || seen.has(value)) return false
    seen.add(value)
    return true
  })
}

function localFallback(message: string) {
  return `I could not find any exact matching records for "${message}". Ask a more specific question, for example: "low scores below 70", "pending assessments", "proctoring flags", or "batch completion".`
}
