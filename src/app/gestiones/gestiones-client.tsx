'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { approveItemAction, rejectItemAction, requestChangesAction } from '@/app/actions/approvals'
import { canApprove } from '@/lib/approvals'
import type { ApprovalItem } from '@/lib/approvals'
import type { UserRole } from '@/lib/auth'
import type { ApprovalType } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
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

// ── Single row ────────────────────────────────────────────────────────────────

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
        {/* Tipo */}
        <td className="py-3.5 pl-6 pr-3">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
            item.itemType === 'oferta'
              ? 'bg-violet-50 text-violet-700'
              : 'bg-blue-50 text-blue-700'
          }`}>
            {item.itemType === 'oferta' ? 'Oferta' : 'Factura'}
          </span>
        </td>

        {/* Número */}
        <td className="py-3.5 px-3">
          <Link
            href={itemPath}
            className="text-sm font-mono font-semibold text-zinc-900 hover:text-blue-700 transition-colors"
          >
            {item.number}
          </Link>
        </td>

        {/* Cliente */}
        <td className="py-3.5 px-3 text-sm text-zinc-700 max-w-[180px] truncate">
          {item.clientName}
        </td>

        {/* Importe */}
        <td className="py-3.5 px-3 text-sm font-mono text-zinc-800 whitespace-nowrap">
          {formatEur(item.amountTotal)}
        </td>

        {/* Tipo aprobación */}
        <td className="py-3.5 px-3">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
            item.approvalType === 'discount'
              ? 'bg-red-50 text-red-700'
              : 'bg-zinc-100 text-zinc-600'
          }`}>
            {item.approvalType === 'discount' ? 'Con descuento' : 'Estándar'}
          </span>
        </td>

        {/* Fecha */}
        <td className="py-3.5 px-3 text-[12px] text-zinc-500 whitespace-nowrap">
          {formatDate(item.createdAt)}
        </td>

        {/* Acciones */}
        <td className="py-3.5 pr-6 pl-3">
          <div className="flex items-center gap-1.5 justify-end">
            {canApproveThis ? (
              <button
                onClick={handleApprove}
                disabled={isPending}
                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40"
              >
                Aprobar
              </button>
            ) : (
              <span className="text-[11px] text-zinc-300 px-2">Solo owner</span>
            )}
            <button
              onClick={() => setModal('changes')}
              disabled={isPending}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-amber-400 text-white hover:bg-amber-500 transition-colors disabled:opacity-40"
            >
              Cambios
            </button>
            <button
              onClick={() => setModal('reject')}
              disabled={isPending}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-40"
            >
              Rechazar
            </button>
          </div>
        </td>
      </tr>

      {modal === 'reject' && (
        <NotesModal
          title={`Rechazar ${item.number}`}
          confirmLabel="Rechazar"
          confirmCls="bg-red-500 text-white hover:bg-red-600"
          onConfirm={handleReject}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'changes' && (
        <NotesModal
          title={`Solicitar cambios en ${item.number}`}
          confirmLabel="Solicitar cambios"
          confirmCls="bg-amber-500 text-white hover:bg-amber-600"
          onConfirm={handleChanges}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Filter = 'all' | 'oferta' | 'factura'

export function GestionesClient({
  items,
  currentUserRole,
}: {
  items: ApprovalItem[]
  currentUserRole: UserRole
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  function showToast(kind: 'success' | 'error', msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const filtered = items.filter((item) => {
    if (filter === 'all') return true
    return item.itemType === filter
  })

  const ofertaCount  = items.filter((i) => i.itemType === 'oferta').length
  const facturaCount = items.filter((i) => i.itemType === 'factura').length

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

      {/* Tabs — prepared to grow */}
      <div className="flex items-end gap-1 mb-6 border-b border-zinc-200">
        {/* Active tab */}
        <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-zinc-900 border-b-2 border-zinc-900 -mb-px transition-colors">
          Aprobaciones
          {items.length > 0 && (
            <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
              {items.length}
            </span>
          )}
        </button>
        {/* Placeholder future tabs */}
        <button disabled className="px-4 py-2.5 text-sm text-zinc-300 cursor-not-allowed">Contratos</button>
        <button disabled className="px-4 py-2.5 text-sm text-zinc-300 cursor-not-allowed">Facturas vencidas</button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-5">
        {([
          { key: 'all',     label: 'Todos',    count: items.length },
          { key: 'oferta',  label: 'Ofertas',  count: ofertaCount  },
          { key: 'factura', label: 'Facturas', count: facturaCount },
        ] as { key: Filter; label: string; count: number }[]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              filter === key
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Table */}
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="text-zinc-400 text-sm">
                    {items.length === 0
                      ? '✓ No hay aprobaciones pendientes'
                      : 'Sin resultados para este filtro'}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
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
    </div>
  )
}
