'use client'

// "Generar contrato" button + modal form.
// Only rendered for accepted offers (enforced by the parent server component).

import { useState, useTransition } from 'react'
import { saveContratoAction } from '@/app/actions/contratos'
import type { InvoiceLineItem } from '@/types'
import { SERVICE_MAP } from '@/lib/invoice-catalog'

interface Props {
  presupuestoId: string
  dealId: string | null
  clientName: string
  clientCif: string | null
  clientAddress: string | null
  lineItems?: InvoiceLineItem[]
  savedEquipment?: EquipmentRow[] | null
}

interface EquipmentRow {
  n: number
  tipo: string
  marca: string
  color: string
  serie: string
  funcion: string
  origen: 'Platomico' | 'Cliente'
  cuotaMensual: string
}

function buildEquipmentRows(items: InvoiceLineItem[]): EquipmentRow[] {
  const rows: EquipmentRow[] = []
  let n = 1
  for (const item of items) {
    if (item.type !== 'line') continue
    const entry = item.serviceId ? SERVICE_MAP.get(item.serviceId) : undefined
    const isHw = entry?.group === 'HARDWARE' || (item as any).itemCategory === 'hardware'
    if (!isHw) continue
    const isRental = item.serviceId?.includes('rental') || item.serviceId?.includes('financed')
    const count = Math.max(1, Math.round(item.quantity))
    for (let i = 0; i < count; i++) {
      rows.push({
        n: n++,
        tipo: entry?.label ?? item.description ?? '—',
        marca: '',
        color: '',
        serie: '',
        funcion: '',
        origen: 'Platomico',
        cuotaMensual: isRental ? String(item.unitPrice) : '',
      })
    }
  }
  return rows
}

export function GenerarContratoButton({
  presupuestoId,
  dealId,
  clientName,
  clientCif,
  clientAddress,
  lineItems = [],
  savedEquipment,
}: Props) {
  const [isOpen, setIsOpen]          = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const [success, setSuccess]        = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const [duracion,    setDuracion]    = useState('12')
  const [permanencia, setPermanencia] = useState('12')
  const [pago,        setPago]        = useState('Transferencia bancaria')
  const [inicio,      setInicio]      = useState(today)
  const [notas,       setNotas]       = useState('')
  const lsKey = `equipment-draft-${presupuestoId}`
  const [equipment, setEquipment] = useState<EquipmentRow[]>(() => {
    try {
      const draft = typeof window !== 'undefined' ? localStorage.getItem(lsKey) : null
      if (draft) return JSON.parse(draft)
    } catch {}
    if (savedEquipment && savedEquipment.length > 0) return savedEquipment
    return buildEquipmentRows(lineItems)
  })

  function updateEquipment(n: number, field: keyof EquipmentRow, value: string) {
    setEquipment(prev => {
      const next = prev.map(r => r.n === n ? { ...r, [field]: value } : r)
      try { localStorage.setItem(lsKey, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function buildDownloadUrl() {
    const params = new URLSearchParams({
      id:          presupuestoId,
      duracion:    duracion    || '12',
      permanencia: permanencia || '12',
      pago,
      inicio,
    })
    if (notas.trim()) params.set('notas', notas.trim())
    if (equipment.length > 0) params.set('equipment', JSON.stringify(equipment))
    return `/api/contratos/generate-pdf?${params.toString()}`
  }

  function handleClose() {
    setIsOpen(false)
    setError(null)
    setSuccess(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const dur = parseInt(duracion,    10) || 12
    const per = parseInt(permanencia, 10) || 12

    startTransition(async () => {
      const res = await saveContratoAction({
        presupuestoId,
        dealId,
        duracionMeses:    dur,
        permanenciaMeses: per,
        formaPago: pago,
        fechaInicio: inicio,
        notas: notas.trim() || null,
        equipment: equipment.length > 0 ? equipment : null,
      })

      if (!res.ok) { setError(res.error); return }

      setSuccess(true)

      const url = buildDownloadUrl()
      const a = document.createElement('a')
      a.href = url
      a.download = `Contrato-${presupuestoId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      setTimeout(() => handleClose(), 1200)
    })
  }

  const FUNCIONES = ['POS', 'Kiosko', 'KDS', 'Otro']

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="1" width="10" height="12" rx="1.5" />
          <path d="M4 4h6M4 7h6M4 10h3" strokeLinecap="round" />
        </svg>
        Generar contrato
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true" role="dialog">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">Generar contrato</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Configura los términos y descarga el PDF listo para firma.</p>
                </div>
                <button
                  onClick={handleClose}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">

                {/* Proveedor */}
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">Proveedor</p>
                  <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 space-y-0.5">
                    <p className="text-xs font-semibold text-zinc-800">Platomico, S.L.</p>
                    <p className="text-[11px] text-zinc-500">NIF: B22741094 · C/ Antonio Machado 9, Rozas de Puerto Real, Madrid 28649</p>
                    <p className="text-[11px] text-zinc-500">Representado por <span className="font-medium text-zinc-700">César Augusto Castro Sáder</span>, Administrador Único</p>
                  </div>
                </div>

                {/* Cliente */}
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">Cliente</p>
                  <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 space-y-0.5">
                    <p className="text-xs font-semibold text-zinc-800">{clientName}</p>
                    {clientCif     && <p className="text-[11px] text-zinc-500">NIF/CIF: {clientCif}</p>}
                    {clientAddress && <p className="text-[11px] text-zinc-500">{clientAddress}</p>}
                  </div>
                </div>

                {/* Términos */}
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Términos del contrato</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5">Duración <span className="font-normal text-zinc-400">(meses)</span></label>
                      <input type="number" min={1} max={120} value={duracion} onChange={e => setDuracion(e.target.value)} required className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5">Permanencia <span className="font-normal text-zinc-400">(meses)</span></label>
                      <input type="number" min={0} max={120} value={permanencia} onChange={e => setPermanencia(e.target.value)} required className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5">Forma de pago</label>
                      <select value={pago} onChange={e => setPago(e.target.value)} className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white">
                        <option>Transferencia bancaria</option>
                        <option>Domiciliación bancaria (SEPA)</option>
                        <option>Tarjeta de crédito/débito</option>
                        <option>Cheque</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5">Fecha de inicio</label>
                      <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} required className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Notas adicionales <span className="font-normal text-zinc-400">(opcional)</span></label>
                    <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Condiciones especiales, SLA personalizado…" className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
                  </div>
                </div>

                {/* Inventario de equipos */}
                {equipment.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                      Inventario de equipos <span className="font-normal normal-case tracking-normal">(Anexo III)</span>
                    </p>
                    <div className="space-y-3">
                      {equipment.map(row => (
                        <div key={row.n} className="border border-zinc-100 rounded-xl px-4 py-3 bg-zinc-50/50">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-200 text-zinc-600 text-[10px] font-bold">{row.n}</span>
                            <span className="text-xs font-semibold text-zinc-800">{row.tipo}</span>
                            {row.cuotaMensual && <span className="ml-auto text-[10px] text-zinc-400">{row.cuotaMensual} €/mes</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] text-zinc-500 mb-1">Marca / Modelo</label>
                              <input
                                type="text"
                                value={row.marca}
                                onChange={e => updateEquipment(row.n, 'marca', e.target.value)}
                                placeholder="ej: Apple iPad 10ª Gen"
                                className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400/50 focus:border-blue-300"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-zinc-500 mb-1">Nº Serie / ID</label>
                              <input
                                type="text"
                                value={row.serie}
                                onChange={e => updateEquipment(row.n, 'serie', e.target.value)}
                                placeholder="ej: DMPM2LL/A"
                                className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400/50 focus:border-blue-300"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-zinc-500 mb-1">Color</label>
                              <input
                                type="text"
                                value={row.color}
                                onChange={e => updateEquipment(row.n, 'color', e.target.value)}
                                placeholder="ej: Plata"
                                className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400/50 focus:border-blue-300"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-zinc-500 mb-1">Función</label>
                              <select
                                value={row.funcion}
                                onChange={e => updateEquipment(row.n, 'funcion', e.target.value)}
                                className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400/50 focus:border-blue-300"
                              >
                                <option value="">— Seleccionar —</option>
                                {FUNCIONES.map(f => <option key={f}>{f}</option>)}
                              </select>
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[10px] text-zinc-500 mb-1">Origen</label>
                              <div className="flex gap-2">
                                {(['Platomico', 'Cliente'] as const).map(o => (
                                  <button
                                    key={o}
                                    type="button"
                                    onClick={() => updateEquipment(row.n, 'origen', o)}
                                    className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${
                                      row.origen === o
                                        ? 'bg-zinc-900 text-white border-zinc-900'
                                        : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'
                                    }`}
                                  >
                                    {o}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error / success */}
                {error   && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
                {success && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">✓ Contrato guardado y PDF descargando…</p>}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-1 border-t border-zinc-100">
                  <button type="button" onClick={handleClose} disabled={isPending} className="text-xs font-medium text-zinc-500 hover:text-zinc-800 px-4 py-2 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50">
                    Cancelar
                  </button>
                  <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                    {isPending ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 14 14" fill="none">
                          <circle className="opacity-25" cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="2" />
                          <path className="opacity-75" fill="currentColor" d="M7 1.5A5.5 5.5 0 0 1 12.5 7h-2A3.5 3.5 0 0 0 7 3.5v-2z" />
                        </svg>
                        Generando…
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M2 11h10" strokeLinecap="round" />
                        </svg>
                        Generar y descargar PDF
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
