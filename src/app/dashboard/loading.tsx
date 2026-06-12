export default function Loading() {
  return (
    <div className="min-h-full bg-[#f5f5f7] p-8 space-y-5 animate-pulse">
      <div className="h-8 w-36 bg-zinc-200 rounded-lg" />
      <div className="h-4 w-48 bg-zinc-200 rounded" />
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl h-24" />
        ))}
      </div>
      <div className="bg-white rounded-2xl h-64" />
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl h-48" />
        <div className="bg-white rounded-2xl h-48" />
      </div>
    </div>
  )
}
