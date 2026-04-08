import Link from 'next/link'
import { getDeals, getActiveConfig } from '@/lib/deals'
import { formatCurrency } from '@/lib/format'
import { DealsTable } from '@/components/deals/deals-table'
import { getCurrentUser, getWorkspaceMembers } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; focus?: string; scope?: string }>
}) {
  const { status, focus, scope } = await searchParams
  const focusMode = focus === 'close'

  const [userOrNull, allDeals] = await Promise.all([
    getCurrentUser(),
    getDeals(),
  ])

  // Middleware guarantees auth, but getCurrentUser can return null if profile
  // creation fails — default to a sales-scoped view to avoid crash.
  const user: AuthUser = userOrNull ?? { id: '', email: '', name: null, role: 'sales', mustChangePassword: false }

  // Admins can toggle mine/all; sales always see all deals
  const isAdmin = user.role === 'admin'
  const effectiveScope: 'mine' | 'all' = isAdmin
    ? (scope === 'mine' ? 'mine' : 'all')
    : 'all'

  const deals = effectiveScope === 'mine'
    ? allDeals.filter((d) => d.ownerId === null || d.ownerId === user.id)
    : allDeals

  // Load members only for admins (for reassign UI)
  const members = isAdmin ? await getWorkspaceMembers() : []

  const totalMRR = deals.reduce((sum, d) => sum + (getActiveConfig(d)?.economics.totalMonthlyRevenue ?? 0), 0)
  const totalARR = deals.reduce((sum, d) => sum + (getActiveConfig(d)?.economics.annualRevenue ?? 0), 0)
  const configured = deals.filter((d) => d.commercialStatus !== 'no_config').length
  const closeReady = deals.filter((d) => d.commercialStatus === 'proposal_created').length

  if (focusMode) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">Modo foco · Cierre</h1>
            </div>
            <p className="text-zinc-400 text-xs">
              {closeReady} deal{closeReady !== 1 ? 's' : ''} listo{closeReady !== 1 ? 's' : ''} para cerrar
            </p>
          </div>
          <Link
            href="/deals"
            className="text-xs text-zinc-400 hover:text-zinc-700 border border-zinc-200 hover:border-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            ← Salir del modo foco
          </Link>
        </div>
        <DealsTable deals={deals} focusMode currentUser={user} members={members} />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Deals</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Pipeline activo · {deals.length} deal{deals.length !== 1 ? 's' : ''} · {configured} configurados
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Scope toggle — only for admins */}
          {isAdmin && (
            <div className="flex items-center bg-zinc-100 rounded-lg p-0.5">
              <Link
                href={`/deals?scope=mine${status ? `&status=${status}` : ''}`}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  effectiveScope === 'mine'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Mis deals
              </Link>
              <Link
                href={`/deals?scope=all${status ? `&status=${status}` : ''}`}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  effectiveScope === 'all'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Todos
              </Link>
            </div>
          )}
          <Link
            href={`/deals?focus=close&scope=${effectiveScope}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Modo foco
          </Link>
          <Link
            href="/deals/new"
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Nuevo deal
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Deals</p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono">{deals.length}</p>
          <p className="text-xs text-zinc-400 mt-1">{configured} configurados</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">MRR Pipeline</p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono">{formatCurrency(totalMRR)}</p>
          <p className="text-xs text-zinc-400 mt-1">mensual recurrente</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">ARR Pipeline</p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono">{formatCurrency(totalARR)}</p>
          <p className="text-xs text-zinc-400 mt-1">anual recurrente</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5 border-emerald-200 bg-emerald-50/30">
          <p className="text-xs text-emerald-600 uppercase tracking-widest mb-1">Listos para cerrar</p>
          <p className="text-2xl font-semibold text-emerald-700 font-mono">{closeReady}</p>
          <p className="text-xs text-emerald-600/60 mt-1">con propuesta creada</p>
        </div>
      </div>

      {/* Table */}
      <DealsTable
        deals={deals}
        initialFilter={status}
        currentUser={user}
        members={members}
      />
    </div>
  )
}
