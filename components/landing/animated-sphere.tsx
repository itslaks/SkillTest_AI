export function AnimatedSphere() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative aspect-square w-[72%] max-w-28 rounded-full border border-black/15 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.92),rgba(56,189,248,0.24)_38%,rgba(15,23,42,0.08)_70%,transparent_72%)] shadow-[inset_-16px_-18px_30px_rgba(15,23,42,0.12),0_18px_50px_rgba(15,23,42,0.12)]">
        <div className="absolute inset-[18%] rounded-full border border-black/10" />
        <div className="absolute inset-y-[12%] left-1/2 w-px -translate-x-1/2 rounded-full bg-black/10" />
        <div className="absolute inset-x-[12%] top-1/2 h-px -translate-y-1/2 rounded-full bg-black/10" />
      </div>
    </div>
  )
}
