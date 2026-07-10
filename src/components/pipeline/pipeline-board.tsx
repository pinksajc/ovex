'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { formatCurrency } from '@/lib/format'
import { updateStageAction } from '@/app/actions/deals'
import type { Deal, DealStage } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PROB_COLORS: Record<number, string> = {
  0:   'bg-zinc-100 text-zinc-500',
  25:  'bg-red-50 text-red-600',
  50:  'bg-orange-50 text-orange-600',
  75:  'bg-blue-50 text-blue-700',
  100: 'bg-emerald-50 text-emerald-700',
}

const STAGE_ORDER: DealStage[] = [
  'prospecting',
  'qualified',
  'proposal_sent',
  'negotiation',
  'closed_won',
  'closed_lost',
  'rejected',
]

const STAGE_LABELS: Record<DealStage, string> = {
  prospecting:   'Prospecting',
  qualified:     'Qualified',
  proposal_sent: 'Propuesta enviada',
  negotiation:   'Negociación',
  closed_won:    'Cerrado ganado',
  closed_lost:   'Cerrado perdido',
  rejected:      'Rechazado',
}

const STAGE_COLORS: Record<DealStage, { header: string; card: string; dropzone: string }> = {
  prospecting:   { header: 'bg-zinc-100 text-zinc-600',      card: 'border-zinc-200',   dropzone: 'bg-zinc-50 ring-zinc-300' },
  qualified:     { header: 'bg-blue-50 text-blue-700',       card: 'border-blue-100',   dropzone: 'bg-blue-50/60 ring-blue-300' },
  proposal_sent: { header: 'bg-violet-50 text-violet-700',   card: 'border-violet-100', dropzone: 'bg-violet-50/60 ring-violet-300' },
  negotiation:   { header: 'bg-amber-50 text-amber-700',     card: 'border-amber-100',  dropzone: 'bg-amber-50/60 ring-amber-300' },
  closed_won:    { header: 'bg-emerald-50 text-emerald-700', card: 'border-emerald-100',dropzone: 'bg-emerald-50/60 ring-emerald-300' },
  closed_lost:   { header: 'bg-red-50 text-red-600',         card: 'border-red-100',    dropzone: 'bg-red-50/60 ring-red-300' },
  rejected:      { header: 'bg-red-100 text-red-700',        card: 'border-red-200',    dropzone: 'bg-red-50/60 ring-red-300' },
}

function matchesQuery(deal: Deal, q: string): boolean {
  const lq = q.toLowerCase()
  return (
    deal.company.name.toLowerCase().includes(lq) ||
    (deal.company.brandName?.toLowerCase().includes(lq) ?? false) ||
    deal.contact.name.toLowerCase().includes(lq)
  )
}

// ── Draggable card ────────────────────────────────────────────────────────────

function DealCard({ deal, isDragging = false }: { deal: Deal; isDragging?: boolean }) {
  const offers = deal.latestOffers ?? []

  return (
    <div
      className={`bg-white border rounded-xl p-3 transition-shadow select-none ${
        STAGE_COLORS[deal.stage].card
      } ${isDragging ? 'shadow-lg opacity-90 rotate-1' : 'hover:shadow-sm'}`}
    >
      <p className="text-sm font-medium text-zinc-900 truncate">{deal.company.name}</p>
      {deal.company.brandName && (
        <p className="text-xs text-zinc-400 truncate mt-0.5">{deal.company.brandName}</p>
      )}
      {deal.company.city && !deal.company.brandName && (
        <p className="text-xs text-zinc-400 mt-0.5">{deal.company.city}</p>
      )}
      {offers.length > 0 && (
        <div className="mt-2 space-y-1">
          {offers.map((offer, i) => (
            <div key={i} className="flex items-baseline gap-1.5 flex-wrap">
              {offer.concept && (
                <span className="text-[10px] text-zinc-400 font-medium">{offer.concept}</span>
              )}
              {offer.fixedMonthly > 0 ? (
                <span className="text-xs font-mono font-semibold text-zinc-700">
                  {formatCurrency(offer.fixedMonthly)}/mes
                </span>
              ) : offer.amountTotal > 0 ? (
                <span className="text-xs font-mono font-semibold text-zinc-700">
                  {formatCurrency(offer.amountTotal)} total
                </span>
              ) : null}
              {offer.hasVariable && (
                <span className="text-[10px] text-amber-600 font-medium">+ variable</span>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-zinc-400">{deal.owner.split(' ')[0]}</span>
        <div className="flex items-center gap-1">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PROB_COLORS[deal.closeProbability] ?? 'bg-zinc-100 text-zinc-500'}`}>
            {deal.closeProbability}%
          </span>
          {deal.commercialStatus === 'proposal_created' && (
            <span className="text-[10px] bg-zinc-900 text-white px-1.5 py-0.5 rounded-full">
              Propuesta
            </span>
          )}
          {deal.commercialStatus === 'no_config' && (
            <span className="text-[10px] text-zinc-300">Sin config</span>
          )}
        </div>
      </div>
    </div>
  )
}

function DraggableDealCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0 : 1 }
    : undefined

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-none">
      {/* Ghost placeholder while dragging — invisible but keeps layout height */}
      {isDragging ? (
        <div className={`border rounded-xl p-3 ${STAGE_COLORS[deal.stage].card} opacity-0`}>
          <p className="text-sm">{deal.company.name}</p>
        </div>
      ) : (
        // Wrap in Link only when not dragging
        <Link href={`/deals/${deal.id}`} draggable={false}>
          <DealCard deal={deal} />
        </Link>
      )}
    </div>
  )
}

// ── Droppable column ──────────────────────────────────────────────────────────

function DroppableColumn({
  stage,
  deals,
  isDragActive,
}: {
  stage: DealStage
  deals: Deal[]
  isDragActive: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const colors = STAGE_COLORS[stage]

  const stageMRR = deals.reduce(
    (sum, d) => sum + (d.latestOffers ?? []).reduce((s, o) => s + o.fixedMonthly, 0),
    0
  )

  return (
    <div className="flex-none w-64 flex flex-col gap-2">
      <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${colors.header}`}>
        <span className="text-xs font-semibold">{STAGE_LABELS[stage]}</span>
        <span className="text-xs font-mono">{deals.length}</span>
      </div>

      {stageMRR > 0 && (
        <p className="text-[11px] text-zinc-400 font-mono px-1">
          {formatCurrency(stageMRR)}/mes
        </p>
      )}

      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 min-h-[80px] rounded-xl transition-all duration-150 ${
          isDragActive
            ? isOver
              ? `ring-2 ${colors.dropzone} p-2`
              : 'p-2'
            : ''
        }`}
      >
        {deals.length === 0 && !isDragActive && (
          <p className="text-xs text-zinc-300 px-1 py-3 text-center">Sin deals</p>
        )}
        {deals.length === 0 && isDragActive && isOver && (
          <p className="text-xs text-zinc-400 px-1 py-3 text-center">Soltar aquí</p>
        )}
        {deals.map((deal) => (
          <DraggableDealCard key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  )
}

// ── Main board ────────────────────────────────────────────────────────────────

export function PipelineBoard({ deals: initialDeals }: { deals: Deal[] }) {
  const [query, setQuery] = useState('')
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null)
  const [saving, setSaving] = useState<string | null>(null)   // deal id being saved
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const filtered = query ? deals.filter((d) => matchesQuery(d, query)) : deals

  const byStage = STAGE_ORDER.reduce<Record<DealStage, Deal[]>>(
    (acc, stage) => ({ ...acc, [stage]: [] }),
    {} as Record<DealStage, Deal[]>
  )
  for (const deal of filtered) byStage[deal.stage].push(deal)

  // Draggable stages (closed_lost shown collapsed, still droppable)
  const activeStages = STAGE_ORDER.filter((s) => s !== 'closed_lost')

  function handleDragStart(event: DragStartEvent) {
    const deal = event.active.data.current?.deal as Deal | undefined
    if (deal) setActiveDeal(deal)
    setError(null)
  }

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDeal(null)
    const { active, over } = event
    if (!over) return

    const dealId = active.id as string
    const newStage = over.id as DealStage
    const deal = deals.find((d) => d.id === dealId)
    if (!deal || deal.stage === newStage) return

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d))
    )
    setSaving(dealId)

    const result = await updateStageAction(dealId, newStage)
    setSaving(null)

    if (!result.ok) {
      // Roll back
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage: deal.stage } : d))
      )
      setError(result.error ?? 'Error al actualizar el stage')
    }
  }, [deals])

  return (
    <>
      {/* Search + error */}
      <div className="mb-5 flex items-center gap-4 flex-wrap">
        <div className="relative max-w-xs">
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por empresa, marca o contacto…"
            className="w-full pl-7 pr-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-transparent bg-white placeholder:text-zinc-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        {saving && (
          <span className="text-xs text-zinc-400 animate-pulse">Guardando…</span>
        )}
        {error && (
          <span className="text-xs text-red-500">{error}</span>
        )}
      </div>

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
          {activeStages.map((stage) => (
            <DroppableColumn
              key={stage}
              stage={stage}
              deals={byStage[stage]}
              isDragActive={activeDeal !== null}
            />
          ))}

          {/* Closed lost — collapsed but droppable */}
          <ClosedLostColumn
            deals={byStage.closed_lost}
            isDragActive={activeDeal !== null}
          />
        </div>

        {/* Drag overlay — the card that follows the cursor */}
        <DragOverlay dropAnimation={null}>
          {activeDeal && <DealCard deal={activeDeal} isDragging />}
        </DragOverlay>
      </DndContext>
    </>
  )
}

// ── Closed lost (collapsed) ───────────────────────────────────────────────────

function ClosedLostColumn({ deals, isDragActive }: { deals: Deal[]; isDragActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'closed_lost' })
  const colors = STAGE_COLORS.closed_lost

  return (
    <div
      ref={setNodeRef}
      className={`flex-none w-48 flex flex-col gap-2 rounded-xl transition-all duration-150 ${
        isDragActive && isOver ? `ring-2 ${colors.dropzone} p-2` : ''
      }`}
    >
      <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${colors.header}`}>
        <span className="text-xs font-semibold">{STAGE_LABELS.closed_lost}</span>
        <span className="text-xs font-mono">{deals.length}</span>
      </div>
      {isDragActive && isOver && (
        <p className="text-xs text-zinc-400 px-1 py-2 text-center">Soltar aquí</p>
      )}
    </div>
  )
}
