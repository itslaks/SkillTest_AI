"use client";

import { useEffect, useState, useRef } from "react";

const gamificationFeatures = [
  { name: "Countdown Timer", category: "Engagement" },
  { name: "Streak Bonuses", category: "Motivation" },
  { name: "Point System", category: "Scoring" },
  { name: "Animated Badges", category: "Rewards" },
  { name: "Progress Bar", category: "Tracking" },
  { name: "Instant Feedback", category: "Learning" },
  { name: "Dynamic Leaderboard", category: "Competition" },
  { name: "Score Animations", category: "Experience" },
  { name: "Difficulty Badges", category: "Rewards" },
  { name: "Completion Certificates", category: "Recognition" },
  { name: "Time Tracking", category: "Analytics" },
  { name: "Rank Indicators", category: "Competition" },
];

export function IntegrationsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="gamification" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden bg-foreground text-background">
      <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{
        backgroundImage: "radial-gradient(circle at 20% 20%, white, transparent 22%), radial-gradient(circle at 80% 30%, white, transparent 20%), linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)"
      }} />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-16 lg:mb-24 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            Gamification
            <span className="w-8 h-px bg-foreground/30" />
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-6">
            Engagement features
            <br />
            with a focused interface.
          </h2>
          <p className="text-xl text-background/65">
            These layers are designed to keep progress visible while the product stays fast, readable, and practical.
          </p>
        </div>

        <div className="mb-10 grid gap-4 md:grid-cols-3">
          {[
            "Readable rewards, progress, and leaderboard signals.",
            "Consistent card language across manager and learner surfaces.",
            "Performance-first restraint so the interface stays crisp.",
          ].map((item) => (
            <div key={item} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white/70">
              {item}
            </div>
          ))}
        </div>
      </div>
      
      {/* Full-width marquees outside container */}
      <div className="w-full mb-6">
        <div className="flex gap-6 marquee">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex gap-6 shrink-0">
              {gamificationFeatures.map((feature) => (
                <div
                  key={`${feature.name}-${setIndex}`}
                  className="shrink-0 rounded-[1.5rem] px-8 py-6 border border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.08] transition-all duration-300 group"
                >
                  <div className="text-lg font-medium group-hover:translate-x-1 transition-transform">
                    {feature.name}
                  </div>
                  <div className="text-sm text-muted-foreground">{feature.category}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Reverse marquee */}
      <div className="w-full">
        <div className="flex gap-6 marquee-reverse">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex gap-6 shrink-0">
              {[...gamificationFeatures].reverse().map((feature) => (
                <div
                  key={`${feature.name}-reverse-${setIndex}`}
                  className="shrink-0 rounded-[1.5rem] px-8 py-6 border border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.08] transition-all duration-300 group"
                >
                  <div className="text-lg font-medium group-hover:translate-x-1 transition-transform">
                    {feature.name}
                  </div>
                  <div className="text-sm text-muted-foreground">{feature.category}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
