"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { AnimatedSphere } from "./animated-sphere";
import { HeroShowcase } from "./hero-showcase";
import Link from "next/link";

const words = ["execute", "coordinate", "assess", "improve"];

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(true);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] opacity-30 pointer-events-none">
        <AnimatedSphere />
      </div>

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

      <div className="absolute inset-x-0 top-20 h-[620px] bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.08),transparent_55%)] pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-28 lg:py-32">
        <div
          className={`mb-8 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground">
            <span className="w-8 h-px bg-foreground/30" />
            AI-powered training execution platform
          </span>
        </div>

        <div className="mb-10">
          <h1
            className={`text-[clamp(3rem,12vw,10rem)] font-display leading-[0.9] tracking-tight transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="block">The platform</span>
            <span className="block">
              to{" "}
              <span className="relative inline-block">
                <span key={wordIndex} className="inline-flex">
                  {words[wordIndex].split("").map((char, i) => (
                    <span
                      key={`${wordIndex}-${i}`}
                      className="inline-block animate-char-in"
                      style={{
                        animationDelay: `${i * 50}ms`,
                      }}
                    >
                      {char}
                    </span>
                  ))}
                </span>
                <span className="absolute -bottom-2 left-0 right-0 h-3 bg-foreground/10" />
              </span>
            </span>
          </h1>
        </div>

        <div className="grid gap-16 xl:grid-cols-[0.85fr_1.15fr] xl:items-center">
          <div className="space-y-8">
            <p
              className={`text-xl lg:text-2xl text-muted-foreground leading-relaxed max-w-xl transition-all duration-700 delay-200 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              Manage training batches, schedule sessions, track attendance, run adaptive assessments, and close the loop with feedback and reminders from one platform.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Interface", value: "Cinematic UI" },
                { label: "Ops", value: "End-to-end" },
                { label: "AI", value: "Behavior-first" },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.5rem] glass-panel p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{item.label}</p>
                  <p className="mt-3 text-lg font-semibold text-zinc-950">{item.value}</p>
                </div>
              ))}
            </div>

            <div
              className={`flex flex-col sm:flex-row items-start gap-4 transition-all duration-700 delay-300 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
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
              Built to impress judges without compromising the product core.
            </p>
          </div>

          <div
            className={`transition-all duration-1000 delay-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <HeroShowcase />
          </div>
        </div>
      </div>

      <div
        className={`relative z-10 mt-2 transition-all duration-700 delay-500 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
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
