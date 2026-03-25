// =========================================
// CRUD — deal_configurations
// server-only
// =========================================

import { getSupabaseClient } from './client'
import type { DealConfiguration, AddonId, HardwareLineItem, DealEconomics } from '@/types'

// ---- Tipo de la fila en Supabase ----

interface ConfigRow {
  id: string
  attio_deal_id: string
  version: number
  label: string | null
  daily_orders_per_location: number
  locations: number
  average_ticket: number
  estimated_growth_percent: number
  plan: string
  plan_overridden: boolean
  active_addons: string[]
  hardware: unknown
  economics: unknown
  is_active: boolean
  created_at: string
}

// ---- Mapper row → DealConfiguration ----

function rowToConfig(row: ConfigRow): DealConfiguration {
  return {
    id: row.id,
    dealId: row.attio_deal_id,
    version: row.version,
    label: row.label ?? undefined,
    dailyOrdersPerLocation: row.daily_orders_per_location,
    locations: row.locations,
    averageTicket: Number(row.average_ticket),
    estimatedGrowthPercent: Number(row.estimated_growth_percent),
    plan: row.plan as DealConfiguration['plan'],
    planOverridden: row.plan_overridden,
    activeAddons: row.active_addons as AddonId[],
    hardware: (row.hardware as HardwareLineItem[]) ?? [],
    economics: row.economics as DealEconomics,
    createdAt: row.created_at,
  }
}

// Helper para tipar la tabla sin generar tipos de Supabase
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table() {
  return getSupabaseClient().from('deal_configurations') as any
}

// ---- Queries ----

/**
 * Todas las configuraciones de un deal, ordenadas por versión desc.
 */
export async function getConfigsForDeal(
  attioDealId: string
): Promise<DealConfiguration[]> {
  const { data, error } = await table()
    .select('*')
    .eq('attio_deal_id', attioDealId)
    .order('version', { ascending: false })

  if (error) throw new Error(`Supabase getConfigsForDeal: ${error.message}`)
  return ((data as ConfigRow[]) ?? []).map(rowToConfig)
}

/**
 * La configuración activa de un deal (is_active = true).
 */
export async function getActiveConfigForDeal(
  attioDealId: string
): Promise<DealConfiguration | undefined> {
  const { data, error } = await table()
    .select('*')
    .eq('attio_deal_id', attioDealId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new Error(`Supabase getActiveConfig: ${error.message}`)
  if (!data) return undefined
  return rowToConfig(data as ConfigRow)
}

/**
 * Guarda (upsert) una configuración.
 */
export async function saveConfig(
  attioDealId: string,
  config: Omit<DealConfiguration, 'dealId'>
): Promise<DealConfiguration> {
  const row = {
    id: config.id,
    attio_deal_id: attioDealId,
    version: config.version,
    label: config.label ?? null,
    daily_orders_per_location: config.dailyOrdersPerLocation,
    locations: config.locations,
    average_ticket: config.averageTicket,
    estimated_growth_percent: config.estimatedGrowthPercent,
    plan: config.plan,
    plan_overridden: config.planOverridden,
    active_addons: config.activeAddons,
    hardware: config.hardware,
    economics: config.economics,
    is_active: false,
  }

  const { data, error } = await table()
    .upsert(row, { onConflict: 'attio_deal_id,version' })
    .select()
    .single()

  if (error) throw new Error(`Supabase saveConfig: ${error.message}`)
  return rowToConfig(data as ConfigRow)
}

/**
 * Marca una configuración como activa y desactiva las demás del mismo deal.
 */
export async function setActiveConfig(
  attioDealId: string,
  configId: string
): Promise<void> {
  const { error: e1 } = await table()
    .update({ is_active: false })
    .eq('attio_deal_id', attioDealId)

  if (e1) throw new Error(`Supabase setActiveConfig (deactivate): ${e1.message}`)

  const { error: e2 } = await table()
    .update({ is_active: true })
    .eq('id', configId)
    .eq('attio_deal_id', attioDealId)

  if (e2) throw new Error(`Supabase setActiveConfig (activate): ${e2.message}`)
}

/**
 * Upserts la única configuración activa de un deal (is_active=true).
 * Desactiva todas las configs existentes del deal antes de insertar.
 */
export async function upsertActiveConfig(
  attioDealId: string,
  config: Omit<DealConfiguration, 'dealId'>
): Promise<DealConfiguration> {
  const { error: deactivateError } = await table()
    .update({ is_active: false })
    .eq('attio_deal_id', attioDealId)

  if (deactivateError) {
    throw new Error(`Supabase upsertActiveConfig (deactivate): ${deactivateError.message}`)
  }

  const row = {
    id: config.id,
    attio_deal_id: attioDealId,
    version: config.version,
    label: config.label ?? null,
    daily_orders_per_location: config.dailyOrdersPerLocation,
    locations: config.locations,
    average_ticket: config.averageTicket,
    estimated_growth_percent: config.estimatedGrowthPercent,
    plan: config.plan,
    plan_overridden: config.planOverridden,
    active_addons: config.activeAddons,
    hardware: config.hardware,
    economics: config.economics,
    is_active: true,
  }

  const { data, error } = await table()
    .upsert(row, { onConflict: 'attio_deal_id,version' })
    .select()
    .single()

  if (error) throw new Error(`Supabase upsertActiveConfig: ${error.message}`)
  return rowToConfig(data as ConfigRow)
}

/**
 * Calcula el siguiente número de versión para un deal.
 */
export async function nextVersionForDeal(attioDealId: string): Promise<number> {
  const { data, error } = await table()
    .select('version')
    .eq('attio_deal_id', attioDealId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Supabase nextVersion: ${error.message}`)
  return data ? (data as { version: number }).version + 1 : 1
}
