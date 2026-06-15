export default function Loading() {
  return (
    <div className="min-h-full bg-[#f5f5f7] p-8 space-y-5 animate-pulse">
      <div className="h-7 w-44 bg-zinc-200 rounded-lg" />
      <div className="h-3.5 w-56 bg-zinc-200 rounded" />

      {/* KPI cards — number block + label line */}
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 flex flex-col gap-3">
            <div className="h-3 w-16 bg-zinc-100 rounded" />
            <div className="h-7 w-24 bg-zinc-100 rounded-md" />
            <div className="h-2.5 w-20 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>

      {/* MRR chart */}
      <div className="bg-white rounded-2xl p-5 h-64 flex flex-col gap-3">
        <div className="h-4 w-32 bg-zinc-100 rounded" />
        <div className="flex-1 bg-zinc-100 rounded-xl" />
      </div>

      {/* Bottom grid — leaderboard + second widget */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-0">
          <div className="h-4 w-28 bg-zinc-100 rounded mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-zinc-50 last:border-0">
              <div className="h-7 w-7 rounded-full bg-zinc-100 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-28 bg-zinc-100 rounded" />
                <div className="h-2.5 w-16 bg-zinc-100 rounded" />
              </div>
              <div className="h-4 w-12 bg-zinc-100 rounded-full" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
          <div className="h-4 w-28 bg-zinc-100 rounded" />
          <div className="flex-1 bg-zinc-100 rounded-xl min-h-[140px]" />
        </div>
      </div>
    </div>
  )
}
