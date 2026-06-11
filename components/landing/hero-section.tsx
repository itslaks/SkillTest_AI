import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { HeroShowcase } from "./hero-showcase";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[96vh] flex-col justify-center overflow-hidden pt-24 md:pt-28">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute h-px bg-foreground/10"
            style={{
              top: `${12.5 * (i + 1)}%`,
              left: 0,
              right: 0,
            }}
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute w-px bg-foreground/10"
            style={{
              left: `${8.33 * (i + 1)}%`,
              top: 0,
              bottom: 0,
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute left-1/2 top-10 z-0 -translate-x-1/2 select-none font-display text-[clamp(5rem,18vw,18rem)] leading-none text-violet-500/10 blur-[0.5px]">
        SkillTest_AI
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 pb-16 pt-8 lg:pb-20 lg:pt-10">
        <div className="mb-8 hero-rise" style={{ animationDelay: "80ms" }}>
          <span className="inline-flex items-center gap-3 rounded-full border border-violet-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
            SkillTest_AI: Mavericks Execution Platform
          </span>
        </div>

        <div className="grid gap-12 xl:grid-cols-[0.82fr_1.18fr] xl:items-center">
          <div className="space-y-8 hero-rise" style={{ animationDelay: "240ms" }}>
            <div>
              <h1 className="max-w-[780px] text-[clamp(3rem,8.2vw,7rem)] font-display leading-[0.94] tracking-tight text-slate-950">
                <span className="block">Execute, Assess,</span>
                <span className="block bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">and Prove Learning Outcomes.</span>
              </h1>
              <p className="mt-4 max-w-xl text-xl font-medium text-slate-600">SkillTest_AI combines assessments, AI proctoring, attendance, certifications, analytics, and compliance evidence into a single training operations platform.</p>
            </div>

            <div className="xl:hidden">
              <HeroShowcase />
            </div>

            <p className="text-xl lg:text-2xl text-slate-700 leading-relaxed max-w-xl">
              Run training operations from mission control: assign assessments, verify integrity, track learner progress, and export evidence-ready reports from one enterprise workspace.
            </p>

            <div className="helper-strip signal-sheen rounded-2xl p-4 text-sm leading-relaxed shadow-sm">
              <p className="font-semibold text-slate-950">How SkillTest_AI works</p>
              <p className="mt-1 text-slate-700">Create batch - assign candidates - mark attendance - AI generates quizzes - upload scores - AI analyses results - export reports.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "AI Engine", value: "Built-in" },
                { label: "Operations", value: "End-to-End" },
                { label: "Insights", value: "Real-time" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl glass-panel signal-card p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{item.label}</p>
                  <p className="mt-3 text-lg font-semibold text-zinc-950">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Button
                size="lg"
                className="bg-foreground hover:bg-foreground/90 text-background px-8 h-14 text-base rounded-full group"
                asChild
              >
                <Link href="/auth/sign-up">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-base rounded-full border-foreground/20 hover:bg-foreground/5"
                asChild
              >
                <Link href="/auth/login">Sign In</Link>
              </Button>
            </div>

            <p className="text-sm font-mono uppercase tracking-[0.25em] text-slate-600">
              Designed for clear decisions across every role.
            </p>
          </div>

          <div className="hidden hero-rise xl:block" style={{ animationDelay: "320ms" }}>
            <HeroShowcase />
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-2 marquee-container">
        <div className="flex gap-16 marquee whitespace-nowrap">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-16">
              {[
                { value: "Batches", label: "lifecycle orchestration", company: "PLANNED TO COMPLETED" },
                { value: "Live", label: "attendance and reminders", company: "REAL-TIME OPS" },
                { value: "AI", label: "behavioral assessment layer", company: "READINESS + DNA" },
                { value: "360", label: "feedback and trainer insights", company: "CLOSED LOOP" },
              ].map((stat) => (
                <div key={`${stat.company}-${i}`} className="flex items-baseline gap-4">
                  <span className="text-4xl lg:text-5xl font-display">{stat.value}</span>
                  <span className="text-sm text-slate-600">
                    {stat.label}
                    <span className="block font-mono text-xs mt-1">{stat.company}</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
