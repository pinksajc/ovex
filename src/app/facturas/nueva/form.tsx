'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createInvoiceAction } from '@/app/actions/invoices'
import { SERVICES, SERVICE_MAP, SERVICE_GROUPS } from '@/lib/invoice-catalog'
import { DELIVERY_PLANS } from '@/lib/pricing/catalog'
import type { InvoiceType, InvoiceLineItem, DiscountMode } from '@/types'

// ---- helpers ----

function newLineId() {
  return Math.random().toString(36).slice(2)
}

function emptyLine(): InvoiceLineItem & { serviceId: string; unit: string } {
  return {
    id: newLineId(),
    type: 'line',
    description: '',
    quantity: 1,
    unitPrice: 0,
    amount: 0,
    serviceId: '',
    unit: '',
  }
}

function emptyDiscount(): InvoiceLineItem & { serviceId: string; unit: string } {
  return {
    id: newLineId(),
    type: 'discount',
    description: 'Descuento',
    quantity: 1,
    unitPrice: 0,
    amount: 0,
    discountMode: 'percent',
    discountValue: 0,
    serviceId: '',
    unit: '',
  }
}

function fmtNum(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function computeDiscountAmount(item: FormLine, subtotal: number): number {
  if (item.type !== 'discount') return item.amount
  if (item.discountMode === 'percent') {
    return -(subtotal * (item.discountValue ?? 0)) / 100
  }
  return -(item.discountValue ?? 0)
}

// ---- extended line type (UI only) ----

type FormLine = InvoiceLineItem & { serviceId: string; unit: string }

// ---- types ----

interface DealOption {
  id: string
  company: { name: string; cif?: string; address?: string }
}

interface Props {
  deals: DealOption[]
  initialDealId?: string
  initialClientName?: string
  initialClientCif?: string
  initialClientAddress?: string
}

// ---- component ----

export function NewInvoiceForm({
  deals,
  initialDealId,
  initialClientName,
  initialClientCif,
  initialClientAddress,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Header fields
  const [type, setType] = useState<InvoiceType>('ordinary')
  const [dealId, setDealId] = useState(initialDealId ?? '')
  const [clientName, setClientName] = useState(initialClientName ?? '')
  const [clientCif, setClientCif] = useState(initialClientCif ?? '')
  const [clientAddress, setClientAddress] = useState(initialClientAddress ?? '')
  const [vatRate, setVatRate] = useState('21')
  const [issuedAt, setIssuedAt] = useState(() => new Date().toISOString().split('T')[0])
  const [dueAt, setDueAt] = useState('')
  const [rectifiesId, setRectifiesId] = useState('')

  // Line items
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

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function addDiscount() {
    setLines((prev) => [...prev, emptyDiscount()])
  }

  function removeLine(id: string) {
    setLines((prev) => {
      const next = prev.filter((l) => l.id !== id)
      return next.length === 0 ? [emptyLine()] : next
    })
  }

  // ---- deal autocomplete ----
  function handleDealSelect(id: string) {
    setDealId(id)
    if (!id) return
    const deal = deals.find((d) => d.id === id)
    if (!deal) return
    setClientName(deal.company.name)
    setClientCif(deal.company.cif ?? '')
    setClientAddress(deal.company.address ?? '')
  }

  // ---- submit ----
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!clientName.trim()) return setError('El nombre del cliente es obligatorio.')
    const filledLines = lines.filter((l) => l.type === 'line' && l.description.trim())
    if (filledLines.length === 0) return setError('Añade al menos una línea con descripción.')
    if (base <= 0) return setError('La base imponible debe ser mayor que 0.')

    const concept =
      filledLines.length === 1
        ? filledLines[0].description.trim()
        : 'Varios conceptos'

    const finalLines: InvoiceLineItem[] = lines.map((l) => {
      const item: InvoiceLineItem = {
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
      }
      return item
    })

    startTransition(async () => {
      const result = await createInvoiceAction({
        type,
        dealId: dealId || null,
        clientName: clientName.trim(),
        clientCif: clientCif.trim() || null,
        clientAddress: clientAddress.trim() || null,
        concept,
        lineItems: finalLines,
        amountNet: base,
        vatRate: vat,
        amountTotal: total,
        issuedAt: issuedAt || null,
        dueAt: dueAt || null,
        rectifiesId: rectifiesId || null,
      })
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-danger/8 border border-danger/20 rounded-lg px-5 py-4 text-[13px] text-danger">
          {error}
        </div>
      )}

      {/* Tipo */}
      <div className="bg-surface border border-border-subtle rounded-lg p-5 space-y-4">
        <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">Tipo de factura</h2>
        <div className="flex gap-3">
          {(['ordinary', 'rectificativa'] as InvoiceType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-4 h-9 rounded-[6px] border text-[13px] font-medium transition-colors duration-150 ${
                type === t
                  ? 'border-accent bg-accent-muted text-accent-text'
                  : 'border-border-subtle text-text-secondary hover:border-border-strong'
              }`}
            >
              {t === 'ordinary' ? 'Ordinaria' : 'Rectificativa'}
            </button>
          ))}
        </div>
        {type === 'rectificativa' && (
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1">
              Factura que rectifica (ID)
            </label>
            <input
              type="text"
              value={rectifiesId}
              onChange={(e) => setRectifiesId(e.target.value)}
              placeholder="UUID de la factura original"
              className="w-full border border-border-subtle rounded-[6px] px-3 h-9 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/40 bg-base text-text-primary placeholder:text-text-tertiary"
            />
          </div>
        )}
      </div>

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
              {deals.map((d) => (
                <option key={d.id} value={d.id}>{d.company.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-[13px] font-medium text-text-secondary mb-1">
            Nombre / Razón social <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            required
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Empresa S.L."
            className="w-full border border-border-subtle rounded-[6px] px-3 h-9 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/40 bg-base text-text-primary placeholder:text-text-tertiary"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1">CIF / NIF</label>
            <input
              type="text"
              value={clientCif}
              onChange={(e) => setClientCif(e.target.value)}
              placeholder="B12345678"
              className="w-full border border-border-subtle rounded-[6px] px-3 h-9 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/40 bg-base text-text-primary placeholder:text-text-tertiary"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1">Dirección fiscal</label>
            <input
              type="text"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              placeholder="C/ Ejemplo 1, Madrid"
              className="w-full border border-border-subtle rounded-[6px] px-3 h-9 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/40 bg-base text-text-primary placeholder:text-text-tertiary"
            />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle">
          <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">Líneas</h2>
        </div>

        {/* Lines */}
        <div className="divide-y divide-border-subtle">
          {lines.map((line) =>
            line.type === 'line' ? (
              <RegularLineRow
                key={line.id}
                line={line}
                onChange={updateLine}
                onRemove={removeLine}
                canRemove={lines.length > 1}
              />
            ) : (
              <DiscountLineRow
                key={line.id}
                line={line}
                subtotal={subtotal}
                onChange={updateLine}
                onRemove={removeLine}
              />
            )
          )}
        </div>

        {/* Add buttons */}
        <div className="px-5 py-3 border-t border-border-subtle flex items-center gap-3">
          <button
            type="button"
            onClick={addLine}
            className="text-[13px] text-text-tertiary hover:text-text-primary border border-border-subtle hover:border-border-strong px-3 h-8 rounded-[6px] transition-colors duration-150"
          >
            ＋ Añadir línea
          </button>
        </div>

        {/* Totals */}
        <div className="border-t border-border-subtle px-5 py-4 space-y-1.5">
          <TotalsRow label="Subtotal" value={fmtNum(subtotal)} />
          {discountTotal < 0 && (
            <TotalsRow label="Descuentos" value={fmtNum(discountTotal)} red />
          )}
          <TotalsRow label="Base imponible" value={fmtNum(base)} />
          <div className="flex items-center gap-2 justify-end">
            <span className="text-[13px] text-text-tertiary">IVA</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className="w-16 border border-border-subtle rounded-[4px] px-2 py-1 text-[13px] font-mono text-right focus:outline-none focus:ring-1 focus:ring-accent/40 bg-base text-text-primary"
            />
            <span className="text-[13px] text-text-tertiary">%</span>
            <span className="text-[13px] font-mono w-28 text-right text-text-secondary">{fmtNum(vatAmount)} €</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            <span className="text-[14px] font-semibold text-text-secondary">Total factura</span>
            <span className="text-[18px] font-mono font-semibold text-text-primary">{fmtNum(total)} €</span>
          </div>
        </div>
      </div>

      {/* Fechas */}
      <div className="bg-surface border border-border-subtle rounded-lg p-5 space-y-4">
        <h2 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">Fechas</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1">Fecha de emisión</label>
            <input
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
              className="w-full border border-border-subtle rounded-[6px] px-3 h-9 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/40 bg-base text-text-secondary"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1">Fecha de vencimiento</label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full border border-border-subtle rounded-[6px] px-3 h-9 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/40 bg-base text-text-secondary"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 h-9 text-[13px] text-text-secondary hover:text-text-primary border border-border-subtle hover:border-border-strong rounded-[6px] transition-colors duration-150"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-5 h-9 text-[13px] font-medium bg-accent text-base hover:bg-accent-hover rounded-[6px] transition-colors duration-150 disabled:opacity-50"
        >
          {isPending ? 'Guardando...' : 'Guardar factura'}
        </button>
      </div>
    </form>
  )
}

// =========================================
// RegularLineRow
// =========================================

function RegularLineRow({
  line,
  onChange,
  onRemove,
  canRemove,
}: {
  line: FormLine
  onChange: (id: string, patch: Partial<FormLine>) => void
  onRemove: (id: string) => void
  canRemove: boolean
}) {
  const svc = line.serviceId ? SERVICE_MAP.get(line.serviceId) : undefined
  const isCustom = svc?.custom === true
  const priceEditable = !svc || svc.priceEditable === true

  function handleServiceSelect(serviceId: string) {
    if (!serviceId) {
      onChange(line.id, { serviceId: '', description: '', unit: '', unitPrice: 0, amount: 0, period: undefined })
      return
    }
    const item = SERVICE_MAP.get(serviceId)
    if (!item) return
    const qty = line.quantity || 1
    const price = item.defaultPrice

    // Auto-fill period with sub-plan details for delivery integration items
    let autoPeriod: string | undefined = line.period
    if (item.deliveryPlanKey) {
      const dp = DELIVERY_PLANS[item.deliveryPlanKey]
      autoPeriod = `${dp.label} · ${dp.includedOrders} ped. incl. · ${dp.extraOrderFee.toFixed(2).replace('.', ',')}€/ped. adic.`
    }

    onChange(line.id, {
      serviceId,
      description: item.custom ? '' : item.label,
      unit: item.unit,
      unitPrice: price,
      amount: qty * price,
      period: autoPeriod,
    })
  }

  function handleQtyChange(val: number) {
    onChange(line.id, { quantity: val, amount: val * line.unitPrice })
  }

  function handlePriceChange(val: number) {
    onChange(line.id, { unitPrice: val, amount: line.quantity * val })
  }

  // Qty column label: prefer catalog qtyUnit, then derive from unit, fallback 'uds'
  const qtyLabel = svc?.qtyUnit ?? (line.unit ? line.unit.split('/')[0] : 'uds')

  const dto = line.lineDiscountPercent ?? 0
  const originalAmount = line.quantity * line.unitPrice

  return (
    <div className="px-5 py-3 space-y-2">
      {/* Row 1: service selector + qty + price + dto% + amount + delete */}
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 60px 100px 28px' }}>
        {/* Service selector */}
        <select
          value={line.serviceId}
          onChange={(e) => handleServiceSelect(e.target.value)}
          className="border border-border-subtle rounded-[4px] px-2 py-1.5 text-[13px] bg-base focus:outline-none focus:ring-1 focus:ring-accent/40 w-full text-text-primary"
        >
          <option value="">— Selecciona servicio —</option>
          {SERVICE_GROUPS.map((group) => {
            const items = SERVICES.filter((s) => s.group === group)
            return (
              <optgroup key={group} label={group}>
                {items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}{s.note ? ` (${s.note})` : ''}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>

        {/* Cantidad */}
        <input
          type="number"
          min="0"
          step="any"
          value={line.quantity || ''}
          placeholder={qtyLabel}
          onChange={(e) => handleQtyChange(parseFloat(e.target.value) || 0)}
          className="border border-border-subtle rounded-[4px] px-2 py-1.5 text-[13px] font-mono text-right focus:outline-none focus:ring-1 focus:ring-accent/40 w-full bg-base text-text-primary"
        />

        {/* Precio unitario */}
        <div className="relative">
          <input
            type="number"
            min="0"
            step="0.01"
            value={line.unitPrice}
            onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
            className={`border rounded-[4px] px-2 py-1.5 text-[13px] font-mono text-right focus:outline-none focus:ring-1 w-full bg-base text-text-primary ${
              priceEditable && line.unitPrice === 0 && line.serviceId
                ? 'border-warning/40 focus:ring-warning/40'
                : 'border-border-subtle focus:ring-accent/40'
            }`}
          />
        </div>

        {/* Dto. % */}
        <div className="relative">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={dto || ''}
            placeholder="0"
            onChange={(e) => {
              const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
              onChange(line.id, { lineDiscountPercent: val || undefined })
            }}
            className="border border-border-subtle rounded-[4px] px-2 py-1.5 text-[13px] font-mono text-right focus:outline-none focus:ring-1 focus:ring-accent/40 w-full pr-5 bg-base text-text-primary"
          />
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

        {/* Delete */}
        {canRemove ? (
          <button
            type="button"
            onClick={() => onRemove(line.id)}
            className="text-text-disabled hover:text-danger transition-colors text-base leading-none"
            title="Eliminar línea"
          >
            ×
          </button>
        ) : (
          <span />
        )}
      </div>

      {/* Row 2: custom description + unit input only for "Línea personalizada" */}
      {line.serviceId && isCustom && (
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 60px 100px 28px' }}>
          <input
            type="text"
            value={line.description}
            onChange={(e) => onChange(line.id, { description: e.target.value })}
            placeholder="Descripción personalizada"
            className="border border-border-subtle rounded-[4px] px-2 py-1 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40 w-full bg-base"
          />
          <input
            type="text"
            value={line.unit}
            onChange={(e) => onChange(line.id, { unit: e.target.value })}
            placeholder="unidad"
            className="border border-border-subtle rounded-[4px] px-2 py-1 text-[11px] text-center text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/40 w-full bg-base"
          />
          {svc?.note && (
            <div className="text-[11px] text-warning text-right truncate">{svc.note}</div>
          )}
        </div>
      )}

      {/* Row 3: Período (all regular lines) */}
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 60px 100px 28px' }}>
        <input
          type="text"
          value={line.period ?? ''}
          onChange={(e) => onChange(line.id, { period: e.target.value || undefined })}
          placeholder="Período (ej: Enero - Marzo 2026)"
          className="border border-border-subtle rounded-[4px] px-2 py-1 text-[11px] text-text-tertiary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-accent/40 w-full bg-hover"
        />
      </div>

      {/* Row 4: Nombre del descuento (only when dto > 0) */}
      {dto > 0 && (
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 60px 100px 28px' }}>
          <input
            type="text"
            value={line.discountName ?? ''}
            onChange={(e) => onChange(line.id, { discountName: e.target.value || undefined })}
            placeholder="Nombre del descuento (ej: CORE PARTNER DISCOUNT)"
            className="border border-border-subtle rounded-[4px] px-2 py-1 text-[11px] text-success placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-accent/40 w-full bg-hover col-span-4"
          />
        </div>
      )}
    </div>
  )
}

// =========================================
// DiscountLineRow (unchanged)
// =========================================

function DiscountLineRow({
  line,
  subtotal,
  onChange,
  onRemove,
}: {
  line: FormLine
  subtotal: number
  onChange: (id: string, patch: Partial<FormLine>) => void
  onRemove: (id: string) => void
}) {
  const discountAmount = computeDiscountAmount(line, subtotal)

  function handleModeChange(mode: DiscountMode) {
    onChange(line.id, { discountMode: mode, discountValue: 0, amount: 0 })
  }

  function handleValueChange(val: number) {
    const amount =
      line.discountMode === 'percent' ? -(subtotal * val) / 100 : -val
    onChange(line.id, { discountValue: val, amount })
  }

  return (
    <div className="grid items-center gap-2 px-5 py-2.5 bg-danger/5" style={{ gridTemplateColumns: '1fr 90px 110px 100px 28px' }}>
      {/* Description + mode toggle */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={line.description}
          onChange={(e) => onChange(line.id, { description: e.target.value })}
          placeholder="Descuento"
          className="border border-danger/20 rounded-[4px] px-2 py-1 text-[13px] text-danger focus:outline-none focus:ring-1 focus:ring-danger/30 w-full bg-base"
        />
        <div className="flex rounded-[4px] overflow-hidden border border-danger/20 shrink-0">
          <button
            type="button"
            onClick={() => handleModeChange('percent')}
            className={`px-2 py-1 text-[11px] font-medium transition-colors ${
              line.discountMode === 'percent'
                ? 'bg-danger/12 text-danger'
                : 'bg-base text-text-disabled hover:text-danger'
            }`}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('amount')}
            className={`px-2 py-1 text-[11px] font-medium border-l border-danger/20 transition-colors ${
              line.discountMode === 'amount'
                ? 'bg-danger/12 text-danger'
                : 'bg-base text-text-disabled hover:text-danger'
            }`}
          >
            €
          </button>
        </div>
      </div>

      {/* Qty — unused for discounts */}
      <div />

      {/* Discount value */}
      <input
        type="number"
        min="0"
        step="0.01"
        value={line.discountValue ?? 0}
        onChange={(e) => handleValueChange(parseFloat(e.target.value) || 0)}
        className="border border-danger/20 rounded-[4px] px-2 py-1 text-[13px] font-mono text-right text-danger focus:outline-none focus:ring-1 focus:ring-danger/30 w-full bg-base"
      />

      {/* Computed amount */}
      <div className="text-[13px] font-mono text-right text-danger font-semibold pr-1">
        {discountAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
      </div>

      <button
        type="button"
        onClick={() => onRemove(line.id)}
        className="text-danger/40 hover:text-danger transition-colors text-base leading-none"
        title="Eliminar descuento"
      >
        ×
      </button>
    </div>
  )
}

function TotalsRow({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[13px] ${red ? 'text-danger' : 'text-text-tertiary'}`}>{label}</span>
      <span className={`text-[13px] font-mono ${red ? 'text-danger font-semibold' : 'text-text-secondary'}`}>
        {value} €
      </span>
    </div>
  )
}
