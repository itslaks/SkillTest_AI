"use client";

import { useState } from "react";

const steps = [
  {
    number: "I",
    title: "Upload your team",
    description: "Managers upload an Excel file with employee email, name, and domain. The system automatically categorizes employees based on their domain.",
    detail: "Supported columns:\n- Employee Email\n- Full Name\n- Domain / Department\n\nAuto-categorization enabled",
  },
  {
    number: "II",
    title: "Create a quiz",
    description: "Define the topic, select a difficulty level, set the number of questions, and attach a feedback form link. AI dynamically generates MCQs.",
    detail: "Quiz Configuration:\n- Topic & Description\n- Difficulty Level\n- Question Count\n- Feedback Form URL\n- Time Limit (minutes)",
  },
  {
    number: "III",
    title: "Assess & rank",
    description: "Employees take the test through a smooth, gamified interface. Scores are calculated automatically and a dynamic leaderboard is generated.",
    detail: "After Completion:\n- Auto-scored results\n- Time-based tie-breaking\n- Dynamic leaderboard\n- Excel export available\n- Feedback form shown",
  },
];

export function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section
      id="how-it-works"
      className="relative py-24 lg:py-32 bg-foreground text-background overflow-hidden"
    >
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-16 lg:mb-24">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-background/50 mb-6">
            <span className="w-8 h-px bg-background/30" />
            How It Works
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight">
            Three steps.
            <br />
            <span className="text-background/50">Complete assessments.</span>
          </h2>
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Steps */}
          <div className="space-y-0">
            {steps.map((step, index) => (
              <button
                key={step.number}
                type="button"
                onClick={() => setActiveStep(index)}
                className={`w-full text-left py-8 border-b border-background/10 transition-all duration-500 group ${
                  activeStep === index ? "opacity-100" : "opacity-40 hover:opacity-70"
                }`}
              >
                <div className="flex items-start gap-6">
                  <span className="font-display text-3xl text-background/30">{step.number}</span>
                  <div className="flex-1">
                    <h3 className="text-2xl lg:text-3xl font-display mb-3 group-hover:translate-x-2 transition-transform duration-300">
                      {step.title}
                    </h3>
                    <p className="text-background/60 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Detail display */}
          <div className="lg:sticky lg:top-32 self-start">
            <div className="border border-background/10 overflow-hidden">
              {/* Window header */}
              <div className="px-6 py-4 border-b border-background/10 flex items-center justify-between">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-background/20" />
                  <div className="w-3 h-3 rounded-full bg-background/20" />
                  <div className="w-3 h-3 rounded-full bg-background/20" />
                </div>
                <span className="text-xs font-mono text-background/40">skilltest_ai.config</span>
              </div>

              {/* Content */}
              <div className="p-8 font-mono text-sm min-h-[280px]">
                <pre className="text-background/70">
                  {steps[activeStep].detail.split('\n').map((line, lineIndex) => (
                    <div key={`${activeStep}-${lineIndex}`} className="leading-loose">
                      {line || '\u00A0'}
                    </div>
                  ))}
                </pre>
              </div>

              {/* Status */}
              <div className="px-6 py-4 border-t border-background/10 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-mono text-background/40">Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
