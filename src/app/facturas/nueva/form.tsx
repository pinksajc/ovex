'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createInvoiceAction } from '@/app/actions/invoices'
import type { InvoiceType } from '@/types'

interface DealOption {
  id: string
  company: { name: string; cif?: string; address?: string }
}

interface Props {
  deals: DealOption[]
}

export function NewInvoiceForm({ deals }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [type, setType] = useState<InvoiceType>('ordinary')
  const [dealId, setDealId] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientCif, setClientCif] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [concept, setConcept] = useState('')
  const [amountNet, setAmountNet] = useState('')
  const [vatRate, setVatRate] = useState('21')
  const [issuedAt, setIssuedAt] = useState(() => new Date().toISOString().split('T')[0])
  const [dueAt, setDueAt] = useState('')
  const [rectifiesId, setRectifiesId] = useState('')

  const net = parseFloat(amountNet) || 0
  const vat = parseFloat(vatRate) || 21
  const vatAmount = net * (vat / 100)
  const total = net + vatAmount

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
    if (!concept.trim()) return setError('El concepto es obligatorio.')
    if (!amountNet || isNaN(net) || net <= 0) return setError('El importe neto debe ser mayor que 0.')

    startTransition(async () => {
      const result = await createInvoiceAction({
        type,
        dealId: dealId || null,
        clientName: clientName.trim(),
        clientCif: clientCif.trim() || null,
        clientAddress: clientAddress.trim() || null,
        concept: concept.trim(),
        amountNet: net,
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
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Autocompletar desde deal
            </label>
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

      {/* Concepto e importes */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Concepto e importes</h2>

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            Concepto <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Servicios de software mensual — Enero 2026"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Importe neto (€) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={amountNet}
              onChange={(e) => setAmountNet(e.target.value)}
              placeholder="0.00"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">IVA (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Total (€)</label>
            <div className="w-full border border-zinc-100 bg-zinc-50 rounded-lg px-3 py-2 text-sm font-mono font-semibold text-zinc-900">
              {total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {net > 0 && (
          <div className="bg-zinc-50 rounded-lg px-4 py-3 text-xs text-zinc-600 space-y-1">
            <div className="flex justify-between">
              <span>Base imponible</span>
              <span className="font-mono">{net.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
            </div>
            <div className="flex justify-between">
              <span>IVA ({vat}%)</span>
              <span className="font-mono">{vatAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
            </div>
            <div className="flex justify-between font-semibold text-zinc-900 border-t border-zinc-200 pt-1 mt-1">
              <span>Total factura</span>
              <span className="font-mono">{total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
            </div>
          </div>
        )}
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
