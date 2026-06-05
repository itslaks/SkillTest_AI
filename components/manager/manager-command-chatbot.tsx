'use client'

import { FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  'Which employees are eligible for certificates but not issued yet?',
  'Show quiz-wise pass rate and weak domains.',
  'Who scored below 70 in the latest quiz?',
  'Compare Java and Data Engineering performance.',
  'Which certificate rules are enabled and what are their thresholds?',
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
    command: 'run create quiz title="Java Basics" topic=Java difficulty=medium question_count=10 passing_score=70',
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
        'Admin assistant ready. Ask for insights, or open Admin Ops and send a run command to create, update, delete, approve, assign, or mark attendance.',
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
        body: JSON.stringify({ message: trimmed }),
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
        <section className="w-[min(calc(100vw-1.25rem),500px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d10] text-white shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
          <div className="relative border-b border-white/10 bg-zinc-950 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-200/30 bg-cyan-200/10">
                  <BrainCircuit className="h-6 w-6 text-cyan-100" />
                </div>
                <div>
                  <p className="text-sm font-semibold">SkillTest_AI Command</p>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/65">Performance intelligence</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full text-white hover:bg-white/10 hover:text-white" onClick={copyLastAnswer} aria-label="Copy latest answer">
                  <Clipboard className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full text-white hover:bg-white/10 hover:text-white" onClick={() => setMessages(messages.slice(0, 1))} aria-label="Clear chat">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full text-white hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)} aria-label="Close assistant">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="border-b border-white/10 bg-black/25 p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setOpsPanel((value) => !value)}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1.5 text-[11px] font-bold text-cyan-50 transition hover:bg-cyan-200/15"
              >
                <DatabaseZap className="h-3.5 w-3.5" />
                Admin Ops
              </button>
              <div className="flex gap-1">
                {fullPanels.slice(0, 3).map((panel) => (
                  <a key={panel.href} href={panel.href} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/70 hover:bg-white/10">
                    {panel.label}
                  </a>
                ))}
              </div>
            </div>
            {opsPanel ? (
              <div className="mb-2 rounded-xl border border-cyan-200/15 bg-cyan-200/[0.06] p-2">
                <div className="chatbot-scrollbar grid max-h-40 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {commandTemplates.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setMessage(item.command)
                        textareaRef.current?.focus()
                      }}
                      className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-left text-[11px] font-semibold text-white/85 transition hover:border-cyan-200/40 hover:bg-cyan-200/10"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {fullPanels.map((panel) => (
                    <a key={panel.href} href={panel.href} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-100/75 hover:bg-white/10">
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
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-[11px] font-semibold text-cyan-50/80 transition hover:border-cyan-200/40 hover:bg-cyan-200/10 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div ref={scrollRef} className="chatbot-scrollbar max-h-[360px] space-y-3 overflow-y-auto p-3.5">
            {messages.map((entry, index) => (
              <div key={`${entry.role}-${index}`} className={entry.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[86%] rounded-2xl border p-3 text-sm leading-relaxed ${
                    entry.role === 'user'
                      ? 'rounded-br-md border-white/10 bg-white text-zinc-950'
                      : 'rounded-bl-md border-white/10 bg-white/[0.06] text-zinc-100'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">
                    {entry.role === 'user' ? <MessageSquareText className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                    {entry.role === 'user' ? 'Your question' : 'Admin insight'}
                  </div>
                  <FormattedMessage content={entry.content} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reading data or executing admin command
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-white/10 bg-black/50 p-3">
            {copied && <p className="mb-2 text-xs font-semibold text-cyan-200">Latest answer copied.</p>}
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Ask for insights, or use: run create batch title="Week 1" domain=Java'
                rows={1}
                className="max-h-28 min-h-11 rounded-xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus-visible:ring-cyan-300/40"
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
        className="h-12 rounded-full border border-cyan-200/40 bg-zinc-950 px-4 text-white shadow-[0_16px_44px_rgba(2,6,23,0.35)] hover:bg-zinc-900"
      >
        <ExternalLink className="mr-2 h-4 w-4 text-cyan-100" />
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
