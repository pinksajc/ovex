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
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">{error}</div>
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
          <input
            type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)}
            placeholder="Empresa S.L."
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
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
        <div className="px-5 py-3 border-t border-zinc-100 flex items-center gap-3">
          <button type="button" onClick={addLine}
            className="text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors">
            ＋ Añadir línea
          </button>
        </div>

        {/* Totals */}
        <div className="border-t border-zinc-200 px-5 py-4 space-y-1.5">
          <TotalsRow label="Subtotal" value={fmtNum(subtotal)} />
          {discountTotal < 0 && <TotalsRow label="Descuentos" value={fmtNum(discountTotal)} red />}
          <TotalsRow label="Base imponible" value={fmtNum(base)} />
          <div className="flex items-center gap-2 justify-end">
            <span className="text-xs text-zinc-500">IVA</span>
            <input
              type="number" min="0" max="100" step="0.1" value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className="w-16 border border-zinc-200 rounded px-2 py-1 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-zinc-300"
            />
            <span className="text-xs text-zinc-400">%</span>
            <span className="text-xs font-mono w-28 text-right text-zinc-700">{fmtNum(vatAmount)} €</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
            <span className="text-sm font-semibold text-zinc-900">Total oferta</span>
            <span className="text-lg font-mono font-semibold text-zinc-900">{fmtNum(total)} €</span>
          </div>
        </div>
      </div>

      {/* Fechas + Notas */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Validez y notas</h2>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Válido hasta</label>
          <input
            type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Notas internas (opcional)</label>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Condiciones especiales, notas de contexto, términos adicionales…"
            rows={3}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 resize-none"
          />
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

        <input type="number" min="0" step="any" value={line.quantity || ''} placeholder={qtyLabel}
          onChange={(e) => onChange(line.id, { quantity: parseFloat(e.target.value) || 0 })}
          className="border border-zinc-200 rounded px-2 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full" />

        <input type="number" min="0" step="0.01" value={line.unitPrice}
          onChange={(e) => { const p = parseFloat(e.target.value) || 0; onChange(line.id, { unitPrice: p }) }}
          className={`border rounded px-2 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 w-full ${priceEditable && line.unitPrice === 0 && line.serviceId ? 'border-amber-300 bg-amber-50 focus:ring-amber-300' : 'border-zinc-200 focus:ring-zinc-300'}`} />

        {/* Dto. % */}
        <div className="relative">
          <input type="number" min="0" max="100" step="0.1" value={dto || ''} placeholder="0"
            onChange={(e) => {
              const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
              onChange(line.id, { lineDiscountPercent: val || undefined })
            }}
            className="border border-zinc-200 rounded px-2 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full pr-5" />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-zinc-400 pointer-events-none">%</span>
        </div>

        {/* Importe */}
        <div className="text-right pr-1">
          {dto > 0 ? (
            <>
              <div className="text-[10px] font-mono text-zinc-400 line-through leading-tight">
                {originalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </div>
              <div className="text-xs font-mono font-semibold text-emerald-600 leading-tight">
                {line.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </div>
            </>
          ) : (
            <span className="text-xs font-mono text-zinc-700">
              {line.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
            </span>
          )}
        </div>

        {canRemove
          ? <button type="button" onClick={() => onRemove(line.id)} className="text-zinc-300 hover:text-red-500 transition-colors text-base leading-none">×</button>
          : <span />}
      </div>

      {/* Row 2: custom description */}
      {line.serviceId && isCustom && (
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 60px 100px 28px' }}>
          <input type="text" value={line.description} onChange={(e) => onChange(line.id, { description: e.target.value })}
            placeholder="Descripción personalizada"
            className="border border-zinc-200 rounded px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full bg-white" />
          <input type="text" value={line.unit} onChange={(e) => onChange(line.id, { unit: e.target.value })}
            placeholder="unidad"
            className="border border-zinc-200 rounded px-2 py-1 text-[10px] text-center text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full" />
          {svc?.note && <div className="text-[10px] text-amber-600 text-right truncate">{svc.note}</div>}
        </div>
      )}

      {/* Row 3: Período */}
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 60px 100px 28px' }}>
        <input type="text" value={line.period ?? ''} onChange={(e) => onChange(line.id, { period: e.target.value || undefined })}
          placeholder="Período (ej: Enero - Marzo 2026)"
          className="border border-zinc-100 rounded px-2 py-1 text-[10px] text-zinc-400 placeholder-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-200 w-full bg-zinc-50 focus:bg-white" />
      </div>
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
