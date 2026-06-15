'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GmailEmailResult } from '@/app/api/deals/[id]/gmail-search/route'

interface Props {
  dealId: string
  contactEmail: string | null | undefined
  gmailConnected: boolean
}

function formatEmailDate(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  )
}

export function GmailSearchPanel({ dealId, contactEmail, gmailConnected }: Props) {
  const router = useRouter()
  const [isSearching, setIsSearching] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [emails, setEmails] = useState<GmailEmailResult[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchError, setSearchError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSearch() {
    setSearchError(null)
    setEmails(null)
    setSelected(new Set())
    setIsSearching(true)
    setOpen(true)

    try {
      const res = await fetch(`/api/deals/${dealId}/gmail-search`)
      const json = (await res.json()) as { emails?: GmailEmailResult[]; error?: string }

      if (!res.ok || json.error) {
        setSearchError(json.error ?? 'Error al buscar emails')
      } else {
        setEmails(json.emails ?? [])
      }
    } catch {
      setSearchError('Error de red al consultar Gmail')
    } finally {
      setIsSearching(false)
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleImport() {
    if (!emails) return
    const toImport = emails.filter((e) => selected.has(e.id))
    if (toImport.length === 0) return

    setSearchError(null)
    setIsImporting(true)

    try {
      const res = await fetch(`/api/deals/${dealId}/gmail-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: toImport }),
      })

      const json = (await res.json()) as {
        comments_created?: number
        error?: string
        errors?: string[]
      }

      console.log('[gmail-import] response', res.status, json)

      if (!res.ok || !json.comments_created) {
        setSearchError(
          json.error ?? 'No se pudo importar ningún email. Inténtalo de nuevo.',
        )
        return
      }

      const n = json.comments_created
      showToast(`${n} email${n !== 1 ? 's' : ''} importado${n !== 1 ? 's' : ''}`)
      setOpen(false)
      setEmails(null)
      setSelected(new Set())
      router.refresh()
    } catch (err) {
      console.error('[gmail-import] fetch error:', err)
      setSearchError('Error de red al importar. Inténtalo de nuevo.')
    } finally {
      setIsImporting(false)
    }
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!gmailConnected) {
    return (
      <a
        href="/api/auth/gmail/connect"
        className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
        title="Conectar Gmail para buscar emails del contacto"
      >
        <GmailIcon />
        Conectar Gmail
      </a>
    )
  }

  // ── No contact email ───────────────────────────────────────────────────────
  if (!contactEmail) {
    return (
      <span className="text-[11px] text-zinc-400 italic">
        Añade un email de contacto al deal para buscar en Gmail
      </span>
    )
  }

  // ── Connected ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Trigger button */}
      <button
        onClick={handleSearch}
        disabled={isSearching || isImporting}
        className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {isSearching ? (
          <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <GmailIcon />
        )}
        {isSearching ? 'Buscando…' : 'Buscar emails en Gmail'}
      </button>

      {/* Toast */}
      {toast && (
        <p className="mt-2 text-[11px] text-emerald-600 font-medium">{toast}</p>
      )}

      {/* Results panel */}
      {open && (
        <div className="mt-4 border border-zinc-200 rounded-xl overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200">
            <div>
              <span className="text-xs font-semibold text-zinc-700">Emails de {contactEmail}</span>
              {emails !== null && (
                <span className="ml-2 text-[11px] text-zinc-400">
                  {emails.length === 0
                    ? 'Sin resultados'
                    : `${emails.length} encontrado${emails.length !== 1 ? 's' : ''}`}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Error state */}
          {searchError && (
            <div className="px-4 py-3 text-xs text-red-600 bg-red-50">{searchError}</div>
          )}

          {/* Loading state */}
          {isSearching && (
            <div className="px-4 py-8 text-center text-xs text-zinc-400">Buscando en Gmail…</div>
          )}

          {/* Empty state */}
          {!isSearching && emails?.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-zinc-400">
              No se encontraron emails con <strong>{contactEmail}</strong>
            </div>
          )}

          {/* Email list */}
          {!isSearching && emails && emails.length > 0 && (
            <>
              <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
                {emails.map((email) => (
                  <label
                    key={email.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(email.id)}
                      onChange={() => toggleSelect(email.id)}
                      className="mt-0.5 shrink-0 accent-zinc-900"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-zinc-800 truncate">
                          {email.subject}
                        </span>
                        <span className="text-[10px] text-zinc-400 shrink-0 tabular-nums">
                          {formatEmailDate(email.date)}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{email.from}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {email.snippet}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Import bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-t border-zinc-200">
                <span className="text-[11px] text-zinc-500">
                  {selected.size > 0
                    ? `${selected.size} seleccionado${selected.size !== 1 ? 's' : ''}`
                    : 'Selecciona emails para importar'}
                </span>
                <button
                  onClick={handleImport}
                  disabled={selected.size === 0 || isImporting}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white px-3.5 py-1.5 rounded-lg hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isImporting ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      Importando…
                    </>
                  ) : (
                    'Importar seleccionados'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function GmailIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 8l9 6 9-6M3 8v10a1 1 0 001 1h4v-7h8v7h4a1 1 0 001-1V8M3 8a1 1 0 011-1h16a1 1 0 011 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
