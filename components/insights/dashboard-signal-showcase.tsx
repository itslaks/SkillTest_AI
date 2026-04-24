"use client";

import { AnimatedSphere } from "@/components/landing/animated-sphere";
import { AnimatedTetrahedron } from "@/components/landing/animated-tetrahedron";
import { AnimatedWave } from "@/components/landing/animated-wave";

type DashboardSignalShowcaseProps = {
  theme?: "dark" | "light";
  title: string;
  subtitle: string;
  badge?: string;
};

export function DashboardSignalShowcase({
  theme = "dark",
  title,
  subtitle,
  badge,
}: DashboardSignalShowcaseProps) {
  const dark = theme === "dark";

  return (
    <div className={`relative h-[320px] w-full overflow-hidden rounded-[2rem] ${dark ? "glass-panel-dark" : "glass-panel"} ${dark ? "dashboard-grid-bg" : "mesh-bg"}`}>
      <div className={`absolute left-6 top-6 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.28em] ${dark ? "border border-white/10 bg-white/10 text-white/70" : "border border-black/10 bg-white/70 text-zinc-600"}`}>
        {badge || "Signal Stack"}
      </div>

      <div className="absolute inset-0">
        <div className={`aura-ring left-10 top-14 h-24 w-24 ${dark ? "bg-cyan-400/30" : "bg-cyan-300/35"}`} />
        <div className={`aura-ring bottom-12 right-10 h-28 w-28 ${dark ? "bg-blue-500/25" : "bg-blue-300/30"}`} style={{ animationDelay: "1.3s" }} />
      </div>

      <div className="absolute inset-0 p-5">
        <div className="grid h-full gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-end">
            <div className={`max-w-sm rounded-[1.6rem] p-5 ${dark ? "border border-white/10 bg-white/6" : "border border-black/8 bg-white/70"}`}>
              <p className={`text-[10px] uppercase tracking-[0.25em] ${dark ? "text-white/45" : "text-zinc-500"}`}>Immersive Surface</p>
              <h3 className={`mt-3 text-2xl font-display leading-tight ${dark ? "text-white" : "text-zinc-950"}`}>{title}</h3>
              <p className={`mt-3 text-sm leading-relaxed ${dark ? "text-white/65" : "text-zinc-600"}`}>{subtitle}</p>
            </div>
          </div>

          <div className="relative">
            <div className={`absolute right-0 top-6 h-28 w-32 rounded-[1.5rem] p-3 ${dark ? "border border-white/10 bg-black/35" : "border border-black/8 bg-white/70"} float-delayed`}>
              <AnimatedWave />
            </div>
            <div className={`absolute left-6 top-16 h-32 w-32 rounded-[1.75rem] p-3 ${dark ? "border border-white/10 bg-white/8" : "border border-black/8 bg-zinc-50/90"} float-slow`}>
              <AnimatedTetrahedron />
            </div>
            <div className={`absolute bottom-6 right-6 h-40 w-40 rounded-[1.9rem] p-4 ${dark ? "border border-white/10 bg-white/8" : "border border-black/8 bg-zinc-50/90"} float-slow`}>
              <AnimatedSphere />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
