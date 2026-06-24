'use client'

import { FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Bot,
  BrainCircuit,
  Clipboard,
  DatabaseZap,
  ExternalLink,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Send,
  X,
} from 'lucide-react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  provider?: string
}

const quickPrompts = [
  'List employees who have not taken any test for past 10 days',
  'Which employees never attempted a quiz?',
  'Which employees are eligible for certificates but not issued yet?',
  'Show quiz-wise pass rate and weak domains.',
  'Who scored below 70 in the latest quiz?',
]

const commandTemplates = [
  {
    label: 'Create employee',
    command: 'run create employee email=person@company.com name="Person Name" employee_id=EMP001 domain=Java department=Engineering',
  },
  {
    label: 'Delete employee',
    command: 'run delete employee email=person@company.com',
  },
  {
    label: 'Create quiz',
    command: 'run create quiz title="Java Basics" topic=Java difficulty=medium question_count=10 passing_score=70 time_limit_minutes=30 assigned_to=person@company.com certificate_min_score=70 proctoring_required=true',
  },
  {
    label: 'Delete quiz',
    command: 'run delete quiz title="Java Basics"',
  },
  {
    label: 'Create batch',
    command: 'run create batch title="Week 1 Java" domain=Java trainer_email=trainer@company.com employee_emails=a@company.com,b@company.com',
  },
  {
    label: 'Delete batch',
    command: 'run delete batch title="Week 1 Java"',
  },
  {
    label: 'Assign trainer',
    command: 'run assign trainer batch="Week 1 Java" trainer_email=trainer@company.com',
  },
  {
    label: 'Approve trainer',
    command: 'run approve trainer email=trainer@company.com',
  },
  {
    label: 'Create roadmap/session',
    command: 'run create session batch="Week 1 Java" title="Day 1 Orientation" date=2026-06-10T10:00 trainer_email=trainer@company.com',
  },
  {
    label: 'Update roadmap/session',
    command: 'run update session title="Day 1 Orientation" status=completed',
  },
  {
    label: 'Delete roadmap/session',
    command: 'run delete session title="Day 1 Orientation"',
  },
  {
    label: 'Mark attendance',
    command: 'run mark attendance session="Day 1 Orientation" email=person@company.com status=present',
  },
  {
    label: 'Clear scheduled',
    command: 'run clear scheduled confirmation="DELETE SCHEDULED"',
  },
  {
    label: 'Delete training',
    command: 'run delete training confirmation="DELETE TRAINING"',
  },
]

const fullPanels = [
  { label: 'Employees', href: '/manager/employees' },
  { label: 'Quizzes', href: '/manager/quizzes' },
  { label: 'Training Ops', href: '/manager/operations' },
  { label: 'Admin', href: '/manager/admin' },
  { label: 'Reports', href: '/manager/reports' },
]

export function ManagerCommandChatbot() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [opsPanel, setOpsPanel] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Admin assistant ready. Ask for live insights like inactive employees, weak scores, certificate gaps, or open Admin Ops to execute changes.',
    },
  ])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function ask(prompt: string) {
    const trimmed = prompt.trim()
    if (!trimmed || loading) return

    setMessage('')
    setLoading(true)
    setCopied(false)
    setMessages((previous) => [...previous, { role: 'user', content: trimmed }])

    try {
      const response = await fetch('/api/manager-chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: messages.slice(-8) }),
      })
      const payload = await response.json()
      if (payload.provider === 'skilltest_ai_command' && !payload.error && !payload.message?.startsWith('Command failed')) {
        router.refresh()
      }
      setMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: payload.message || payload.error || 'I could not read that data yet.',
        },
      ])
    } catch {
      setMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: 'I could not connect to the analytics service. Please refresh and try again.',
        },
      ])
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void ask(message)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void ask(message)
    }
  }

  async function copyLastAnswer() {
    const last = [...messages].reverse().find((entry) => entry.role === 'assistant')
    if (!last) return
    await navigator.clipboard.writeText(last.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <section className="w-[min(calc(100vw-1.25rem),460px)] overflow-hidden rounded-[1.35rem] border border-zinc-800/80 bg-zinc-950 text-white shadow-[0_22px_70px_rgba(2,6,23,0.42)]">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-200 text-zinc-950">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">AI Command</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Admin assistant</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white" asChild aria-label="Open full AI Command console">
                  <Link href="/manager/ai-command">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white" onClick={copyLastAnswer} aria-label="Copy latest answer">
                  <Clipboard className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white" onClick={() => setMessages(messages.slice(0, 1))} aria-label="Clear chat">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)} aria-label="Close assistant">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="border-b border-white/10 bg-zinc-900/45 px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setOpsPanel((value) => !value)}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-200/20 bg-cyan-200/10 px-2.5 py-1.5 text-[11px] font-bold text-cyan-50 transition hover:bg-cyan-200/15"
              >
                <DatabaseZap className="h-3.5 w-3.5" />
                Admin Ops
              </button>
              <div className="flex gap-1 overflow-hidden">
                {fullPanels.slice(0, 3).map((panel) => (
                  <a key={panel.href} href={panel.href} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:bg-white/10 hover:text-white">
                    {panel.label}
                  </a>
                ))}
              </div>
            </div>
            {opsPanel ? (
              <div className="mb-2 rounded-xl border border-white/10 bg-black/20 p-2">
                <div className="chatbot-scrollbar grid max-h-36 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                  {commandTemplates.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setMessage(item.command)
                        textareaRef.current?.focus()
                      }}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-left text-[11px] font-medium text-zinc-300 transition hover:border-cyan-200/35 hover:bg-cyan-200/10 hover:text-white"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {fullPanels.map((panel) => (
                    <a key={panel.href} href={panel.href} className="rounded-md px-2 py-1 text-[10px] font-semibold text-cyan-100/70 hover:bg-white/10">
                      Full {panel.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="chatbot-scrollbar flex gap-2 overflow-x-auto pb-1">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void ask(prompt)}
                  disabled={loading}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-left text-[11px] font-medium text-zinc-300 transition hover:border-cyan-200/35 hover:bg-cyan-200/10 hover:text-white disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div ref={scrollRef} className="chatbot-scrollbar max-h-[360px] space-y-3 overflow-y-auto bg-zinc-950 p-3.5">
            {messages.map((entry, index) => (
              <div key={`${entry.role}-${index}`} className={entry.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[86%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed shadow-sm ${
                    entry.role === 'user'
                      ? 'rounded-br-md bg-white text-zinc-950'
                      : 'rounded-bl-md border border-white/10 bg-zinc-900 text-zinc-100'
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] opacity-60">
                    {entry.role === 'user' ? <MessageSquareText className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                    {entry.role === 'user' ? 'Your question' : 'Admin insight'}
                  </div>
                  <FormattedMessage content={entry.content} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Working on live data
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-white/10 bg-zinc-900 p-3">
            {copied && <p className="mb-2 text-xs font-semibold text-cyan-200">Latest answer copied.</p>}
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Ask for insights, or use: run create batch title="Week 1" domain=Java'
                rows={1}
                className="max-h-28 min-h-11 rounded-xl border-white/10 bg-zinc-950 text-sm text-white placeholder:text-zinc-500 focus-visible:ring-cyan-300/40"
              />
              <Button type="submit" size="icon" className="h-11 w-11 rounded-xl bg-cyan-200 text-zinc-950 hover:bg-cyan-100" disabled={loading || !message.trim()} aria-label="Send message">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </form>
        </section>
      )}

      <Button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="h-11 rounded-full border border-cyan-200/30 bg-zinc-950 px-4 text-sm font-semibold text-white shadow-[0_14px_38px_rgba(2,6,23,0.28)] hover:bg-zinc-900"
      >
        <BrainCircuit className="mr-2 h-4 w-4 text-cyan-100" />
        AI Command
      </Button>
    </div>
  )
}

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, index) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={index} className="h-1" />
        const bullet = trimmed.match(/^[-*]\s+(.+)$/)
        if (bullet) {
          return (
            <div key={index} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
              <p>{formatInline(bullet[1])}</p>
            </div>
          )
        }
        return <p key={index}>{formatInline(trimmed)}</p>
      })}
    </div>
  )
}

function formatInline(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-current">{part.slice(2, -2)}</strong>
    }
    return part
  })
}
