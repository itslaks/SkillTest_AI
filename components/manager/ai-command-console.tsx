'use client'

import { KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileQuestion,
  Download,
  GraduationCap,
  Loader2,
  Mic,
  MessageSquareText,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  UserCheck,
  Users,
  Workflow,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import RuixenMoonChat from '@/components/ui/ruixen-moon-chat'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  ok?: boolean
  preview?: AiActionPreview
  exportPayload?: AiExportPayload
}

type AiActionPreview = {
  requiresConfirmation?: boolean
  confirmToken?: string
  actionType?: string
  affectedCount?: number
  affectedEntityType?: string
  messagePreview?: string
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  affected?: Array<{ id: string; label: string; detail?: string }>
}

type AiExportPayload = {
  id: string
  format: 'csv' | 'pdf'
  title: string
  generatedAt: string
  requestedBy: string
  filters?: Record<string, string>
  content: string
}

type CommandEmployee = {
  id: string
  full_name?: string | null
  email: string
  employee_id?: string | null
  department?: string | null
  domain?: string | null
}

type CommandQuiz = {
  id: string
  title: string
  topic?: string | null
  difficulty?: string | null
  is_active?: boolean | null
}

const commandPacks = [
  {
    title: 'People',
    icon: Users,
    prompts: [
      'List employees who have not taken any test for past 10 days',
      'Employees with no tests in last 10 days',
      'Low performers below 60%',
      'High-risk proctoring summary',
      'Executive Summary',
      'Anything unusual this week?',
      'Which employees are at risk of failing this month training goals?',
      'Which employees never attempted a quiz?',
      'run create employee email=person@company.com name="Person Name" employee_id=EMP001 domain=Java department=Engineering',
      'run update employee email=person@company.com domain=React department=Frontend',
      'run create trainer email=trainer@company.com name="Trainer Name" domain=Java',
      'run approve trainer email=trainer@company.com',
    ],
  },
  {
    title: 'Quizzes',
    icon: FileQuestion,
    prompts: [
      'run create quiz title="Java Basics" topic=Java difficulty=medium question_count=10 passing_score=70 time_limit_minutes=30 assigned_to=person@company.com certificate_min_score=70 proctoring_required=true',
      'run update quiz title="Java Basics" passing_score=80 time_limit=45',
      'run create question quiz="Java Basics" question="Which keyword creates a class?" option_a=class option_b=function option_c=let option_d=return correct_answer=A',
      'run assign quiz quiz="Java Basics" employee_emails=person@company.com due_date=2026-06-30',
      'run delete quiz title="Java Basics"',
    ],
  },
  {
    title: 'Training',
    icon: Workflow,
    prompts: [
      'run create batch title="Week 1 Java" domain=Java trainer_email=trainer@company.com employee_emails=person@company.com',
      'List training batches',
      'run update batch batch="Week 1 Java" status=running',
      'run delete batch title="Week 1 Java"',
      'run create session batch="Week 1 Java" title="Day 1 Orientation" date=2026-06-10T10:00 trainer_email=trainer@company.com',
      'List scheduled sessions',
      'run update session title="Day 1 Orientation" status=completed link=https://meet.google.com/abc-defg-hij',
      'run delete session title="Day 1 Orientation"',
      'run mark attendance session="Day 1 Orientation" email=person@company.com status=present',
      'run delete scheduled confirmation="DELETE SCHEDULED"',
    ],
  },
  {
    title: 'Feedback',
    icon: ClipboardList,
    prompts: [
      'run create feedback form batch="Week 1 Java" title="Week 1 Feedback" closes_at=2026-06-12T18:00',
      'run update feedback form title="Week 1 Feedback" status=open',
      'run delete feedback form title="Week 1 Feedback"',
      'delete all feedback forms',
      'Which employees are eligible for certificates but not issued yet?',
      'Weekly inactive employees',
      'Batch performance report',
    ],
  },
]

const templatePrompts = [
  'Weekly inactive employees',
  'Employees with no tests in last 10 days',
  'Failed employees by quiz',
  'Low performers below 60%',
  'High-risk proctoring summary',
  'Batch performance report',
  'Pending assessments',
  'Overdue assessments',
  'Domain performance comparison',
  'Certificate eligibility report',
  'Executive Summary',
  'Anything unusual this week?',
  'Create a recovery plan for all employees below 50%',
  'Which employees are at risk of failing this month training goals?',
]

const moduleLinks = [
  { label: 'Employees', href: '/manager/employees', icon: Users },
  { label: 'Quizzes', href: '/manager/quizzes', icon: FileQuestion },
  { label: 'Training Ops', href: '/manager/operations', icon: Workflow },
  { label: 'Admin Console', href: '/manager/admin', icon: ShieldCheck },
]

export function AICommandConsole({ employees = [], quizzes = [] }: { employees?: CommandEmployee[]; quizzes?: CommandQuiz[] }) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [processingPrompt, setProcessingPrompt] = useState('')
  const [listening, setListening] = useState(false)
  const [activePack, setActivePack] = useState(commandPacks[0].title)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      ok: true,
      content: 'AI Command is live. Ask for live operations data, reports, exports, or actions. Risky actions are previewed first and run only after confirmation.',
    },
  ])
  const scrollRef = useRef<HTMLDivElement>(null)
  const didLoadBriefing = useRef(false)
  const active = useMemo(() => commandPacks.find((pack) => pack.title === activePack) || commandPacks[0], [activePack])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, loading])

  async function loadProactiveBriefing() {
    try {
      const response = await fetch('/api/manager-chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '/briefing', history: [] }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.message) return
      setMessages((previous) => [...previous, {
        role: 'assistant',
        content: payload.message,
        ok: true,
        preview: payload.preview,
        exportPayload: payload.export,
      }])
    } catch {
      // The command console remains usable if the proactive brief cannot load.
    }
  }

  useEffect(() => {
    if (didLoadBriefing.current) return
    didLoadBriefing.current = true
    void loadProactiveBriefing()
  }, [])

  async function runCommand(value: string) {
    const trimmed = value.trim()
    if (!trimmed || loading) return
    setInput('')
    setLoading(true)
    setProcessingPrompt(trimmed)
    setMessages((previous) => [...previous, { role: 'user', content: trimmed }])

    try {
      const response = await fetch('/api/manager-chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: messages.slice(-8) }),
      })
      const payload = await response.json()
      const ok = response.ok && !payload.message?.startsWith('Command failed')
      setMessages((previous) => [...previous, {
        role: 'assistant',
        content: payload.message || payload.error || 'No response returned.',
        ok,
        preview: payload.preview,
        exportPayload: payload.export,
      }])
      if (payload.provider === 'skilltest_ai_command' && ok) router.refresh()
    } catch {
      setMessages((previous) => [...previous, { role: 'assistant', content: 'AI Command could not reach the server. Refresh and try again.', ok: false }])
    } finally {
      setLoading(false)
      setProcessingPrompt('')
    }
  }

  async function decidePreview(preview: AiActionPreview, decision: 'confirm' | 'cancel', messageOverride?: string) {
    if (!preview.confirmToken || loading) return
    setLoading(true)
    setProcessingPrompt(`${decision} ${preview.actionType || 'pending action'}`)
    setMessages((previous) => [...previous, { role: 'user', content: decision === 'confirm' ? 'Confirm' : 'Cancel' }])
    try {
      const response = await fetch('/api/manager-chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: decision,
          confirmToken: preview.confirmToken,
          decision,
          messageOverride,
          history: messages.slice(-8),
        }),
      })
      const payload = await response.json()
      const ok = response.ok && !payload.message?.startsWith('Command failed')
      setMessages((previous) => [...previous, { role: 'assistant', content: payload.message || payload.error || 'No response returned.', ok }])
      if (ok) router.refresh()
    } catch {
      setMessages((previous) => [...previous, { role: 'assistant', content: 'AI Command could not confirm the action. Try again.', ok: false }])
    } finally {
      setLoading(false)
      setProcessingPrompt('')
    }
  }

  function startVoiceCommand() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMessages((previous) => [...previous, { role: 'assistant', content: 'Voice command is not supported in this browser. Please type the command instead.', ok: false }])
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => {
      setListening(false)
      setMessages((previous) => [...previous, { role: 'assistant', content: 'Voice command could not hear clearly. Try again or type the request.', ok: false }])
    }
    recognition.onresult = (event: any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim()
      if (transcript) setInput(transcript)
    }
    recognition.start()
  }

  async function downloadExport(payload: AiExportPayload) {
    try {
      const response = await fetch('/api/manager-chatbot/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${payload.format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setMessages((previous) => [...previous, { role: 'assistant', content: 'Export failed. Please try again.', ok: false }])
    }
  }

  function keydown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void runCommand(input)
    }
  }

  return (
    <RuixenMoonChat
      title="SkillTest_AI Command"
      subtitle={`Ask for live insights or execute ${active.title.toLowerCase()} operations in real time.`}
      value={input}
      loading={loading}
      onChange={setInput}
      onSubmit={() => void runCommand(input)}
      onKeyDown={keydown}
      placeholder='Ask: inactive employees, weak scores, certificate gaps - or run: create employee email=...'
      utilityActions={
        <div className="hidden flex-wrap items-center justify-end gap-2 md:flex">
          <Button
            type="button"
            variant="outline"
            onClick={startVoiceCommand}
            className="rounded-full border-sky-200/20 bg-slate-950/45 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:border-sky-200/40 hover:bg-sky-200/10"
          >
            <Mic className="mr-2 h-3.5 w-3.5" />
            {listening ? 'Listening...' : 'Voice'}
          </Button>
          {moduleLinks.map((link) => {
            const Icon = link.icon
            return (
              <a key={link.href} href={link.href} className="inline-flex items-center gap-2 rounded-full border border-sky-200/20 bg-slate-950/45 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:border-sky-200/40 hover:bg-sky-200/10">
                <Icon className="h-3.5 w-3.5" />
                {link.label}
              </a>
            )
          })}
        </div>
      }
      quickActions={
        <>
          {commandPacks.map((pack) => {
            const Icon = pack.icon
            return (
              <CommandChip
                key={pack.title}
                active={pack.title === activePack}
                icon={<Icon className="h-4 w-4" />}
                label={pack.title}
                onClick={() => setActivePack(pack.title)}
              />
            )
          })}
          {active.prompts.slice(0, 5).map((prompt) => (
            <CommandChip
              key={prompt}
              icon={<TerminalSquare className="h-4 w-4" />}
              label={prompt}
              compact
              onClick={() => setInput(prompt)}
            />
          ))}
          {templatePrompts.slice(0, 10).map((prompt) => (
            <CommandChip
              key={`template-${prompt}`}
              icon={<Sparkles className="h-4 w-4" />}
              label={prompt}
              compact
              onClick={() => void runCommand(prompt)}
            />
          ))}
        </>
      }
    >
      <div className="space-y-3">
        <QuizLaunchpad employees={employees} quizzes={quizzes} loading={loading} onLaunch={(command) => void runCommand(command)} />

        <div className="mb-3 grid gap-2 rounded-xl border border-sky-200/10 bg-slate-950/55 p-3 text-xs text-sky-100/80 sm:grid-cols-2">
          <StatusNote icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />} label="Safe execution" text="Actions are previewed first and require confirmation before anything changes." />
          <StatusNote icon={<Sparkles className="h-4 w-4 text-sky-200" />} label="Operations intelligence" text="Ask for inactive employees, weak areas, proctoring risk, exports, templates, or schedules." />
        </div>

        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[88%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm ${
              message.role === 'user'
                ? 'rounded-br-md border-white/10 bg-white text-slate-950'
                : message.ok === false
                  ? 'rounded-bl-md border-red-300/30 bg-red-950/55 text-red-50'
                  : 'rounded-bl-md border-sky-200/20 bg-sky-950/55 text-sky-50'
            }`}>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] opacity-70">
                {message.role === 'user' ? <MessageSquareText className="h-3 w-3" /> : message.ok === false ? <XCircle className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                {message.role === 'user' ? 'Admin command' : message.ok === false ? 'Execution issue' : 'System reply'}
              </div>
              <FormattedText value={message.content} />
              {message.preview?.requiresConfirmation && (
                <ActionPreviewCard preview={message.preview} onDecision={(decision, draft) => void decidePreview(message.preview!, decision, draft)} />
              )}
              {message.exportPayload && (
                <Button
                  type="button"
                  onClick={() => void downloadExport(message.exportPayload!)}
                  className="mt-3 h-9 rounded-full bg-white text-slate-950 hover:bg-sky-100"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download {message.exportPayload.format.toUpperCase()}
                </Button>
              )}
              {message.role === 'assistant' && message.ok !== false && (
                <SuggestedActionButtons content={message.content} onRun={(prompt) => void runCommand(prompt)} onExport={() => void runCommand('Export this as CSV')} />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="rounded-xl border border-sky-200/20 bg-sky-300/10 px-3 py-2 text-xs text-sky-50">
            <div className="flex items-center gap-2 font-semibold">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {processingStatus(processingPrompt).title}
            </div>
            <p className="mt-1 text-sky-50/75">{processingStatus(processingPrompt).detail}</p>
          </div>
        )}
        <div ref={scrollRef} />
      </div>
    </RuixenMoonChat>
  )
}

function processingStatus(prompt: string) {
  const lower = prompt.toLowerCase()
  if (/\bconfirm\b/.test(lower)) return { title: 'Confirming approved operation', detail: 'Applying the reviewed action, refreshing affected consoles, and writing the audit result.' }
  if (/\bcancel\b/.test(lower)) return { title: 'Cancelling pending operation', detail: 'Closing the pending action without changing training data.' }
  if (/\bcreate\s+batch\b/.test(lower)) return { title: 'Creating training batch', detail: 'Validating trainer, enrolling requested learners, syncing batch links, and logging governance evidence.' }
  if (/\bupdate\s+batch\b/.test(lower)) return { title: 'Updating training batch', detail: 'Finding the batch, checking lifecycle fields, syncing trainer assignments, and refreshing Training Ops.' }
  if (/\b(delete|remove)\s+batch\b/.test(lower)) return { title: 'Deleting training batch', detail: 'Checking safeguards, removing linked sessions and roster rows, then writing the audit trail.' }
  if (/\b(create|schedule)\s+session\b/.test(lower)) return { title: 'Scheduling training session', detail: 'Checking batch, selected trainer roster, learner scope, meeting link, email notices, and attendance setup.' }
  if (/\bupdate\s+session\b/.test(lower)) return { title: 'Updating training session', detail: 'Finding the session, applying status/link changes, and re-sending allocation details when needed.' }
  if (/\b(delete|remove)\s+session\b/.test(lower)) return { title: 'Deleting training session', detail: 'Removing session attendance, linked notifications, feedback references, and audit records.' }
  if (/\bcreate\s+quiz\b/.test(lower)) return { title: 'Preparing quiz command', detail: 'Parsing quiz settings, assignees, certificate rule, and AI proctoring choice before preview.' }
  if (/\bassign\s+quiz\b/.test(lower)) return { title: 'Assigning quiz', detail: 'Validating recipients, creating assignments, and sending/logging assignment emails.' }
  if (/\b(export|download|report)\b/.test(lower)) return { title: 'Preparing report export', detail: 'Collecting current scoped data and formatting the requested download.' }
  if (/\b(attendance|absent|present|late)\b/.test(lower)) return { title: 'Checking attendance records', detail: 'Reading sessions, learner roster, attendance rows, and risk signals.' }
  if (/\b(employee|employees|learner|learners)\b/.test(lower)) return { title: 'Reading employee roster', detail: 'Using your current role scope, trainer assignments, quiz activity, and profile records.' }
  return { title: 'Interpreting command', detail: 'Classifying the prompt, loading scoped records, and choosing the safest matching operation.' }
}

function QuizLaunchpad({
  employees,
  quizzes,
  loading,
  onLaunch,
}: {
  employees: CommandEmployee[]
  quizzes: CommandQuiz[]
  loading: boolean
  onLaunch: (command: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [mode, setMode] = useState<'create' | 'assign'>('create')
  const [step, setStep] = useState(1)
  const [topic, setTopic] = useState('')
  const [title, setTitle] = useState('')
  const [quizId, setQuizId] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [questionCount, setQuestionCount] = useState(10)
  const [passingScore, setPassingScore] = useState(70)
  const [timeLimit, setTimeLimit] = useState(30)
  const [dueDate, setDueDate] = useState('')
  const [certificateEnabled, setCertificateEnabled] = useState(true)
  const [certificateScore, setCertificateScore] = useState(70)
  const [proctoringRequired, setProctoringRequired] = useState(true)
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [employeeSearch, setEmployeeSearch] = useState('')

  const selectedQuiz = quizzes.find((quiz) => quiz.id === quizId)
  const filteredEmployees = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase()
    if (!term) return employees
    return employees.filter((employee) =>
      [employee.full_name, employee.email, employee.employee_id, employee.department, employee.domain]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    )
  }, [employeeSearch, employees])

  const steps = [
    { number: 1, label: 'Quiz', icon: GraduationCap },
    { number: 2, label: 'People', icon: UserCheck },
    { number: 3, label: 'Rules', icon: ShieldCheck },
    { number: 4, label: 'Review', icon: Rocket },
  ]

  const stepReady = step === 1
    ? mode === 'create' ? Boolean(topic.trim() && title.trim()) : Boolean(quizId)
    : step === 2
      ? selectedEmails.length > 0
      : true

  function toggleEmployee(email: string) {
    setSelectedEmails((current) => current.includes(email)
      ? current.filter((item) => item !== email)
      : [...current, email])
  }

  function buildCommand() {
    const recipients = selectedEmails.join(',')
    if (mode === 'assign' && selectedQuiz) {
      return [
        'run assign quiz',
        `quiz=${commandValue(selectedQuiz.title)}`,
        `employee_emails=${commandValue(recipients)}`,
        dueDate ? `due_date=${dueDate}` : '',
      ].filter(Boolean).join(' ')
    }

    return [
      'run create quiz',
      `title=${commandValue(title.trim())}`,
      `topic=${commandValue(topic.trim())}`,
      `difficulty=${difficulty}`,
      `question_count=${questionCount}`,
      `passing_score=${passingScore}`,
      `time_limit_minutes=${timeLimit}`,
      `assigned_to=${commandValue(recipients)}`,
      certificateEnabled ? `certificate_min_score=${certificateScore}` : 'certificate_enabled=false',
      `proctoring_required=${proctoringRequired}`,
      dueDate ? `due_date=${dueDate}` : '',
    ].filter(Boolean).join(' ')
  }

  function launch() {
    if (!selectedEmails.length || (mode === 'create' && (!topic.trim() || !title.trim())) || (mode === 'assign' && !selectedQuiz)) return
    onLaunch(buildCommand())
  }

  return (
    <section className="mb-3 overflow-hidden rounded-lg border border-cyan-200/20 bg-slate-950/75">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-cyan-300 text-slate-950">
            <Rocket className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-white">Quiz Launchpad</span>
            <span className="block text-[11px] text-sky-100/60">Four quick decisions, then a confirmation preview.</span>
          </span>
        </span>
        <span className="text-xs font-semibold text-cyan-200">{open ? 'Hide' : 'Open'}</span>
      </button>

      {open && (
        <div className="border-t border-white/10">
          <div className="grid grid-cols-4 border-b border-white/10">
            {steps.map((item) => {
              const Icon = item.icon
              const active = step === item.number
              const complete = step > item.number
              return (
                <button
                  key={item.number}
                  type="button"
                  onClick={() => setStep(item.number)}
                  className={`relative flex min-w-0 items-center justify-center gap-1.5 px-2 py-3 text-xs font-semibold transition ${
                    active ? 'bg-cyan-300 text-slate-950' : complete ? 'bg-emerald-300/10 text-emerald-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                    active ? 'border-slate-950/20 bg-slate-950/10' : 'border-current/30'
                  }`}>
                    {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.number}
                  </span>
                  <Icon className="hidden h-3.5 w-3.5 sm:block" />
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
          </div>

          <div className="min-h-64 p-3">
            {step === 1 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 rounded-md bg-white/[0.04] p-1">
                  <button
                    type="button"
                    onClick={() => { setMode('create'); setQuizId('') }}
                    className={`h-9 rounded-md text-xs font-semibold ${mode === 'create' ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/5'}`}
                  >
                    Create + assign
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('assign')}
                    className={`h-9 rounded-md text-xs font-semibold ${mode === 'assign' ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/5'}`}
                  >
                    Assign existing
                  </button>
                </div>

                {mode === 'create' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <LaunchField label="Quiz title">
                      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="SQL Window Functions" className={launchInputClass} />
                    </LaunchField>
                    <LaunchField label="Topic">
                      <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="SQL window functions" className={launchInputClass} />
                    </LaunchField>
                    <LaunchField label="Difficulty">
                      <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className={launchInputClass}>
                        {['easy', 'medium', 'hard', 'advanced', 'hardcore'].map((value) => <option key={value} value={value}>{sentenceCase(value)}</option>)}
                      </select>
                    </LaunchField>
                    <LaunchField label="Questions">
                      <input type="number" min={1} max={50} value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} className={launchInputClass} />
                    </LaunchField>
                  </div>
                ) : (
                  <LaunchField label="Active quiz">
                    <select value={quizId} onChange={(event) => setQuizId(event.target.value)} className={launchInputClass}>
                      <option value="">Choose a quiz</option>
                      {quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title} - {quiz.topic || 'General'}</option>)}
                    </select>
                  </LaunchField>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder="Search name, email, ID, department..."
                    className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <span className="text-xs font-semibold text-cyan-200">{selectedEmails.length} selected</span>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEmails((current) => Array.from(new Set([...current, ...filteredEmployees.map((employee) => employee.email)])))}
                    className="text-xs font-semibold text-cyan-200 hover:text-cyan-100"
                  >
                    Select shown
                  </button>
                  <button type="button" onClick={() => setSelectedEmails([])} className="text-xs font-semibold text-slate-400 hover:text-white">
                    Clear
                  </button>
                </div>
                <div className="grid max-h-48 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
                  {filteredEmployees.map((employee) => {
                    const selected = selectedEmails.includes(employee.email)
                    return (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => toggleEmployee(employee.email)}
                        className={`flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left transition ${
                          selected ? 'border-cyan-300/50 bg-cyan-300/10' : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                        }`}
                      >
                        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${selected ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-slate-600'}`}>
                          {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-white">{employee.full_name || employee.email}</span>
                          <span className="block truncate text-[10px] text-slate-400">{employee.email} {employee.department ? `- ${employee.department}` : ''}</span>
                        </span>
                      </button>
                    )
                  })}
                  {!filteredEmployees.length && <p className="py-8 text-center text-xs text-slate-400 sm:col-span-2">No employees match this search.</p>}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {mode === 'create' && (
                  <>
                    <LaunchField label="Passing score (%)">
                      <input type="number" min={0} max={100} value={passingScore} onChange={(event) => setPassingScore(Number(event.target.value))} className={launchInputClass} />
                    </LaunchField>
                    <LaunchField label="Time limit (minutes)">
                      <input type="number" min={1} max={480} value={timeLimit} onChange={(event) => setTimeLimit(Number(event.target.value))} className={launchInputClass} />
                    </LaunchField>
                  </>
                )}
                <LaunchField label="Due date">
                  <div className="relative">
                    <CalendarClock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={`${launchInputClass} pl-9`} />
                  </div>
                </LaunchField>
                {mode === 'create' && (
                  <>
                    <ToggleRow label="AI proctoring" checked={proctoringRequired} onChange={setProctoringRequired} />
                    <ToggleRow label="Certificate" checked={certificateEnabled} onChange={setCertificateEnabled} />
                    {certificateEnabled && (
                      <LaunchField label="Certificate score (%)">
                        <input type="number" min={0} max={100} value={certificateScore} onChange={(event) => setCertificateScore(Number(event.target.value))} className={launchInputClass} />
                      </LaunchField>
                    )}
                  </>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <div className="grid gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-2">
                  <ReviewLine label={mode === 'create' ? 'New quiz' : 'Quiz'} value={mode === 'create' ? title || 'Not set' : selectedQuiz?.title || 'Not selected'} />
                  <ReviewLine label="Recipients" value={`${selectedEmails.length} employee${selectedEmails.length === 1 ? '' : 's'}`} />
                  <ReviewLine label="Due date" value={dueDate || 'Not set'} />
                  <ReviewLine label="Action" value={mode === 'create' ? `${questionCount} ${difficulty} questions` : 'Assign existing quiz'} />
                  {mode === 'create' && <ReviewLine label="Pass / certificate" value={`${passingScore}% / ${certificateEnabled ? `${certificateScore}%` : 'Off'}`} />}
                  {mode === 'create' && <ReviewLine label="AI proctoring" value={proctoringRequired ? 'Enabled' : 'Disabled'} />}
                </div>
                <p className="text-xs leading-relaxed text-slate-400">Launch creates an action preview only. Review the affected employees and press Confirm in the conversation to execute.</p>
                <Button type="button" onClick={launch} disabled={loading || !selectedEmails.length} className="h-10 w-full rounded-md bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                  Build confirmation preview
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-3 py-2.5">
            <Button type="button" size="sm" variant="ghost" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))} className="rounded-md text-slate-300 hover:bg-white/10 hover:text-white">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Step {step} of 4</span>
            <Button type="button" size="sm" disabled={step === 4 || !stepReady} onClick={() => setStep((current) => Math.min(4, current + 1))} className="rounded-md bg-white text-slate-950 hover:bg-slate-100">
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

const launchInputClass = 'h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50'

function LaunchField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      {children}
    </label>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex h-[62px] items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 text-left">
      <span className="text-sm font-semibold text-white">{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-cyan-300' : 'bg-slate-700'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  )
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-slate-950 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function commandValue(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function AICommandHistory({ logs, schedules }: { logs: any[]; schedules: any[] }) {
  return (
    <div className="mx-auto mt-6 grid w-full max-w-7xl gap-4 px-4 pb-8 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-2xl border border-slate-200/10 bg-slate-950/80 p-4 text-slate-100 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-sky-100">Recent AI Command Audit</h2>
          <span className="rounded-full border border-sky-200/20 px-2 py-1 text-[10px] text-sky-100">{logs.length} logged</span>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
          {logs.length ? logs.map((log) => (
            <div key={log.id} className="grid gap-2 border-b border-white/10 p-3 text-xs last:border-b-0 md:grid-cols-[1fr_auto_auto]">
              <div>
                <p className="font-semibold text-white">{log.original_prompt}</p>
                <p className="mt-1 text-slate-300">{log.result_summary || log.error_message || log.detected_intent}</p>
              </div>
              <span className="h-fit rounded-full border border-white/10 px-2 py-1 uppercase text-sky-100">{log.action_status}</span>
              <span className="text-slate-400">{new Date(log.created_at).toLocaleString('en-IN')}</span>
            </div>
          )) : (
            <p className="p-3 text-sm text-slate-300">No AI command audit records yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/10 bg-slate-950/80 p-4 text-slate-100 shadow-xl">
        <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-sky-100">Scheduled Commands</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-300">Schedules are stored for Vercel Cron or another worker to execute safely with audit logging.</p>
        <div className="mt-3 space-y-2">
          {schedules.length ? schedules.map((schedule) => (
            <div key={schedule.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
              <p className="font-semibold text-white">{schedule.title}</p>
              <p className="mt-1 text-slate-300">{schedule.cadence} at {schedule.time_of_day} · {schedule.enabled ? 'enabled' : 'disabled'}</p>
            </div>
          )) : (
            <p className="rounded-xl border border-white/10 p-3 text-sm text-slate-300">No recurring commands configured.</p>
          )}
        </div>
      </section>
    </div>
  )
}

function ActionPreviewCard({ preview, onDecision }: { preview: AiActionPreview; onDecision: (decision: 'confirm' | 'cancel', draft?: string) => void }) {
  const [draft, setDraft] = useState(preview.messagePreview || '')
  const riskTone = preview.riskLevel === 'critical' || preview.riskLevel === 'high'
    ? 'border-red-300/30 bg-red-950/35 text-red-50'
    : 'border-amber-200/30 bg-amber-950/25 text-amber-50'
  return (
    <div className={`mt-3 rounded-xl border p-3 ${riskTone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em]">Action Preview</p>
          <p className="mt-1 font-semibold">{preview.actionType || 'AI action'} · {preview.affectedCount || 0} affected</p>
        </div>
        <span className="rounded-full border border-white/20 px-2 py-1 text-[10px] font-bold uppercase">{preview.riskLevel || 'medium'} risk</span>
      </div>
      {preview.messagePreview && (
        <div className="mt-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">Editable draft</label>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="mt-1 min-h-20 w-full rounded-lg border border-white/10 bg-black/25 p-2 text-xs text-white outline-none focus:border-white/40"
          />
        </div>
      )}
      {!!preview.affected?.length && (
        <div className="mt-2 grid gap-1 text-xs">
          {preview.affected.slice(0, 5).map((item) => (
            <div key={item.id} className="flex justify-between gap-3 rounded-lg bg-white/5 px-2 py-1">
              <span className="font-medium">{item.label}</span>
              {item.detail && <span className="truncate opacity-75">{item.detail}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => onDecision('confirm', draft)} className="rounded-full bg-emerald-300 text-emerald-950 hover:bg-emerald-200">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Confirm
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onDecision('cancel')} className="rounded-full border-white/20 bg-black/20 text-white hover:bg-white/10">
          <XCircle className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  )
}

function SuggestedActionButtons({ content, onRun, onExport }: { content: string; onRun: (prompt: string) => void; onExport: () => void }) {
  const actions = buildSuggestedActions(content)
  if (!actions.length) return null
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.label}
          type="button"
          size="sm"
          variant="outline"
          onClick={() => action.kind === 'export' ? onExport() : onRun(action.prompt)}
          className="rounded-full border-white/15 bg-white/10 text-xs text-white hover:bg-white/20"
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
}

function buildSuggestedActions(content: string) {
  const lower = content.toLowerCase()
  const actions: Array<{ label: string; prompt: string; kind?: 'export' }> = []
  if (/\binactive|pending|overdue|low-score|low score|risk|recovery/i.test(content)) {
    actions.push({ label: 'Why?', prompt: 'Why is this happening? Explain the exact records behind this metric.' })
  }
  if (/\binactive|pending|overdue|below|low score|risk/i.test(lower)) {
    actions.push({ label: 'Send Reminder', prompt: 'Send reminder to them' })
  }
  if (/\bfailed|below 50|below 60|recovery/i.test(lower)) {
    actions.push({ label: 'Assign Retest', prompt: 'Assign retest to them' })
  }
  if (/\bbatch|domain|training|recovery/i.test(lower)) {
    actions.push({ label: 'Create Batch', prompt: 'Create a catch-up batch for this group' })
  }
  actions.push({ label: 'Export', prompt: 'Export this as CSV', kind: 'export' })
  return actions.slice(0, 4)
}

function CommandChip({ active, compact, icon, label, onClick }: { active?: boolean; compact?: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={`max-w-full rounded-full border-sky-200/20 px-3 text-xs shadow-sm transition ${
        active
          ? 'bg-sky-200 text-slate-950 hover:bg-sky-100'
          : 'bg-slate-950/50 text-sky-100 hover:border-sky-200/40 hover:bg-sky-200/10 hover:text-white'
      } ${compact ? 'h-8 max-w-[20rem] truncate' : 'h-9'}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </Button>
  )
}

function StatusNote({ icon, label, text }: { icon: ReactNode; label: string; text: string }) {
  return (
    <div className="flex gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="font-semibold text-white">{label}</p>
        <p className="mt-1 leading-relaxed">{text}</p>
      </div>
    </div>
  )
}

function FormattedText({ value }: { value: string }) {
  const blocks = value.split('\n\n')
  return (
    <div className="space-y-2">
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').filter((line) => line.trim())
        if (lines.length >= 2 && lines.every((line) => line.trim().startsWith('|')) && lines.some((line) => /^[-|\s:]+$/.test(line.replace(/\|/g, '')))) {
          const tableRows = lines
            .filter((line) => !/^[-|\s:]+$/.test(line.replace(/\|/g, '')))
            .map((line) => line.split('|').map((cell) => cell.trim()).filter(Boolean))
          const [head, ...body] = tableRows
          return (
            <div key={blockIndex} className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-white/10 text-white">
                  <tr>{head.map((cell) => <th key={cell} className="px-3 py-2 font-semibold">{cell}</th>)}</tr>
                </thead>
                <tbody>
                  {body.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-white/10">
                      {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2 text-sky-50/90">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        const joined = lines.join('\n')
        const highlighted = /^(recommendation|suggested actions|warning|risk):?/i.test(joined.trim())
        return (
          <div key={blockIndex} className={highlighted ? 'rounded-xl border border-white/10 bg-white/10 p-2' : 'space-y-1.5'}>
            {lines.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        )
      })}
    </div>
  )
}
