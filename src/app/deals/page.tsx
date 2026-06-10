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

  // Resolve user first — getDeals scoping depends on role
  const userOrNull = await getCurrentUser()
  // Middleware guarantees auth, but getCurrentUser can return null if profile
  // creation fails — default to a sales-scoped view to avoid crash.
  const user: AuthUser = userOrNull ?? { id: '', email: '', name: null, role: 'sales', mustChangePassword: false }
  const isAdmin = user.role === 'admin' || user.role === 'owner'

  // Fetch deals and workspace members in parallel.
  // getDeals(user) enforces scoping at query level: sales users only receive their own deals.
  const [allDeals, members] = await Promise.all([
    getDeals(user),
    isAdmin ? getWorkspaceMembers() : Promise.resolve([] as Awaited<ReturnType<typeof getWorkspaceMembers>>),
  ])

  // Admins can toggle mine/all; sales users always see only their own deals (query-level)
  const effectiveScope: 'mine' | 'all' = isAdmin
    ? (scope === 'mine' ? 'mine' : 'all')
    : 'mine'

  const deals = isAdmin && effectiveScope === 'mine'
    ? allDeals.filter((d) => d.ownerId === null || d.ownerId === user.id)
    : allDeals

  const totalMRR = deals.reduce((sum, d) => sum + (getActiveConfig(d)?.economics.totalMonthlyRevenue ?? 0), 0)
  const totalARR = deals.reduce((sum, d) => sum + (getActiveConfig(d)?.economics.annualRevenue ?? 0), 0)
  const configured = deals.filter((d) => d.commercialStatus !== 'no_config').length
  const closeReady = deals.filter((d) => d.commercialStatus === 'proposal_created').length

  if (focusMode) {
    return (
      <div className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <h1 className="text-base font-semibold text-text-primary tracking-tight">Modo foco · Cierre</h1>
            </div>
            <p className="text-text-tertiary text-[13px]">
              {closeReady} deal{closeReady !== 1 ? 's' : ''} listo{closeReady !== 1 ? 's' : ''} para cerrar
            </p>
          </div>
          <Link
            href="/deals"
            className="text-[13px] text-text-tertiary hover:text-text-primary border border-border-subtle hover:border-border-strong px-3 py-1.5 rounded-[6px] transition-colors duration-150"
          >
            ← Salir del modo foco
          </Link>
        </div>
        <DealsTable deals={deals} focusMode currentUser={user} members={members} />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">Deals</h1>
          <p className="text-text-tertiary text-[13px] mt-0.5">
            Pipeline activo · {deals.length} deal{deals.length !== 1 ? 's' : ''} · {configured} configurados
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Scope toggle — only for admins */}
          {isAdmin && (
            <div className="flex items-center bg-elevated border border-border-subtle rounded-[6px] p-0.5">
              <Link
                href={`/deals?scope=mine${status ? `&status=${status}` : ''}`}
                className={`px-3 py-1.5 rounded-[4px] text-[13px] font-medium transition-colors duration-150 ${
                  effectiveScope === 'mine'
                    ? 'bg-hover text-text-primary'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                Mis deals
              </Link>
              <Link
                href={`/deals?scope=all${status ? `&status=${status}` : ''}`}
                className={`px-3 py-1.5 rounded-[4px] text-[13px] font-medium transition-colors duration-150 ${
                  effectiveScope === 'all'
                    ? 'bg-hover text-text-primary'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                Todos
              </Link>
            </div>
          )}
          <Link
            href={`/deals?focus=close&scope=${effectiveScope}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-success bg-success/12 border border-success/20 hover:bg-success/20 px-3 h-9 rounded-[6px] transition-colors duration-150"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            Modo foco
          </Link>
          <Link
            href="/deals/new"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-accent text-base hover:bg-accent-hover px-3 h-9 rounded-[6px] transition-colors duration-150"
          >
            + Nuevo deal
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-border-subtle rounded-lg p-5">
          <p className="text-[12px] font-medium text-text-tertiary uppercase tracking-widest mb-1">Deals</p>
          <p className="text-[28px] font-semibold text-text-primary font-mono">{deals.length}</p>
          <p className="text-[12px] text-text-tertiary mt-1">{configured} configurados</p>
        </div>
        <div className="bg-surface border border-border-subtle rounded-lg p-5">
          <p className="text-[12px] font-medium text-text-tertiary uppercase tracking-widest mb-1">MRR Pipeline</p>
          <p className="text-[28px] font-semibold text-accent-text font-mono">{formatCurrency(totalMRR)}</p>
          <p className="text-[12px] text-text-tertiary mt-1">mensual recurrente</p>
        </div>
        <div className="bg-surface border border-border-subtle rounded-lg p-5">
          <p className="text-[12px] font-medium text-text-tertiary uppercase tracking-widest mb-1">ARR Pipeline</p>
          <p className="text-[28px] font-semibold text-accent-text font-mono">{formatCurrency(totalARR)}</p>
          <p className="text-[12px] text-text-tertiary mt-1">anual recurrente</p>
        </div>
        <div className="bg-surface border border-success/20 rounded-lg p-5">
          <p className="text-[12px] font-medium text-success/70 uppercase tracking-widest mb-1">Listos para cerrar</p>
          <p className="text-[28px] font-semibold text-success font-mono">{closeReady}</p>
          <p className="text-[12px] text-success/60 mt-1">con propuesta creada</p>
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
