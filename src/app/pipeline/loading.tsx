export default function Loading() {
  const COLS = 4
  const CARDS = [3, 5, 2, 4]

  return (
    <div className="p-8 h-full flex flex-col animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-8 w-32 bg-zinc-200 rounded-lg" />
        <div className="h-4 w-28 bg-zinc-100 rounded mt-2" />
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
        {Array.from({ length: COLS }).map((_, col) => (
          <div key={col} className="flex-shrink-0 w-72 flex flex-col gap-3">
            {/* Column header */}
            <div className="flex items-center justify-between px-1">
              <div className="h-4 w-24 bg-zinc-200 rounded" />
              <div className="h-5 w-6 bg-zinc-100 rounded-full" />
            </div>
            {/* Cards */}
            {Array.from({ length: CARDS[col] ?? 3 }).map((_, card) => (
              <div
                key={card}
                className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2"
              >
                <div className="h-3 w-3/4 bg-zinc-100 rounded" />
                <div className="h-3 w-1/2 bg-zinc-100 rounded" />
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-5 w-16 bg-zinc-100 rounded-full" />
                  <div className="h-3 w-14 bg-zinc-100 rounded ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
