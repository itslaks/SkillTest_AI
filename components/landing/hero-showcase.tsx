"use client";

import { useMemo, useState } from "react";
import { AnimatedSphere } from "./animated-sphere";
import { AnimatedTetrahedron } from "./animated-tetrahedron";
import { AnimatedWave } from "./animated-wave";

const commandCards = [
  { label: "Batch", value: "24 Active", detail: "Cohorts under orchestration" },
  { label: "Attendance", value: "94%", detail: "Live across scheduled sessions" },
  { label: "Insights", value: "Readiness", detail: "Signals driving interventions" },
];

export function HeroShowcase() {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const transforms = useMemo(() => {
    const rotateY = pointer.x * 8;
    const rotateX = pointer.y * -8;
    return {
      shell: { transform: `perspective(1800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)` },
      front: { transform: `translate3d(${pointer.x * 10}px, ${pointer.y * 8}px, 0)` },
      back: { transform: `translate3d(${pointer.x * -14}px, ${pointer.y * -10}px, 0)` },
      chip: { transform: `translate3d(${pointer.x * 18}px, ${pointer.y * -14}px, 0)` },
    };
  }, [pointer.x, pointer.y]);

  return (
    <div
      className="relative h-[640px] w-full"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        setPointer({ x, y });
      }}
      onMouseLeave={() => setPointer({ x: 0, y: 0 })}
    >
      <div className="aura-ring left-8 top-10 h-40 w-40 bg-cyan-400/35" />
      <div className="aura-ring bottom-16 right-6 h-48 w-48 bg-blue-600/30" style={{ animationDelay: "1.5s" }} />

      <div className="absolute inset-0" style={transforms.shell}>
        <div className="absolute left-0 top-16 h-52 w-40 rounded-[2rem] glass-panel p-4 float-slow" style={transforms.back}>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            <span>Readiness</span>
            <span>Live</span>
          </div>
          <div className="mt-4 h-32 rounded-[1.5rem] bg-white/70 p-2">
            <AnimatedTetrahedron />
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-900">Learning readiness and training load in one view.</p>
        </div>

        <div className="absolute right-2 top-0 h-44 w-48 rounded-[2rem] glass-panel p-4 float-delayed" style={transforms.chip}>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            <span>Execution</span>
            <span>Realtime</span>
          </div>
          <div className="mt-4 h-24 rounded-[1.5rem] bg-zinc-950 p-2 text-white">
            <AnimatedWave />
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-900">Attendance, reminders, and session load kept visible.</p>
        </div>

        <div className="absolute bottom-8 right-6 h-56 w-44 rounded-[2rem] glass-panel p-4 float-slow" style={transforms.front}>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            <span>Insights</span>
            <span>Live</span>
          </div>
          <div className="mt-4 h-36 rounded-[1.5rem] bg-zinc-100 p-3">
            <AnimatedSphere />
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-900">Signals that help managers act sooner.</p>
        </div>

        <div className="absolute inset-x-[12%] top-24 rounded-[2.25rem] glass-panel tilt-sheen overflow-hidden" style={transforms.front}>
          <div className="mesh-bg p-6 md:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Manager Workspace</p>
                <h3 className="mt-3 max-w-xl text-3xl font-display leading-[0.95] text-zinc-950 md:text-4xl">
                  One calm workspace for execution, assessment, and learner progress.
                </h3>
              </div>
              <div className="hidden rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-mono text-zinc-600 md:block">
                clear / secure / role-based
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[1.75rem] border border-black/8 bg-zinc-950 p-5 text-white shadow-[0_30px_70px_rgba(15,23,42,0.28)]">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">Training Signal Stack</p>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white/70">
                    Live View
                  </span>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {commandCards.map((card) => (
                    <div key={card.label} className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">{card.label}</p>
                      <p className="mt-3 text-xl font-semibold">{card.value}</p>
                      <p className="mt-2 text-xs leading-relaxed text-white/60">{card.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr]">
                  <div className="rounded-[1.35rem] border border-cyan-400/15 bg-cyan-400/8 p-4">
                    <p className="text-xs font-semibold text-cyan-100">Ops Layer</p>
                    <p className="mt-2 text-sm text-cyan-50/80">Batch orchestration, trainer coordination, attendance logging, reminders, and feedback loops.</p>
                  </div>
                  <div className="rounded-[1.35rem] border border-blue-400/15 bg-blue-400/8 p-4">
                    <p className="text-xs font-semibold text-blue-100">Intelligence Layer</p>
                    <p className="mt-2 text-sm text-blue-50/80">Readiness scoring, behavioral inference, knowledge decay, trainer impact, and anti-gaming analysis.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.75rem] border border-black/8 bg-white/75 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Interface System</p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="h-16 rounded-[1.25rem] bg-[radial-gradient(circle_at_top,rgba(12,74,110,0.38),transparent_65%),linear-gradient(135deg,#f8fafc,#dbeafe)]" />
                    <div className="h-16 rounded-[1.25rem] bg-[radial-gradient(circle_at_40%_35%,rgba(8,145,178,0.28),transparent_60%),linear-gradient(135deg,#111827,#0f172a)]" />
                    <div className="h-16 rounded-[1.25rem] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.24),transparent_50%),linear-gradient(135deg,#ffffff,#e4e4e7)]" />
                  </div>
                  <p className="mt-4 text-sm text-zinc-600">The interface uses restrained contrast, clear hierarchy, and connected product states.</p>
                </div>

                <div className="rounded-[1.75rem] border border-black/8 bg-white/75 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Product Strength</p>
                  <ul className="mt-4 space-y-2 text-sm text-zinc-700">
                    <li>Manager and employee journeys share the same system language</li>
                    <li>Operational tasks stay visible without adding clutter</li>
                    <li>Assessment insights connect directly to next actions</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
