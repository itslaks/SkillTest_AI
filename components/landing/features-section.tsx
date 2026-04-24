"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatedTetrahedron } from "./animated-tetrahedron";
import { AnimatedWave } from "./animated-wave";

const features = [
  {
    number: "01",
    title: "AI-Powered Questions",
    description: "Dynamically generate MCQs with intelligent difficulty distribution — 70% from your chosen level, with the remaining 30% spread across adjacent difficulty tiers for comprehensive assessment.",
    visual: "ai",
  },
  {
    number: "02",
    title: "Gamified Experience",
    description: "Keep employees engaged with countdown timers, streak bonuses, point systems, animated badges, progress indicators, and instant feedback after every answer.",
    visual: "deploy",
  },
  {
    number: "03",
    title: "Smart Leaderboard",
    description: "Dynamic rankings generated based on participant count. Ties are broken by completion time, ensuring fair and precise scoring for every assessment.",
    visual: "collab",
  },
  {
    number: "04",
    title: "Excel Import & Export",
    description: "Managers upload employee lists via Excel (email, name, domain) and download complete leaderboards with employee ID, score, and completion time.",
    visual: "security",
  },
];

function QuizVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <defs>
        <clipPath id="quizClip">
          <rect x="30" y="20" width="140" height="120" rx="4" />
        </clipPath>
      </defs>
      
      {/* Container */}
      <rect x="30" y="20" width="140" height="120" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      
      {/* Animated bars representing questions */}
      <g clipPath="url(#quizClip)">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x="40"
            y={35 + i * 16}
            width="120"
            height="10"
            rx="2"
            fill="currentColor"
            opacity="0.15"
          >
            <animate
              attributeName="opacity"
              values="0.15;0.8;0.15"
              dur="2s"
              begin={`${i * 0.15}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="width"
              values="20;120;20"
              dur="2s"
              begin={`${i * 0.15}s`}
              repeatCount="indefinite"
            />
          </rect>
        ))}
      </g>
      
      {/* Progress indicator */}
      <circle cx="100" cy="155" r="3" fill="currentColor" opacity="0.3">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function AIVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {/* Central node */}
      <circle cx="100" cy="80" r="12" fill="currentColor">
        <animate attributeName="r" values="12;14;12" dur="2s" repeatCount="indefinite" />
      </circle>
      
      {/* Orbiting nodes */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i * 60) * (Math.PI / 180);
        const radius = 50;
        const cx = (100 + Math.cos(angle) * radius).toFixed(6);
        const cy = (80 + Math.sin(angle) * radius).toFixed(6);
        return (
          <g key={i}>
            {/* Connection line */}
            <line
              x1="100"
              y1="80"
              x2={cx}
              y2={cy}
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.3"
            >
              <animate
                attributeName="opacity"
                values="0.3;0.8;0.3"
                dur="2s"
                begin={`${i * 0.3}s`}
                repeatCount="indefinite"
              />
            </line>
            
            {/* Outer node */}
            <circle
              cx={cx}
              cy={cy}
              r="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <animate
                attributeName="r"
                values="6;8;6"
                dur="2s"
                begin={`${i * 0.3}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        );
      })}
      
      {/* Pulse rings */}
      <circle cx="100" cy="80" r="30" fill="none" stroke="currentColor" strokeWidth="1" opacity="0">
        <animate attributeName="r" values="20;60" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function LeaderboardVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {/* User A */}
      <g>
        <rect x="30" y="50" width="50" height="60" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="55" y="85" textAnchor="middle" fontSize="20" fontFamily="monospace" fill="currentColor">1</text>
        <circle cx="55" cy="35" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      </g>
      
      {/* User B */}
      <g>
        <rect x="120" y="50" width="50" height="60" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="145" y="85" textAnchor="middle" fontSize="20" fontFamily="monospace" fill="currentColor">2</text>
        <circle cx="145" cy="35" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      </g>
      
      {/* Connection */}
      <line x1="80" y1="80" x2="120" y2="80" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4">
        <animate attributeName="stroke-dashoffset" values="0;-8" dur="0.5s" repeatCount="indefinite" />
      </line>
      
      {/* Trophy */}
      <g transform="translate(100, 130)">
        <circle r="6" fill="none" stroke="currentColor" strokeWidth="2">
          <animate attributeName="r" values="6;10;6" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

function ExcelVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {/* Shield / Document */}
      <path
        d="M 100 20 L 150 40 L 150 90 Q 150 130 100 145 Q 50 130 50 90 L 50 40 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      
      {/* Inner */}
      <path
        d="M 100 35 L 135 50 L 135 85 Q 135 115 100 128 Q 65 115 65 85 L 65 50 Z"
        fill="currentColor"
        opacity="0.1"
      >
        <animate attributeName="opacity" values="0.1;0.2;0.1" dur="2s" repeatCount="indefinite" />
      </path>
      
      {/* Excel icon lines */}
      <line x1="80" y1="65" x2="120" y2="65" stroke="currentColor" strokeWidth="2" />
      <line x1="80" y1="80" x2="120" y2="80" stroke="currentColor" strokeWidth="2" />
      <line x1="80" y1="95" x2="120" y2="95" stroke="currentColor" strokeWidth="2" />
      <line x1="100" y1="55" x2="100" y2="105" stroke="currentColor" strokeWidth="2" />
      
      {/* Scan lines */}
      <line x1="60" y1="60" x2="140" y2="60" stroke="currentColor" strokeWidth="1" opacity="0">
        <animate attributeName="y1" values="40;120;40" dur="3s" repeatCount="indefinite" />
        <animate attributeName="y2" values="40;120;40" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.5;0" dur="3s" repeatCount="indefinite" />
      </line>
    </svg>
  );
}

function AnimatedVisual({ type }: { type: string }) {
  switch (type) {
    case "deploy":
      return <QuizVisual />;
    case "ai":
      return <AIVisual />;
    case "collab":
      return <LeaderboardVisual />;
    case "security":
      return <ExcelVisual />;
    default:
      return <QuizVisual />;
  }
}

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className={`group relative transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 py-12 lg:py-20 border-b border-foreground/10">
        {/* Number */}
        <div className="shrink-0">
          <span className="font-mono text-sm text-muted-foreground">{feature.number}</span>
        </div>
        
        {/* Content */}
        <div className="flex-1 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-3xl lg:text-4xl font-display mb-4 group-hover:translate-x-2 transition-transform duration-500">
              {feature.title}
            </h3>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {feature.description}
            </p>
          </div>
          
          {/* Visual */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[420px]">
              <div className="absolute -top-4 right-8 h-16 w-16 rounded-full bg-cyan-300/30 blur-2xl" />
              <div className="absolute -bottom-4 left-8 h-20 w-20 rounded-full bg-blue-400/20 blur-2xl" />
              <div className="glass-panel rounded-[2rem] p-5 tilt-sheen">
                <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr] md:items-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Showcase Layer</p>
                    <p className="mt-3 text-xl font-display text-foreground">{feature.title}</p>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      Each capability is presented as a premium product surface, not a flat list item.
                    </p>
                  </div>
                  <div className="h-40 rounded-[1.6rem] bg-gradient-to-br from-zinc-50 to-slate-100 p-3 text-foreground shadow-inner">
                    <AnimatedVisual type={feature.visual} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

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
    <section
      id="features"
      ref={sectionRef}
      className="relative py-24 lg:py-32"
    >
      <div className="pointer-events-none absolute inset-x-0 top-12 mx-auto hidden max-w-[1200px] lg:block">
        <div className="grid grid-cols-[0.4fr_1fr_0.4fr] items-center gap-6 opacity-70">
          <div className="glass-panel h-40 rounded-[2rem] p-4 float-slow">
            <AnimatedTetrahedron />
          </div>
          <div className="glass-panel h-24 rounded-[2rem] p-4 float-delayed">
            <AnimatedWave />
          </div>
          <div className="glass-panel h-40 rounded-[2rem] p-4 float-slow">
            <AnimatedTetrahedron />
          </div>
        </div>
      </div>
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-16 lg:mb-24 pt-8 lg:pt-28">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            Platform Features
          </span>
          <h2
            className={`text-4xl lg:text-6xl font-display tracking-tight transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Everything you need
            <br />
            <span className="text-muted-foreground">to make the experience unforgettable.</span>
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              "A premium visual layer that feels crafted rather than assembled.",
              "Depth, blur, gradients, and motion used with discipline.",
              "The wow factor stays attached to real operational and AI features.",
            ].map((copy) => (
              <div key={copy} className="glass-panel rounded-[1.5rem] p-4 text-sm leading-relaxed text-muted-foreground">
                {copy}
              </div>
            ))}
          </div>
        </div>

        {/* Features List */}
        <div>
          {features.map((feature, index) => (
            <FeatureCard key={feature.number} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
