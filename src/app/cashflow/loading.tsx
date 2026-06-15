export default function Loading() {
  return (
    <div className="min-h-full bg-[#f5f5f7] p-8 space-y-5 animate-pulse">
      <div className="h-7 w-40 bg-zinc-200 rounded-lg" />
      <div className="h-3.5 w-56 bg-zinc-200 rounded" />

      {/* 3 KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 flex flex-col gap-3">
            <div className="h-3 w-20 bg-zinc-100 rounded" />
            <div className="h-7 w-28 bg-zinc-100 rounded-md" />
            <div className="h-2.5 w-24 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>

      {/* Income/Expense bar chart */}
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
        <div className="h-4 w-40 bg-zinc-100 rounded" />
        <div className="h-52 bg-zinc-100 rounded-xl" />
      </div>

      {/* Balance trend + Donut side by side */}
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 bg-white rounded-2xl p-5 flex flex-col gap-3">
          <div className="h-4 w-32 bg-zinc-100 rounded" />
          <div className="h-44 bg-zinc-100 rounded-xl" />
        </div>
        {/* Donut skeleton */}
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
          <div className="h-4 w-28 bg-zinc-100 rounded" />
          <div className="flex items-center justify-center flex-1 py-4">
            <div className="w-32 h-32 rounded-full bg-zinc-100 ring-[16px] ring-zinc-50" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-100 shrink-0" />
              <div className="h-2.5 flex-1 bg-zinc-100 rounded" />
              <div className="h-2.5 w-12 bg-zinc-100 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-3 bg-zinc-50 border-b border-zinc-100">
          <div className="h-2.5 w-24 bg-zinc-200 rounded" />
          <div className="h-2.5 w-36 bg-zinc-200 rounded" />
          <div className="h-2.5 w-20 bg-zinc-200 rounded ml-auto" />
          <div className="h-2.5 w-16 bg-zinc-200 rounded" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-zinc-50 last:border-0">
            <div className="h-3 w-24 bg-zinc-100 rounded" />
            <div className="h-3 w-48 bg-zinc-100 rounded" />
            <div className="h-3 w-20 bg-zinc-100 rounded ml-auto" />
            <div className="h-5 w-16 bg-zinc-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
