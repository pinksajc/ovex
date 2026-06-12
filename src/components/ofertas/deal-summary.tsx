import type { InvoiceLineItem } from '@/types'
import { VARIABLE_IDS, IGNORE_IDS, DEAL_TYPE_LABELS, DEAL_TYPE_COLORS } from '@/lib/deal-type'
import type { DealType } from '@/lib/deal-type'

function formatEur(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function formatEurPedido(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n)
}

interface ServiceRow {
  id: string
  description: string
  unitPrice: number
  amount: number
  quantity: number
  unit: string
  /** true when unit contains "local" → eligible for per-local breakdown */
  isPerLocal: boolean
}

function toRows(items: InvoiceLineItem[]): ServiceRow[] {
  return items.map((l) => ({
    id: l.id,
    description: l.description,
    unitPrice: l.unitPrice,
    amount: l.amount,
    quantity: l.quantity,
    unit: l.unit ?? '',
    isPerLocal: (l.unit ?? '').toLowerCase().includes('local'),
  }))
}

interface Props {
  lineItems: InvoiceLineItem[]
  dealType: DealType | null
  locationCount?: number
}

export function DealSummary({ lineItems, dealType, locationCount = 0 }: Props) {
  if (!dealType) return null

  const serviceLines = lineItems.filter(
    (l) => l.type === 'line' && !IGNORE_IDS.has(l.serviceId ?? ''),
  )
  const fixedLines    = toRows(serviceLines.filter((l) => !VARIABLE_IDS.has(l.serviceId ?? '')))
  const variableLines = toRows(serviceLines.filter((l) =>  VARIABLE_IDS.has(l.serviceId ?? '')))

  if (fixedLines.length === 0 && variableLines.length === 0) return null

  const totalFixed   = fixedLines.reduce((s, l) => s + l.amount, 0)
  const feePerOrder  = variableLines.reduce((s, l) => s + l.unitPrice, 0)
  const totalVarEst  = variableLines.reduce((s, l) => s + l.amount, 0)

  const isMixed    = dealType === 'mixed'
  const showLocales = locationCount > 0

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
          Resumen del acuerdo
        </h2>
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${DEAL_TYPE_COLORS[dealType]}`}>
          {DEAL_TYPE_LABELS[dealType]}
        </span>
        {showLocales && (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
            {locationCount} {locationCount === 1 ? 'local' : 'locales'}
          </span>
        )}
      </div>

      {/* Body */}
      <div className={`grid gap-6 ${isMixed ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* ── Fixed block ────────────────────────────────────────────── */}
        {fixedLines.length > 0 && (
          <div>
            {isMixed && (
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2.5">
                Parte fija
              </p>
            )}
            <div className="space-y-2">
              {fixedLines.map((l) => {
                const showBreakdown = l.isPerLocal && l.quantity > 1
                return (
                  <div key={l.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-zinc-700 truncate">{l.description}</span>
                      <span className="text-xs font-mono text-zinc-900 shrink-0 tabular-nums">
                        {formatEur(l.amount)}<span className="text-zinc-400">/mes</span>
                      </span>
                    </div>
                    {showBreakdown && (
                      <p className="text-[10px] text-zinc-400 mt-0.5 text-right">
                        {formatEur(l.unitPrice)}/local × {l.quantity} locales
                      </p>
                    )}
                  </div>
                )
              })}
              <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-zinc-100">
                <span className="text-xs font-semibold text-zinc-700">Total fijo</span>
                <span className="text-xs font-mono font-semibold text-zinc-900 tabular-nums">
                  {formatEur(totalFixed)}<span className="text-zinc-500 font-normal">/mes</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Variable block ──────────────────────────────────────────── */}
        {variableLines.length > 0 && (
          <div>
            {isMixed && (
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2.5">
                Parte variable
              </p>
            )}
            <div className="space-y-1.5">
              {variableLines.map((l) => (
                <div key={l.id} className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-zinc-700 truncate">{l.description}</span>
                  <span className="text-xs font-mono text-zinc-900 shrink-0 tabular-nums">
                    {formatEurPedido(l.unitPrice)}<span className="text-zinc-400">/pedido</span>
                  </span>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-zinc-100">
                <span className="text-xs font-semibold text-zinc-700">Fee variable</span>
                <span className="text-xs font-mono font-semibold text-zinc-900 tabular-nums">
                  {formatEurPedido(feePerOrder)}<span className="text-zinc-500 font-normal">/pedido</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Summary totals (Mixto only) ────────────────────────────────── */}
      {isMixed && (
        <div className="mt-4 pt-4 border-t border-zinc-100 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-zinc-500">Cuota fija mensual</span>
            <span className="text-xs font-mono text-zinc-800 tabular-nums">
              {formatEur(totalFixed)}<span className="text-zinc-400">/mes</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-zinc-500">Fee variable</span>
            <span className="text-xs font-mono text-zinc-800 tabular-nums">
              {formatEurPedido(feePerOrder)}<span className="text-zinc-400">/pedido</span>
            </span>
          </div>
          {totalVarEst > 0 && (
            <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-zinc-100">
              <span className="text-xs font-semibold text-zinc-700">
                Total estimado mensual
                <span className="ml-1 text-[10px] font-normal text-zinc-400">(según volumen oferta)</span>
              </span>
              <span className="text-sm font-mono font-semibold text-zinc-900 tabular-nums">
                {formatEur(totalFixed + totalVarEst)}<span className="text-zinc-500 font-normal text-xs">/mes</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
