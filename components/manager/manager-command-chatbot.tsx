'use client'

import { FormEvent, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Bot, ExternalLink, Loader2, Send, Sparkles, X } from 'lucide-react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  provider?: string
}

export function ManagerCommandChatbot() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Ask me about quiz performance, employee progress, attendance, badges, certificates, or domain readiness.',
      provider: 'skilltest_ai_local',
    },
  ])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || loading) return

    setMessage('')
    setLoading(true)
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
          content: 'The analytics assistant could not connect. Check AI keys or try again after a refresh.',
          provider: 'skilltest_ai_local',
        },
      ])
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <section className="w-[min(calc(100vw-2rem),420px)] overflow-hidden rounded-2xl border border-cyan-300/30 bg-zinc-950 text-white shadow-[0_28px_100px_rgba(6,182,212,0.35)]">
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.02))] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/40 bg-cyan-300/10">
                  <Bot className="h-5 w-5 text-cyan-100" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Command Intelligence</p>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/70">DB aware assistant</p>
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full text-white hover:bg-white/10 hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-[430px] space-y-3 overflow-y-auto p-4">
            {messages.map((entry, index) => (
              <div
                key={`${entry.role}-${index}`}
                className={`rounded-2xl border p-3 text-sm leading-relaxed ${
                  entry.role === 'user'
                    ? 'ml-8 border-white/10 bg-white text-zinc-950'
                    : 'mr-6 border-cyan-300/20 bg-cyan-300/10 text-cyan-50'
                }`}
              >
                <p>{entry.content}</p>
                {entry.provider && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/55">
                    <Sparkles className="h-3 w-3" />
                    {entry.provider}
                  </span>
                )}
              </div>
            ))}
            {loading && (
              <div className="mr-10 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reading performance context
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-white/10 bg-black/40 p-3">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ask: who scored below 70 in Python?"
                className="max-h-28 min-h-12 rounded-xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus-visible:ring-cyan-300/40"
              />
              <Button
                type="submit"
                size="icon"
                className="h-12 w-12 rounded-xl bg-cyan-200 text-zinc-950 hover:bg-cyan-100"
                disabled={loading || !message.trim()}
                aria-label="Send message"
              >
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
