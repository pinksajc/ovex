'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import type { AuthUser } from '@/lib/auth'
import type { AttioDeal, AttioDealStage } from '@/app/api/leads/attio/route'
import type { DealStage } from '@/types'

const ORVEX_STAGES: { value: DealStage; label: string }[] = [
  { value: 'prospecting',   label: 'Prospecto'   },
  { value: 'qualified',     label: 'Contactado'  },
  { value: 'proposal_sent', label: 'Demo'        },
  { value: 'negotiation',   label: 'Negociación' },
]

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  lead:        { bg: 'rgba(124,114,232,0.12)', text: '#A89FEF' },
  in_progress: { bg: 'rgba(59,130,246,0.12)',  text: '#7CB3F8' },
  negotiating: { bg: 'rgba(234,179,8,0.12)',   text: '#FBBF24' },
  won:         { bg: 'rgba(34,197,94,0.12)',   text: '#4ADE80' },
  lost:        { bg: 'rgba(239,68,68,0.12)',   text: '#F87171' },
}

function stageColor(s: string) {
  return STAGE_COLORS[s.toLowerCase()] ?? { bg: 'rgba(113,113,122,0.15)', text: '#A1A1AA' }
}

function fmtCurrency(val: number | null, currency: string) {
  if (val === null) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency, maximumFractionDigits: 0 }).format(val)
}

function fmtDate(d: string) {
  if (!d) return '—'
  try { return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d)) }
  catch { return '—' }
}

interface Props {
  currentUser: AuthUser
  members: AuthUser[]
  convertedNames: Set<string>
  convertedEmails: Set<string>
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [onDone])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg text-sm font-medium text-white shadow-lg"
      style={{ background: '#7C72E8' }}>
      {msg}
    </div>
  )
}

// ── Convert Modal ─────────────────────────────────────────────────────────────
function ConvertModal({
  deal, members, currentUserId, onClose, onConverted,
}: {
  deal: AttioDeal
  members: AuthUser[]
  currentUserId: string
  onClose: () => void
  onConverted: (name: string) => void
}) {
  const [stage, setStage] = useState<DealStage>('prospecting')
  const [owner, setOwner] = useState(currentUserId)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await fetch('/api/leads/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: deal.name,
          stage,
          ownerId: owner,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setError(d.error ?? 'Error al crear el deal')
        return
      }
      onConverted(deal.name)
      onClose()
    })
  }

  const { bg: stageBg, text: stageText } = stageColor(deal.stage)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-md rounded-xl border shadow-xl p-6" style={{ background: '#18181B', borderColor: '#2D2D35' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Convertir a Deal</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
        </div>

        <div className="rounded-lg px-4 py-3 mb-5 text-sm" style={{ background: '#0E0E11', border: '1px solid #2D2D35' }}>
          <p className="text-white font-medium">{deal.name}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: stageBg, color: stageText }}>
              {deal.stageLabel}
            </span>
            {deal.value !== null && (
              <span className="text-zinc-400 text-xs">{fmtCurrency(deal.value, deal.currency)}</span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-widest">Stage en Orvex</label>
            <select value={stage} onChange={(e) => setStage(e.target.value as DealStage)}
              className="w-full px-3 py-2.5 text-sm text-white rounded-lg border focus:outline-none"
              style={{ background: '#1C1C21', borderColor: '#33333B' }}>
              {ORVEX_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-widest">Owner</label>
            <select value={owner} onChange={(e) => setOwner(e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-white rounded-lg border focus:outline-none"
              style={{ background: '#1C1C21', borderColor: '#33333B' }}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name ?? m.email}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-400 rounded px-3 py-2" style={{ background: 'rgba(127,29,29,0.25)' }}>{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm rounded-lg border text-zinc-300 hover:text-white transition-colors"
              style={{ borderColor: '#33333B', background: 'transparent' }}>
              Cancelar
            </button>
            <button type="submit" disabled={pending}
              className="flex-1 py-2.5 text-sm rounded-lg font-semibold text-white disabled:opacity-50"
              style={{ background: '#7C72E8' }}>
              {pending ? 'Creando…' : 'Crear Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function LeadsClient({ currentUser, members, convertedNames }: Props) {
  const [activeStage, setActiveStage] = useState<AttioDealStage | 'all'>('all')
  const [query, setQuery]   = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [deals, setDeals]   = useState<AttioDeal[]>([])
  const [converted, setConverted] = useState<Set<string>>(convertedNames)
  const [modal, setModal]   = useState<AttioDeal | null>(null)
  const [toast, setToast]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/leads/attio')
      .then((r) => r.json())
      .then((d: { deals?: AttioDeal[]; error?: string }) => {
        if (d.error) { setError(d.error); return }
        setDeals(d.deals ?? [])
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  // Derive unique stages from data
  const stages = useMemo(() => {
    const seen = new Map<string, string>()
    for (const d of deals) seen.set(d.stage, d.stageLabel)
    // Order: lead → in_progress → negotiating → won → lost → others
    const order = ['lead', 'in_progress', 'inprogress', 'negotiating', 'won', 'lost']
    const sorted = [...seen.entries()].sort(([a], [b]) => {
      const ia = order.indexOf(a.toLowerCase()), ib = order.indexOf(b.toLowerCase())
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
    return sorted
  }, [deals])

  const q = query.toLowerCase()
  const filtered = useMemo(() =>
    deals.filter((d) =>
      (activeStage === 'all' || d.stage === activeStage) &&
      (!q || d.name.toLowerCase().includes(q) || (d.ownerName ?? '').toLowerCase().includes(q))
    ),
    [deals, activeStage, q]
  )

  function handleConverted(name: string) {
    setConverted((prev) => new Set([...prev, name.toLowerCase().trim()]))
    setToast('Deal creado correctamente')
  }

  const tabBase = 'px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap'
  const tabActive = `${tabBase} bg-zinc-800 text-white`
  const tabInactive = `${tabBase} text-zinc-400 hover:text-zinc-200`

  const count = (stage: AttioDealStage | 'all') =>
    stage === 'all' ? deals.length : deals.filter((d) => d.stage === stage).length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Leads</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Pipeline de Attio{!loading && ` · ${deals.length} deals`}
          </p>
        </div>
        <input
          type="text"
          placeholder="Buscar…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="px-3 py-2 text-sm text-white rounded-lg border w-52 focus:outline-none placeholder:text-zinc-600"
          style={{ background: '#18181B', borderColor: '#2D2D35' }}
        />
      </div>

      {/* Stage tabs */}
      {!loading && !error && (
        <div className="flex items-center gap-1 p-1 rounded-lg mb-4 overflow-x-auto" style={{ background: '#18181B' }}>
          <button className={activeStage === 'all' ? tabActive : tabInactive} onClick={() => setActiveStage('all')}>
            Todos <span className="ml-1 text-xs opacity-60">({count('all')})</span>
          </button>
          {stages.map(([slug, label]) => (
            <button key={slug} className={activeStage === slug ? tabActive : tabInactive} onClick={() => setActiveStage(slug)}>
              {label} <span className="ml-1 text-xs opacity-60">({count(slug)})</span>
            </button>
          ))}
        </div>
      )}

      {/* States */}
      {loading && <div className="text-center text-zinc-500 py-20 text-sm">Cargando desde Attio…</div>}
      {!loading && error && (
        <div className="rounded-lg px-4 py-3 text-sm text-red-400 border" style={{ background: 'rgba(127,29,29,0.2)', borderColor: 'rgba(153,27,27,0.4)' }}>
          Error: {error}
        </div>
      )}
      {!loading && !error && (
        <DealsTable rows={filtered} converted={converted} onConvert={setModal} />
      )}

      {modal && (
        <ConvertModal
          deal={modal}
          members={members}
          currentUserId={currentUser.id}
          onClose={() => setModal(null)}
          onConverted={handleConverted}
        />
      )}
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  )
}

// ── Deals table ───────────────────────────────────────────────────────────────
function DealsTable({
  rows, converted, onConvert,
}: {
  rows: AttioDeal[]
  converted: Set<string>
  onConvert: (d: AttioDeal) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="text-center text-zinc-500 py-20 text-sm rounded-xl border" style={{ borderColor: '#2D2D35' }}>
        No se encontraron deals
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#2D2D35' }}>
      <table className="w-full text-sm">
        <thead style={{ background: '#18181B' }}>
          <tr className="border-b" style={{ borderColor: '#2D2D35' }}>
            {['Nombre', 'Stage', 'Valor', 'Owner Attio', 'Fecha', 'Acciones'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-widest">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => {
            const isConverted = converted.has(d.name.toLowerCase().trim())
            const { bg, text } = stageColor(d.stage)
            return (
              <tr key={d.attioId} className="border-b hover:bg-zinc-800/30 transition-colors" style={{ borderColor: '#2D2D35' }}>
                <td className="px-4 py-3 text-white font-medium max-w-xs truncate">
                  {d.name}
                  {isConverted && (
                    <span className="ml-2 inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                      style={{ background: 'rgba(34,197,94,0.12)', color: '#4ADE80' }}>
                      ✓ En Orvex
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: bg, color: text }}>
                    {d.stageLabel}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-300">{fmtCurrency(d.value, d.currency)}</td>
                <td className="px-4 py-3 text-zinc-400">{d.ownerName ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{fmtDate(d.createdAt)}</td>
                <td className="px-4 py-3">
                  {!isConverted && (
                    <button
                      onClick={() => onConvert(d)}
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
