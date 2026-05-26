export default function ManagerLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-zinc-900 bg-black p-8 text-white shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
        <div className="h-3 w-40 rounded-full bg-white/10" />
        <div className="mt-6 h-10 w-full max-w-2xl rounded-2xl bg-white/10" />
        <div className="mt-3 h-4 w-full max-w-xl rounded-full bg-white/10" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="h-3 w-24 rounded-full bg-zinc-100" />
            <div className="mt-4 h-8 w-20 rounded-xl bg-zinc-100" />
            <div className="mt-4 h-3 w-full rounded-full bg-zinc-100" />
          </div>
        ))}
      </div>
      <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="h-4 w-52 rounded-full bg-zinc-100" />
        <div className="mt-5 grid gap-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-16 rounded-2xl bg-zinc-100" />
          ))}
        </div>
      </div>
    </div>
  )
}
