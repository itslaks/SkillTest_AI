export default function EmployeeLoading() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <section className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm">
        <div className="grid gap-0 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="relative min-h-[260px] bg-black p-6 md:p-8 dashboard-grid-bg">
            <div className="h-7 w-36 rounded-full bg-white/10" />
            <div className="mt-8 flex items-center gap-4">
              <div className="h-[88px] w-[88px] rounded-[1.5rem] bg-white/10" />
              <div className="space-y-3">
                <div className="h-9 w-72 max-w-[70vw] rounded-2xl bg-white/10" />
                <div className="h-4 w-96 max-w-[70vw] rounded-full bg-white/10" />
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <div className="h-11 w-40 rounded-full bg-white/10" />
              <div className="h-11 w-36 rounded-full bg-white/10" />
            </div>
          </div>
          <div className="grid gap-4 bg-zinc-50 p-5 md:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="skeleton-shimmer h-3 w-24 rounded-full" />
                  <div className="skeleton-shimmer mt-4 h-8 w-16 rounded-xl" />
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="skeleton-shimmer h-4 w-40 rounded-full" />
              <div className="skeleton-shimmer mt-4 h-3 w-full rounded-full" />
              <div className="skeleton-shimmer mt-2 h-3 w-2/3 rounded-full" />
            </div>
          </div>
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="skeleton-shimmer h-4 w-48 rounded-full" />
              <div className="skeleton-shimmer mt-5 h-20 rounded-2xl" />
            </div>
          ))}
        </div>
        <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="skeleton-shimmer h-4 w-32 rounded-full" />
          <div className="skeleton-shimmer mt-5 h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
