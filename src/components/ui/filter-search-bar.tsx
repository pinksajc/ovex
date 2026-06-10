'use client'

export interface FilterSearchBarProps {
  query: string
  onQuery: (v: string) => void
  desde: string
  onDesde: (v: string) => void
  hasta: string
  onHasta: (v: string) => void
  placeholder?: string
}

export function FilterSearchBar({
  query, onQuery,
  desde, onDesde,
  hasta, onHasta,
  placeholder = 'Número, cliente o CIF…',
}: FilterSearchBarProps) {
  const hasFilters = query || desde || hasta
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Text search */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none"
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <circle cx="6.5" cy="6.5" r="4.5" />
          <path d="M10.5 10.5L14 14" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-7 pr-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-transparent bg-zinc-50 placeholder:text-zinc-400"
        />
        {query && (
          <button
            onClick={() => onQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Date range */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-400 shrink-0">Desde</span>
        <input
          type="date"
          value={desde}
          onChange={(e) => onDesde(e.target.value)}
          className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-transparent bg-zinc-50 text-zinc-700"
        />
        <span className="text-xs text-zinc-400 shrink-0">Hasta</span>
        <input
          type="date"
          value={hasta}
          onChange={(e) => onHasta(e.target.value)}
          className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-transparent bg-zinc-50 text-zinc-700"
        />
      </div>

      {/* Clear all */}
      {hasFilters && (
        <button
          onClick={() => { onQuery(''); onDesde(''); onHasta('') }}
          className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          Limpiar
        </button>
      )}
    </div>
  )
}
