// Deal timeline — server component
// Horizontal stepper: ●——●——● guaranteed row layout

import Link from 'next/link'
import type { Presupuesto, Invoice, PresupuestoStatus, InvoiceStatus } from '@/types'
import type { ApprovalEventDisplay } from '@/lib/supabase/events'

const PQ_STATUS_LABEL: Record<PresupuestoStatus, string> = {
  draft: 'Borrador', sent: 'Enviado', accepted: 'Aceptado', rejected: 'Rechazado', expired: 'Expirado',
}
const PQ_DOT_COLOR: Record<PresupuestoStatus, string> = {
  draft: '#d4d4d8', sent: '#93c5fd', accepted: '#6ee7b7', rejected: '#fca5a5', expired: '#fcd34d',
}
const INV_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Borrador', issued: 'Emitida', paid: 'Pagada', overdue: 'Vencida', converted: 'Convertida',
}
const INV_DOT_COLOR: Record<InvoiceStatus, string> = {
  draft: '#d4d4d8', issued: '#93c5fd', paid: '#6ee7b7', overdue: '#fca5a5', converted: '#d4d4d8',
}
const BADGE_CLASS: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-500',
  sent: 'bg-blue-50 text-blue-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  expired: 'bg-amber-50 text-amber-700',
  issued: 'bg-blue-50 text-blue-700',
  paid: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-red-50 text-red-700',
  converted: 'bg-zinc-100 text-zinc-500',
}

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}
function dateShort(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
}

type TItem =
  | { kind: 'oferta';  data: Presupuesto; sortDate: string }
  | { kind: 'factura'; data: Invoice;     sortDate: string }

export function DealTimeline({
  presupuestos,
  facturas,
  activePresupuestoId,
  approvalEvents = [],
}: {
  presupuestos: Presupuesto[]
  facturas: Invoice[]
  activePresupuestoId?: string
  approvalEvents?: ApprovalEventDisplay[]
}) {
  const items: TItem[] = [
    ...presupuestos.map((p): TItem => ({ kind: 'oferta',  data: p, sortDate: p.createdAt })),
    ...facturas.map((f):    TItem => ({ kind: 'factura', data: f, sortDate: f.issuedAt ?? f.createdAt })),
  ].sort((a, b) => a.sortDate.localeCompare(b.sortDate))

  if (items.length === 0 && approvalEvents.length === 0) return null

  return (
    <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: '20px 20px 20px 20px', marginBottom: 24 }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20, margin: '0 0 20px 0' }}>
        Timeline
      </p>

      {/* Outer scroll wrapper */}
      <div style={{ overflowX: items.length > 5 ? 'auto' : 'visible' }}>
        {/* THE STEPPER ROW — alternates node / connector / node */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          minWidth: items.length > 5 ? `${items.length * 180}px` : undefined,
        }}>
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1

            /* ── OFERTA NODE ── */
            if (item.kind === 'oferta') {
              const p = item.data
              const isActive = p.id === activePresupuestoId
              const dotColor = isActive ? '#1e3a5f' : PQ_DOT_COLOR[p.status]
              const href = `/ofertas/${p.id}`
              const statusLabel = PQ_STATUS_LABEL[p.status]
              const badgeCls = BADGE_CLASS[p.status] ?? 'bg-zinc-100 text-zinc-500'
              const typeLabel = `Oferta${p.version > 1 ? ` v${p.version}` : ''}`

              return (
                <NodeAndConnector key={`pq-${p.id}`} isLast={isLast}>
                  <DotCircle href={href} dotColor={dotColor} isActive={isActive} />
                  <NodeLabels
                    href={href}
                    typeLabel={typeLabel}
                    number={p.number}
                    statusLabel={statusLabel}
                    badgeCls={badgeCls}
                    amount={eur(p.amountTotal)}
                    date={dateShort(p.createdAt)}
                    isActive={isActive}
                  />
                </NodeAndConnector>
              )
            }

            /* ── FACTURA NODE ── */
            const f = item.data
            const dotColor = INV_DOT_COLOR[f.status]
            const href = `/facturas/${f.id}`
            const statusLabel = INV_STATUS_LABEL[f.status]
            const badgeCls = BADGE_CLASS[f.status] ?? 'bg-zinc-100 text-zinc-500'
            const typeLabel = f.type === 'rectificativa' ? 'Rectificativa' : f.type === 'proforma' ? 'Proforma' : 'Factura'

            return (
              <NodeAndConnector key={`inv-${f.id}`} isLast={isLast}>
                <DotSquare href={href} dotColor={dotColor} />
                <NodeLabels
                  href={href}
                  typeLabel={typeLabel}
                  number={f.number}
                  statusLabel={statusLabel}
                  badgeCls={badgeCls}
                  amount={eur(f.amountTotal)}
                  date={dateShort(f.issuedAt)}
                  isActive={false}
                />
              </NodeAndConnector>
            )
          })}
        </div>
      </div>

      {/* ── Approval events feed ── */}
      {approvalEvents.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f4f4f5' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Aprobaciones
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {approvalEvents.map((ev) => {
              const cfg = APPROVAL_EVENT_CONFIG[ev.eventType]
              const timeStr = new Date(ev.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
              return (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {/* Icon */}
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                    background: cfg.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {cfg.icon}
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: '#27272a', margin: 0, lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 600 }}>{ev.documentNumber}</span>
                      {' '}
                      <span style={{ color: cfg.color }}>{cfg.label}</span>
                      {ev.actor && (
                        <span style={{ color: '#71717a' }}> · {ev.actor}</span>
                      )}
                    </p>
                    {ev.notes && (
                      <p style={{ fontSize: 11, color: '#71717a', margin: '2px 0 0 0', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        &ldquo;{ev.notes}&rdquo;
                      </p>
                    )}
                  </div>
                  {/* Date */}
                  <span style={{ fontSize: 10, color: '#a1a1aa', flexShrink: 0, fontFamily: 'monospace', marginTop: 2 }}>{timeStr}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Approval event config ── */

const APPROVAL_EVENT_CONFIG: Record<
  ApprovalEventDisplay['eventType'],
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  approval_pending: {
    label: 'pendiente de aprobación',
    color: '#71717a',
    bg: '#f4f4f5',
    icon: (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="5" r="3.5" stroke="#a1a1aa" strokeWidth="1.5" />
        <path d="M5 3v2.5l1.5 1" stroke="#a1a1aa" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    ),
  },
  approval_approved: {
    label: 'aprobada',
    color: '#16a34a',
    bg: '#dcfce7',
    icon: (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 5l2.5 2.5 4-4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  approval_rejected: {
    label: 'rechazada',
    color: '#dc2626',
    bg: '#fee2e2',
    icon: (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M3 3l4 4M7 3l-4 4" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  approval_changes_requested: {
    label: 'cambios solicitados',
    color: '#d97706',
    bg: '#fef3c7',
    icon: (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 5h6M6 3l2 2-2 2" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
}

/* ── Sub-components ── */

function NodeAndConnector({ children, isLast }: { children: React.ReactNode; isLast: boolean }) {
  return (
    <>
      {/* Node: fixed min-width, centered column */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: 140,
        flex: '0 0 140px',
      }}>
        {children}
      </div>

      {/* Connector line — sits at same vertical level as the dot (dot is 20px tall, margin-top ~0) */}
      {!isLast && (
        <div style={{
          flex: 1,
          minWidth: 24,
          borderTop: '2px solid #e5e7eb',
          marginTop: 10, /* half of dot height (20px / 2 = 10) */
          alignSelf: 'flex-start',
        }} />
      )}
    </>
  )
}

function DotCircle({ href, dotColor, isActive }: { href: string; dotColor: string; isActive: boolean }) {
  return (
    <Link href={href} style={{ display: 'block', marginBottom: 8 }}>
      <div style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: isActive ? dotColor : 'transparent',
        border: isActive ? `none` : `2.5px solid ${dotColor === '#d4d4d8' ? '#a1a1aa' : dotColor}`,
        boxSizing: 'border-box',
        transition: 'box-shadow 0.1s',
      }} />
    </Link>
  )
}

function DotSquare({ href, dotColor }: { href: string; dotColor: string }) {
  return (
    <Link href={href} style={{ display: 'block', marginBottom: 8 }}>
      <div style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        background: 'transparent',
        border: `2.5px solid ${dotColor === '#d4d4d8' ? '#a1a1aa' : dotColor}`,
        boxSizing: 'border-box',
      }} />
    </Link>
  )
}

function NodeLabels({
  href, typeLabel, number, statusLabel, badgeCls, amount, date, isActive,
}: {
  href: string
  typeLabel: string
  number: string
  statusLabel: string
  badgeCls: string
  amount: string
  date: string
  isActive: boolean
}) {
  return (
    <div style={{ textAlign: 'center', width: '100%', padding: '0 6px' }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
        {typeLabel}
      </div>
      <Link
        href={href}
        style={{
          display: 'block',
          fontSize: 11,
          fontFamily: 'monospace',
          fontWeight: isActive ? 700 : 600,
          color: isActive ? '#1e3a5f' : '#27272a',
          textDecoration: 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={number}
      >
        {number}
      </Link>
      <span className={`inline-block mt-1 ${badgeCls}`} style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 6px', borderRadius: 999 }}>
        {statusLabel}
      </span>
      <div style={{ marginTop: 4, fontSize: 10, fontFamily: 'monospace', color: '#71717a' }}>{amount}</div>
      <div style={{ marginTop: 2, fontSize: 9, color: '#a1a1aa' }}>{date}</div>
    </div>
  )
}
