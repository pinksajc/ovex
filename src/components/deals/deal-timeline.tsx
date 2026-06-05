// Deal timeline — server component
// Shows a horizontal stepper of all offers + invoices linked to a deal,
// sorted by createdAt/issuedAt. Scrollable if > 6 items.

import Link from 'next/link'
import type { Presupuesto, Invoice, PresupuestoStatus, InvoiceStatus } from '@/types'

const PQ_STATUS_LABEL: Record<PresupuestoStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Expirado',
}

const PQ_STATUS_COLOR: Record<PresupuestoStatus, { dot: string; badge: string }> = {
  draft:    { dot: 'bg-zinc-300',     badge: 'bg-zinc-100 text-zinc-500' },
  sent:     { dot: 'bg-blue-400',     badge: 'bg-blue-50 text-blue-700' },
  accepted: { dot: 'bg-emerald-400',  badge: 'bg-emerald-50 text-emerald-700' },
  rejected: { dot: 'bg-red-400',      badge: 'bg-red-50 text-red-700' },
  expired:  { dot: 'bg-amber-400',    badge: 'bg-amber-50 text-amber-700' },
}

const INV_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft:     'Borrador',
  issued:    'Emitida',
  paid:      'Pagada',
  overdue:   'Vencida',
  converted: 'Convertida',
}

const INV_STATUS_COLOR: Record<InvoiceStatus, { dot: string; badge: string }> = {
  draft:     { dot: 'bg-zinc-300',    badge: 'bg-zinc-100 text-zinc-500' },
  issued:    { dot: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-700' },
  paid:      { dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700' },
  overdue:   { dot: 'bg-red-400',     badge: 'bg-red-50 text-red-700' },
  converted: { dot: 'bg-zinc-300',    badge: 'bg-zinc-100 text-zinc-500' },
}

function formatEur(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function formatDateShort(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
}

type TimelineItem =
  | { kind: 'oferta'; data: Presupuesto; sortDate: string }
  | { kind: 'factura'; data: Invoice; sortDate: string }

interface Props {
  presupuestos: Presupuesto[]
  facturas: Invoice[]
}

export function DealTimeline({ presupuestos, facturas }: Props) {
  const items: TimelineItem[] = [
    ...presupuestos.map((p): TimelineItem => ({ kind: 'oferta', data: p, sortDate: p.createdAt })),
    ...facturas.map((f): TimelineItem => ({ kind: 'factura', data: f, sortDate: f.issuedAt ?? f.createdAt })),
  ].sort((a, b) => a.sortDate.localeCompare(b.sortDate))

  if (items.length === 0) return null

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-6">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-4">
        Timeline
      </h3>

      {/* Horizontal scroll container */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex items-start gap-0 min-w-max">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1

            if (item.kind === 'oferta') {
              const p = item.data
              const colors = PQ_STATUS_COLOR[p.status]
              return (
                <div key={`pq-${p.id}`} className="flex items-start">
                  {/* Node */}
                  <div className="flex flex-col items-center w-32">
                    {/* Dot + line */}
                    <div className="flex items-center w-full">
                      <div className="flex-1 h-px bg-zinc-200" style={{ visibility: idx === 0 ? 'hidden' : 'visible' }} />
                      <div className={`w-3 h-3 rounded-full shrink-0 border-2 border-white ring-2 ${colors.dot} ring-${colors.dot.replace('bg-', '')} shadow-sm`} />
                      <div className="flex-1 h-px bg-zinc-200" style={{ visibility: isLast ? 'hidden' : 'visible' }} />
                    </div>
                    {/* Card */}
                    <div className="mt-2 w-full text-center px-1">
                      <div className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide mb-0.5">
                        Oferta
                        {p.version > 1 && <span className="ml-1 text-violet-500">v{p.version}</span>}
                      </div>
                      <Link
                        href={`/ofertas/${p.id}`}
                        className="text-[11px] font-mono font-semibold text-zinc-800 hover:text-blue-700 transition-colors truncate block"
                        title={p.number}
                      >
                        {p.number}
                      </Link>
                      <span className={`inline-block mt-1 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${colors.badge}`}>
                        {PQ_STATUS_LABEL[p.status]}
                      </span>
                      <div className="mt-1 text-[10px] font-mono text-zinc-500">{formatEur(p.amountTotal)}</div>
                      <div className="mt-0.5 text-[9px] text-zinc-400">{formatDateShort(p.createdAt)}</div>
                    </div>
                  </div>
                </div>
              )
            }

            // factura
            const f = item.data
            const colors = INV_STATUS_COLOR[f.status]
            return (
              <div key={`inv-${f.id}`} className="flex items-start">
                <div className="flex flex-col items-center w-32">
                  <div className="flex items-center w-full">
                    <div className="flex-1 h-px bg-zinc-200" style={{ visibility: idx === 0 ? 'hidden' : 'visible' }} />
                    <div className={`w-3 h-3 rounded-full shrink-0 border-2 border-white ring-2 ${colors.dot} shadow-sm`} />
                    <div className="flex-1 h-px bg-zinc-200" style={{ visibility: isLast ? 'hidden' : 'visible' }} />
                  </div>
                  <div className="mt-2 w-full text-center px-1">
                    <div className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide mb-0.5">
                      {f.type === 'rectificativa' ? 'Rectif.' : f.type === 'proforma' ? 'Proforma' : 'Factura'}
                    </div>
                    <Link
                      href={`/facturas/${f.id}`}
                      className="text-[11px] font-mono font-semibold text-zinc-800 hover:text-blue-700 transition-colors truncate block"
                      title={f.number}
                    >
                      {f.number}
                    </Link>
                    <span className={`inline-block mt-1 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${colors.badge}`}>
                      {INV_STATUS_LABEL[f.status]}
                    </span>
                    <div className="mt-1 text-[10px] font-mono text-zinc-500">{formatEur(f.amountTotal)}</div>
                    <div className="mt-0.5 text-[9px] text-zinc-400">{formatDateShort(f.issuedAt)}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
