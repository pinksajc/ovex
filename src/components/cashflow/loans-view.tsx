'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createLoanAction,
  updateLoanAction,
  deleteLoanAction,
  assignTransactionLoanAction,
} from '@/app/actions/cashflow-loans'
import { buildLoanSummaries, outstandingLabel } from '@/lib/cashflow-loans'
import type { CashflowLoan, CashflowTransaction, LoanDirection } from '@/types'

const _EUR2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function fmt(n: number) { return `${_EUR2.format(Math.abs(n))} €` }
function fmtSigned(n: number) { return `${n < 0 ? '−' : '+'}${_EUR2.format(Math.abs(n))} €` }
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
}

const DIRECTION_OPTIONS: { value: LoanDirection; label: string; hint: string }[] = [
  { value: 'lent',     label: 'Les prestamos (nos deben)',  hint: 'Platomico envía dinero → la contraparte nos debe' },
  { value: 'borrowed', label: 'Nos prestaron (les debemos)', hint: 'La contraparte nos envía dinero → nosotros le debemos' },
]

export function LoansView({
  loans,
  loanTransactions,
}: {
  loans: CashflowLoan[]
  loanTransactions: CashflowTransaction[]  // all category === 'Préstamos'
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  const summaries = useMemo(
    () => buildLoanSummaries(loans, loanTransactions),
    [loans, loanTransactions],
  )

  const unassigned = useMemo(
    () => loanTransactions.filter((t) => !t.loanId).sort((a, b) => b.date.localeCompare(a.date)),
    [loanTransactions],
  )

  // Totals across all loans, by outstanding direction
  const totalNosDeben = summaries
    .filter((s) => s.loan.direction === 'lent')
    .reduce((acc, s) => acc + s.pendiente, 0)
  const totalLesDebemos = summaries
    .filter((s) => s.loan.direction === 'borrowed')
    .reduce((acc, s) => acc + s.pendiente, 0)

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Nos deben" value={fmt(totalNosDeben)} color="#0071e3" sub="préstamos que hicimos, pendiente de cobro" />
        <Kpi label="Les debemos" value={fmt(totalLesDebemos)} color="#ff9f0a" sub="préstamos que nos hicieron, pendiente de pago" />
        <Kpi label="Préstamos activos" value={String(loans.length)} color="#18181b" sub={`${unassigned.length} movimientos sin asignar`} />
      </div>

      {/* Loans list */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Préstamos</h2>
          <button
            onClick={() => setCreating(true)}
            className="text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Nuevo préstamo
          </button>
        </div>

        {summaries.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-zinc-400">
            No hay préstamos. Crea uno y asígnale movimientos abajo.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {summaries.map((s) => (
              <LoanCard
                key={s.loan.id}
                summary={s}
                loans={loans}
                onChanged={() => router.refresh()}
              />
            ))}
          </div>
        )}
      </div>

      {/* Unassigned movements */}
      {unassigned.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm">
          <div className="p-5 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">Movimientos sin asignar</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Transacciones de categoría «Préstamos» que aún no pertenecen a ningún préstamo
            </p>
          </div>
          <div className="divide-y divide-zinc-50">
            {unassigned.map((t) => (
              <AssignRow key={t.id} tx={t} loans={loans} onChanged={() => router.refresh()} />
            ))}
          </div>
        </div>
      )}

      {creating && (
        <LoanFormModal
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); router.refresh() }}
        />
      )}
    </div>
  )
}

// ── Loan card ─────────────────────────────────────────────────────────────────

function LoanCard({
  summary,
  loans,
  onChanged,
}: {
  summary: ReturnType<typeof buildLoanSummaries>[number]
  loans: CashflowLoan[]
  onChanged: () => void
}) {
  const { loan, desembolsado, pagado, pendiente, transactions } = summary
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing]   = useState(false)
  const [isPending, start]      = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const label = outstandingLabel(loan.direction, pendiente)
  const isReceivable = loan.direction === 'lent'
  const balColor = pendiente === 0 ? '#71717a' : isReceivable ? '#0071e3' : '#ff9f0a'

  function handleDelete() {
    start(async () => {
      await deleteLoanAction(loan.id)
      onChanged()
    })
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <button onClick={() => setExpanded((v) => !v)} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-zinc-900">{loan.name}</span>
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
              isReceivable ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {isReceivable ? 'Les prestamos' : 'Nos prestaron'}
            </span>
            <span className="text-xs text-zinc-400">{loan.counterparty}</span>
            <span className="text-[10px] text-zinc-300">· {transactions.length} mov.</span>
          </div>
          {loan.notes && <p className="text-xs text-zinc-400 mt-1">{loan.notes}</p>}
          <div className="flex items-center gap-4 mt-2 text-xs">
            <span className="text-zinc-500">Desembolsado <span className="font-mono font-semibold text-zinc-700">{fmt(desembolsado)}</span></span>
            <span className="text-zinc-500">Pagado <span className="font-mono font-semibold text-emerald-600">{fmt(pagado)}</span></span>
            <span className="text-zinc-500">
              {label} <span className="font-mono font-bold" style={{ color: balColor }}>{fmt(pendiente)}</span>
            </span>
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setEditing(true)} className="text-xs text-zinc-400 hover:text-zinc-700 px-2 py-1 transition-colors">Editar</button>
          {confirmDelete ? (
            <>
              <button onClick={handleDelete} disabled={isPending} className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded disabled:opacity-50 transition-colors">
                {isPending ? '…' : 'Eliminar'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-zinc-400 hover:text-zinc-600 px-1">Cancelar</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 transition-colors">Eliminar</button>
          )}
        </div>
      </div>

      {expanded && transactions.length > 0 && (
        <div className="mt-3 border-t border-zinc-50 pt-2 space-y-1">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 text-xs py-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-zinc-400 shrink-0">{fmtDate(t.date)}</span>
                <span className="text-zinc-600 truncate">{t.description}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`font-mono font-semibold ${t.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {fmtSigned(t.amount)}
                </span>
                <LoanSelect txId={t.id} currentLoanId={t.loanId} loans={loans} onChanged={onChanged} compact />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <LoanFormModal
          loan={loan}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onChanged() }}
        />
      )}
    </div>
  )
}

// ── Unassigned row ──────────────────────────────────────────────────────────────

function AssignRow({
  tx,
  loans,
  onChanged,
}: {
  tx: CashflowTransaction
  loans: CashflowLoan[]
  onChanged: () => void
}) {
  return (
    <div className="px-5 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-xs text-zinc-400 shrink-0">{fmtDate(tx.date)}</span>
        <span className="text-xs text-zinc-600 truncate">{tx.description}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-xs font-mono font-semibold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {fmtSigned(tx.amount)}
        </span>
        <LoanSelect txId={tx.id} currentLoanId={tx.loanId} loans={loans} onChanged={onChanged} />
      </div>
    </div>
  )
}

function LoanSelect({
  txId,
  currentLoanId,
  loans,
  onChanged,
  compact,
}: {
  txId: string
  currentLoanId: string | null
  loans: CashflowLoan[]
  onChanged: () => void
  compact?: boolean
}) {
  const [isPending, start] = useTransition()
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value || null
    start(async () => {
      await assignTransactionLoanAction(txId, value)
      onChanged()
    })
  }
  return (
    <select
      value={currentLoanId ?? ''}
      onChange={handleChange}
      disabled={isPending || loans.length === 0}
      className={`text-xs border border-zinc-200 rounded-md bg-white text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 ${compact ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}
    >
      <option value="">{compact ? '— quitar —' : 'Asignar a…'}</option>
      {loans.map((l) => (
        <option key={l.id} value={l.id}>{l.name}</option>
      ))}
    </select>
  )
}

// ── Create/edit modal ─────────────────────────────────────────────────────────

function LoanFormModal({
  loan,
  onClose,
  onSaved,
}: {
  loan?: CashflowLoan
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName]                 = useState(loan?.name ?? '')
  const [counterparty, setCounterparty] = useState(loan?.counterparty ?? '')
  const [direction, setDirection]       = useState<LoanDirection>(loan?.direction ?? 'lent')
  const [notes, setNotes]               = useState(loan?.notes ?? '')
  const [error, setError]               = useState<string | null>(null)
  const [isPending, start]              = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim())         { setError('El nombre es obligatorio'); return }
    if (!counterparty.trim()) { setError('La contraparte es obligatoria'); return }
    start(async () => {
      const payload = { name: name.trim(), counterparty: counterparty.trim(), direction, notes: notes.trim() || null }
      const result = loan
        ? await updateLoanAction(loan.id, payload)
        : await createLoanAction(payload)
      if (result.ok) onSaved()
      else setError(result.error ?? 'Error al guardar')
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !isPending) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">{loan ? 'Editar préstamo' : 'Nuevo préstamo'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Nombre</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
              placeholder="Ej. Préstamo Smashburger jul 2026"
              className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Contraparte</label>
            <input
              type="text" value={counterparty} onChange={(e) => setCounterparty(e.target.value)}
              placeholder="Ej. Smashburger SL"
              className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Dirección</label>
            <div className="space-y-2">
              {DIRECTION_OPTIONS.map((opt) => (
                <label key={opt.value} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  direction === opt.value ? 'border-blue-300 bg-blue-50/50' : 'border-zinc-200 hover:border-zinc-300'
                }`}>
                  <input
                    type="radio" name="direction" value={opt.value}
                    checked={direction === opt.value}
                    onChange={() => setDirection(opt.value)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-xs font-medium text-zinc-800">{opt.label}</span>
                    <span className="block text-[11px] text-zinc-400">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Notas <span className="normal-case font-normal text-zinc-400">(opcional)</span>
            </label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full text-sm bg-zinc-100 border-0 rounded-lg px-3 py-2 text-zinc-700 placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={isPending} className="text-sm text-zinc-500 hover:text-zinc-700 px-2 py-1.5 transition-colors">Cancelar</button>
            <button type="submit" disabled={isPending} className="text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-700 px-5 py-2 rounded-lg disabled:opacity-50 transition-colors">
              {isPending ? 'Guardando…' : loan ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Kpi({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3 leading-tight">{label}</p>
      <p className="text-2xl font-bold tracking-tight leading-none" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-400 mt-2 leading-tight">{sub}</p>}
    </div>
  )
}
