export default function Loading() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-7 w-32 bg-zinc-100 rounded-lg" />
      <div className="h-3.5 w-40 bg-zinc-100 rounded" />

      {/* Status tabs */}
      <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5 w-fit">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-7 rounded-md bg-zinc-200 ${i === 0 ? 'w-20' : 'w-24'}`} />
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-3 bg-zinc-50 border-b border-zinc-100">
          <div className="h-2.5 w-32 bg-zinc-200 rounded" />
          <div className="h-2.5 w-24 bg-zinc-200 rounded" />
          <div className="h-2.5 w-16 bg-zinc-200 rounded ml-auto" />
          <div className="h-2.5 w-20 bg-zinc-200 rounded" />
          <div className="h-2.5 w-16 bg-zinc-200 rounded" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-zinc-50 last:border-0">
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-40 bg-zinc-100 rounded" />
              <div className="h-2.5 w-28 bg-zinc-100 rounded" />
            </div>
            <div className="h-5 w-20 bg-zinc-100 rounded-full" />
            <div className="h-3 w-16 bg-zinc-100 rounded ml-auto" />
            <div className="h-3 w-24 bg-zinc-100 rounded" />
            <div className="h-3 w-14 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
