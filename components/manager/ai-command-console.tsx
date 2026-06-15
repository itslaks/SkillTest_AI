'use client'

import { KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  CheckCircle2,
  ClipboardList,
  FileQuestion,
  Download,
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

const commandPacks = [
  {
    title: 'People',
    icon: Users,
    prompts: [
      'List employees who have not taken any test for past 10 days',
      'Employees with no tests in last 10 days',
      'Low performers below 60%',
      'High-risk proctoring summary',
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
      content: 'AI Command is live. Ask for live operations data, reports, exports, or actions. Risky actions are previewed first and run only after confirmation.',
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
    }
  }

  async function decidePreview(preview: AiActionPreview, decision: 'confirm' | 'cancel') {
    if (!preview.confirmToken || loading) return
    setLoading(true)
    setMessages((previous) => [...previous, { role: 'user', content: decision === 'confirm' ? 'Confirm' : 'Cancel' }])
    try {
      const response = await fetch('/api/manager-chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: decision,
          confirmToken: preview.confirmToken,
          decision,
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
    }
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
                <ActionPreviewCard preview={message.preview} onDecision={(decision) => void decidePreview(message.preview!, decision)} />
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

function ActionPreviewCard({ preview, onDecision }: { preview: AiActionPreview; onDecision: (decision: 'confirm' | 'cancel') => void }) {
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
      {preview.messagePreview && <p className="mt-2 rounded-lg bg-black/20 p-2 text-xs">{preview.messagePreview}</p>}
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
        <Button type="button" size="sm" onClick={() => onDecision('confirm')} className="rounded-full bg-emerald-300 text-emerald-950 hover:bg-emerald-200">
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
