'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createInvoiceAction } from '@/app/actions/invoices'
import { listLocationsAction, createLocationAction } from '@/app/actions/company-locations'
import { getActiveConfigAction } from '@/app/actions/deal-config'
import { generateLinesForLocation } from '@/lib/invoice-lines'
import { SERVICES, SERVICE_MAP, SERVICE_GROUPS } from '@/lib/invoice-catalog'
import { DELIVERY_PLANS } from '@/lib/pricing/catalog'
import type { InvoiceType, InvoiceLineItem, DiscountMode, CompanyLocation, DealConfiguration } from '@/types'

const COST_CENTERS = ['Operaciones', 'Administración', 'Tecnología', 'Marketing', 'RRHH', 'Otro']

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
  /** ISO date string (YYYY-MM-DD) — the earliest date the user may select */
  minIssuedAt?: string | null
}

// ---- component ----

export function NewInvoiceForm({
  deals,
  initialDealId,
  initialClientName,
  initialClientCif,
  initialClientAddress,
  minIssuedAt,
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
  const [dueDateEnabled, setDueDateEnabled] = useState(true)
  const [rectifiesId, setRectifiesId] = useState('')

  // Location (multi-select)
  const [locations, setLocations]             = useState<CompanyLocation[]>([])
  const [selectedLocations, setSelectedLocs]  = useState<CompanyLocation[]>([])
  const [dealConfig, setDealConfig]           = useState<DealConfiguration | null>(null)
  const [showLocModal, setShowLocModal]       = useState(false)

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

  const [showServicePicker, setShowServicePicker] = useState(false)
  const [servicePickerGroup, setServicePickerGroup] = useState<{ id: string; name: string; address?: string | null } | undefined>(undefined)

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

  function addLine(locationGroup?: { id: string; name: string; address?: string | null }) {
    const base = emptyLine()
    if (locationGroup) {
      base.locationGroupId = locationGroup.id
      base.locationGroupName = locationGroup.name
      base.locationGroupAddress = locationGroup.address ?? undefined
    }
    setLines((prev) => {
      if (locationGroup) {
        // Insert after the last line of this group
        const idx = [...prev].reverse().findIndex((l) => l.locationGroupId === locationGroup.id)
        if (idx !== -1) {
          const insertAt = prev.length - idx
          const next = [...prev]
          next.splice(insertAt, 0, base)
          return next
        }
      }
      return [...prev, base]
    })
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

  function addServiceLine(serviceId: string, locationGroup?: { id: string; name: string; address?: string | null }) {
    const svc = SERVICE_MAP.get(serviceId)
    if (!svc) return
    let autoPeriod: string | undefined
    if (svc.deliveryPlanKey) {
      const dp = DELIVERY_PLANS[svc.deliveryPlanKey]
      autoPeriod = `${dp.label} · ${dp.includedOrders} ped. incl. · ${dp.extraOrderFee.toFixed(2).replace('.', ',')}€/ped. adic.`
    }
    const newLine: FormLine = {
      id: newLineId(),
      type: 'line',
      description: svc.custom ? '' : svc.label,
      quantity: 1,
      unitPrice: svc.defaultPrice,
      amount: svc.defaultPrice,
      serviceId,
      unit: svc.unit,
      period: autoPeriod,
      ...(locationGroup ? {
        locationGroupId: locationGroup.id,
        locationGroupName: locationGroup.name,
        locationGroupAddress: locationGroup.address ?? undefined,
      } : {}),
    }
    setLines((prev) => {
      const onlyPlaceholder = prev.length === 1 && !prev[0].description && !prev[0].locationGroupId
      if (onlyPlaceholder && !locationGroup) return [newLine]
      if (locationGroup) {
        // Insert after the last line of this group
        const idx = [...prev].reverse().findIndex((l) => l.locationGroupId === locationGroup.id)
        if (idx !== -1) {
          const insertAt = prev.length - idx
          const next = [...prev]
          next.splice(insertAt, 0, newLine)
          return next
        }
      }
      return [...prev, newLine]
    })
  }

  // ---- toggle location (check/uncheck) ----
  function toggleLocation(loc: CompanyLocation) {
    const isSelected = selectedLocations.some((l) => l.id === loc.id)
    if (isSelected) {
      // Deselect: remove the location and all its lines
      setSelectedLocs((prev) => prev.filter((l) => l.id !== loc.id))
      setLines((prev) => {
        const without = prev.filter((l) => l.locationGroupId !== loc.id)
        return without.length === 0 ? [emptyLine()] : without
      })
    } else {
      // Select: add the location and auto-generate lines if config available
      setSelectedLocs((prev) => [...prev, loc])
      const group = { locationGroupId: loc.id, locationGroupName: loc.name, locationGroupAddress: loc.address ?? undefined }
      if (dealConfig) {
        const generated = generateLinesForLocation(loc, dealConfig).map((item) => ({
          ...item,
          serviceId: item.serviceId ?? '',
          unit: item.unit ?? '',
        })) as FormLine[]
        setLines((prev) => {
          const hasOnlyPlaceholder =
            prev.length === 1 && !prev[0].description && !prev[0].locationGroupId
          return hasOnlyPlaceholder ? generated : [...prev, ...generated]
        })
      } else {
        // No config — add a blank grouped line so the location group appears in the view
        const placeholder: FormLine = { ...emptyLine(), ...group }
        setLines((prev) => {
          const hasOnlyPlaceholder =
            prev.length === 1 && !prev[0].description && !prev[0].locationGroupId
          return hasOnlyPlaceholder ? [placeholder] : [...prev, placeholder]
        })
      }
    }
  }

  // ---- load locations + config when deal changes ----
  useEffect(() => {
    if (!dealId) {
      setLocations([])
      setSelectedLocs([])
      setDealConfig(null)
      return
    }
    listLocationsAction(dealId).then((res) => {
      if (res.ok && res.data) setLocations(res.data)
    })
    getActiveConfigAction(dealId).then((res) => {
      if (res.ok) setDealConfig(res.data ?? null)
    })
  }, [dealId])

  // ---- deal autocomplete ----
  function handleDealSelect(id: string) {
    setDealId(id)
    setSelectedLocs([])
    setDealConfig(null)
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

    // Validate issue date is not before the most recent existing invoice
    if (minIssuedAt && issuedAt && issuedAt < minIssuedAt) {
      const formatted = new Date(minIssuedAt + 'T00:00:00').toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      return setError(`La fecha no puede ser anterior a la última factura emitida (${formatted})`)
    }

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
        locationGroupId: l.locationGroupId || undefined,
        locationGroupName: l.locationGroupName || undefined,
        locationGroupAddress: l.locationGroupAddress || undefined,
      }
      return item
    })

    // For single-location invoices keep locationId; for multi-location set to null
    const singleLocationId = selectedLocations.length === 1 ? selectedLocations[0].id : null

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
        dueAt: dueDateEnabled ? (dueAt || null) : null,
        dueDateEnabled,
        locationId: singleLocationId,
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
        <div className="flex gap-3 flex-wrap">
          {([
            ['ordinary', 'Ordinaria'],
            ['proforma', 'Factura Proforma'],
            ['rectificativa', 'Rectificativa'],
          ] as [InvoiceType, string][]).map(([t, label]) => (
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
              {label}
            </button>
          ))}
        </div>
        {type === 'proforma' && (
          <p className="text-xs text-violet-600 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
            Se creará con número <strong>PF-{new Date().getFullYear()}-XXXX</strong>. Podrás convertirla a factura ordinaria desde el detalle.
          </p>
        )}
        {type === 'rectificativa' && (
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Factura que rectifica
            </label>
            <input
              type="text"
              value={rectifiesId}
              onChange={(e) => setRectifiesId(e.target.value)}
              placeholder="Ej. F-2026-0007"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
            <p className="text-[11px] text-zinc-400 mt-1">Introduce el número de factura (no el UUID interno)</p>
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
        {/* Localizaciones — multi-select checkboxes when a deal is selected */}
        {dealId && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-700">Localizaciones</label>
              <button
                type="button"
                onClick={() => setShowLocModal(true)}
                className="text-xs border border-zinc-200 text-zinc-600 hover:border-zinc-400 px-2.5 py-1 rounded-lg transition-colors"
              >
                + Nueva
              </button>
            </div>
            {locations.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">Sin localizaciones para este deal.</p>
            ) : (
              <div className="space-y-1.5">
                {locations.map((loc) => {
                  const checked = selectedLocations.some((l) => l.id === loc.id)
                  return (
                    <label
                      key={loc.id}
                      className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        checked
                          ? 'border-zinc-900 bg-zinc-50'
                          : 'border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLocation(loc)}
                        className="mt-0.5 w-3.5 h-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                      />
                      <span className="text-xs text-zinc-800 leading-tight">
                        <span className="font-medium">{loc.name}</span>
                        {loc.costCenter && (
                          <span className="text-zinc-400 ml-1.5">· {loc.costCenter}</span>
                        )}
                        {loc.address && (
                          <span className="block text-zinc-400 text-[10px] mt-0.5">{loc.address}</span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
            {dealConfig && selectedLocations.length > 0 && (
              <p className="text-[10px] text-violet-600 mt-2">
                Líneas autogeneradas desde config: <strong>{dealConfig.plan}</strong>
                {dealConfig.activeAddons.length > 0 && ` + ${dealConfig.activeAddons.filter(a => a !== 'analytics_premium' && a !== 'datafono').join(', ')}`}
              </p>
            )}
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

        {/* Lines — optionally grouped by locationGroupId */}
        <GroupedLinesView
          lines={lines}
          subtotal={subtotal}
          onUpdate={updateLine}
          onRemove={removeLine}
          onAddLine={(group) => addLine(group)}
          onAddService={(group) => { setServicePickerGroup(group); setShowServicePicker(true) }}
        />

        {/* Add buttons */}
        <div className="px-5 py-3 border-t border-zinc-100 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowServicePicker(true)}
            className="text-xs font-medium text-zinc-700 hover:text-zinc-900 border border-zinc-300 hover:border-zinc-500 bg-white px-3 py-1.5 rounded-lg transition-colors"
          >
            ＋ Añadir servicio
          </button>
          <button
            type="button"
            onClick={() => addLine()}
            className="text-xs text-zinc-400 hover:text-zinc-700 border border-zinc-200 hover:border-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            ＋ Línea vacía
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
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Fechas</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Fecha de emisión</label>
            <input
              type="date"
              value={issuedAt}
              min={minIssuedAt ?? undefined}
              onChange={(e) => setIssuedAt(e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
            {minIssuedAt && (
              <p className="mt-1 text-[10px] text-zinc-400">
                Mínimo:{' '}
                {new Date(minIssuedAt + 'T00:00:00').toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-zinc-700">Fecha de vencimiento</label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dueDateEnabled}
                  onChange={(e) => setDueDateEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                />
                <span className="text-[10px] text-zinc-400">Activar</span>
              </label>
            </div>
            {dueDateEnabled ? (
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            ) : (
              <div className="w-full border border-zinc-100 bg-zinc-50 rounded-lg px-3 py-2 text-sm text-zinc-300">
                Sin fecha de vencimiento
              </div>
            )}
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
          {isPending ? 'Guardando...' : type === 'proforma' ? 'Guardar factura proforma' : 'Guardar factura'}
        </button>
      </div>

      {/* New location mini-modal */}
      {showLocModal && (
        <NewLocationModal
          dealId={dealId}
          onCreated={(loc) => {
            setLocations((prev) => [...prev, loc])
            setShowLocModal(false)
            // Auto-select the newly created location
            toggleLocation(loc)
          }}
          onClose={() => setShowLocModal(false)}
        />
      )}

      {/* Service picker modal */}
      {showServicePicker && (
        <ServicePickerModal
          onPick={(serviceId) => { addServiceLine(serviceId, servicePickerGroup); setShowServicePicker(false); setServicePickerGroup(undefined) }}
          onClose={() => { setShowServicePicker(false); setServicePickerGroup(undefined) }}
        />
      )}
    </form>
  )
}

// =========================================
// NewLocationModal
// =========================================

function NewLocationModal({
  dealId,
  onCreated,
  onClose,
}: {
  dealId: string
  onCreated: (loc: CompanyLocation) => void
  onClose: () => void
}) {
  const [name, setName]           = useState('')
  const [address, setAddress]     = useState('')
  const [costCenter, setCc]       = useState('')
  const [customCc, setCustomCc]   = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [isPending, startTx]      = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    const finalCc = costCenter === 'Otro' ? customCc.trim() : costCenter
    startTx(async () => {
      const res = await createLocationAction({ dealId, name: name.trim(), address: address.trim() || null, costCenter: finalCc || null })
      if (res.ok && res.data) {
        onCreated(res.data)
      } else {
        setError(res.error ?? 'Error al crear')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Nueva localización</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null) }}
              placeholder="Local Madrid Centro"
              className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Dirección</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="C/ Ejemplo 1, Madrid"
              className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Centro de coste</label>
            <select
              value={costCenter}
              onChange={(e) => setCc(e.target.value)}
              className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            >
              <option value="">— Sin centro de coste —</option>
              {COST_CENTERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {costCenter === 'Otro' && (
              <input
                type="text"
                value={customCc}
                onChange={(e) => setCustomCc(e.target.value)}
                placeholder="Centro de coste personalizado"
                className="mt-2 w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            )}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Guardando…' : 'Crear localización'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
            className="border border-zinc-200 rounded px-2 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full pr-5"
          />
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

      {/* Row 2: description (always visible) + unit input */}
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 60px 100px 28px' }}>
        <input
          type="text"
          value={line.description}
          onChange={(e) => onChange(line.id, { description: e.target.value })}
          placeholder="Descripción (aparece en la factura)"
          className="border border-zinc-200 rounded px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full bg-white"
        />
        {(isCustom || !line.serviceId) ? (
          <input
            type="text"
            value={line.unit}
            onChange={(e) => onChange(line.id, { unit: e.target.value })}
            placeholder="unidad"
            className="border border-zinc-200 rounded px-2 py-1 text-[10px] text-center text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 w-full"
          />
        ) : (
          <span className="text-[10px] text-zinc-400 text-center">{line.unit}</span>
        )}
        {svc?.note && (
          <div className="text-[10px] text-amber-600 text-right truncate">{svc.note}</div>
        )}
      </div>

      {/* Row 2b: Hardware/Software toggle — only for custom lines without catalog serviceId */}
      {(!line.serviceId || isCustom) && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-400">Tipo:</span>
          {(['software', 'hardware'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onChange(line.id, { itemCategory: cat })}
              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                (line.itemCategory ?? 'software') === cat
                  ? cat === 'hardware'
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-zinc-200 text-zinc-400 hover:border-zinc-300'
              }`}
            >
              {cat === 'hardware' ? '⬡ Hardware' : '◻ Software'}
            </button>
          ))}
        </div>
      )}

      {/* Row 3: Período (all regular lines) */}
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 90px 110px 60px 100px 28px' }}>
        <input
          type="text"
          value={line.period ?? ''}
          onChange={(e) => onChange(line.id, { period: e.target.value || undefined })}
          placeholder="Período (ej: Enero - Marzo 2026)"
          className="border border-zinc-100 rounded px-2 py-1 text-[10px] text-zinc-400 placeholder-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-200 w-full bg-zinc-50 focus:bg-white"
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
            className="border border-zinc-100 rounded px-2 py-1 text-[10px] text-emerald-600 placeholder-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-200 w-full bg-zinc-50 focus:bg-white col-span-4"
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

// =========================================
// GroupedLinesView
// =========================================

function GroupedLinesView({
  lines,
  subtotal,
  onUpdate,
  onRemove,
  onAddLine,
  onAddService,
}: {
  lines: FormLine[]
  subtotal: number
  onUpdate: (id: string, patch: Partial<FormLine>) => void
  onRemove: (id: string) => void
  onAddLine?: (group?: { id: string; name: string; address?: string | null }) => void
  onAddService?: (group?: { id: string; name: string; address?: string | null }) => void
}) {
  const hasGroups = lines.some((l) => l.locationGroupId)

  if (!hasGroups) {
    // Flat view (no locations selected)
    return (
      <div className="divide-y divide-zinc-50">
        {lines.map((line) =>
          line.type === 'line' ? (
            <RegularLineRow key={line.id} line={line} onChange={onUpdate} onRemove={onRemove} canRemove={lines.length > 1} />
          ) : (
            <DiscountLineRow key={line.id} line={line} subtotal={subtotal} onChange={onUpdate} onRemove={onRemove} />
          )
        )}
      </div>
    )
  }

  // Grouped view
  const seen = new Set<string>()
  const groupIds: Array<string | undefined> = []
  for (const l of lines) {
    const gid = l.locationGroupId ?? '__ungrouped__'
    if (!seen.has(gid)) { seen.add(gid); groupIds.push(l.locationGroupId) }
  }

  return (
    <div>
      {groupIds.map((gid) => {
        const groupLines = lines.filter((l) => (l.locationGroupId ?? undefined) === gid)
        const groupName = groupLines[0]?.locationGroupName ?? (gid ? gid : 'General')
        const groupAddr = groupLines[0]?.locationGroupAddress
        const group = gid ? { id: gid, name: groupName, address: groupAddr } : undefined

        return (
          <div key={gid ?? '__ungrouped__'}>
            {/* Group header */}
            <div className="flex items-center gap-2 px-5 py-2 bg-zinc-50 border-t border-zinc-100">
              <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">{groupName}</span>
              {groupAddr && <span className="text-[10px] text-zinc-400">{groupAddr}</span>}
            </div>
            {/* Group lines */}
            <div className="divide-y divide-zinc-50">
              {groupLines.map((line) =>
                line.type === 'line' ? (
                  <RegularLineRow key={line.id} line={line} onChange={onUpdate} onRemove={onRemove} canRemove={true} />
                ) : (
                  <DiscountLineRow key={line.id} line={line} subtotal={subtotal} onChange={onUpdate} onRemove={onRemove} />
                )
              )}
            </div>
            {/* Per-group add buttons */}
            {group && (
              <div className="px-5 py-2 flex items-center gap-2 border-b border-zinc-100 bg-white">
                <button
                  type="button"
                  onClick={() => onAddService?.(group)}
                  className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800 border border-zinc-200 hover:border-zinc-400 bg-white px-2.5 py-1 rounded-md transition-colors"
                >
                  ＋ Servicio
                </button>
                <button
                  type="button"
                  onClick={() => onAddLine?.(group)}
                  className="text-[11px] text-zinc-400 hover:text-zinc-600 border border-zinc-100 hover:border-zinc-300 px-2.5 py-1 rounded-md transition-colors"
                >
                  ＋ Línea vacía
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// =========================================
// ServicePickerModal
// =========================================

function ServicePickerModal({
  onPick,
  onClose,
}: {
  onPick: (serviceId: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const q = query.toLowerCase()

  const filtered = SERVICES.filter(
    (s) => !q || s.label.toLowerCase().includes(q) || s.group.toLowerCase().includes(q)
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold text-zinc-900">Añadir servicio</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-lg leading-none">✕</button>
        </div>
        <div className="px-4 py-3 border-b border-zinc-100 shrink-0">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar servicio…"
            className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
        </div>
        <div className="overflow-y-auto flex-1 pb-2">
          {SERVICE_GROUPS.map((group) => {
            const items = filtered.filter((s) => s.group === group)
            if (items.length === 0) return null
            return (
              <div key={group}>
                <div className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                  {group}
                </div>
                {items.map((svc) => (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => onPick(svc.id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 active:bg-zinc-100 transition-colors flex items-center justify-between gap-4"
                  >
                    <span className="text-sm text-zinc-800 leading-tight">
                      {svc.label}
                      {svc.note && (
                        <span className="ml-1.5 text-[10px] text-zinc-400">({svc.note})</span>
                      )}
                    </span>
                    <span className="text-xs font-mono text-zinc-400 shrink-0">
                      {svc.priceEditable
                        ? 'precio libre'
                        : `${svc.defaultPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`
                      }
                      {svc.unit ? ` / ${svc.unit}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-zinc-400 py-10">Sin resultados para &ldquo;{query}&rdquo;</p>
          )}
        </div>
      </div>
    </div>
  )
}
