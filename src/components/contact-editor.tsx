'use client'

import { useState, useTransition } from 'react'
import { updateContactAction } from '@/app/actions/update-contact'

interface ContactEditorProps {
  personRecordId: string
  name: string        // full name as stored (e.g. "Juan García")
  email: string
  phone?: string
}

/** Splits a full name string into first + last best-effort. */
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  const first = parts[0]
  const last = parts.slice(1).join(' ')
  return { first, last }
}

export function ContactEditor({ personRecordId, name, email, phone }: ContactEditorProps) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Display state — updated locally on save so UI reflects changes immediately
  const [displayName, setDisplayName] = useState(name)
  const [displayEmail, setDisplayEmail] = useState(email)

  const { first: initialFirst, last: initialLast } = splitName(displayName)
  const [firstName, setFirstName] = useState(initialFirst)
  const [lastName, setLastName] = useState(initialLast)
  const [emailVal, setEmailVal] = useState(displayEmail)

  function handleCancel() {
    const { first, last } = splitName(displayName)
    setFirstName(first)
    setLastName(last)
    setEmailVal(displayEmail)
    setError(null)
    setEditing(false)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateContactAction(personRecordId, firstName, lastName, emailVal)
      if (result.ok) {
        const newName = `${firstName} ${lastName}`.trim()
        setDisplayName(newName)
        setDisplayEmail(emailVal)
        setEditing(false)
      } else {
        setError(result.error)
      }
    })
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide block mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
              placeholder="Nombre"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide block mb-1">
              Apellido
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
              placeholder="Apellido"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide block mb-1">
            Email
          </label>
          <input
            type="email"
            value={emailVal}
            onChange={(e) => setEmailVal(e.target.value)}
            className="w-full text-sm border border-zinc-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
            placeholder="email@empresa.com"
          />
        </div>

        {error && (
          <p className="text-[11px] text-red-500 leading-tight">{error}</p>
        )}

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
      <div className="flex items-center justify-between group">
        <div className="flex-1 space-y-2">
          <ContactRow label="Nombre" value={displayName} />
          <ContactRow label="Email" value={displayEmail} />
          {phone && <ContactRow label="Teléfono" value={phone} mono />}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 cursor-pointer flex-shrink-0"
          title="Editar contacto"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </dl>
  )
}

function ContactRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-xs text-zinc-400 w-20 flex-shrink-0">{label}</dt>
      <dd className={`text-sm text-zinc-900 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}
