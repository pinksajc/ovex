import Link from 'next/link'
import { getDeals, getActiveConfig } from '@/lib/deals'
import { formatCurrency } from '@/lib/format'
import type { DealStage } from '@/types'

const STAGE_LABELS: Record<DealStage, string> = {
  prospecting: 'Prospecting',
  qualified: 'Qualified',
  proposal_sent: 'Propuesta enviada',
  negotiation: 'Negociación',
  closed_won: 'Cerrado ganado',
  closed_lost: 'Cerrado perdido',
}

const STAGE_COLORS: Record<DealStage, string> = {
  prospecting: 'bg-zinc-100 text-zinc-600',
  qualified: 'bg-blue-50 text-blue-700',
  proposal_sent: 'bg-violet-50 text-violet-700',
  negotiation: 'bg-amber-50 text-amber-700',
  closed_won: 'bg-emerald-50 text-emerald-700',
  closed_lost: 'bg-red-50 text-red-600',
}

export default async function DealsPage() {
  const deals = await getDeals()

  const totalARR = deals.reduce((sum, deal) => {
    const cfg = getActiveConfig(deal)
    return sum + (cfg?.economics.annualRevenue ?? 0)
  }, 0)

  const totalMRR = deals.reduce((sum, deal) => {
    const cfg = getActiveConfig(deal)
    return sum + (cfg?.economics.totalMonthlyRevenue ?? 0)
  }, 0)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Deals</h1>
        <p className="text-zinc-500 text-sm mt-1">Pipeline activo · {deals.length} deals</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">MRR Pipeline</p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono">
            {formatCurrency(totalMRR)}
          </p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">ARR Pipeline</p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono">
            {formatCurrency(totalARR)}
          </p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Deals activos</p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono">{deals.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Empresa
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Contacto
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Stage
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Plan
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                MRR
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Locales
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Owner
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {deals.map((deal) => {
              const cfg = getActiveConfig(deal)

              return (
                <tr key={deal.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="font-medium text-zinc-900">{deal.company.name}</p>
                      <p className="text-xs text-zinc-400">{deal.company.city}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-zinc-700">{deal.contact.name}</p>
                    <p className="text-xs text-zinc-400">{deal.contact.email}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[deal.stage]}`}
                    >
                      {STAGE_LABELS[deal.stage]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {cfg ? (
                      <span className="text-zinc-700 capitalize">{cfg.plan}</span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-medium text-zinc-900">
                    {cfg ? formatCurrency(cfg.economics.totalMonthlyRevenue) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right text-zinc-700">
                    {cfg?.locations ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500">{deal.owner}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/deals/${deal.id}`}
                      className="text-xs text-zinc-400 hover:text-zinc-900 font-medium transition-colors"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
