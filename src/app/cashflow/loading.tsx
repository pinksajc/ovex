export default function Loading() {
  return (
    <div className="min-h-full bg-[#f5f5f7] p-8 space-y-5 animate-pulse">
      <div className="h-8 w-40 bg-zinc-200 rounded-lg" />
      <div className="h-4 w-56 bg-zinc-200 rounded" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl h-24" />
        ))}
      </div>
      <div className="bg-white rounded-2xl h-64" />
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
