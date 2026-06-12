export default function Loading() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      <div className="h-8 w-24 bg-zinc-100 rounded-lg" />
      <div className="h-4 w-48 bg-zinc-100 rounded" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-zinc-100 rounded-xl h-24" />
        ))}
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-zinc-50 last:border-0">
            <div className="h-3 w-24 bg-zinc-100 rounded" />
            <div className="h-3 w-40 bg-zinc-100 rounded" />
            <div className="h-3 w-20 bg-zinc-100 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
