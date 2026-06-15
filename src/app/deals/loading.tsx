export default function Loading() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      <div className="h-7 w-24 bg-zinc-100 rounded-lg" />
      <div className="h-3.5 w-48 bg-zinc-100 rounded" />

      {/* Search + filter bar */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-56 bg-zinc-100 rounded-lg" />
        <div className="h-8 w-32 bg-zinc-100 rounded-lg" />
        <div className="h-8 w-32 bg-zinc-100 rounded-lg" />
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-zinc-100 bg-zinc-50">
          <div className="h-2.5 w-4 bg-zinc-200 rounded" />
          <div className="h-2.5 w-32 bg-zinc-200 rounded" />
          <div className="h-2.5 w-24 bg-zinc-200 rounded" />
          <div className="h-2.5 w-20 bg-zinc-200 rounded ml-auto" />
          <div className="h-2.5 w-16 bg-zinc-200 rounded" />
          <div className="h-2.5 w-20 bg-zinc-200 rounded" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-zinc-50 last:border-0">
            <div className="h-3 w-4 bg-zinc-100 rounded shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-36 bg-zinc-100 rounded" />
              <div className="h-2.5 w-24 bg-zinc-100 rounded" />
            </div>
            <div className="h-3 w-28 bg-zinc-100 rounded" />
            <div className="h-5 w-20 bg-zinc-100 rounded-full ml-auto" />
            <div className="h-3 w-16 bg-zinc-100 rounded" />
            <div className="h-3 w-14 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
