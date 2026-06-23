export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'advanced' | 'hardcore'

export type ParsedCommand = {
  action: string
  args: Record<string, string>
  source: 'explicit' | 'natural'
}

export function classifyCopilotIntent(message: string) {
  const lower = normalizeCommandText(message)
  if (/\b(create|add|make|build|prepare|update|edit|delete|remove|assign|give|approve|reject|mark|send|remind|archive|extend|run|execute)\b/.test(lower)) return 'OPERATIONAL_ACTION'
  if (/\b(report|summary|weekly|monthly|compliance|status)\b/.test(lower)) return 'REPORT_GENERATION'
  if (/\b(why|explain|reason|blocked|failed|not generated|not issued)\b/.test(lower)) return 'SYSTEM_EXPLANATION'
  if (/\b(compare|trend|struggling|poorly|highest|lowest|weak|risk|performing)\b/.test(lower)) return 'DATA_ANALYSIS'
  return 'DATA_RETRIEVAL'
}

export function resolveAdminCommand(message: string): ParsedCommand | null {
  const trimmed = message.trim()
  if (/^(run|execute)\s+/i.test(trimmed)) {
    return { ...parseCommand(trimmed.replace(/^(run|execute)\s+/i, '')), source: 'explicit' }
  }

  return parseNaturalCommand(trimmed)
}

export function parseCommand(text: string): Omit<ParsedCommand, 'source'> {
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

export function parseNaturalCommand(text: string): ParsedCommand | null {
  const lower = normalizeCommandText(text)
  const args: Record<string, string> = {}

  if (/\b(remove|delete|clear)\b.*\bscheduled\b.*\b(training|session|sessions|roadmap|roadmaps)\b/.test(lower)) {
    args.confirmation = 'DELETE SCHEDULED'
    return { action: 'clear scheduled', args, source: 'natural' }
  }

  if (/\b(delete|clear|remove)\b.*\b(all\s+)?training\b/.test(lower)) {
    args.confirmation = 'DELETE TRAINING'
    return { action: 'clear training', args, source: 'natural' }
  }

  const createEmployee = /\b(?:create|add|make|setup|set up)\s+employee\b/i.test(text)
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

  if (/\b(create|add|make|setup|set up)\s+trainer\b/i.test(text) && !/\b(assign|batch)\b/i.test(text)) {
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

  if (isQuizCreationRequest(text)) {
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

  if (/\b(create|add|make)\s+question\b/i.test(text)) {
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

  if (/\b(assign|give)\s+quiz\b/i.test(text)) {
    mergeKeyValues(args, text)
    args.email ||= firstEmail(text)
    args.quiz ||= quotedValueAfter(text, 'quiz')
    return { action: 'assign quiz', args, source: 'natural' }
  }

  if (/\b(create|add|make|setup|set up)\s+batch\b/i.test(text)) {
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

  if (/\b(create|add|make|schedule)\s+(session|roadmap)\b/i.test(text)) {
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

  if (/\b(create|open|add|make)\b.*\bfeedback\b.*\b(form|window)?\b/i.test(text)) {
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

export function extractQuizCreationIntent(text: string) {
  const args: Record<string, string> = {}
  const lower = normalizeCommandText(text)
  const difficulty = lower.match(/\b(easy|medium|hard|advanced|hardcore)\b/)?.[1]
  if (difficulty) args.difficulty = difficulty

  const count = lower.match(/\b(\d{1,3})\s*(?:questions?|mcqs?|mcq|qs)\b/)?.[1]
  if (count) args.question_count = count

  const duration = lower.match(/\b(\d{1,3})\s*(?:minutes?|mins?|min)\b/)?.[1]
  if (duration) args.time_limit_minutes = duration

  const passing = lower.match(/\b(?:passing|pass)\s*(?:score|mark)?\s*(?:is|=|:)?\s*(\d{1,3})\b/)?.[1]
  if (passing) args.passing_score = passing

  const due = text.match(/\b(?:due|by|before)\s+(.+?)(?:,|\.|$)/i)?.[1]?.trim()
  if (due) args.due_date = due

  const department = text.match(/\bfor\s+(.+?)\s+(?:team|department)\b/i)?.[1]?.trim()
  if (department) args.department = cleanEntity(department)

  const assigned = text.match(/\b(?:assign(?:ed)?|give|send)\s+(?:it\s+|quiz\s+|assessment\s+)?to\s+(.+?)(?:\s+(?:due|by|before)\b|,|\.|$)/i)?.[1]?.trim()
    || text.match(/\bfor\s+([A-Z][\w .'-]{1,60})(?:\s+(?:due|by|before)\b|,|\.|$)/)?.[1]?.trim()
  if (assigned && !/\b(team|department)\b/i.test(assigned)) args.assigned_to = cleanEntity(assigned)

  const topicPatterns = [
    /\b(?:create|add|make|build|prepare)\s+(?:a\s+|an\s+)?(?:easy|medium|hard|advanced|hardcore)?\s*(?:quiz|assessment|test)\s+(?:on|about|for)\s+(.+?)(?:\s*,|\s+difficulty\b|\s+and\s+(?:assign|give)\b|\s+for\s+[A-Z]|\s+(?:due|by|before)\b|$)/i,
    /\b(?:create|add|make|build|prepare)\s+(?:a\s+|an\s+)?(?:easy|medium|hard|advanced|hardcore)?\s*(.+?)\s+(?:quiz|assessment|test)\b/i,
    /\bgenerate\s+(?:\d{1,3}\s*)?(?:easy|medium|hard|advanced|hardcore)?\s*(.+?)\s+(?:questions?|mcqs?|mcq|qs)\b/i,
    /\bgenerate\s+(?:\d{1,3}\s*)?(?:questions?|mcqs?|mcq|qs)\s+(?:on|about|for)\s+(.+?)(?:\s*,|\s+difficulty\b|\s+and\s+(?:assign|give)\b|\s+(?:due|by|before)\b|$)/i,
    /\b(?:quiz|assessment|test)\s+(?:on|about|for)\s+(.+?)(?:\s*,|\s+difficulty\b|\s+and\s+(?:assign|give)\b|\s+(?:due|by|before)\b|$)/i,
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

export function cleanTopic(value: string) {
  return cleanEntity(value)
    .replace(/\b\d{1,3}\s*(?:questions?|mcqs?|mcq|qs)\b/ig, '')
    .replace(/\b(?:passing|pass)\s*(?:score|mark)?\s*(?:is|=|:)?\s*\d{1,3}\b/ig, '')
    .replace(/\b\d{1,3}\s*(?:minutes?|mins?|min)\b/ig, '')
    .replace(/\b(?:difficulty|level)\s+(?:easy|medium|hard|advanced|hardcore)\b/ig, '')
    .replace(/\b(?:easy|medium|hard|advanced|hardcore)\b/ig, '')
    .replace(/\b(?:quiz|assessment|test|questions?|mcqs?|mcq|qs)\b/ig, '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function cleanEntity(value: string) {
  return value
    .replace(/^["']|["']$/g, '')
    .replace(/\b(and|with)\b.*$/i, '')
    .replace(/^(the|a|an)\s+/i, '')
    .trim()
}

export function normalizeDifficultyArg(value?: string): DifficultyLevel {
  const normalized = String(value || '').toLowerCase().trim() as DifficultyLevel
  return ['easy', 'medium', 'hard', 'advanced', 'hardcore'].includes(normalized) ? normalized : 'medium'
}

export function normalizeCommandText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function isQuizCreationRequest(text: string) {
  return /\b(create|add|make|build|prepare)\b.*\b(quiz|assessment|test|questions?|mcqs?|mcq)\b/i.test(text)
    || /\bgenerate\b.*\b(questions?|mcqs?|mcq|quiz|assessment|test)\b/i.test(text)
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
