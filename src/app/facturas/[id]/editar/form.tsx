'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { updateInvoiceAction } from '@/app/actions/invoices'
import { SERVICES, SERVICE_MAP, SERVICE_GROUPS } from '@/lib/invoice-catalog'
import type { Invoice, InvoiceLineItem, DiscountMode } from '@/types'

// ---- helpers (identical to nueva/form.tsx) ----

function newLineId() {
  return Math.random().toString(36).slice(2)
}

type FormLine = InvoiceLineItem & { serviceId: string; unit: string }

function emptyLine(): FormLine {
  return { id: newLineId(), type: 'line', description: '', quantity: 1, unitPrice: 0, amount: 0, serviceId: '', unit: '' }
}

function emptyDiscount(): FormLine {
  return { id: newLineId(), type: 'discount', description: 'Descuento', quantity: 1, unitPrice: 0, amount: 0, discountMode: 'percent', discountValue: 0, serviceId: '', unit: '' }
}

function itemToFormLine(item: InvoiceLineItem): FormLine {
  return {
    ...item,
    id: item.id || newLineId(),
    serviceId: item.serviceId ?? '',
    unit: item.unit ?? '',
  }
}

function fmtNum(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function computeDiscountAmount(item: FormLine, subtotal: number): number {
  if (item.type !== 'discount') return item.amount
  if (item.discountMode === 'percent') return -(subtotal * (item.discountValue ?? 0)) / 100
  return -(item.discountValue ?? 0)
}

// ---- props ----

interface DealOption {
  id: string
  company: { name: string; cif?: string; address?: string }
}

interface Props {
  invoice: Invoice
  deals: DealOption[]
}

// ---- component ----

export function EditInvoiceForm({ invoice, deals }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [dealId, setDealId] = useState(invoice.dealId ?? '')
  const [clientName, setClientName] = useState(invoice.clientName)
  const [clientCif, setClientCif] = useState(invoice.clientCif ?? '')
  const [clientAddress, setClientAddress] = useState(invoice.clientAddress ?? '')
  const [vatRate, setVatRate] = useState(String(invoice.vatRate))
  const [issuedAt, setIssuedAt] = useState(invoice.issuedAt?.split('T')[0] ?? '')
  const [dueAt, setDueAt] = useState(invoice.dueAt?.split('T')[0] ?? '')
  const [rectifiesId, setRectifiesId] = useState(invoice.rectifiesId ?? '')

  const [lines, setLines] = useState<FormLine[]>(() =>
    invoice.lineItems.length > 0
      ? invoice.lineItems.map(itemToFormLine)
      : [emptyLine()]
  )

  // ---- totals ----
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
        if (merged.type === 'line') merged.amount = merged.quantity * merged.unitPrice
        return merged
      })
    )
  }, [])

  function addLine() { setLines((p) => [...p, emptyLine()]) }
  function addDiscount() { setLines((p) => [...p, emptyDiscount()]) }
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
    }))

    startTransition(async () => {
      const result = await updateInvoiceAction(invoice.id, {
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
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">{error}</div>
      )}

      {/* Rectificativa link */}
      {invoice.type === 'rectificativa' && (
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Factura que rectifica (ID)</label>
          <input
            type="text"
            value={rectifiesId}
            onChange={(e) => setRectifiesId(e.target.value)}
            placeholder="UUID de la factura original"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
        </div>
      )}

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
              {deals.map((d) => <option key={d.id} value={d.id}>{d.company.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            Nombre / Razón social <span className="text-red-500">*</span>
          </label>
          <input type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)}
            placeholder="Empresa S.L."
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">CIF / NIF</label>
            <input type="text" value={clientCif} onChange={(e) => setClientCif(e.target.value)}
              placeholder="B12345678"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Dirección fiscal</label>
            <input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)}
              placeholder="C/ Ejemplo 1, Madrid"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300" />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Líneas</h2>
        </div>
        <div className="divide-y divide-zinc-50">
          {lines.map((line) =>
            line.type === 'line' ? (
              <RegularLineRow key={line.id} line={line} onChange={updateLine} onRemove={removeLine} canRemove={lines.length > 1} />
            ) : (
              <DiscountLineRow key={line.id} line={line} subtotal={subtotal} onChange={updateLine} onRemove={removeLine} />
            )
          )}
        </div>
        <div className="px-5 py-3 border-t border-zinc-100 flex items-center gap-3">
          <button type="button" onClick={addLine}
            className="text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors">
            ＋ Añadir línea
          </button>
          <button type="button" onClick={addDiscount}
            className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">
            ＋ Añadir descuento
          </button>
        </div>
        <div className="border-t border-zinc-200 px-5 py-4 space-y-1.5">
          <TotalsRow label="Subtotal" value={fmtNum(subtotal)} />
          {discountTotal < 0 && <TotalsRow label="Descuentos" value={fmtNum(discountTotal)} red />}
          <TotalsRow label="Base imponible" value={fmtNum(base)} />
          <div className="flex items-center gap-2 justify-end">
            <span className="text-xs text-zinc-500">IVA</span>
            <input type="number" min="0" max="100" step="0.1" value={vatRate} onChange={(e) => setVatRate(e.target.value)}
              className="w-16 border border-zinc-200 rounded px-2 py-1 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-zinc-300" />
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
            <input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Fecha de vencimiento</label>
            <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={() => router.back()}
          className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 rounded-lg transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          className="px-5 py-2 text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50">
          {isPending ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

// ---- Sub-components (identical logic to nueva/form.tsx) ----

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

  function handleServiceSelect(serviceId: string) {
    if (!serviceId) { onChange(line.id, { serviceId: '', description: '', unit: '', unitPrice: 0, amount: 0 }); return }
    const item = SERVICE_MAP.get(serviceId)
    if (!item) return
    const qty = line.quantity || 1
    onChange(line.id, { serviceId, description: item.custom ? '' : item.label, unit: item.unit, unitPrice: item.defaultPrice, amount: qty * item.defaultPrice })
  }

  return (
    <div className="px-5 py-3 space-y-2">
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 100px 28px' }}>
        <select value={line.serviceId} onChange={(e) => handleServiceSelect(e.target.value)}
          className="border border-zinc-200 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full text-zinc-700">
          <option value="">— Selecciona servicio —</option>
          {SERVICE_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {SERVICES.filter((s) => s.group === group).map((s) => (
                <option key={s.id} value={s.id}>{s.label}{s.note ? ` (${s.note})` : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <input type="number" min="0" step="any" value={line.quantity || ''}
          placeholder={qtyLabel}
          onChange={(e) => onChange(line.id, { quantity: parseFloat(e.target.value) || 0, amount: (parseFloat(e.target.value) || 0) * line.unitPrice })}
          className="border border-zinc-200 rounded px-2 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full" />
        <input type="number" min="0" step="0.01" value={line.unitPrice}
          onChange={(e) => { const p = parseFloat(e.target.value) || 0; onChange(line.id, { unitPrice: p, amount: line.quantity * p }) }}
          className={`border rounded px-2 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 w-full ${priceEditable && line.unitPrice === 0 && line.serviceId ? 'border-amber-300 bg-amber-50 focus:ring-amber-300' : 'border-zinc-200 focus:ring-zinc-300'}`} />
        <div className="text-xs font-mono text-right text-zinc-700 pr-1">
          {line.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
        </div>
        {canRemove
          ? <button type="button" onClick={() => onRemove(line.id)} className="text-zinc-300 hover:text-red-500 transition-colors text-base leading-none">×</button>
          : <span />}
      </div>
      {line.serviceId && isCustom && (
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 100px 28px' }}>
          <input type="text" value={line.description} onChange={(e) => onChange(line.id, { description: e.target.value })}
            placeholder="Descripción personalizada"
            className="border border-zinc-200 rounded px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full bg-white" />
          <input type="text" value={line.unit} onChange={(e) => onChange(line.id, { unit: e.target.value })}
            placeholder="unidad"
            className="border border-zinc-200 rounded px-2 py-1 text-[10px] text-center text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full" />
          {svc?.note && <div className="text-[10px] text-amber-600 text-right truncate">{svc.note}</div>}
        </div>
      )}

      {/* Período (all regular lines) */}
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 100px 28px' }}>
        <input type="text" value={line.period ?? ''} onChange={(e) => onChange(line.id, { period: e.target.value || undefined })}
          placeholder="Período (ej: Enero - Marzo 2026)"
          className="border border-zinc-100 rounded px-2 py-1 text-[10px] text-zinc-400 placeholder-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-200 w-full bg-zinc-50 focus:bg-white" />
      </div>
    </div>
  )
}

function DiscountLineRow({ line, subtotal, onChange, onRemove }: {
  line: FormLine; subtotal: number
  onChange: (id: string, patch: Partial<FormLine>) => void
  onRemove: (id: string) => void
}) {
  const discountAmount = computeDiscountAmount(line, subtotal)
  function handleModeChange(mode: DiscountMode) { onChange(line.id, { discountMode: mode, discountValue: 0, amount: 0 }) }
  function handleValueChange(val: number) {
    onChange(line.id, { discountValue: val, amount: line.discountMode === 'percent' ? -(subtotal * val) / 100 : -val })
  }
  return (
    <div className="grid items-center gap-2 px-5 py-2.5 bg-red-50/30" style={{ gridTemplateColumns: '1fr 90px 110px 100px 28px' }}>
      <div className="flex items-center gap-2">
        <input type="text" value={line.description} onChange={(e) => onChange(line.id, { description: e.target.value })}
          placeholder="Descuento"
          className="border border-red-200 rounded px-2 py-1 text-xs text-red-700 focus:outline-none focus:ring-1 focus:ring-red-300 w-full" />
        <div className="flex rounded overflow-hidden border border-red-200 shrink-0">
          {(['percent', 'amount'] as DiscountMode[]).map((m, i) => (
            <button key={m} type="button" onClick={() => handleModeChange(m)}
              className={`px-2 py-1 text-[10px] font-medium transition-colors ${i > 0 ? 'border-l border-red-200' : ''} ${line.discountMode === m ? 'bg-red-100 text-red-700' : 'bg-white text-zinc-400 hover:text-red-500'}`}>
              {m === 'percent' ? '%' : '€'}
            </button>
          ))}
        </div>
      </div>
      <div />
      <input type="number" min="0" step="0.01" value={line.discountValue ?? 0}
        onChange={(e) => handleValueChange(parseFloat(e.target.value) || 0)}
        className="border border-red-200 rounded px-2 py-1 text-xs font-mono text-right text-red-600 focus:outline-none focus:ring-1 focus:ring-red-300 w-full" />
      <div className="text-xs font-mono text-right text-red-600 font-semibold pr-1">
        {discountAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
      </div>
      <button type="button" onClick={() => onRemove(line.id)} className="text-red-300 hover:text-red-600 transition-colors text-base leading-none">×</button>
    </div>
  )
}

function TotalsRow({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${red ? 'text-red-500' : 'text-zinc-500'}`}>{label}</span>
      <span className={`text-xs font-mono ${red ? 'text-red-600 font-semibold' : 'text-zinc-700'}`}>{value} €</span>
    </div>
  )
}
