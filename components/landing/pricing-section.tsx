"use client";

import { ArrowRight, Check } from "lucide-react";

const capabilities = [
  {
    name: "Assessment",
    description: "Core testing capabilities",
    highlight: "AI-Powered",
    features: [
      "Dynamic MCQ Generation",
      "5 Difficulty Levels",
      "Timer & Progress Sync",
      "Domain Categorization",
      "Secure Proctored Mode",
    ],
    cta: "Start Assessing",
  },
  {
    name: "Gamification",
    description: "Engagement & Motivation",
    highlight: "Interactive",
    features: [
      "Streak Multipliers",
      "Animated Badges",
      "Exp & Point System",
      "Milestone Celebrations",
      "Daily Challenges",
      "Rank Progression",
    ],
    cta: "Boost Engagement",
    popular: true,
  },
  {
    name: "Analytics",
    description: "Data & Reporting",
    highlight: "Detailed",
    features: [
      "Real-time Leaderboard",
      "Excel Data Export",
      "Time-based Tie-breaking",
      "Group Performance Analysis",
      "Individual Growth Tracking",
      "Excel Employee Import",
    ],
    cta: "View Reports",
  },
];

export function PricingSection() {
  return (
    <section id="highlights" className="relative py-32 lg:py-40 border-t border-foreground/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="max-w-3xl mb-20">
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase block mb-6">
            Platform Highlights
          </span>
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight text-foreground mb-6">
            Everything in one
            <br />
            <span className="text-stroke">place</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl">
            From automated question generation to massive scale leadership reporting. SkillTest is the complete package.
          </p>
        </div>

        {/* Highlight Cards */}
        <div className="grid md:grid-cols-3 gap-px bg-foreground/10">
          {capabilities.map((item, idx) => (
            <div
              key={item.name}
              className={`relative p-8 lg:p-12 bg-background ${
                item.popular ? "md:-my-4 md:py-12 lg:py-16 border-2 border-foreground" : ""
              }`}
            >
              {item.popular && (
                <span className="absolute -top-3 left-8 px-3 py-1 bg-foreground text-primary-foreground text-xs font-mono uppercase tracking-widest">
                  Key Feature
                </span>
              )}

              {/* Card Header */}
              <div className="mb-8">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-3xl text-foreground mt-2">{item.name}</h3>
                <p className="text-sm text-muted-foreground mt-2">{item.description}</p>
              </div>

              {/* Highlight Label */}
              <div className="mb-8 pb-8 border-b border-foreground/10">
                <span className="font-display text-4xl text-foreground">{item.highlight}</span>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-10">
                {item.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-foreground mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Simulation */}
              <div
                className={`w-full py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all group ${
                  item.popular
                    ? "bg-foreground text-primary-foreground hover:bg-foreground/90"
                    : "border border-foreground/20 text-foreground hover:border-foreground hover:bg-foreground/5"
                } cursor-default`}
              >
                {item.cta}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <p className="mt-12 text-center text-sm text-muted-foreground">
          Ready to experience the future of employee assessments?{" "}
          <a href="/auth/sign-up" className="underline underline-offset-4 hover:text-foreground transition-colors">
            Create an account today.
          </a>
        </p>
      </div>
    </section>
  );
}
