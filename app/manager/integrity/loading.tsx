export default function IntegrityLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-44 rounded-[2rem] bg-zinc-900" />
      <div className="grid gap-3 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-zinc-100" />
        ))}
      </div>
      <div className="h-32 rounded-2xl bg-amber-50" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-64 rounded-2xl bg-zinc-900" />
        <div className="h-64 rounded-2xl bg-zinc-900" />
      </div>
    </div>
  )
}
