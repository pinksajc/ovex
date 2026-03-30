'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 px-3 py-1.5 rounded-lg transition-colors"
    >
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 4V1h6v3" strokeLinecap="round" />
        <rect x="1" y="4" width="10" height="5" rx="1" />
        <path d="M3 7h6M3 9.5h3" strokeLinecap="round" />
      </svg>
      Imprimir / Guardar PDF
    </button>
  )
}
