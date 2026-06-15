export default function Loading() {
  return (
    <div className="p-8 max-w-4xl mx-auto animate-pulse">
      {/* Back + header */}
      <div className="mb-6 space-y-3">
        <div className="h-3.5 w-20 bg-zinc-100 rounded" />
        <div className="flex items-center gap-4">
          <div className="h-8 w-48 bg-zinc-200 rounded-lg" />
          <div className="h-6 w-20 bg-zinc-100 rounded-full" />
        </div>
        <div className="h-3.5 w-36 bg-zinc-100 rounded" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main invoice card — 2/3 */}
        <div className="col-span-2 space-y-5">
          {/* Header info */}
          <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-4 w-36 bg-zinc-100 rounded" />
                <div className="h-3 w-28 bg-zinc-100 rounded" />
              </div>
              <div className="h-20 w-20 bg-zinc-100 rounded-lg" />
            </div>
            {/* Rows */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-zinc-50 last:border-0">
                <div className="h-3 w-32 bg-zinc-100 rounded" />
                <div className="h-3 w-28 bg-zinc-100 rounded" />
              </div>
            ))}
          </div>

          {/* Line items table */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-3 bg-zinc-50 border-b border-zinc-100">
              <div className="h-2.5 w-32 bg-zinc-200 rounded flex-1" />
              <div className="h-2.5 w-16 bg-zinc-200 rounded" />
              <div className="h-2.5 w-20 bg-zinc-200 rounded" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-zinc-50 last:border-0">
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-48 bg-zinc-100 rounded" />
                  <div className="h-2.5 w-32 bg-zinc-100 rounded" />
                </div>
                <div className="h-3 w-16 bg-zinc-100 rounded" />
                <div className="h-3 w-20 bg-zinc-100 rounded" />
              </div>
            ))}
            {/* Totals */}
            <div className="px-5 py-4 border-t border-zinc-100 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-3 w-20 bg-zinc-100 rounded" />
                  <div className="h-3 w-24 bg-zinc-100 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar — 1/3 */}
        <div className="space-y-5">
          {/* Actions */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
            <div className="h-3 w-20 bg-zinc-100 rounded" />
            <div className="h-9 w-full bg-zinc-100 rounded-lg" />
            <div className="h-9 w-full bg-zinc-100 rounded-lg" />
          </div>
          {/* Deal info */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
            <div className="h-3 w-24 bg-zinc-100 rounded" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-50 last:border-0">
                <div className="h-2.5 w-24 bg-zinc-100 rounded" />
                <div className="h-2.5 w-28 bg-zinc-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
