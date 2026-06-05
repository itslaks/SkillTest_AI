'use client'

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  CheckCircle2,
  ClipboardList,
  DatabaseZap,
  FileQuestion,
  Loader2,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Users,
  Workflow,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  ok?: boolean
}

const commandPacks = [
  {
    title: 'People',
    icon: Users,
    color: 'emerald',
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
    color: 'violet',
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
    color: 'cyan',
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
    color: 'amber',
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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const active = useMemo(() => commandPacks.find((pack) => pack.title === activePack) || commandPacks[0], [activePack])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
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
      inputRef.current?.focus()
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void runCommand(input)
  }

  function keydown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void runCommand(input)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-950 text-cyan-200">
              <DatabaseZap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Admin execution cockpit</p>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-950">AI Command</h1>
              <p className="mt-1 text-sm text-zinc-500">Use the popup for quick access, or this page for full admin workflows and command history.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {moduleLinks.map((link) => {
              const Icon = link.icon
              return (
                <a key={link.href} href={link.href} className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100">
                  <Icon className="h-3.5 w-3.5" />
                  {link.label}
                </a>
              )
            })}
          </div>
        </div>
      </section>

      <div className="grid min-h-[calc(100vh-17rem)] grid-cols-1 gap-5 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Command lanes</p>
          <div className="mt-4 grid gap-2">
            {commandPacks.map((pack) => {
              const Icon = pack.icon
              const selected = pack.title === activePack
              return (
                <button
                  key={pack.title}
                  type="button"
                  onClick={() => setActivePack(pack.title)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    selected ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-semibold">{pack.title}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              Realtime execution
            </div>
            <p className="mt-2 text-xs leading-relaxed text-emerald-700">
              Create, update, delete, assign, approve, mark attendance, open feedback forms, and clear scheduled work directly from chat.
            </p>
          </div>
        </aside>

        <main className="flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 bg-zinc-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500">Selected lane</p>
                <h2 className="mt-1 text-2xl font-semibold text-zinc-950">{active.title} operations</h2>
              </div>
              <div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">
                Live data commands
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="chatbot-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[86%] rounded-3xl border p-4 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'rounded-br-md border-zinc-900 bg-zinc-950 text-white'
                    : message.ok === false
                      ? 'rounded-bl-md border-red-200 bg-red-50 text-red-800'
                      : 'rounded-bl-md border-cyan-200 bg-cyan-50 text-zinc-800'
                }`}>
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] opacity-70">
                    {message.role === 'user' ? <MessageSquareText className="h-3 w-3" /> : message.ok === false ? <XCircle className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                    {message.role === 'user' ? 'Admin command' : message.ok === false ? 'Execution issue' : 'System reply'}
                  </div>
                  <FormattedText value={message.content} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Executing command against live data
              </div>
            )}
          </div>

          <form onSubmit={submit} className="border-t border-zinc-200 bg-zinc-50 p-5">
            <div className="flex items-end gap-3">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={keydown}
                rows={2}
                placeholder='Say: create employee email=... name="..." employee_id=... domain=...'
                className="max-h-40 min-h-16 rounded-2xl border-zinc-200 bg-white text-zinc-950 placeholder:text-zinc-400 focus-visible:ring-cyan-300/40"
              />
              <Button type="submit" disabled={loading || !input.trim()} className="h-16 rounded-2xl bg-zinc-950 px-5 text-white hover:bg-zinc-800">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
          </form>
        </main>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <TerminalSquare className="h-4 w-4 text-amber-600" />
              Command examples
            </div>
            <div className="mt-4 grid gap-2">
              {active.prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInput(prompt)}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-left text-xs leading-relaxed text-zinc-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-zinc-950"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Sparkles className="h-4 w-4" />
              Natural language
            </div>
            <p className="mt-2 text-xs leading-relaxed text-amber-800">
              You can say “delete all feedback forms”, “mark attendance present for employee in session”, or “approve trainer by email”. The server executes and replies with the result.
            </p>
          </div>
        </aside>
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
