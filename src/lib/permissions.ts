// =========================================
// PERMISSIONS — single source of truth for role → module access
// Import in server components, layouts, middleware, and the sidebar.
// =========================================

export const ROLES = ['owner', 'admin', 'growth_manager', 'sales', 'finance'] as const
export type Role = typeof ROLES[number]

export type Module =
  | 'dashboard'
  | 'deals'
  | 'leads'
  | 'pipeline'
  | 'ofertas'
  | 'facturas'
  | 'cashflow'
  | 'usuarios'
  | 'gestiones'

/**
 * Which roles may access each module.
 *
 * dashboard:  owner · admin · growth_manager · sales · finance
 * deals:      owner · admin · growth_manager · sales · finance
 * pipeline:   owner · admin · growth_manager · sales · finance
 * ofertas:    owner · admin · growth_manager · sales · finance
 * facturas:   owner · admin · growth_manager · finance
 * cashflow:   owner · admin · finance
 * leads:      owner · admin · growth_manager
 * gestiones:  owner · admin · growth_manager
 * usuarios:   owner · admin · growth_manager
 */
export const MODULE_ROLES: Record<Module, readonly Role[]> = {
  dashboard: ['owner', 'admin', 'growth_manager', 'sales', 'finance'],
  deals:     ['owner', 'admin', 'growth_manager', 'sales', 'finance'],
  leads:     ['owner', 'admin', 'growth_manager'],
  pipeline:  ['owner', 'admin', 'growth_manager', 'sales', 'finance'],
  ofertas:   ['owner', 'admin', 'growth_manager', 'sales', 'finance'],
  facturas:  ['owner', 'admin', 'growth_manager', 'finance'],
  cashflow:  ['owner', 'admin', 'finance'],
  gestiones: ['owner', 'admin', 'growth_manager'],
  usuarios:  ['owner', 'admin', 'growth_manager'],
}

export function canAccess(role: string | undefined | null, module: Module): boolean {
  if (!role) return false
  return (MODULE_ROLES[module] as readonly string[]).includes(role)
}

export const ROLE_LABEL: Record<string, string> = {
  owner:          'Owner',
  admin:          'Admin',
  growth_manager: 'Growth Manager',
  sales:          'Sales',
  finance:        'Finance',
}

export const ROLE_COLOR: Record<string, string> = {
  owner:          'bg-amber-50 text-amber-700',
  admin:          'bg-violet-50 text-violet-700',
  growth_manager: 'bg-teal-50 text-teal-700',
  sales:          'bg-blue-50 text-blue-700',
  finance:        'bg-emerald-50 text-emerald-700',
}
