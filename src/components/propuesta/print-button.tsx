'use client'

export function PrintButton({ variant = 'inline' }: { variant?: 'inline' | 'fab' }) {
  if (variant === 'fab') {
    return (
      <button
        onClick={() => window.print()}
        className="print:hidden fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 bg-zinc-900 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg hover:bg-zinc-700 active:scale-95 transition-all"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 5V1h8v4M3 10H1V5h12v5h-2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 8h8v5H3z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Guardar PDF
      </button>
    )
  }
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
