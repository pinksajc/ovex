'use client'

import { useState, useTransition } from 'react'
import { updateCompanyAction } from '@/app/actions/update-company'

interface CompanyEditorProps {
  dealId: string
  name: string
  brandName?: string
  cif?: string
  address?: string
  city?: string
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide w-20 shrink-0 pt-0.5">
        {label}
      </dt>
      <dd className={`text-sm text-zinc-800 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}

export function CompanyEditor({ dealId, name, brandName, cif, address, city }: CompanyEditorProps) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [displayName, setDisplayName]           = useState(name)
  const [displayBrandName, setDisplayBrandName] = useState(brandName ?? '')
  const [displayCif, setDisplayCif]             = useState(cif ?? '')
  const [displayAddress, setDisplayAddress]     = useState(address ?? '')
  const [displayCity, setDisplayCity]           = useState(city ?? '')

  const [nameVal, setNameVal]           = useState(name)
  const [brandNameVal, setBrandNameVal] = useState(brandName ?? '')
  const [cifVal, setCifVal]             = useState(cif ?? '')
  const [addressVal, setAddressVal]     = useState(address ?? '')
  const [cityVal, setCityVal]           = useState(city ?? '')

  function handleCancel() {
    setNameVal(displayName)
    setBrandNameVal(displayBrandName)
    setCifVal(displayCif)
    setAddressVal(displayAddress)
    setCityVal(displayCity)
    setError(null)
    setEditing(false)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateCompanyAction(dealId, nameVal.trim(), brandNameVal.trim(), cifVal.trim(), addressVal.trim(), cityVal.trim())
      if (result.ok) {
        setDisplayName(nameVal.trim())
        setDisplayBrandName(brandNameVal.trim())
        setDisplayCif(cifVal.trim())
        setDisplayAddress(addressVal.trim())
        setDisplayCity(cityVal.trim())
        setEditing(false)
      } else {
        setError(result.error)
      }
    })
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide block mb-1">
            Nombre
          </label>
          <input
            type="text"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            className="w-full text-sm border border-zinc-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
            placeholder="Empresa S.L."
            autoFocus
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide block mb-1">
            Marca
          </label>
          <input
            type="text"
            value={brandNameVal}
            onChange={(e) => setBrandNameVal(e.target.value)}
            className="w-full text-sm border border-zinc-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
            placeholder="Nombre comercial / marca"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide block mb-1">
            CIF
          </label>
          <input
            type="text"
            value={cifVal}
            onChange={(e) => setCifVal(e.target.value)}
            className="w-full text-sm font-mono border border-zinc-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
            placeholder="Ej: B12345678"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide block mb-1">
            Dirección fiscal
          </label>
          <input
            type="text"
            value={addressVal}
            onChange={(e) => setAddressVal(e.target.value)}
            className="w-full text-sm border border-zinc-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
            placeholder="Ej: Calle Mayor 1, Madrid"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide block mb-1">
            Ciudad
          </label>
          <input
            type="text"
            value={cityVal}
            onChange={(e) => setCityVal(e.target.value)}
            className="w-full text-sm border border-zinc-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
            placeholder="Ej: Madrid"
          />
        </div>

        {error && <p className="text-[11px] text-red-500 leading-tight">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="text-xs font-medium bg-zinc-900 text-white px-3 py-1.5 rounded-md hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="text-xs text-zinc-400 hover:text-zinc-700 cursor-pointer disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <dl className="space-y-2">
      <div className="flex items-start justify-between group">
        <div className="flex-1 space-y-2">
          <Row label="Nombre"    value={displayName} />
          {displayBrandName && <Row label="Marca"     value={displayBrandName} />}
          {displayCif       && <Row label="CIF"       value={displayCif}       mono />}
          {displayAddress   && <Row label="Dirección" value={displayAddress}   />}
          {displayCity      && <Row label="Ciudad"    value={displayCity}      />}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 cursor-pointer flex-shrink-0"
          title="Editar empresa"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </dl>
  )
}
