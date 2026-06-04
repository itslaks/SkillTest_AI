import Link from 'next/link'
import { adminGuideQuickStart, adminGuideSections } from '@/lib/manager-docs'
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileQuestion,
  FileSpreadsheet,
  FolderOpen,
  MessageSquareText,
  RadioTower,
  Search,
  Users,
} from 'lucide-react'

const iconMap = [
  Users,
  FileQuestion,
  CalendarDays,
  ClipboardCheck,
  MessageSquareText,
  FileSpreadsheet,
  FolderOpen,
  RadioTower,
]

export default function ManagerDocsPage() {
  const prioritySections = adminGuideSections.slice().sort((a, b) => a.priority - b.priority)

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-zinc-900 bg-zinc-950 text-white shadow-[0_40px_140px_rgba(0,0,0,0.45)]">
        <div className="grid gap-8 p-6 md:p-8 xl:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
              <BookOpenCheck className="h-3.5 w-3.5" />
              Admin Docs
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
              SkillTest_AI operating manual
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-300">
              A complete non-technical guide for admins, trainers, managers, and coordinators to run employees,
              quizzes, batches, sessions, attendance, feedback, assessments, evidence, automations, and reports.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/manager/operations" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100">
                Open Training Ops
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="#quick-start" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
                Start guide
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {prioritySections.slice(0, 8).map((section, index) => {
              const Icon = iconMap[index % iconMap.length]
              return (
                <Link key={section.id} href={`#${section.id}`} className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/40 hover:bg-white/[0.08]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300 text-zinc-950">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-zinc-400">
                      {section.priority.toString().padStart(2, '0')}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-white">{section.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{section.outcome}</p>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section id="quick-start" className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
            <Search className="h-4 w-4 text-cyan-600" />
            Manager Friendly Order
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Use this order when you are unsure what to do next. It mirrors how the data flows through the app.
          </p>
          <div className="mt-5 space-y-3">
            {adminGuideQuickStart.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-bold text-white">
                  {index + 1}
                </div>
                <p className="text-sm leading-6 text-zinc-700">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <GuideMetric label="First Setup" value="Employees + Quizzes" detail="Foundation data" />
            <GuideMetric label="Daily Work" value="Sessions + Attendance" detail="Execution rhythm" />
            <GuideMetric label="Proof" value="Reports + Evidence" detail="Audit ready" />
          </div>
          <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
            <p className="text-sm font-semibold text-cyan-950">How to use this page</p>
            <p className="mt-2 text-sm leading-6 text-cyan-900">
              Click any feature below. Each section explains the feature role, when to use it, exact steps, a real example,
              manager tips, and direct links to the correct screen.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {prioritySections.map((section) => (
          <Link key={section.id} href={`#${section.id}`} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-950">{section.title}</p>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-500">P{section.priority}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{section.outcome}</p>
          </Link>
        ))}
      </section>

      <section className="space-y-5">
        {prioritySections.map((section) => (
          <article key={section.id} id={section.id} className="scroll-mt-32 overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 bg-zinc-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-zinc-950 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                      Priority {section.priority}
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                      {section.role}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950">{section.title}</h2>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-600">{section.outcome}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {section.relatedLinks.map((link) => (
                    <Link key={link.href + link.label} href={link.href} className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-900 hover:text-zinc-950">
                      {link.label}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 xl:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="rounded-2xl border border-zinc-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">When to use</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-700">{section.whenToUse}</p>
                </div>
                <div className="mt-4 rounded-2xl border border-zinc-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Steps</p>
                  <div className="mt-3 space-y-3">
                    {section.steps.map((step, index) => (
                      <div key={step} className="flex gap-3">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-[11px] font-bold text-white">
                          {index + 1}
                        </div>
                        <p className="text-sm leading-6 text-zinc-700">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <CheckCircle2 className="h-4 w-4" />
                    Example
                  </div>
                  <p className="mt-2 text-sm leading-6 text-emerald-900">{section.example}</p>
                </div>
                <details className="group rounded-2xl border border-zinc-200 bg-white p-4 open:bg-zinc-50">
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-950">Manager tips</summary>
                  <div className="mt-3 space-y-2">
                    {section.tips.map((tip) => (
                      <p key={tip} className="text-sm leading-6 text-zinc-600">{tip}</p>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}

function GuideMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-3 text-lg font-semibold text-zinc-950">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  )
}
