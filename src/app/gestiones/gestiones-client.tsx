'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { approveItemAction, rejectItemAction, requestChangesAction } from '@/app/actions/approvals'
import { canApprove } from '@/lib/approvals'
import type { ApprovalItem, HistoryItem } from '@/lib/approvals'
import type { UserRole } from '@/lib/auth'
import type { ApprovalType } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatRelative(s: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH   = Math.floor(diffMs / 3600000)
  const diffD   = Math.floor(diffMs / 86400000)
  if (diffMin < 2)  return 'ahora mismo'
  if (diffMin < 60) return `hace ${diffMin} min`
  if (diffH < 24)   return `hace ${diffH}h`
  if (diffD === 1)  return 'ayer'
  if (diffD < 7)    return `hace ${diffD} días`
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ── Notes modal ───────────────────────────────────────────────────────────────

function NotesModal({
  title,
  confirmLabel,
  confirmCls,
  onConfirm,
  onClose,
}: {
  title: string
  confirmLabel: string
  confirmCls: string
  onConfirm: (notes: string) => void
  onClose: () => void
}) {
  const [notes, setNotes] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 pt-6 pb-0 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">×</button>
        </div>
        <div className="px-6 pt-4 pb-6 space-y-4">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Motivo o instrucciones para el equipo…"
            rows={4}
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 resize-none"
            autoFocus
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirm(notes)}
              disabled={!notes.trim()}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 ${confirmCls}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Notes popover (historial) ─────────────────────────────────────────────────

function NotesPopover({ notes }: { notes: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Ver nota"
        className="text-zinc-400 hover:text-zinc-700 transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 2h10v8H8l-3 2V10H2z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4.5 5.5h5M4.5 7.5h3" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* Popover */}
          <div className="absolute right-0 top-6 z-20 w-64 bg-white border border-zinc-200 rounded-xl shadow-lg p-3">
            <p className="text-xs font-semibold text-zinc-500 mb-1.5 uppercase tracking-wide">Nota</p>
            <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">{notes}</p>
          </div>
        </>
      )}
    </div>
  )
}

// ── Approval pending row ──────────────────────────────────────────────────────

function ApprovalRow({
  item,
  currentUserRole,
  onSuccess,
  onError,
}: {
  item: ApprovalItem
  currentUserRole: UserRole
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [modal, setModal] = useState<'reject' | 'changes' | null>(null)

  const itemPath = item.itemType === 'oferta' ? `/ofertas/${item.id}` : `/facturas/${item.id}`
  const canApproveThis = canApprove(currentUserRole, item.approvalType)

  function handleApprove() {
    startTransition(async () => {
      const res = await approveItemAction(item.itemType, item.id, item.approvalType)
      if (res.ok) onSuccess(`${item.number} aprobado`)
      else onError(res.error)
    })
  }

  function handleReject(notes: string) {
    setModal(null)
    startTransition(async () => {
      const res = await rejectItemAction(item.itemType, item.id, notes)
      if (res.ok) onSuccess(`${item.number} rechazado`)
      else onError(res.error)
    })
  }

  function handleChanges(notes: string) {
    setModal(null)
    startTransition(async () => {
      const res = await requestChangesAction(item.itemType, item.id, notes)
      if (res.ok) onSuccess(`Cambios solicitados en ${item.number}`)
      else onError(res.error)
    })
  }

  return (
    <>
      <tr className={`border-b border-zinc-100 transition-colors ${isPending ? 'opacity-50' : 'hover:bg-zinc-50/50'}`}>
        <td className="py-3.5 pl-6 pr-3">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
            item.itemType === 'oferta' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'
          }`}>
            {item.itemType === 'oferta' ? 'Oferta' : 'Factura'}
          </span>
        </td>
        <td className="py-3.5 px-3">
          <Link href={itemPath} className="text-sm font-mono font-semibold text-zinc-900 hover:text-blue-700 transition-colors">
            {item.number}
          </Link>
        </td>
        <td className="py-3.5 px-3 text-sm text-zinc-700 max-w-[180px] truncate">{item.clientName}</td>
        <td className="py-3.5 px-3 text-sm font-mono text-zinc-800 whitespace-nowrap">{formatEur(item.amountTotal)}</td>
        <td className="py-3.5 px-3">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
            item.approvalType === 'discount' ? 'bg-red-50 text-red-700' : 'bg-zinc-100 text-zinc-600'
          }`}>
            {item.approvalType === 'discount' ? 'Con descuento' : 'Estándar'}
          </span>
        </td>
        <td className="py-3.5 px-3 text-[12px] text-zinc-500 whitespace-nowrap">{formatDate(item.createdAt)}</td>
        <td className="py-3.5 pr-6 pl-3">
          <div className="flex items-center gap-1.5 justify-end">
            {canApproveThis ? (
              <button onClick={handleApprove} disabled={isPending}
                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40">
                Aprobar
              </button>
            ) : (
              <span className="text-[11px] text-zinc-300 px-2">Solo owner</span>
            )}
            <button onClick={() => setModal('changes')} disabled={isPending}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-amber-400 text-white hover:bg-amber-500 transition-colors disabled:opacity-40">
              Cambios
            </button>
            <button onClick={() => setModal('reject')} disabled={isPending}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-40">
              Rechazar
            </button>
          </div>
        </td>
      </tr>

      {modal === 'reject' && (
        <NotesModal title={`Rechazar ${item.number}`} confirmLabel="Rechazar"
          confirmCls="bg-red-500 text-white hover:bg-red-600"
          onConfirm={handleReject} onClose={() => setModal(null)} />
      )}
      {modal === 'changes' && (
        <NotesModal title={`Solicitar cambios en ${item.number}`} confirmLabel="Solicitar cambios"
          confirmCls="bg-amber-500 text-white hover:bg-amber-600"
          onConfirm={handleChanges} onClose={() => setModal(null)} />
      )}
    </>
  )
}

// ── History row ───────────────────────────────────────────────────────────────

const HISTORY_STATUS: Record<HistoryItem['approvalStatus'], { label: string; cls: string }> = {
  approved:          { label: 'Aprobado',          cls: 'bg-emerald-50 text-emerald-700' },
  rejected:          { label: 'Rechazado',         cls: 'bg-red-50 text-red-700'         },
  changes_requested: { label: 'Cambios solicitados', cls: 'bg-amber-50 text-amber-700'  },
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const itemPath = item.itemType === 'oferta' ? `/ofertas/${item.id}` : `/facturas/${item.id}`
  const statusCfg = HISTORY_STATUS[item.approvalStatus]

  return (
    <tr className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
      {/* Tipo */}
      <td className="py-3.5 pl-6 pr-3">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
          item.itemType === 'oferta' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'
        }`}>
          {item.itemType === 'oferta' ? 'Oferta' : 'Factura'}
        </span>
      </td>

      {/* Número */}
      <td className="py-3.5 px-3">
        <Link href={itemPath} className="text-sm font-mono font-semibold text-zinc-900 hover:text-blue-700 transition-colors">
          {item.number}
        </Link>
      </td>

      {/* Cliente */}
      <td className="py-3.5 px-3 text-sm text-zinc-700 max-w-[160px] truncate">{item.clientName}</td>

      {/* Importe */}
      <td className="py-3.5 px-3 text-sm font-mono text-zinc-800 whitespace-nowrap">{formatEur(item.amountTotal)}</td>

      {/* Acción */}
      <td className="py-3.5 px-3">
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${statusCfg.cls}`}>
            {statusCfg.label}
          </span>
          {item.approvalNotes && <NotesPopover notes={item.approvalNotes} />}
        </div>
      </td>

      {/* Quién */}
      <td className="py-3.5 px-3 text-[12px] text-zinc-600 whitespace-nowrap">
        {item.approvedByName ?? <span className="text-zinc-300">—</span>}
      </td>

      {/* Fecha */}
      <td className="py-3.5 pr-6 pl-3 text-[12px] text-zinc-500 whitespace-nowrap">
        {formatRelative(item.approvedAt)}
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type TypeFilter   = 'all' | 'oferta' | 'factura'
type ActionFilter = 'all' | 'approved' | 'rejected' | 'changes_requested'
type SubTab       = 'pending' | 'history'

export function GestionesClient({
  items,
  history,
  currentUserRole,
}: {
  items: ApprovalItem[]
  history: HistoryItem[]
  currentUserRole: UserRole
}) {
  const [toast,      setToast]      = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)
  const [subTab,     setSubTab]     = useState<SubTab>('pending')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [actFilter,  setActFilter]  = useState<ActionFilter>('all')

  function showToast(kind: 'success' | 'error', msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Pendientes filters ──
  const filteredPending = items.filter((item) =>
    typeFilter === 'all' ? true : item.itemType === typeFilter
  )
  const pendingOfertaCount  = items.filter((i) => i.itemType === 'oferta').length
  const pendingFacturaCount = items.filter((i) => i.itemType === 'factura').length

  // ── Historial filters ──
  const filteredHistory = history.filter((item) => {
    const matchType = typeFilter === 'all' ? true : item.itemType === typeFilter
    const matchAct  = actFilter  === 'all' ? true : item.approvalStatus === actFilter
    return matchType && matchAct
  })
  const historyOfertaCount  = history.filter((i) => i.itemType === 'oferta').length
  const historyFacturaCount = history.filter((i) => i.itemType === 'factura').length

  // Reset filters on tab switch
  function switchTab(tab: SubTab) {
    setSubTab(tab)
    setTypeFilter('all')
    setActFilter('all')
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.kind === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Gestiones</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Panel de administración interna</p>
      </div>

      {/* Main tabs */}
      <div className="flex items-end gap-1 mb-6 border-b border-zinc-200">
        <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-zinc-900 border-b-2 border-zinc-900 -mb-px transition-colors">
          Aprobaciones
          {items.length > 0 && (
            <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
              {items.length}
            </span>
          )}
        </button>
        <button disabled className="px-4 py-2.5 text-sm text-zinc-300 cursor-not-allowed">Contratos</button>
        <button disabled className="px-4 py-2.5 text-sm text-zinc-300 cursor-not-allowed">Facturas vencidas</button>
      </div>

      {/* Sub-tabs: Pendientes / Historial */}
      <div className="flex items-center gap-1 mb-5 bg-zinc-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => switchTab('pending')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            subTab === 'pending'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Pendientes
          {items.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
              {items.length}
            </span>
          )}
        </button>
        <button
          onClick={() => switchTab('history')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            subTab === 'history'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Historial
          {history.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-zinc-400 text-white text-[9px] font-bold px-1">
              {history.length}
            </span>
          )}
        </button>
      </div>

      {/* ── PENDIENTES ── */}
      {subTab === 'pending' && (
        <>
          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-5">
            {([
              { key: 'all',     label: 'Todos',    count: items.length       },
              { key: 'oferta',  label: 'Ofertas',  count: pendingOfertaCount  },
              { key: 'factura', label: 'Facturas', count: pendingFacturaCount },
            ] as { key: TypeFilter; label: string; count: number }[]).map(({ key, label, count }) => (
              <button key={key} onClick={() => setTypeFilter(key)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  typeFilter === key
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                }`}>
                {label} ({count})
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60">
                  <th className="py-3 pl-6 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Tipo</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Número</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Cliente</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Importe</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Aprobación</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Fecha</th>
                  <th className="py-3 pr-6 pl-3 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="text-zinc-400 text-sm">
                        {items.length === 0 ? '✓ No hay aprobaciones pendientes' : 'Sin resultados para este filtro'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPending.map((item) => (
                    <ApprovalRow
                      key={`${item.itemType}-${item.id}`}
                      item={item}
                      currentUserRole={currentUserRole}
                      onSuccess={(msg) => showToast('success', msg)}
                      onError={(msg) => showToast('error', msg)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── HISTORIAL ── */}
      {subTab === 'history' && (
        <>
          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {/* Type filter */}
            <div className="flex items-center gap-1.5">
              {([
                { key: 'all',     label: 'Todos',    count: history.length       },
                { key: 'oferta',  label: 'Ofertas',  count: historyOfertaCount   },
                { key: 'factura', label: 'Facturas', count: historyFacturaCount  },
              ] as { key: TypeFilter; label: string; count: number }[]).map(({ key, label, count }) => (
                <button key={key} onClick={() => setTypeFilter(key)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    typeFilter === key
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                  }`}>
                  {label} ({count})
                </button>
              ))}
            </div>

            {/* Separator */}
            <div className="w-px h-5 bg-zinc-200 mx-1" />

            {/* Action filter */}
            <div className="flex items-center gap-1.5">
              {([
                { key: 'all',               label: 'Todas',            cls: '' },
                { key: 'approved',          label: 'Aprobadas',        cls: 'data-[active=true]:bg-emerald-600 data-[active=true]:border-emerald-600' },
                { key: 'rejected',          label: 'Rechazadas',       cls: 'data-[active=true]:bg-red-600 data-[active=true]:border-red-600' },
                { key: 'changes_requested', label: 'Cambios',          cls: 'data-[active=true]:bg-amber-500 data-[active=true]:border-amber-500' },
              ] as { key: ActionFilter; label: string; cls: string }[]).map(({ key, label, cls }) => (
                <button key={key} onClick={() => setActFilter(key)}
                  data-active={actFilter === key}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    actFilter === key
                      ? `text-white border-transparent ${
                          key === 'approved'          ? 'bg-emerald-600' :
                          key === 'rejected'          ? 'bg-red-600'     :
                          key === 'changes_requested' ? 'bg-amber-500'   :
                          'bg-zinc-900'
                        }`
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                  } ${cls}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60">
                  <th className="py-3 pl-6 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Tipo</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Número</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Cliente</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Importe</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Acción</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Quién</th>
                  <th className="py-3 pr-6 pl-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="text-zinc-400 text-sm">
                        {history.length === 0 ? 'No hay registros en el historial todavía' : 'Sin resultados para este filtro'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item) => (
                    <HistoryRow key={`${item.itemType}-${item.id}`} item={item} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
