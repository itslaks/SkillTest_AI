import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { HeroShowcase } from "./hero-showcase";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative min-h-[92vh] flex flex-col justify-center overflow-hidden">
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

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-24 lg:py-28">
        <div className="mb-8">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground">
            <span className="w-8 h-px bg-foreground/30" />
            Training execution and assessment platform
          </span>
        </div>

        <div className="mb-10">
          <h1 className="text-[clamp(3rem,10vw,8rem)] font-display leading-[0.94] tracking-tight">
            <span className="block">SkillTest</span>
            <span className="block text-foreground/70">for enterprise learning</span>
          </h1>
        </div>

        <div className="grid gap-16 xl:grid-cols-[0.85fr_1.15fr] xl:items-center">
          <div className="space-y-8">
            <p className="text-xl lg:text-2xl text-muted-foreground leading-relaxed max-w-xl">
              Manage training batches, schedule sessions, track attendance, run adaptive assessments, and close the loop with feedback and reminders from one platform.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Interface", value: "Executive" },
                { label: "Operations", value: "Connected" },
                { label: "Insights", value: "Actionable" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl glass-panel p-4">
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

            <p className="text-sm font-mono uppercase tracking-[0.25em] text-muted-foreground">
              Designed for clear decisions across managers and learners.
            </p>
          </div>

          <div>
            <HeroShowcase />
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-2">
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
                  <span className="text-sm text-muted-foreground">
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
