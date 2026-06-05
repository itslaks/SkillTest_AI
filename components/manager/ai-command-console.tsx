'use client'

import { KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  CheckCircle2,
  ClipboardList,
  FileQuestion,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
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
}

const commandPacks = [
  {
    title: 'People',
    icon: Users,
    prompts: [
      'run create employee email=person@company.com name="Person Name" employee_id=EMP001 domain=Java department=Engineering',
      'run update employee email=person@company.com domain=React department=Frontend',
      'run create trainer email=trainer@company.com name="Trainer Name" domain=Java',
      'run approve trainer email=trainer@company.com',
      'run delete employee email=person@company.com',
    ],
  },
  {
    title: 'Quizzes',
    icon: FileQuestion,
    prompts: [
      'run create quiz title="Java Basics" topic=Java difficulty=medium question_count=10 passing_score=70',
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
      'run update batch batch="Week 1 Java" status=running',
      'run create session batch="Week 1 Java" title="Day 1 Orientation" date=2026-06-10T10:00 trainer_email=trainer@company.com',
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
    ],
  },
]

const moduleLinks = [
  { label: 'Employees', href: '/manager/employees', icon: Users },
  { label: 'Quizzes', href: '/manager/quizzes', icon: FileQuestion },
  { label: 'Training Ops', href: '/manager/operations', icon: Workflow },
  { label: 'Admin Console', href: '/manager/admin', icon: ShieldCheck },
]

export function AICommandConsole() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activePack, setActivePack] = useState(commandPacks[0].title)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      ok: true,
      content: 'AI Command is live. Tell me the operation and I will execute it against the application data when the command has enough details.',
    },
  ])
  const scrollRef = useRef<HTMLDivElement>(null)
  const active = useMemo(() => commandPacks.find((pack) => pack.title === activePack) || commandPacks[0], [activePack])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, loading])

  async function runCommand(value: string) {
    const trimmed = value.trim()
    if (!trimmed || loading) return
    setInput('')
    setLoading(true)
    setMessages((previous) => [...previous, { role: 'user', content: trimmed }])

    try {
      const response = await fetch('/api/manager-chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      const payload = await response.json()
      const ok = response.ok && !payload.message?.startsWith('Command failed')
      setMessages((previous) => [...previous, { role: 'assistant', content: payload.message || payload.error || 'No response returned.', ok }])
      if (payload.provider === 'skilltest_ai_command' && ok) router.refresh()
    } catch {
      setMessages((previous) => [...previous, { role: 'assistant', content: 'AI Command could not reach the server. Refresh and try again.', ok: false }])
    } finally {
      setLoading(false)
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
      subtitle={`Ask for insights or execute ${active.title.toLowerCase()} operations in real time.`}
      value={input}
      loading={loading}
      onChange={setInput}
      onSubmit={() => void runCommand(input)}
      onKeyDown={keydown}
      placeholder='Ask, or run: create employee email=... name="..." employee_id=... domain=...'
      utilityActions={
        <div className="hidden flex-wrap items-center justify-end gap-2 md:flex">
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
        </>
      }
    >
      <div className="space-y-3">
        <div className="mb-3 grid gap-2 rounded-xl border border-sky-200/10 bg-slate-950/55 p-3 text-xs text-sky-100/80 sm:grid-cols-2">
          <StatusNote icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />} label="Realtime execution" text="Create, update, delete, assign, approve, and mark attendance from chat." />
          <StatusNote icon={<Sparkles className="h-4 w-4 text-sky-200" />} label="Natural language" text="Example: delete all feedback forms, approve trainer by email, or create a batch." />
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
            </div>
          </div>
        ))}

        {loading && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-sky-200/20 bg-sky-300/10 px-3 py-2 text-xs text-sky-50">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Executing command against live data
          </div>
        )}
        <div ref={scrollRef} />
      </div>
    </RuixenMoonChat>
  )
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
  return (
    <div className="space-y-1.5">
      {value.split('\n').map((line, index) => (
        line.trim() ? <p key={index}>{line}</p> : <div key={index} className="h-1" />
      ))}
    </div>
  )
}
