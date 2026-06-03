'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Bot,
  BrainCircuit,
  Clipboard,
  ExternalLink,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Send,
  Sparkles,
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

export function ManagerCommandChatbot() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Command Center online. Ask about employees, quizzes, domains, scores, attendance, badges, certificate eligibility, or enabled certificate thresholds.',
      provider: 'skilltest_ai_local',
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
      setMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: payload.message || payload.error || 'I could not read that data yet.',
          provider: payload.provider,
        },
      ])
    } catch {
      setMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: 'The analytics assistant could not connect. Check AI keys or retry after refresh.',
          provider: 'skilltest_ai_local',
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
        <section className="w-[min(calc(100vw-1.25rem),620px)] overflow-hidden rounded-3xl border border-cyan-300/30 bg-zinc-950 text-white shadow-[0_30px_120px_rgba(6,182,212,0.38)]">
          <div className="relative border-b border-white/10 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,0.26),transparent_30%),radial-gradient(circle_at_85%_5%,rgba(168,85,247,0.20),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02))] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/40 bg-cyan-200/10 shadow-[0_0_40px_rgba(34,211,238,0.25)]">
                  <BrainCircuit className="h-6 w-6 text-cyan-100" />
                </div>
                <div>
                  <p className="text-base font-semibold">SkillTest_AI Command Center</p>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-100/70">Performance + certificate intelligence</p>
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

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <SignalCard label="Scope" value="DB aware" />
              <SignalCard label="Answers" value="Actionable" />
              <SignalCard label="Fallback" value="Groq ready" />
            </div>
          </div>

          <div className="border-b border-white/10 bg-black/25 p-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
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

          <div ref={scrollRef} className="max-h-[470px] space-y-3 overflow-y-auto p-4">
            {messages.map((entry, index) => (
              <div key={`${entry.role}-${index}`} className={entry.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[86%] rounded-2xl border p-3 text-sm leading-relaxed ${
                    entry.role === 'user'
                      ? 'border-white/10 bg-white text-zinc-950'
                      : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-50'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">
                    {entry.role === 'user' ? <MessageSquareText className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                    {entry.role === 'user' ? 'Your question' : 'Command answer'}
                  </div>
                  <p className="whitespace-pre-wrap">{entry.content}</p>
                  {entry.provider && (
                    <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/55">
                      <Sparkles className="h-3 w-3" />
                      {entry.provider}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reading quizzes, profiles, certificates, and attempts
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
                placeholder="Ask about certificate eligibility, weak domains, quiz scores, employee progress..."
                className="max-h-32 min-h-12 rounded-2xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus-visible:ring-cyan-300/40"
              />
              <Button type="submit" size="icon" className="h-12 w-12 rounded-2xl bg-cyan-200 text-zinc-950 hover:bg-cyan-100" disabled={loading || !message.trim()} aria-label="Send message">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </form>
        </section>
      )}

      <Button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="h-14 rounded-full border border-cyan-200/50 bg-zinc-950 px-5 text-white shadow-[0_18px_60px_rgba(6,182,212,0.42)] hover:bg-zinc-900"
      >
        <ExternalLink className="mr-2 h-4 w-4 text-cyan-100" />
        AI Command
      </Button>
    </div>
  )
}

function SignalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/35">{label}</p>
      <p className="mt-1 text-xs font-semibold text-cyan-50">{value}</p>
    </div>
  )
}
