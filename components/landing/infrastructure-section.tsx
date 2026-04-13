"use client";

import { useEffect, useState, useRef } from "react";

const difficultyLevels = [
  { level: "Easy", distribution: "10%", description: "Fundamental concepts", color: "bg-green-500" },
  { level: "Medium", distribution: "10%", description: "Applied knowledge", color: "bg-blue-500" },
  { level: "Hard", distribution: "10%", description: "Complex problem-solving", color: "bg-amber-500" },
  { level: "Advanced", distribution: "10%", description: "Expert-level reasoning", color: "bg-orange-500" },
  { level: "Hardcore", distribution: "10%", description: "Master-level challenges", color: "bg-red-500" },
];

export function InfrastructureSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeLevel, setActiveLevel] = useState(2);
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

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLevel((prev) => (prev + 1) % difficultyLevels.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              Assessment Engine
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
              Smart difficulty
              <br />
              distribution.
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-12">
              When a manager selects a difficulty level, 50% of questions come from that tier. 
              The remaining 50% is evenly distributed (10% each) across all other levels — 
              ensuring a well-rounded, fair assessment.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">50%</div>
                <div className="text-sm text-muted-foreground">Selected level</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">10%</div>
                <div className="text-sm text-muted-foreground">Each other level</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">5</div>
                <div className="text-sm text-muted-foreground">Difficulty tiers</div>
              </div>
            </div>
          </div>

          {/* Right: Difficulty levels */}
          <div
            className={`transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="border border-foreground/10">
              {/* Header */}
              <div className="px-6 py-4 border-b border-foreground/10 flex items-center justify-between">
                <span className="text-sm font-mono text-muted-foreground">Difficulty Distribution</span>
                <span className="flex items-center gap-2 text-xs font-mono text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  AI-Powered
                </span>
              </div>

              {/* Difficulty levels */}
              <div>
                {difficultyLevels.map((item, index) => (
                  <div
                    key={item.level}
                    className={`px-6 py-5 border-b border-foreground/5 last:border-b-0 flex items-center justify-between transition-all duration-300 ${
                      activeLevel === index ? "bg-foreground/[0.02]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span 
                        className={`w-3 h-3 rounded-full transition-all duration-300 ${item.color} ${
                          activeLevel === index ? "scale-125" : "scale-100 opacity-60"
                        }`}
                      />
                      <div>
                        <div className="font-medium">{item.level}</div>
                        <div className="text-sm text-muted-foreground">{item.description}</div>
                      </div>
                    </div>
                    <span className={`font-mono text-sm transition-all duration-300 ${
                      activeLevel === index ? "text-foreground font-bold text-base" : "text-muted-foreground"
                    }`}>
                      {activeLevel === index ? "50%" : item.distribution}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
