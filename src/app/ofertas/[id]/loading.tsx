function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3 animate-pulse">
      <div className="h-3 w-24 bg-zinc-100 rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-50 last:border-0">
          <div className="h-2.5 w-32 bg-zinc-100 rounded" />
          <div className="h-2.5 w-28 bg-zinc-100 rounded" />
        </div>
      ))}
    </div>
  )
}

export default function Loading() {
  return (
    <div className="p-8 max-w-7xl mx-auto animate-pulse">
      {/* Back + header */}
      <div className="mb-6 space-y-3">
        <div className="h-3.5 w-20 bg-zinc-100 rounded" />
        <div className="flex items-center gap-4">
          <div className="h-8 w-64 bg-zinc-200 rounded-lg" />
          <div className="h-6 w-20 bg-zinc-100 rounded-full" />
          <div className="h-6 w-20 bg-zinc-100 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-32 bg-zinc-100 rounded" />
          <div className="h-3.5 w-24 bg-zinc-100 rounded" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left — 2/3 */}
        <div className="col-span-2 space-y-5">
          {/* Amounts card */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
            <div className="h-4 w-28 bg-zinc-100 rounded" />
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-zinc-50 rounded-lg p-4 space-y-2">
                  <div className="h-3 w-20 bg-zinc-100 rounded" />
                  <div className="h-6 w-24 bg-zinc-100 rounded-md" />
                </div>
              ))}
            </div>
          </div>
          {/* Items table */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="h-10 bg-zinc-50 border-b border-zinc-100 px-5 flex items-center gap-4">
              <div className="h-3 w-32 bg-zinc-100 rounded" />
              <div className="h-3 w-20 bg-zinc-200 rounded ml-auto" />
              <div className="h-3 w-20 bg-zinc-200 rounded" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-zinc-50 last:border-0">
                <div className="flex-1 h-3 bg-zinc-100 rounded" />
                <div className="h-3 w-16 bg-zinc-100 rounded" />
                <div className="h-3 w-20 bg-zinc-100 rounded" />
              </div>
            ))}
          </div>
          {/* Contract section */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
            <div className="h-3 w-24 bg-zinc-100 rounded" />
            <div className="h-10 w-36 bg-zinc-100 rounded-lg" />
          </div>
        </div>

        {/* Right — 1/3 */}
        <div className="space-y-5">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={3} />
          <CardSkeleton rows={3} />
        </div>
      </div>
    </div>
  )
}
