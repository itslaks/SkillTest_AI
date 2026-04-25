import { AnimatedSphere } from "./animated-sphere";
import { AnimatedTetrahedron } from "./animated-tetrahedron";
import { AnimatedWave } from "./animated-wave";

const commandCards = [
  { label: "Batch", value: "24 Active", detail: "Cohorts under orchestration" },
  { label: "Attendance", value: "94%", detail: "Live across scheduled sessions" },
  { label: "Insights", value: "Readiness", detail: "Signals driving interventions" },
];

export function HeroShowcase() {
  return (
    <div className="relative min-h-[560px] w-full overflow-hidden rounded-[2rem] border border-black/8 bg-white/55 p-4 shadow-[0_30px_90px_rgba(15,23,42,0.10)] sm:p-5">
      <div className="aura-ring left-8 top-10 h-40 w-40 bg-cyan-400/35" />
      <div className="aura-ring bottom-16 right-6 h-48 w-48 bg-blue-600/30" style={{ animationDelay: "1.5s" }} />

      <div className="relative z-10 grid h-full min-h-[520px] gap-4 sm:grid-cols-2">
        <div className="glass-panel flex min-h-52 flex-col rounded-[1.5rem] p-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            <span>Readiness</span>
            <span>Live</span>
          </div>
          <div className="mt-4 h-32 rounded-[1.25rem] bg-white/70 p-2">
            <AnimatedTetrahedron />
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-900">Learning readiness and training load in one view.</p>
        </div>

        <div className="glass-panel flex min-h-52 flex-col rounded-[1.5rem] p-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            <span>Execution</span>
            <span>Realtime</span>
          </div>
          <div className="mt-4 h-28 rounded-[1.25rem] bg-zinc-950 p-2 text-white">
            <AnimatedWave />
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-900">Attendance, reminders, and session load kept visible.</p>
        </div>

        <div className="glass-panel flex min-h-52 flex-col rounded-[1.5rem] p-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            <span>Insights</span>
            <span>Live</span>
          </div>
          <div className="mt-4 h-32 rounded-[1.25rem] bg-zinc-100 p-3">
            <AnimatedSphere />
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-900">Signals that help managers act sooner.</p>
        </div>

        <div className="glass-panel flex min-h-52 flex-col rounded-[1.5rem] bg-zinc-950 p-4 text-white sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">Training Signal Stack</p>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white/70">
              Live View
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {commandCards.map((card) => (
              <div key={card.label} className="min-w-0 rounded-[1.15rem] border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">{card.label}</p>
                <p className="mt-3 text-xl font-semibold">{card.value}</p>
                <p className="mt-2 text-xs leading-relaxed text-white/60">{card.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
