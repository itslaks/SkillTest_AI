import { NextRequest, NextResponse } from 'next/server'
import { requireTrainingStaffForApi } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/server'
import { getAccessibleTrainingBatchIds } from '@/lib/training-access'
import { callAI, stripCodeFences } from '@/lib/ai'
import { analyzeAttemptPattern } from '@/lib/insights'
import { buildAdminGuideSearchIndex, findAdminGuideAnswer } from '@/lib/manager-docs'
import { createEmployeeWithSetupEmail } from '@/lib/employee-onboarding'
import type { DifficultyLevel, QuizAnswer } from '@/lib/types/database'
import { revalidatePath } from 'next/cache'

export async function POST(request: NextRequest) {
  const auth = await requireTrainingStaffForApi()
  if (auth instanceof NextResponse) return auth

  const { message } = await request.json()
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }

  const adminCommand = resolveAdminCommand(message)
  if (adminCommand) {
    if (auth.role !== 'admin') {
      return NextResponse.json({ error: 'AI Command mutations require admin access.' }, { status: 403 })
    }
    const admin = createAdminClient()
    const result = await executeAdminCommand(admin, auth.userId, adminCommand)
    return NextResponse.json({
      message: result.error ? `Command failed: ${result.error}` : result.message,
      provider: 'skilltest_ai_command',
      command: result,
    }, { status: result.error ? 400 : 200 })
  }

  const admin = createAdminClient()
  const batchIds = await getAccessibleTrainingBatchIds(auth.userId, auth.role)

  const [
    { data: quizzes },
    { data: attempts },
    { data: profiles },
    { data: badges },
    { data: certificates },
    { data: certificateRules },
    { data: attendance },
  ] = await Promise.all([
    admin
      .from('quizzes')
      .select('id, title, topic, difficulty, passing_score, created_by, batch_id')
      .or(`created_by.eq.${auth.userId}${batchIds.length ? `,batch_id.in.(${batchIds.join(',')})` : ''}`)
      .limit(80),
    admin
      .from('quiz_attempts')
      .select('quiz_id, user_id, score, status, correct_answers, total_questions, time_taken_seconds, points_earned, completed_at, answers, quizzes:quiz_id(title, topic, difficulty)')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(250),
    admin
      .from('profiles')
      .select('id, full_name, email, employee_id, department, domain, role')
      .limit(500),
    admin
      .from('user_badges')
      .select('user_id, badges(name, category, rarity)')
      .limit(500),
    admin
      .from('certificates')
      .select('user_id, quiz_id, title, score, issued_at')
      .limit(250),
    admin
      .from('certificate_rules')
      .select('quiz_id, enabled, min_score, title, certificate_name, quizzes:quiz_id(title, topic)')
      .limit(120),
    admin
      .from('session_attendance')
      .select('user_id, status, session:session_id(batch_id, title, session_date)')
      .limit(500),
  ])

  const data = {
    quizzes: quizzes || [],
    attempts: attempts || [],
    profiles: profiles || [],
    badges: badges || [],
    certificates: certificates || [],
    certificateRules: certificateRules || [],
    attendance: attendance || [],
  }

  const deterministicAnswer = buildDeterministicAnswer(message, data)
  if (deterministicAnswer) {
    return NextResponse.json({ message: deterministicAnswer, provider: 'skilltest_ai_stats' })
  }

  const docsAnswer = findAdminGuideAnswer(message)
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
          'You are SkillTest_AI Command Chat. Use only the provided database context and admin guide context. Never invent numbers, names, attempts, scores, or certificates. If exact data is missing, say so. For how-to questions, answer from the admin guide. Keep responses under 80 words, with at most 4 bullets. Use crisp plain text and avoid markdown decoration unless it improves readability.',
      },
      {
        role: 'user',
        content: `DATABASE CONTEXT:\n${context}\n\nADMIN GUIDE CONTEXT:\n${docsContext}\n\nQUESTION:\n${message}`,
      },
    ], { maxTokens: 180, temperature: 0.1 })

    return NextResponse.json({ message: text, provider })
  } catch (error: any) {
    return NextResponse.json({
      message: localFallback(message, attempts || [], profiles || []),
      provider: 'skilltest_ai_local',
      error: error.message,
    })
  }
}

type CommandResult = { message?: string; error?: string; data?: any }
type ParsedCommand = { action: string; args: Record<string, string>; source: 'explicit' | 'natural' }

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
  const { error } = await admin.from('profiles').delete().eq('id', profile.id)
  if (error) return { error: error.message }
  await admin.auth.admin.deleteUser(profile.id).catch(() => null)
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
  ].join('\n')
}

function buildDeterministicAnswer(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
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

function localFallback(message: string, attempts: any[], profiles: any[]) {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const top = attempts
    .slice()
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 5)
    .map((attempt, index) => {
      const profile = profileById.get(attempt.user_id)
      return `${index + 1}. ${profile?.full_name || profile?.email || 'Unknown'} scored ${attempt.score}% in ${attempt.quizzes?.title || 'quiz'}.`
    })
  return `Current performance summary for "${message}":\n\n${top.join('\n') || 'No completed attempts found in the loaded records.'}`
}
