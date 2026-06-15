export default function Loading() {
  return (
    <div className="p-8 max-w-7xl mx-auto animate-pulse">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="h-8 w-24 bg-zinc-200 rounded-lg" />
          <div className="h-4 w-48 bg-zinc-100 rounded mt-2" />
        </div>
        <div className="h-9 w-60 bg-zinc-100 rounded-lg" />
      </div>

      {/* Stage tabs skeleton */}
      <div className="flex gap-1 mb-6">
        {[80, 100, 90, 70].map((w, i) => (
          <div key={i} style={{ width: w }} className="h-8 bg-zinc-100 rounded-md" />
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-zinc-100">
          {[120, 80, 80, 100, 80].map((w, i) => (
            <div key={i} style={{ width: w }} className="h-3 bg-zinc-100 rounded" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-zinc-50 last:border-0">
            <div className="h-3 w-36 bg-zinc-100 rounded" />
            <div className="h-5 w-20 bg-zinc-100 rounded-full" />
            <div className="h-3 w-16 bg-zinc-100 rounded font-mono" />
            <div className="h-3 w-28 bg-zinc-100 rounded" />
            <div className="h-3 w-20 bg-zinc-100 rounded" />
            <div className="h-7 w-28 bg-zinc-100 rounded-lg ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
