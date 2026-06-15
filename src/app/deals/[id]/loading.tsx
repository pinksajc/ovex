// Skeleton for /deals/[id] — mirrors the multi-panel layout of the deal detail page

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
          <div className="h-8 w-56 bg-zinc-200 rounded-lg" />
          <div className="h-6 w-24 bg-zinc-100 rounded-full" />
          <div className="h-6 w-20 bg-zinc-100 rounded-full" />
        </div>
        <div className="h-3.5 w-40 bg-zinc-100 rounded" />
      </div>

      {/* Main 2-col layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left column — 2/3 */}
        <div className="col-span-2 space-y-5">
          {/* Config / pricing card */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
            <div className="h-4 w-32 bg-zinc-100 rounded" />
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-zinc-50 rounded-lg p-4 space-y-2">
                  <div className="h-3 w-20 bg-zinc-100 rounded" />
                  <div className="h-6 w-24 bg-zinc-100 rounded-md" />
                </div>
              ))}
            </div>
          </div>
          {/* Timeline */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
            <div className="h-3 w-20 bg-zinc-100 rounded" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 py-2">
                <div className="h-4 w-4 rounded-full bg-zinc-100 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-48 bg-zinc-100 rounded" />
                  <div className="h-2.5 w-24 bg-zinc-100 rounded" />
                </div>
              </div>
            ))}
          </div>
          {/* Comments panel */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
            <div className="h-3 w-24 bg-zinc-100 rounded" />
            <div className="h-20 bg-zinc-50 rounded-lg border border-zinc-100" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-3 border border-zinc-100 rounded-lg">
                <div className="h-5 w-5 rounded bg-zinc-100 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-48 bg-zinc-100 rounded" />
                  <div className="h-2.5 w-64 bg-zinc-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column — 1/3 */}
        <div className="space-y-5">
          <CardSkeleton rows={4} />   {/* Contact */}
          <CardSkeleton rows={3} />   {/* Company */}
          <CardSkeleton rows={3} />   {/* Presupuestos */}
          <CardSkeleton rows={3} />   {/* Facturas */}
        </div>
      </div>
    </div>
  )
}
