'use client'

const features = [
  {
    icon: '🛡️',
    title: 'AI Proctoring',
    description: 'Camera, gaze, device, focus, evidence, and auto-submit signals flow into a single integrity review center.',
  },
  {
    icon: '🤖',
    title: 'AI Quiz Generation',
    description: 'Generate adaptive MCQs with difficulty-aware distribution and manager review before publishing.',
  },
  {
    icon: '📊',
    title: 'Analytics',
    description: 'Trainer scorecards, learner readiness, leaderboard signals, and operational reports stay connected.',
  },
  {
    icon: '🏆',
    title: 'Gamification',
    description: 'Points, badges, streaks, ranks, and certificates make assessment progress visible and motivating.',
  },
  {
    icon: '📄',
    title: 'BRD Evidence',
    description: 'Attendance, imports, feedback, notifications, audits, and exports support judge-ready traceability.',
  },
  {
    icon: '🔐',
    title: 'Enterprise RBAC',
    description: 'Employee, trainer, coordinator, manager, and admin workflows are scoped through role-aware access.',
  },
]

const proctoringFeatures = [
  '✅ Multi-face detection',
  '✅ Gaze tracking',
  '✅ Device detection',
  '✅ Auto-submit',
  '✅ Evidence capture',
  '✅ Realtime alerts',
]

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 lg:py-32">
      <div className="absolute inset-0 -z-10 mesh-bg" />
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-12 max-w-3xl">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground">
            <span className="h-px w-8 bg-foreground/30" />
            Platform Features
          </span>
          <h2 className="mt-6 text-4xl font-display tracking-tight text-slate-950 lg:text-6xl">
            Built for trusted assessments and training operations.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            SkillTest_AI brings exam intelligence, operational evidence, and manager controls into one role-aware platform.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="group rounded-xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-2xl shadow-sm">
                {feature.icon}
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{feature.description}</p>
              <div className="mt-6 h-1 w-16 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 opacity-70 transition group-hover:w-24" />
            </article>
          ))}
        </div>

        <section className="mt-20 grid gap-10 rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_32px_90px_rgba(15,23,42,0.28)] lg:grid-cols-[1fr_420px] lg:p-10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-200">Proctoring Showcase</p>
            <h3 className="mt-4 text-3xl font-display lg:text-5xl">Enterprise-Grade AI Proctoring</h3>
            <p className="mt-5 max-w-2xl text-xl leading-9 text-slate-300">
              Every exam is monitored. Every violation is captured. Every result is trusted.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {proctoringFeatures.map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-full rounded-xl border border-red-300/25 bg-gradient-to-br from-red-700 via-rose-700 to-red-950 p-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🚨</span>
                <div>
                  <p className="text-sm font-semibold">Phone detected</p>
                  <p className="mt-1 text-xs text-red-100">Captured and reported to examiner.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-2 text-xs text-red-50">
                <div className="flex justify-between rounded-lg bg-white/10 px-3 py-2"><span>Severity</span><strong>Critical</strong></div>
                <div className="flex justify-between rounded-lg bg-white/10 px-3 py-2"><span>Evidence</span><strong>Stored</strong></div>
                <div className="flex justify-between rounded-lg bg-white/10 px-3 py-2"><span>Alert</span><strong>Realtime</strong></div>
              </div>
              <div className="mt-5 h-1 rounded-full bg-white/20">
                <div className="h-full w-2/3 rounded-full bg-white" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
