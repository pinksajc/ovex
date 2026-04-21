import Link from 'next/link'
import { getPresupuestos } from '@/lib/supabase/presupuestos'
import type { Presupuesto, PresupuestoStatus } from '@/types'

const STATUS_LABELS: Record<PresupuestoStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Expirado',
}

const STATUS_COLORS: Record<PresupuestoStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-blue-50 text-blue-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  expired: 'bg-amber-50 text-amber-700',
}

function formatEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams

  let presupuestos: Presupuesto[] = []
  let fetchError = false
  try {
    presupuestos = await getPresupuestos()
  } catch {
    fetchError = true
  }

  const activeFilter = status as PresupuestoStatus | undefined
  const filtered = activeFilter
    ? presupuestos.filter((p) => p.status === activeFilter)
    : presupuestos

  const totalByStatus = (s: PresupuestoStatus) => presupuestos.filter((p) => p.status === s).length

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Presupuestos</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {presupuestos.length} presupuesto{presupuestos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/presupuestos/nuevo"
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          + Nuevo presupuesto
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-6 bg-zinc-100 rounded-lg p-0.5 w-fit flex-wrap">
        <Link
          href="/presupuestos"
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            !activeFilter ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Todos ({presupuestos.length})
        </Link>
        {(['draft', 'sent', 'accepted', 'rejected', 'expired'] as PresupuestoStatus[]).map((s) => (
          <Link
            key={s}
            href={`/presupuestos?status=${s}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeFilter === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {STATUS_LABELS[s]} ({totalByStatus(s)})
          </Link>
        ))}
      </div>

      {fetchError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
          Error al cargar los presupuestos. Asegúrate de que la tabla <code>presupuestos</code> existe en Supabase.
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <p className="text-zinc-400 text-sm">No hay presupuestos{activeFilter ? ` con estado "${STATUS_LABELS[activeFilter]}"` : ''}.</p>
          <Link
            href="/presupuestos/nuevo"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Nuevo presupuesto
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Número</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Cliente</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Concepto</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Total</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Estado</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Válido hasta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.map((pq) => (
                <tr key={pq.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/presupuestos/${pq.id}`} className="font-mono font-semibold text-zinc-900 hover:text-blue-700 text-xs">
                      {pq.number}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-xs font-medium text-zinc-800">{pq.clientName}</p>
                    {pq.clientCif && <p className="text-[10px] text-zinc-400">{pq.clientCif}</p>}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-xs text-zinc-600 truncate">{pq.concept}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-xs font-semibold text-zinc-900">{formatEur(pq.amountTotal)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_COLORS[pq.status]}`}>
                      {STATUS_LABELS[pq.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{formatDate(pq.validUntil)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
