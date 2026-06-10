'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createPresupuestoAction } from '@/app/actions/presupuestos'
import { SERVICES, SERVICE_MAP, SERVICE_GROUPS } from '@/lib/invoice-catalog'
import type { InvoiceLineItem, DiscountMode } from '@/types'

// ---- helpers ----

function newLineId() {
  return Math.random().toString(36).slice(2)
}

type FormLine = InvoiceLineItem & { serviceId: string; unit: string }

function emptyLine(): FormLine {
  return { id: newLineId(), type: 'line', description: '', quantity: 1, unitPrice: 0, amount: 0, serviceId: '', unit: '' }
}

function fmtNum(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function computeDiscountAmount(item: FormLine, subtotal: number): number {
  if (item.type !== 'discount') return item.amount
  if (item.discountMode === 'percent') return -(subtotal * (item.discountValue ?? 0)) / 100
  return -(item.discountValue ?? 0)
}

interface DealOption {
  id: string
  company: { name: string; cif?: string; address?: string }
}

interface Props {
  deals: DealOption[]
  preselectedDealId?: string
}

export function NuevaOfertaForm({ deals, preselectedDealId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const preselected = preselectedDealId ? deals.find((d) => d.id === preselectedDealId) : undefined

  const [dealId, setDealId] = useState(preselected?.id ?? '')
  const [clientName, setClientName] = useState(preselected?.company.name ?? '')
  const [clientCif, setClientCif] = useState(preselected?.company.cif ?? '')
  const [clientAddress, setClientAddress] = useState(preselected?.company.address ?? '')
  const [vatRate, setVatRate] = useState('21')
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<FormLine[]>([emptyLine()])

  // ---- computed totals ----
  const regularLines = lines.filter((l) => l.type === 'line')
  const subtotal = regularLines.reduce((s, l) => s + l.amount, 0)
  const discountLines = lines.filter((l) => l.type === 'discount')
  const discountTotal = discountLines.reduce((s, l) => s + computeDiscountAmount(l, subtotal), 0)
  const base = subtotal + discountTotal
  const vat = parseFloat(vatRate) || 21
  const vatAmount = base * (vat / 100)
  const total = base + vatAmount

  // ---- line mutators ----
  const updateLine = useCallback((id: string, patch: Partial<FormLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const merged = { ...l, ...patch }
        if (merged.type === 'line') {
          const dto = merged.lineDiscountPercent ?? 0
          merged.amount = merged.quantity * merged.unitPrice * (1 - dto / 100)
        }
        return merged
      })
    )
  }, [])

  function addLine() { setLines((p) => [...p, emptyLine()]) }
  function removeLine(id: string) {
    setLines((p) => { const n = p.filter((l) => l.id !== id); return n.length === 0 ? [emptyLine()] : n })
  }

  function handleDealSelect(id: string) {
    setDealId(id)
    if (!id) return
    const deal = deals.find((d) => d.id === id)
    if (!deal) return
    setClientName(deal.company.name)
    setClientCif(deal.company.cif ?? '')
    setClientAddress(deal.company.address ?? '')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!clientName.trim()) return setError('El nombre del cliente es obligatorio.')
    const filledLines = lines.filter((l) => l.type === 'line' && l.description.trim())
    if (filledLines.length === 0) return setError('Añade al menos una línea con descripción.')
    if (base <= 0) return setError('La base imponible debe ser mayor que 0.')

    const concept = filledLines.length === 1 ? filledLines[0].description.trim() : 'Varios conceptos'

    const finalLines: InvoiceLineItem[] = lines.map((l) => ({
      id: l.id,
      type: l.type,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.type === 'discount' ? computeDiscountAmount(l, subtotal) : l.amount,
      discountMode: l.discountMode,
      discountValue: l.discountValue,
      serviceId: l.serviceId || undefined,
      unit: l.unit || undefined,
      period: l.period || undefined,
      lineDiscountPercent: l.lineDiscountPercent || undefined,
      discountName: l.discountName || undefined,
    }))

    startTransition(async () => {
      const result = await createPresupuestoAction({
        dealId: dealId || null,
        clientName: clientName.trim(),
        clientCif: clientCif.trim() || null,
        clientAddress: clientAddress.trim() || null,
        concept,
        lineItems: finalLines,
        amountNet: base,
        vatRate: vat,
        amountTotal: total,
        validUntil: validUntil || null,
        notes: notes.trim() || null,
      })
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-danger/8 border border-danger/20 rounded-lg px-5 py-4 text-[13px] text-danger">{error}</div>
      )}

      {/* Cliente */}
      <div className="bg-surface border border-border-subtle rounded-lg p-5 space-y-4">
        <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">Datos del cliente</h2>
        {deals.length > 0 && (
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1">Autocompletar desde deal</label>
            <select
              value={dealId}
              onChange={(e) => handleDealSelect(e.target.value)}
              className="w-full border border-border-subtle rounded-[6px] px-3 h-9 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/40 bg-base text-text-primary"
            >
              <option value="">— Selecciona un deal (opcional) —</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.company.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-[13px] font-medium text-text-secondary mb-1">
            Nombre / Razón social <span className="text-danger">*</span>
          </label>
          <input
            type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)}
            placeholder="Empresa S.L."
            className="w-full border border-border-subtle rounded-[6px] px-3 h-9 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/40 bg-base text-text-primary placeholder:text-text-tertiary"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1">CIF / NIF</label>
            <input type="text" value={clientCif} onChange={(e) => setClientCif(e.target.value)}
              placeholder="B12345678"
              className="w-full border border-border-subtle rounded-[6px] px-3 h-9 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/40 bg-base text-text-primary placeholder:text-text-tertiary" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1">Dirección fiscal</label>
            <input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)}
              placeholder="C/ Ejemplo 1, Madrid"
              className="w-full border border-border-subtle rounded-[6px] px-3 h-9 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/40 bg-base text-text-primary placeholder:text-text-tertiary" />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle">
          <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">Líneas</h2>
        </div>
        <div className="divide-y divide-border-subtle">
          {lines.map((line) => (
            <RegularLineRow
              key={line.id}
              line={line}
              onChange={updateLine}
              onRemove={removeLine}
              canRemove={lines.length > 1}
            />
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border-subtle flex items-center gap-3">
          <button type="button" onClick={addLine}
            className="text-[13px] text-text-tertiary hover:text-text-primary border border-border-subtle hover:border-border-strong px-3 h-8 rounded-[6px] transition-colors duration-150">
            ＋ Añadir línea
          </button>
        </div>

        {/* Totals */}
        <div className="border-t border-border-subtle px-5 py-4 space-y-1.5">
          <TotalsRow label="Subtotal" value={fmtNum(subtotal)} />
          {discountTotal < 0 && <TotalsRow label="Descuentos" value={fmtNum(discountTotal)} red />}
          <TotalsRow label="Base imponible" value={fmtNum(base)} />
          <div className="flex items-center gap-2 justify-end">
            <span className="text-[13px] text-text-tertiary">IVA</span>
            <input
              type="number" min="0" max="100" step="0.1" value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className="w-16 border border-border-subtle rounded-[4px] px-2 py-1 text-[13px] font-mono text-right focus:outline-none focus:ring-1 focus:ring-accent/40 bg-base text-text-primary"
            />
            <span className="text-[13px] text-text-tertiary">%</span>
            <span className="text-[13px] font-mono w-28 text-right text-text-secondary">{fmtNum(vatAmount)} €</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            <span className="text-[14px] font-semibold text-text-secondary">Total oferta</span>
            <span className="text-[18px] font-mono font-semibold text-text-primary">{fmtNum(total)} €</span>
          </div>
        </div>
      </div>

      {/* Fechas + Notas */}
      <div className="bg-surface border border-border-subtle rounded-lg p-5 space-y-4">
        <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">Validez y notas</h2>
        <div>
          <label className="block text-[13px] font-medium text-text-secondary mb-1">Válido hasta</label>
          <input
            type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
            className="w-full border border-border-subtle rounded-[6px] px-3 h-9 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/40 bg-base text-text-secondary"
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-text-secondary mb-1">Notas internas (opcional)</label>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Condiciones especiales, notas de contexto, términos adicionales…"
            rows={3}
            className="w-full border border-border-subtle rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/40 bg-base text-text-primary placeholder:text-text-tertiary resize-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={() => router.back()}
          className="px-4 h-9 text-[13px] text-text-secondary hover:text-text-primary border border-border-subtle hover:border-border-strong rounded-[6px] transition-colors duration-150">
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          className="px-5 h-9 text-[13px] font-medium bg-accent text-base hover:bg-accent-hover rounded-[6px] transition-colors duration-150 disabled:opacity-50">
          {isPending ? 'Guardando...' : 'Guardar oferta'}
        </button>
      </div>
    </form>
  )
}

// =========================================
// RegularLineRow
// =========================================

function RegularLineRow({ line, onChange, onRemove, canRemove }: {
  line: FormLine
  onChange: (id: string, patch: Partial<FormLine>) => void
  onRemove: (id: string) => void
  canRemove: boolean
}) {
  const svc = line.serviceId ? SERVICE_MAP.get(line.serviceId) : undefined
  const isCustom = svc?.custom === true
  const priceEditable = !svc || svc.priceEditable === true
  const qtyLabel = svc?.qtyUnit ?? (line.unit ? line.unit.split('/')[0] : 'uds')
  const dto = line.lineDiscountPercent ?? 0
  const originalAmount = line.quantity * line.unitPrice

  function handleServiceSelect(serviceId: string) {
    if (!serviceId) { onChange(line.id, { serviceId: '', description: '', unit: '', unitPrice: 0, amount: 0 }); return }
    const item = SERVICE_MAP.get(serviceId)
    if (!item) return
    const qty = line.quantity || 1
    onChange(line.id, { serviceId, description: item.custom ? '' : item.label, unit: item.unit, unitPrice: item.defaultPrice, amount: qty * item.defaultPrice })
  }

  return (
    <div className="px-5 py-3 space-y-2">
      {/* Row 1: service + qty + price + dto% + importe + delete */}
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 60px 100px 28px' }}>
        <select value={line.serviceId} onChange={(e) => handleServiceSelect(e.target.value)}
          className="border border-border-subtle rounded-[4px] px-2 py-1.5 text-[13px] bg-base focus:outline-none focus:ring-1 focus:ring-accent/40 w-full text-text-primary">
          <option value="">— Selecciona servicio —</option>
          {SERVICE_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {SERVICES.filter((s) => s.group === group).map((s) => (
                <option key={s.id} value={s.id}>{s.label}{s.note ? ` (${s.note})` : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>

        <input type="number" min="0" step="any" value={line.quantity || ''} placeholder={qtyLabel}
          onChange={(e) => onChange(line.id, { quantity: parseFloat(e.target.value) || 0 })}
          className="border border-border-subtle rounded-[4px] px-2 py-1.5 text-[13px] font-mono text-right focus:outline-none focus:ring-1 focus:ring-accent/40 w-full bg-base text-text-primary" />

        <input type="number" min="0" step="0.01" value={line.unitPrice}
          onChange={(e) => { const p = parseFloat(e.target.value) || 0; onChange(line.id, { unitPrice: p }) }}
          className={`border rounded-[4px] px-2 py-1.5 text-[13px] font-mono text-right focus:outline-none focus:ring-1 w-full bg-base text-text-primary ${priceEditable && line.unitPrice === 0 && line.serviceId ? 'border-warning/40 focus:ring-warning/40' : 'border-border-subtle focus:ring-accent/40'}`} />

        {/* Dto. % */}
        <div className="relative">
          <input type="number" min="0" max="100" step="0.1" value={dto || ''} placeholder="0"
            onChange={(e) => {
              const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
              onChange(line.id, { lineDiscountPercent: val || undefined })
            }}
            className="border border-border-subtle rounded-[4px] px-2 py-1.5 text-[13px] font-mono text-right focus:outline-none focus:ring-1 focus:ring-accent/40 w-full pr-5 bg-base text-text-primary" />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-tertiary pointer-events-none">%</span>
        </div>

        {/* Importe */}
        <div className="text-right pr-1">
          {dto > 0 ? (
            <>
              <div className="text-[11px] font-mono text-text-disabled line-through leading-tight">
                {originalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </div>
              <div className="text-[13px] font-mono font-semibold text-success leading-tight">
                {line.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </div>
            </>
          ) : (
            <span className="text-[13px] font-mono text-text-primary">
              {line.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
            </span>
          )}
        </div>

        {canRemove
          ? <button type="button" onClick={() => onRemove(line.id)} className="text-text-disabled hover:text-danger transition-colors text-base leading-none">×</button>
          : <span />}
      </div>

      {/* Row 2: custom description */}
      {line.serviceId && isCustom && (
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 60px 100px 28px' }}>
          <input type="text" value={line.description} onChange={(e) => onChange(line.id, { description: e.target.value })}
            placeholder="Descripción personalizada"
            className="border border-border-subtle rounded-[4px] px-2 py-1 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40 w-full bg-base" />
          <input type="text" value={line.unit} onChange={(e) => onChange(line.id, { unit: e.target.value })}
            placeholder="unidad"
            className="border border-border-subtle rounded-[4px] px-2 py-1 text-[11px] text-center text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/40 w-full bg-base" />
          {svc?.note && <div className="text-[11px] text-warning text-right truncate">{svc.note}</div>}
        </div>
      )}

      {/* Row 3: Período */}
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 60px 100px 28px' }}>
        <input type="text" value={line.period ?? ''} onChange={(e) => onChange(line.id, { period: e.target.value || undefined })}
          placeholder="Período (ej: Enero - Marzo 2026)"
          className="border border-border-subtle rounded-[4px] px-2 py-1 text-[11px] text-text-tertiary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-accent/40 w-full bg-hover" />
      </div>

      {/* Row 4: Nombre del descuento (only when dto > 0) */}
      {dto > 0 && (
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 60px 100px 28px' }}>
          <input type="text" value={line.discountName ?? ''} onChange={(e) => onChange(line.id, { discountName: e.target.value || undefined })}
            placeholder="Nombre del descuento (ej: CORE PARTNER DISCOUNT)"
            className="border border-border-subtle rounded-[4px] px-2 py-1 text-[11px] text-success placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-accent/40 w-full bg-hover col-span-4" />
        </div>
      )}
    </div>
  )
}

function TotalsRow({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[13px] ${red ? 'text-danger' : 'text-text-tertiary'}`}>{label}</span>
      <span className={`text-[13px] font-mono ${red ? 'text-danger font-semibold' : 'text-text-secondary'}`}>{value} €</span>
    </div>
  )
}
