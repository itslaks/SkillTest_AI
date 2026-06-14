export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-[1.5rem] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="skeleton-shimmer h-20 w-20 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="skeleton-shimmer h-7 w-64 max-w-full rounded-xl" />
            <div className="skeleton-shimmer h-4 w-80 max-w-full rounded-full" />
          </div>
        </div>
      </section>
      <section className="rounded-[1.5rem] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="skeleton-shimmer h-5 w-44 rounded-full" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="space-y-2">
              <div className="skeleton-shimmer h-3 w-24 rounded-full" />
              <div className="skeleton-shimmer h-11 rounded-xl" />
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[1.5rem] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="skeleton-shimmer h-5 w-36 rounded-full" />
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="skeleton-shimmer h-28 rounded-2xl" />
          ))}
        </div>
      </section>
    </div>
  )
}
