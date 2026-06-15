'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import type { AuthUser } from '@/lib/auth'
import type { AttioCompany, AttioPerson, AttioLead } from '@/app/api/leads/attio/route'
import type { DealStage } from '@/types'

const STAGES: { value: DealStage; label: string }[] = [
  { value: 'prospecting',   label: 'Prospecto'     },
  { value: 'qualified',     label: 'Contactado'    },
  { value: 'proposal_sent', label: 'Demo'          },
  { value: 'negotiation',   label: 'Negociación'   },
]

interface Props {
  currentUser: AuthUser
  members: AuthUser[]
  convertedNames: Set<string>
  convertedEmails: Set<string>
}

function isConverted(lead: AttioLead, names: Set<string>, emails: Set<string>) {
  if (lead.type === 'company') return names.has(lead.name.toLowerCase().trim())
  return (
    names.has(lead.name.toLowerCase().trim()) ||
    (!!lead.email && emails.has(lead.email.toLowerCase().trim()))
  )
}

function fmt(dateStr: string) {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateStr))
  } catch { return '—' }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg text-sm font-medium text-white shadow-lg"
      style={{ background: '#7C72E8' }}>
      {msg}
    </div>
  )
}

// ── Convert Modal ─────────────────────────────────────────────────────────────
function ConvertModal({
  lead,
  members,
  currentUserId,
  onClose,
  onConverted,
}: {
  lead: AttioLead
  members: AuthUser[]
  currentUserId: string
  onClose: () => void
  onConverted: () => void
}) {
  const [stage, setStage]   = useState<DealStage>('prospecting')
  const [owner, setOwner]   = useState(currentUserId)
  const [pending, start]    = useTransition()
  const [error, setError]   = useState<string | null>(null)

  const defaults = useMemo(() => {
    if (lead.type === 'company') {
      return {
        companyName:      lead.name,
        companyCity:      lead.city ?? '',
        contactFirstName: '',
        contactLastName:  '',
        contactEmail:     '',
        contactPhone:     '',
      }
    }
    const parts = lead.name.split(' ')
    return {
      companyName:      lead.company ?? lead.name,
      companyCity:      '',
      contactFirstName: parts[0] ?? '',
      contactLastName:  parts.slice(1).join(' '),
      contactEmail:     lead.email ?? '',
      contactPhone:     lead.phone ?? '',
    }
  }, [lead])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await fetch('/api/leads/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...defaults, stage, ownerId: owner }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setError(d.error ?? 'Error al crear el deal')
        return
      }
      onConverted()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-md rounded-xl border shadow-xl p-6" style={{ background: '#18181B', borderColor: '#2D2D35' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Convertir a Deal</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg leading-none">×</button>
        </div>

        {/* Pre-filled summary */}
        <div className="rounded-lg px-4 py-3 mb-5 text-sm" style={{ background: '#0E0E11', border: '1px solid #2D2D35' }}>
          <p className="text-white font-medium">{defaults.companyName}</p>
          {defaults.contactEmail && <p className="text-zinc-400 mt-0.5">{defaults.contactEmail}</p>}
          {defaults.companyCity && <p className="text-zinc-500 text-xs mt-0.5">{defaults.companyCity}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-widest">Stage</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as DealStage)}
              className="w-full px-3 py-2.5 text-sm text-white rounded-lg border focus:outline-none"
              style={{ background: '#1C1C21', borderColor: '#33333B' }}
            >
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-widest">Owner</label>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-white rounded-lg border focus:outline-none"
              style={{ background: '#1C1C21', borderColor: '#33333B' }}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-400 rounded px-3 py-2" style={{ background: 'rgba(127,29,29,0.25)' }}>{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm rounded-lg border text-zinc-300 hover:text-white transition-colors"
              style={{ borderColor: '#33333B', background: 'transparent' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-2.5 text-sm rounded-lg font-semibold text-white disabled:opacity-50 transition-colors"
              style={{ background: '#7C72E8' }}
            >
              {pending ? 'Creando…' : 'Crear Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main client component ─────────────────────────────────────────────────────
export function LeadsClient({ currentUser, members, convertedNames, convertedEmails }: Props) {
  const [tab, setTab]             = useState<'companies' | 'people'>('companies')
  const [query, setQuery]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [companies, setCompanies] = useState<AttioCompany[]>([])
  const [people, setPeople]       = useState<AttioPerson[]>([])
  const [convertedSet, setConvertedSet] = useState({ names: convertedNames, emails: convertedEmails })
  const [modal, setModal]         = useState<AttioLead | null>(null)
  const [toast, setToast]         = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/leads/attio')
      .then((r) => r.json())
      .then((d: { companies?: AttioCompany[]; people?: AttioPerson[]; error?: string }) => {
        if (d.error) { setError(d.error); return }
        setCompanies(d.companies ?? [])
        setPeople(d.people ?? [])
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const q = query.toLowerCase()

  const filteredCompanies = useMemo(
    () => companies.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.domain ?? '').toLowerCase().includes(q)),
    [companies, q]
  )

  const filteredPeople = useMemo(
    () => people.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q) || (p.company ?? '').toLowerCase().includes(q)),
    [people, q]
  )

  function handleConverted() {
    if (!modal) return
    // Optimistically mark as converted
    setConvertedSet((prev) => {
      const names  = new Set(prev.names)
      const emails = new Set(prev.emails)
      names.add(modal.type === 'company' ? modal.name.toLowerCase().trim() : (modal as AttioPerson).company?.toLowerCase().trim() ?? modal.name.toLowerCase().trim())
      if (modal.type === 'person' && (modal as AttioPerson).email) emails.add((modal as AttioPerson).email!.toLowerCase().trim())
      return { names, emails }
    })
    setToast('Deal creado correctamente')
  }

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-md transition-colors ${active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Leads</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Empresas y contactos de Attio</p>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#18181B' }}>
          <button className={tabCls(tab === 'companies')} onClick={() => setTab('companies')}>
            Companies {!loading && <span className="ml-1.5 text-xs text-zinc-500">({companies.length})</span>}
          </button>
          <button className={tabCls(tab === 'people')} onClick={() => setTab('people')}>
            People {!loading && <span className="ml-1.5 text-xs text-zinc-500">({people.length})</span>}
          </button>
        </div>

        <input
          type="text"
          placeholder="Buscar…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="px-3 py-2 text-sm text-white rounded-lg border w-56 focus:outline-none placeholder:text-zinc-600"
          style={{ background: '#18181B', borderColor: '#2D2D35' }}
        />
      </div>

      {/* Content */}
      {loading && (
        <div className="text-center text-zinc-500 py-20 text-sm">Cargando desde Attio…</div>
      )}

      {!loading && error && (
        <div className="rounded-lg px-4 py-3 text-sm text-red-400 border" style={{ background: 'rgba(127,29,29,0.2)', borderColor: 'rgba(153,27,27,0.4)' }}>
          Error al cargar leads: {error}
        </div>
      )}

      {!loading && !error && tab === 'companies' && (
        <CompaniesTable
          rows={filteredCompanies}
          convertedNames={convertedSet.names}
          onConvert={setModal}
        />
      )}

      {!loading && !error && tab === 'people' && (
        <PeopleTable
          rows={filteredPeople}
          convertedNames={convertedSet.names}
          convertedEmails={convertedSet.emails}
          onConvert={setModal}
        />
      )}

      {/* Modal */}
      {modal && (
        <ConvertModal
          lead={modal}
          members={members}
          currentUserId={currentUser.id}
          onClose={() => setModal(null)}
          onConverted={handleConverted}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  )
}

// ── Companies table ───────────────────────────────────────────────────────────
function CompaniesTable({
  rows,
  convertedNames,
  onConvert,
}: {
  rows: AttioCompany[]
  convertedNames: Set<string>
  onConvert: (lead: AttioLead) => void
}) {
  if (rows.length === 0) return <EmptyState label="No se encontraron empresas" />

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#2D2D35' }}>
      <table className="w-full text-sm">
        <thead style={{ background: '#18181B' }}>
          <tr className="border-b" style={{ borderColor: '#2D2D35' }}>
            <Th>Nombre</Th>
            <Th>Dominio</Th>
            <Th>Ciudad</Th>
            <Th>Entrada Attio</Th>
            <Th>Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const converted = convertedNames.has(c.name.toLowerCase().trim())
            return (
              <tr key={c.attioId} className="border-b hover:bg-zinc-800/30 transition-colors" style={{ borderColor: '#2D2D35' }}>
                <td className="px-4 py-3 text-white font-medium">
                  <span>{c.name}</span>
                  {converted && <ConvertedBadge />}
                </td>
                <td className="px-4 py-3 text-zinc-400">{c.domain ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-400">{c.city ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{fmt(c.createdAt)}</td>
                <td className="px-4 py-3">
                  {!converted && (
                    <button
                      onClick={() => onConvert(c)}
                      className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                      style={{ background: 'rgba(124,114,232,0.15)', color: '#A89FEF' }}
                    >
                      Convertir a Deal →
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── People table ──────────────────────────────────────────────────────────────
function PeopleTable({
  rows,
  convertedNames,
  convertedEmails,
  onConvert,
}: {
  rows: AttioPerson[]
  convertedNames: Set<string>
  convertedEmails: Set<string>
  onConvert: (lead: AttioLead) => void
}) {
  if (rows.length === 0) return <EmptyState label="No se encontraron personas" />

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#2D2D35' }}>
      <table className="w-full text-sm">
        <thead style={{ background: '#18181B' }}>
          <tr className="border-b" style={{ borderColor: '#2D2D35' }}>
            <Th>Nombre</Th>
            <Th>Email</Th>
            <Th>Teléfono</Th>
            <Th>Empresa</Th>
            <Th>Entrada Attio</Th>
            <Th>Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const converted =
              convertedNames.has(p.name.toLowerCase().trim()) ||
              (!!p.email && convertedEmails.has(p.email.toLowerCase().trim()))
            return (
              <tr key={p.attioId} className="border-b hover:bg-zinc-800/30 transition-colors" style={{ borderColor: '#2D2D35' }}>
                <td className="px-4 py-3 text-white font-medium">
                  <span>{p.name}</span>
                  {converted && <ConvertedBadge />}
                </td>
                <td className="px-4 py-3 text-zinc-400">{p.email ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-400">{p.phone ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-400">{p.company ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{fmt(p.createdAt)}</td>
                <td className="px-4 py-3">
                  {!converted && (
                    <button
                      onClick={() => onConvert(p)}
                      className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                      style={{ background: 'rgba(124,114,232,0.15)', color: '#A89FEF' }}
                    >
                      Convertir a Deal →
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-widest">{children}</th>
  )
}

function ConvertedBadge() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
      style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
      ✓ En Orvex
    </span>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center text-zinc-500 py-20 text-sm rounded-xl border" style={{ borderColor: '#2D2D35' }}>
      {label}
    </div>
  )
}
