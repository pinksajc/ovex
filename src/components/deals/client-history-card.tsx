// Client history card — server component
// KPIs: total facturado / cobrado / pendiente / MRR + invoice list (date desc)

import Link from 'next/link'
import type { Invoice, InvoiceStatus } from '@/types'

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft:     'Borrador',
  issued:    'Emitida',
  paid:      'Pagada',
  overdue:   'Vencida',
  converted: 'Convertida',
}

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft:     'bg-zinc-100 text-zinc-500',
  issued:    'bg-blue-50 text-blue-700',
  paid:      'bg-emerald-50 text-emerald-700',
  overdue:   'bg-red-50 text-red-700',
  converted: 'bg-zinc-100 text-zinc-500',
}

function formatEur(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  }).format(n)
}

function formatDateShort(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  facturas: Invoice[]
  /** Label for the card — defaults to "Historial de facturación" */
  title?: string
  /** Optional MRR from active deal config */
  mrr?: number
}

export function ClientHistoryCard({ facturas, title = 'Historial de facturación', mrr }: Props) {
  // Sort by date desc
  const sorted = [...facturas].sort((a, b) => {
    const da = a.issuedAt ?? a.createdAt
    const db = b.issuedAt ?? b.createdAt
    return db.localeCompare(da)
  })

  // Totals (exclude draft + converted)
  const billed = sorted.filter((f) => f.status !== 'draft' && f.status !== 'converted')
  const totalFacturado = billed.reduce((s, f) => s + f.amountTotal, 0)
  const totalCobrado   = billed.filter((f) => f.status === 'paid').reduce((s, f) => s + f.amountTotal, 0)
  const totalPendiente = billed.filter((f) => f.status === 'issued' || f.status === 'overdue').reduce((s, f) => s + f.amountTotal, 0)

  const showMrr = mrr !== undefined && mrr > 0

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-6">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-4">
        {title}
      </h3>

      {/* KPIs */}
      <div className={`grid gap-3 mb-5 ${showMrr ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        <KpiCell label="Total facturado" value={formatEur(totalFacturado)} />
        <KpiCell label="Cobrado" value={formatEur(totalCobrado)} positive />
        <KpiCell label="Pendiente" value={formatEur(totalPendiente)} warn={totalPendiente > 0} />
        {showMrr && <KpiCell label="MRR activo" value={formatEur(mrr!)} highlight />}
      </div>

      {/* Invoice list */}
      {sorted.length > 0 ? (
        <div className="divide-y divide-zinc-50">
          {sorted.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Link
                  href={`/facturas/${f.id}`}
                  className="text-xs font-mono font-semibold text-zinc-800 hover:text-blue-700 transition-colors shrink-0"
                >
                  {f.number}
                </Link>
                <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[f.status]}`}>
                  {STATUS_LABEL[f.status]}
                </span>
                {f.concept && (
                  <span className="text-[10px] text-zinc-400 truncate hidden sm:block">
                    {f.concept}
                  </span>
                )}
              </div>
              <div className="text-right shrink-0 ml-3">
                <div className="text-xs font-mono text-zinc-700 font-semibold">{formatEur(f.amountTotal)}</div>
                <div className="text-[10px] text-zinc-400">{formatDateShort(f.issuedAt)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-400 italic">Sin facturas aún.</p>
      )}
    </div>
  )
}

function KpiCell({ label, value, positive, warn, highlight }: {
  label: string; value: string; positive?: boolean; warn?: boolean; highlight?: boolean
}) {
  const valueColor = highlight ? 'text-zinc-900'
    : positive ? 'text-emerald-600'
    : warn     ? 'text-amber-600'
    : 'text-zinc-700'
  return (
    <div className="bg-zinc-50 rounded-lg px-3 py-2.5">
      <p className="text-[10px] text-zinc-400 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold font-mono ${valueColor}`}>{value}</p>
    </div>
  )
}
