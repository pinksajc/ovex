import Link from 'next/link'
import { getDeals, getActiveConfig } from '@/lib/deals'
import { formatCurrency } from '@/lib/format'
import { DealsTable } from '@/components/deals/deals-table'

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; focus?: string }>
}) {
  const { status, focus } = await searchParams
  const focusMode = focus === 'close'
  const deals = await getDeals()

  const totalMRR = deals.reduce((sum, d) => sum + (getActiveConfig(d)?.economics.totalMonthlyRevenue ?? 0), 0)
  const totalARR = deals.reduce((sum, d) => sum + (getActiveConfig(d)?.economics.annualRevenue ?? 0), 0)
  const configured = deals.filter((d) => d.commercialStatus !== 'no_config').length
  const closeReady = deals.filter((d) => d.commercialStatus === 'proposal_created').length

  if (focusMode) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        {/* Focus header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">Modo foco · Cierre</h1>
            </div>
            <p className="text-zinc-400 text-xs">
              {closeReady} deal{closeReady !== 1 ? 's' : ''} listo{closeReady !== 1 ? 's' : ''} para cerrar
            </p>
          </div>
          <Link
            href="/deals"
            className="text-xs text-zinc-400 hover:text-zinc-700 border border-zinc-200 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            ← Salir del modo foco
          </Link>
        </div>

        <DealsTable deals={deals} focusMode />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Deals</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Pipeline activo · {deals.length} deals · {configured} configurados
          </p>
        </div>
        <Link
          href="/deals?focus=close"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Modo foco
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Deals</p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono">{deals.length}</p>
          <p className="text-xs text-zinc-400 mt-1">{configured} configurados</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">MRR Pipeline</p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono">{formatCurrency(totalMRR)}</p>
          <p className="text-xs text-zinc-400 mt-1">mensual recurrente</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">ARR Pipeline</p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono">{formatCurrency(totalARR)}</p>
          <p className="text-xs text-zinc-400 mt-1">anual recurrente</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5 border-emerald-200 bg-emerald-50/30">
          <p className="text-xs text-emerald-600 uppercase tracking-widest mb-1">Listos para cerrar</p>
          <p className="text-2xl font-semibold text-emerald-700 font-mono">{closeReady}</p>
          <p className="text-xs text-emerald-600/60 mt-1">con propuesta creada</p>
        </div>
      </div>

      {/* Table with filter */}
      <DealsTable deals={deals} initialFilter={status} />
    </div>
  )
}
