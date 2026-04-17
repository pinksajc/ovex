'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createInvoiceAction } from '@/app/actions/invoices'
import { SERVICES, SERVICE_MAP, SERVICE_GROUPS } from '@/lib/invoice-catalog'
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
}

// ---- component ----

export function NewInvoiceForm({ deals }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Header fields
  const [type, setType] = useState<InvoiceType>('ordinary')
  const [dealId, setDealId] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientCif, setClientCif] = useState('')
  const [clientAddress, setClientAddress] = useState('')
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
          merged.amount = merged.quantity * merged.unitPrice
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
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tipo */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Tipo de factura</h2>
        <div className="flex gap-3">
          {(['ordinary', 'rectificativa'] as InvoiceType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                type === t
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 text-zinc-600 hover:border-zinc-400'
              }`}
            >
              {t === 'ordinary' ? 'Ordinaria' : 'Rectificativa'}
            </button>
          ))}
        </div>
        {type === 'rectificativa' && (
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Factura que rectifica (ID)
            </label>
            <input
              type="text"
              value={rectifiesId}
              onChange={(e) => setRectifiesId(e.target.value)}
              placeholder="UUID de la factura original"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>
        )}
      </div>

      {/* Cliente */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Datos del cliente</h2>
        {deals.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Autocompletar desde deal</label>
            <select
              value={dealId}
              onChange={(e) => handleDealSelect(e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
            >
              <option value="">— Selecciona un deal (opcional) —</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>{d.company.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            Nombre / Razón social <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Empresa S.L."
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">CIF / NIF</label>
            <input
              type="text"
              value={clientCif}
              onChange={(e) => setClientCif(e.target.value)}
              placeholder="B12345678"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Dirección fiscal</label>
            <input
              type="text"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              placeholder="C/ Ejemplo 1, Madrid"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Líneas</h2>
        </div>

        {/* Lines */}
        <div className="divide-y divide-zinc-50">
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
        <div className="px-5 py-3 border-t border-zinc-100 flex items-center gap-3">
          <button
            type="button"
            onClick={addLine}
            className="text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            ＋ Añadir línea
          </button>
          <button
            type="button"
            onClick={addDiscount}
            className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            ＋ Añadir descuento
          </button>
        </div>

        {/* Totals */}
        <div className="border-t border-zinc-200 px-5 py-4 space-y-1.5">
          <TotalsRow label="Subtotal" value={fmtNum(subtotal)} />
          {discountTotal < 0 && (
            <TotalsRow label="Descuentos" value={fmtNum(discountTotal)} red />
          )}
          <TotalsRow label="Base imponible" value={fmtNum(base)} />
          <div className="flex items-center gap-2 justify-end">
            <span className="text-xs text-zinc-500">IVA</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className="w-16 border border-zinc-200 rounded px-2 py-1 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-zinc-300"
            />
            <span className="text-xs text-zinc-400">%</span>
            <span className="text-xs font-mono w-28 text-right text-zinc-700">{fmtNum(vatAmount)} €</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
            <span className="text-sm font-semibold text-zinc-900">Total factura</span>
            <span className="text-lg font-mono font-semibold text-zinc-900">{fmtNum(total)} €</span>
          </div>
        </div>
      </div>

      {/* Fechas */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Fechas</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Fecha de emisión</label>
            <input
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Fecha de vencimiento</label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
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
      onChange(line.id, { serviceId: '', description: '', unit: '', unitPrice: 0, amount: 0 })
      return
    }
    const item = SERVICE_MAP.get(serviceId)
    if (!item) return
    const qty = line.quantity || 1
    const price = item.defaultPrice
    onChange(line.id, {
      serviceId,
      description: item.custom ? '' : item.label,
      unit: item.unit,
      unitPrice: price,
      amount: qty * price,
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

  return (
    <div className="px-5 py-3 space-y-2">
      {/* Row 1: service selector + qty + price + amount + delete */}
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 100px 28px' }}>
        {/* Service selector */}
        <select
          value={line.serviceId}
          onChange={(e) => handleServiceSelect(e.target.value)}
          className="border border-zinc-200 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full text-zinc-700"
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
          className="border border-zinc-200 rounded px-2 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full"
        />

        {/* Precio unitario */}
        <div className="relative">
          <input
            type="number"
            min="0"
            step="0.01"
            value={line.unitPrice}
            onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
            className={`border rounded px-2 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 w-full ${
              priceEditable && line.unitPrice === 0 && line.serviceId
                ? 'border-amber-300 bg-amber-50 focus:ring-amber-300'
                : 'border-zinc-200 focus:ring-zinc-300'
            }`}
          />
        </div>

        {/* Importe */}
        <div className="text-xs font-mono text-right text-zinc-700 pr-1">
          {line.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
        </div>

        {/* Delete */}
        {canRemove ? (
          <button
            type="button"
            onClick={() => onRemove(line.id)}
            className="text-zinc-300 hover:text-red-500 transition-colors text-base leading-none"
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
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 100px 28px' }}>
          <input
            type="text"
            value={line.description}
            onChange={(e) => onChange(line.id, { description: e.target.value })}
            placeholder="Descripción personalizada"
            className="border border-zinc-200 rounded px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full bg-white"
          />
          <input
            type="text"
            value={line.unit}
            onChange={(e) => onChange(line.id, { unit: e.target.value })}
            placeholder="unidad"
            className="border border-zinc-200 rounded px-2 py-1 text-[10px] text-center text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full"
          />
          {svc?.note && (
            <div className="text-[10px] text-amber-600 text-right truncate">{svc.note}</div>
          )}
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
    <div className="grid items-center gap-2 px-5 py-2.5 bg-red-50/30" style={{ gridTemplateColumns: '1fr 90px 110px 100px 28px' }}>
      {/* Description + mode toggle */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={line.description}
          onChange={(e) => onChange(line.id, { description: e.target.value })}
          placeholder="Descuento"
          className="border border-red-200 rounded px-2 py-1 text-xs text-red-700 focus:outline-none focus:ring-1 focus:ring-red-300 w-full"
        />
        <div className="flex rounded overflow-hidden border border-red-200 shrink-0">
          <button
            type="button"
            onClick={() => handleModeChange('percent')}
            className={`px-2 py-1 text-[10px] font-medium transition-colors ${
              line.discountMode === 'percent'
                ? 'bg-red-100 text-red-700'
                : 'bg-white text-zinc-400 hover:text-red-500'
            }`}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('amount')}
            className={`px-2 py-1 text-[10px] font-medium border-l border-red-200 transition-colors ${
              line.discountMode === 'amount'
                ? 'bg-red-100 text-red-700'
                : 'bg-white text-zinc-400 hover:text-red-500'
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
        className="border border-red-200 rounded px-2 py-1 text-xs font-mono text-right text-red-600 focus:outline-none focus:ring-1 focus:ring-red-300 w-full"
      />

      {/* Computed amount */}
      <div className="text-xs font-mono text-right text-red-600 font-semibold pr-1">
        {discountAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
      </div>

      <button
        type="button"
        onClick={() => onRemove(line.id)}
        className="text-red-300 hover:text-red-600 transition-colors text-base leading-none"
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
      <span className={`text-xs ${red ? 'text-red-500' : 'text-zinc-500'}`}>{label}</span>
      <span className={`text-xs font-mono ${red ? 'text-red-600 font-semibold' : 'text-zinc-700'}`}>
        {value} €
      </span>
    </div>
  )
}
