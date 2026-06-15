'use client'

import { useState, useTransition } from 'react'
import { updateContactAction } from '@/app/actions/update-contact'

interface ContactEditorProps {
  dealId: string
  name: string
  emails: string[]   // at least one element
  phone?: string
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

export function ContactEditor({ dealId, name, emails: initialEmails, phone }: ContactEditorProps) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState(name)
  const [displayEmails, setDisplayEmails] = useState<string[]>(
    initialEmails.length > 0 ? initialEmails : ['']
  )

  const { first: initFirst, last: initLast } = splitName(displayName)
  const [firstName, setFirstName] = useState(initFirst)
  const [lastName, setLastName] = useState(initLast)
  const [emailFields, setEmailFields] = useState<string[]>(
    displayEmails.length > 0 ? [...displayEmails] : ['']
  )

  function handleCancel() {
    const { first, last } = splitName(displayName)
    setFirstName(first)
    setLastName(last)
    setEmailFields([...displayEmails])
    setError(null)
    setEditing(false)
  }

  function handleAddEmail() {
    setEmailFields((prev) => [...prev, ''])
  }

  function handleRemoveEmail(i: number) {
    setEmailFields((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleEmailChange(i: number, val: string) {
    setEmailFields((prev) => prev.map((e, idx) => (idx === i ? val : e)))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateContactAction('', firstName, lastName, emailFields, dealId)
      if (result.ok) {
        const newName = `${firstName} ${lastName}`.trim()
        setDisplayName(newName)
        const clean = emailFields.map((e) => e.trim()).filter(Boolean)
        setDisplayEmails(clean.length > 0 ? clean : [''])
        setEditing(false)
      } else {
        setError(result.error)
      }
    })
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
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
          <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide block mb-1.5">
            Email{emailFields.length > 1 ? 's' : ''}
          </label>
          <div className="space-y-2">
            {emailFields.map((email, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(i, e.target.value)}
                  className="flex-1 text-sm border border-zinc-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
                  placeholder={i === 0 ? 'email@empresa.com' : 'otro@empresa.com'}
                />
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(i)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors rounded"
                    title="Eliminar email"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddEmail}
            className="mt-2 text-xs text-zinc-400 hover:text-zinc-700 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 1v10M1 6h10" strokeLinecap="round" />
            </svg>
            Añadir email
          </button>
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

  // ── View mode ──────────────────────────────────────────────────────────────
  return (
    <dl className="space-y-2">
      <div className="flex items-start justify-between group">
        <div className="flex-1 space-y-2">
          <ContactRow label="Nombre" value={displayName} />
          {displayEmails.filter(Boolean).map((e, i) => (
            <ContactRow key={i} label={i === 0 ? 'Email' : ''} value={e} />
          ))}
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
      <dd className={`text-sm text-zinc-900 ${mono ? 'font-mono' : ''}`}>{value || '—'}</dd>
    </div>
  )
}
