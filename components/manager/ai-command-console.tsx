'use client'

import { FormEvent, KeyboardEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
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
import * as THREE from 'three'

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
    <div className="relative min-h-[calc(100vh-11rem)] overflow-hidden rounded-[2rem] border border-zinc-900 bg-[#07090d] text-white shadow-[0_40px_140px_rgba(2,6,23,0.45)]">
      <div className="absolute inset-0 opacity-80">
        <CommandScene />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,9,13,0.98)_0%,rgba(7,9,13,0.86)_44%,rgba(7,9,13,0.7)_100%)]" />

      <div className="relative grid min-h-[calc(100vh-11rem)] grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        <aside className="border-b border-white/10 p-5 xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/30 bg-cyan-200/10">
              <DatabaseZap className="h-6 w-6 text-cyan-100" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">AI Command</h1>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/65">Admin execution cockpit</p>
            </div>
          </div>

          <div className="mt-6 grid gap-2">
            {commandPacks.map((pack) => {
              const Icon = pack.icon
              const selected = pack.title === activePack
              return (
                <button
                  key={pack.title}
                  type="button"
                  onClick={() => setActivePack(pack.title)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    selected ? 'border-cyan-200/40 bg-white/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-semibold">{pack.title}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
              Realtime execution
            </div>
            <p className="mt-2 text-xs leading-relaxed text-emerald-50/70">
              Create, update, delete, assign, approve, mark attendance, open feedback forms, and clear scheduled work directly from chat.
            </p>
          </div>
        </aside>

        <main className="flex min-h-[640px] flex-col border-white/10 xl:border-r">
          <div className="border-b border-white/10 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/45">Selected lane</p>
                <h2 className="mt-1 text-2xl font-semibold">{active.title} operations</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {moduleLinks.map((link) => {
                  const Icon = link.icon
                  return (
                    <a key={link.href} href={link.href} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/10">
                      <Icon className="h-3.5 w-3.5" />
                      {link.label}
                    </a>
                  )
                })}
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="chatbot-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[86%] rounded-3xl border p-4 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'rounded-br-md border-white/20 bg-white text-zinc-950'
                    : message.ok === false
                      ? 'rounded-bl-md border-red-300/25 bg-red-500/10 text-red-50'
                      : 'rounded-bl-md border-cyan-200/20 bg-cyan-200/[0.08] text-zinc-50'
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
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-xs text-cyan-50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Executing command against live data
              </div>
            )}
          </div>

          <form onSubmit={submit} className="border-t border-white/10 bg-black/30 p-5">
            <div className="flex items-end gap-3">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={keydown}
                rows={2}
                placeholder='Say: create employee email=... name="..." employee_id=... domain=...'
                className="max-h-40 min-h-16 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-white/35 focus-visible:ring-cyan-300/40"
              />
              <Button type="submit" disabled={loading || !input.trim()} className="h-16 rounded-2xl bg-cyan-200 px-5 text-zinc-950 hover:bg-cyan-100">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
          </form>
        </main>

        <aside className="space-y-4 p-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TerminalSquare className="h-4 w-4 text-amber-200" />
              Command examples
            </div>
            <div className="mt-4 grid gap-2">
              {active.prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInput(prompt)}
                  className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-left text-xs leading-relaxed text-white/75 transition hover:border-cyan-200/35 hover:bg-cyan-200/10 hover:text-white"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
              <Sparkles className="h-4 w-4" />
              Natural language
            </div>
            <p className="mt-2 text-xs leading-relaxed text-amber-50/75">
              You can say “delete all feedback forms”, “mark attendance present for employee in session”, or “approve trainer by email”. The server executes and replies with the result.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function CommandScene() {
  return (
    <Suspense fallback={null}>
      <Canvas camera={{ position: [0, 0, 7], fov: 48 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.65} />
        <directionalLight position={[4, 4, 6]} intensity={1.2} />
        <CommandMesh />
      </Canvas>
    </Suspense>
  )
}

function CommandMesh() {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!group.current) return
    group.current.rotation.y = state.clock.elapsedTime * 0.16
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.28) * 0.16
  })

  return (
    <group ref={group} position={[2.3, 0, 0]}>
      <mesh>
        <icosahedronGeometry args={[2.2, 1]} />
        <meshStandardMaterial color="#22d3ee" wireframe transparent opacity={0.34} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.1, 0.018, 8, 96]} />
        <meshStandardMaterial color="#f59e0b" emissive="#7c2d12" emissiveIntensity={0.35} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[2.72, 0.014, 8, 96]} />
        <meshStandardMaterial color="#34d399" emissive="#064e3b" emissiveIntensity={0.35} />
      </mesh>
    </group>
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
