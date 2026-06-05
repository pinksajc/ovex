// Deal timeline — server component
// Horizontal stepper: ●——●——● with clickable nodes for offers + invoices

import Link from 'next/link'
import type { Presupuesto, Invoice, PresupuestoStatus, InvoiceStatus } from '@/types'

const PQ_STATUS_LABEL: Record<PresupuestoStatus, string> = {
  draft:    'Borrador',
  sent:     'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired:  'Expirado',
}

// bg color for dot (inline style — avoids Tailwind purge issues with dynamic classes)
const PQ_DOT_COLOR: Record<PresupuestoStatus, string> = {
  draft:    '#a1a1aa',
  sent:     '#60a5fa',
  accepted: '#34d399',
  rejected: '#f87171',
  expired:  '#fbbf24',
}

const PQ_BADGE: Record<PresupuestoStatus, string> = {
  draft:    'bg-zinc-100 text-zinc-500',
  sent:     'bg-blue-50 text-blue-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  expired:  'bg-amber-50 text-amber-700',
}

const INV_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft:     'Borrador',
  issued:    'Emitida',
  paid:      'Pagada',
  overdue:   'Vencida',
  converted: 'Convertida',
}

const INV_DOT_COLOR: Record<InvoiceStatus, string> = {
  draft:     '#a1a1aa',
  issued:    '#60a5fa',
  paid:      '#34d399',
  overdue:   '#f87171',
  converted: '#a1a1aa',
}

const INV_BADGE: Record<InvoiceStatus, string> = {
  draft:     'bg-zinc-100 text-zinc-500',
  issued:    'bg-blue-50 text-blue-700',
  paid:      'bg-emerald-50 text-emerald-700',
  overdue:   'bg-red-50 text-red-700',
  converted: 'bg-zinc-100 text-zinc-500',
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
  | { kind: 'oferta';  data: Presupuesto; sortDate: string }
  | { kind: 'factura'; data: Invoice;     sortDate: string }

interface Props {
  presupuestos: Presupuesto[]
  facturas: Invoice[]
  /** UUID of the presupuesto currently being viewed — highlighted with a ring */
  activePresupuestoId?: string
}

export function DealTimeline({ presupuestos, facturas, activePresupuestoId }: Props) {
  const items: TimelineItem[] = [
    ...presupuestos.map((p): TimelineItem => ({ kind: 'oferta',  data: p, sortDate: p.createdAt })),
    ...facturas.map((f):    TimelineItem => ({ kind: 'factura', data: f, sortDate: f.issuedAt ?? f.createdAt })),
  ].sort((a, b) => a.sortDate.localeCompare(b.sortDate))

  if (items.length === 0) return null

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-6">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-5">
        Timeline
      </h3>

      {/* Overflow wrapper */}
      <div className="overflow-x-auto pb-1">
        {/* The stepper row: nodes separated by connector lines */}
        <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content' }}>
          {items.map((item, idx) => {
            const isFirst = idx === 0
            const isLast  = idx === items.length - 1

            if (item.kind === 'oferta') {
              const p      = item.data
              const dotClr = PQ_DOT_COLOR[p.status]
              const isActive = p.id === activePresupuestoId

              return (
                <div key={`pq-${p.id}`} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                  {/* Left connector */}
                  {!isFirst && (
                    <div style={{ width: 40, height: 1, background: '#e4e4e7', marginTop: 9, flexShrink: 0 }} />
                  )}

                  {/* Node column */}
                  <div style={{ width: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    {/* Dot row (dot + right connector stub if not last) */}
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <div style={{ flex: 1 }} /> {/* left spacer */}
                      <Link href={`/ofertas/${p.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: dotClr,
                            flexShrink: 0,
                            boxShadow: isActive ? `0 0 0 3px white, 0 0 0 5px ${dotClr}` : '0 0 0 2px white, 0 1px 3px rgba(0,0,0,0.15)',
                          }}
                        />
                      </Link>
                      <div style={{ flex: 1 }} /> {/* right spacer */}
                    </div>

                    {/* Labels */}
                    <div style={{ textAlign: 'center', marginTop: 8, width: '100%', padding: '0 4px' }}>
                      <div className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide">
                        Oferta{p.version > 1 ? ` v${p.version}` : ''}
                      </div>
                      <Link
                        href={`/ofertas/${p.id}`}
                        className="text-[11px] font-mono font-semibold text-zinc-800 hover:text-blue-700 transition-colors block truncate mt-0.5"
                        title={p.number}
                      >
                        {p.number}
                      </Link>
                      <span className={`inline-block mt-1 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${PQ_BADGE[p.status]}`}>
                        {PQ_STATUS_LABEL[p.status]}
                      </span>
                      <div className="mt-1 text-[10px] font-mono text-zinc-500">{formatEur(p.amountTotal)}</div>
                      <div className="mt-0.5 text-[9px] text-zinc-400">{formatDateShort(p.createdAt)}</div>
                    </div>
                  </div>

                  {/* Right connector (only for last node) */}
                  {isLast && false /* never */ && null}
                </div>
              )
            }

            // --- Factura node ---
            const f      = item.data
            const dotClr = INV_DOT_COLOR[f.status]

            return (
              <div key={`inv-${f.id}`} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                {/* Left connector */}
                {!isFirst && (
                  <div style={{ width: 40, height: 1, background: '#e4e4e7', marginTop: 9, flexShrink: 0 }} />
                )}

                {/* Node column */}
                <div style={{ width: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <div style={{ flex: 1 }} />
                    <Link href={`/facturas/${f.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4, /* square-ish = factura */
                          background: dotClr,
                          flexShrink: 0,
                          boxShadow: '0 0 0 2px white, 0 1px 3px rgba(0,0,0,0.15)',
                        }}
                      />
                    </Link>
                    <div style={{ flex: 1 }} />
                  </div>

                  <div style={{ textAlign: 'center', marginTop: 8, width: '100%', padding: '0 4px' }}>
                    <div className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide">
                      {f.type === 'rectificativa' ? 'Rectif.' : f.type === 'proforma' ? 'Proforma' : 'Factura'}
                    </div>
                    <Link
                      href={`/facturas/${f.id}`}
                      className="text-[11px] font-mono font-semibold text-zinc-800 hover:text-blue-700 transition-colors block truncate mt-0.5"
                      title={f.number}
                    >
                      {f.number}
                    </Link>
                    <span className={`inline-block mt-1 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${INV_BADGE[f.status]}`}>
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
