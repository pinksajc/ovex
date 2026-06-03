'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createLocationAction,
  updateLocationAction,
  deleteLocationAction,
} from '@/app/actions/company-locations'
import type { CompanyLocation } from '@/types'

const COST_CENTERS = ['Operaciones', 'Administración', 'Tecnología', 'Marketing', 'RRHH', 'Otro']

// ── Row ───────────────────────────────────────────────────────────────────────

function LocationRow({
  loc,
  dealId,
  onUpdated,
  onDeleted,
}: {
  loc: CompanyLocation
  dealId: string
  onUpdated: (loc: CompanyLocation) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing]       = useState(false)
  const [name, setName]             = useState(loc.name)
  const [address, setAddress]       = useState(loc.address ?? '')
  const [costCenter, setCc]         = useState(loc.costCenter ?? '')
  const [customCc, setCustomCc]     = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [isPending, startTx]        = useTransition()

  function handleSave() {
    if (!name.trim()) { setError('Nombre obligatorio'); return }
    const finalCc = costCenter === 'Otro' ? customCc.trim() : costCenter
    startTx(async () => {
      const res = await updateLocationAction(loc.id, dealId, {
        name: name.trim(),
        address: address.trim() || null,
        costCenter: finalCc || null,
      })
      if (res.ok) {
        onUpdated({ ...loc, name: name.trim(), address: address.trim() || null, costCenter: finalCc || null })
        setEditing(false)
        setError(null)
      } else {
        setError(res.error ?? 'Error')
      }
    })
  }

  function handleDelete() {
    startTx(async () => {
      const res = await deleteLocationAction(loc.id, dealId)
      if (res.ok) onDeleted(loc.id)
      else setError(res.error ?? 'Error')
    })
  }

  if (editing) {
    return (
      <div className="py-3 space-y-2 border-b border-zinc-50">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Nombre</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs bg-zinc-100 rounded-lg px-2.5 py-1.5 border-0 focus:outline-none focus:ring-1 focus:ring-zinc-300"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Dirección</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full text-xs bg-zinc-100 rounded-lg px-2.5 py-1.5 border-0 focus:outline-none focus:ring-1 focus:ring-zinc-300"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Centro de coste</label>
          <select
            value={costCenter}
            onChange={(e) => setCc(e.target.value)}
            className="w-full text-xs bg-zinc-100 rounded-lg px-2.5 py-1.5 border-0 focus:outline-none focus:ring-1 focus:ring-zinc-300"
          >
            <option value="">— Sin centro de coste —</option>
            {COST_CENTERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {costCenter === 'Otro' && (
            <input
              type="text"
              value={customCc}
              onChange={(e) => setCustomCc(e.target.value)}
              placeholder="Personalizado…"
              className="mt-1.5 w-full text-xs bg-zinc-100 rounded-lg px-2.5 py-1.5 border-0 focus:outline-none focus:ring-1 focus:ring-zinc-300"
            />
          )}
        </div>
        {error && <p className="text-[11px] text-red-500">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-3 py-1 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={() => { setEditing(false); setName(loc.name); setAddress(loc.address ?? ''); setCc(loc.costCenter ?? ''); setError(null) }}
            disabled={isPending}
            className="text-xs text-zinc-500 hover:text-zinc-700"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start justify-between py-2.5 border-b border-zinc-50">
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-800 truncate">{loc.name}</p>
        {loc.address && <p className="text-[11px] text-zinc-400 truncate">{loc.address}</p>}
        {loc.costCenter && (
          <span className="inline-block mt-0.5 text-[9px] font-semibold uppercase tracking-wide bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">
            {loc.costCenter}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          title="Editar"
        >
          <PencilIcon className="w-3 h-3" />
        </button>
        {confirmDel ? (
          <>
            <span className="text-[10px] text-zinc-500">¿Eliminar?</span>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-[10px] font-semibold text-red-600 hover:text-red-700 px-1.5 disabled:opacity-50"
            >
              Sí
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              disabled={isPending}
              className="text-[10px] text-zinc-400 hover:text-zinc-600"
            >
              No
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Eliminar"
          >
            <TrashIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function DealLocationsPanel({
  dealId,
  initialLocations,
}: {
  dealId: string
  initialLocations: CompanyLocation[]
}) {
  const router = useRouter()
  const [locations, setLocations] = useState<CompanyLocation[]>(initialLocations)
  const [showCreate, setShowCreate] = useState(false)

  // Create form state
  const [newName, setNewName]       = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newCc, setNewCc]           = useState('')
  const [newCustomCc, setNewCustomCc] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [isPending, startTx]          = useTransition()

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) { setCreateError('Nombre obligatorio'); return }
    const finalCc = newCc === 'Otro' ? newCustomCc.trim() : newCc
    startTx(async () => {
      const res = await createLocationAction({
        dealId,
        name: newName.trim(),
        address: newAddress.trim() || null,
        costCenter: finalCc || null,
      })
      if (res.ok && res.data) {
        setLocations((prev) => [...prev, res.data!])
        setShowCreate(false)
        setNewName(''); setNewAddress(''); setNewCc(''); setNewCustomCc(''); setCreateError(null)
        router.refresh()
      } else {
        setCreateError(res.error ?? 'Error')
      }
    })
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Localizaciones</h3>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs font-medium text-zinc-700 border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Nueva localización
          </button>
        )}
      </div>

      {locations.length === 0 && !showCreate && (
        <p className="text-xs text-zinc-400 italic">No hay localizaciones para este deal.</p>
      )}

      {locations.map((loc) => (
        <LocationRow
          key={loc.id}
          loc={loc}
          dealId={dealId}
          onUpdated={(updated) => setLocations((prev) => prev.map((l) => l.id === updated.id ? updated : l))}
          onDeleted={(id) => setLocations((prev) => prev.filter((l) => l.id !== id))}
        />
      ))}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-3 space-y-3 pt-3 border-t border-zinc-100">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Nueva localización</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1">Nombre *</label>
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setCreateError(null) }}
                placeholder="Local Madrid Centro"
                className="w-full text-xs bg-zinc-100 rounded-lg px-2.5 py-1.5 border-0 focus:outline-none focus:ring-1 focus:ring-zinc-300"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1">Dirección</label>
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="C/ Ejemplo 1, Madrid"
                className="w-full text-xs bg-zinc-100 rounded-lg px-2.5 py-1.5 border-0 focus:outline-none focus:ring-1 focus:ring-zinc-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 mb-1">Centro de coste</label>
            <select
              value={newCc}
              onChange={(e) => setNewCc(e.target.value)}
              className="w-full text-xs bg-zinc-100 rounded-lg px-2.5 py-1.5 border-0 focus:outline-none focus:ring-1 focus:ring-zinc-300"
            >
              <option value="">— Sin centro de coste —</option>
              {COST_CENTERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {newCc === 'Otro' && (
              <input
                type="text"
                value={newCustomCc}
                onChange={(e) => setNewCustomCc(e.target.value)}
                placeholder="Personalizado…"
                className="mt-1.5 w-full text-xs bg-zinc-100 rounded-lg px-2.5 py-1.5 border-0 focus:outline-none focus:ring-1 focus:ring-zinc-300"
              />
            )}
          </div>
          {createError && <p className="text-[11px] text-red-500">{createError}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="px-3 py-1 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Creando…' : 'Crear'}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setCreateError(null) }}
              disabled={isPending}
              className="text-xs text-zinc-500 hover:text-zinc-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8.5 1.5 10.5 3.5 4 10H2V8L8.5 1.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3h10M4 3V1.5h4V3M5 5.5v3M7 5.5v3M2 3l.75 7.5h6.5L10 3" />
    </svg>
  )
}
