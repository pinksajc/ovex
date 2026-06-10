// =========================================
// PERMISSIONS — single source of truth for role → module access
// Import in server components, layouts, middleware, and the sidebar.
// =========================================

export const ROLES = ['owner', 'admin', 'sales', 'finance'] as const
export type Role = typeof ROLES[number]

export type Module =
  | 'dashboard'
  | 'deals'
  | 'pipeline'
  | 'ofertas'
  | 'facturas'
  | 'cashflow'
  | 'usuarios'
  | 'gestiones'

/**
 * Which roles may access each module.
 * owner always has full access.
 */
export const MODULE_ROLES: Record<Module, readonly Role[]> = {
  dashboard: ['owner', 'admin', 'sales', 'finance'],
  deals:     ['owner', 'admin', 'sales'],
  pipeline:  ['owner', 'admin', 'sales'],
  ofertas:   ['owner', 'admin', 'sales'],
  facturas:  ['owner', 'admin', 'finance'],
  cashflow:  ['owner', 'admin', 'finance'],
  usuarios:  ['owner', 'admin'],
  gestiones: ['owner', 'admin'],
}

export function canAccess(role: string | undefined | null, module: Module): boolean {
  if (!role) return false
  return (MODULE_ROLES[module] as readonly string[]).includes(role)
}

export const ROLE_LABEL: Record<string, string> = {
  owner:   'Owner',
  admin:   'Admin',
  sales:   'Sales',
  finance: 'Finance',
}

export const ROLE_COLOR: Record<string, string> = {
  owner:   'bg-amber-50 text-amber-700',
  admin:   'bg-violet-50 text-violet-700',
  sales:   'bg-blue-50 text-blue-700',
  finance: 'bg-emerald-50 text-emerald-700',
}
