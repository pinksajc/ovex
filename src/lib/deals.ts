// =========================================
// DEALS SERVICE LAYER
// Abstracción sobre la fuente de datos.
//
// Comportamiento automático:
//   ATTIO_API_KEY + SUPABASE_URL + SUPABASE_SERVICE_KEY definidas
//     → datos reales de Attio + configuraciones de Supabase
//   Si alguna falta
//     → mock data (sin cambiar comportamiento ni pantallas)
//
// Las páginas siempre importan desde aquí — nunca de mock-data directamente.
// =========================================

import type { Deal, DealConfiguration } from '@/types'

// ---- Flags ----

function isAttioConfigured(): boolean {
  return !!(
    process.env.ATTIO_API_KEY &&
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_KEY
  )
}

// =========================================
// READS
// =========================================

/**
 * Lista todos los deals.
 */
export async function getDeals(): Promise<Deal[]> {
  if (!isAttioConfigured()) {
    const { MOCK_DEALS } = await import('./mock-data')
    return MOCK_DEALS
  }
  return getDealsFromAttio()
}

/**
 * Obtiene un deal por ID.
 * En modo Attio, el ID es el record_id de Attio.
 * En modo mock, el ID es el mock ID ('deal-001', etc.)
 */
export async function getDeal(id: string): Promise<Deal | undefined> {
  if (!isAttioConfigured()) {
    const { getDealById } = await import('./mock-data')
    return getDealById(id)
  }
  return getDealFromAttio(id)
}

/**
 * Retorna la configuración activa de un deal.
 * Función pura sobre el tipo Deal — funciona igual en mock y Attio.
 */
export function getActiveConfig(
  deal: Deal
): DealConfiguration | undefined {
  if (!deal.activeConfigId) return deal.configurations[0]
  return deal.configurations.find((c) => c.id === deal.activeConfigId)
}

// =========================================
// WRITES (solo en modo Attio+Supabase)
// =========================================

/**
 * Guarda una configuración nueva o actualiza una existente.
 * No hace nada en modo mock.
 */
export async function saveConfig(
  attioDealId: string,
  config: Omit<DealConfiguration, 'dealId'>
): Promise<DealConfiguration> {
  if (!isAttioConfigured()) {
    // En mock, devuelve la config tal cual (state-only, sin persistencia)
    return { ...config, dealId: attioDealId }
  }

  const { saveConfig: sbSave } = await import('./supabase/configs')
  return sbSave(attioDealId, config)
}

/**
 * Marca una configuración como la activa del deal.
 */
export async function setActiveConfig(
  attioDealId: string,
  configId: string
): Promise<void> {
  if (!isAttioConfigured()) return

  const { setActiveConfig: sbSet } = await import('./supabase/configs')
  return sbSet(attioDealId, configId)
}

/**
 * Upserts la configuración activa de un deal (modelo single-config-per-deal).
 * En modo Attio persiste en Supabase y devuelve { config, persisted: true }.
 * En modo mock devuelve la config sin persistir y persisted: false.
 */
export async function saveActiveConfig(
  attioDealId: string,
  config: Omit<DealConfiguration, 'dealId'>
): Promise<{ config: DealConfiguration; persisted: boolean }> {
  if (!isAttioConfigured()) {
    return { config: { ...config, dealId: attioDealId }, persisted: false }
  }

  const { upsertActiveConfig } = await import('./supabase/configs')
  const saved = await upsertActiveConfig(attioDealId, config)
  return { config: saved, persisted: true }
}

/**
 * Calcula el siguiente número de versión para un deal.
 */
export async function nextVersion(attioDealId: string): Promise<number> {
  if (!isAttioConfigured()) {
    // En mock, contamos las configs del deal
    const deal = await getDeal(attioDealId)
    return (deal?.configurations.length ?? 0) + 1
  }

  const { nextVersionForDeal } = await import('./supabase/configs')
  return nextVersionForDeal(attioDealId)
}

// =========================================
// IMPLEMENTACIÓN ATTIO
// =========================================

async function getDealsFromAttio(): Promise<Deal[]> {
  const [
    { listAttioDeals, listAttioMembers },
    { getConfigsForDeal, getActiveConfigForDeal },
    { mapAttioDeal, getCompanyRefId, getPersonRefId },
    { getAttioCompany, getAttioPerson },
  ] = await Promise.all([
    import('./attio/client'),
    import('./supabase/configs'),
    import('./attio/mappers'),
    import('./attio/client'),
  ])

  const [dealRecords, members] = await Promise.all([
    listAttioDeals(),
    listAttioMembers().catch(() => []), // silencia error de permisos
  ])

  // Fetch configs y detalles en paralelo para todos los deals
  const deals = await Promise.all(
    dealRecords.map(async (record) => {
      const attioId = record.id.record_id

      // Refs de empresa y persona
      const companyRefId = getCompanyRefId(record)
      const personRefId = getPersonRefId(record)

      // Parallelizar fetches por deal
      const [companyRecord, personRecord, configs, activeConfig] =
        await Promise.all([
          companyRefId ? getAttioCompany(companyRefId) : Promise.resolve(null),
          personRefId ? getAttioPerson(personRefId) : Promise.resolve(null),
          getConfigsForDeal(attioId).catch(() => []),
          getActiveConfigForDeal(attioId).catch(() => undefined),
        ])

      return mapAttioDeal(record, {
        companyRecord,
        personRecord,
        members,
        configurations: configs,
        activeConfigId: activeConfig?.id,
      })
    })
  )

  return deals
}

async function getDealFromAttio(recordId: string): Promise<Deal | undefined> {
  const [
    { getAttioDeal, getAttioCompany, getAttioPerson, listAttioMembers },
    { getConfigsForDeal, getActiveConfigForDeal },
    { mapAttioDeal, getCompanyRefId, getPersonRefId },
  ] = await Promise.all([
    import('./attio/client'),
    import('./supabase/configs'),
    import('./attio/mappers'),
  ])

  const record = await getAttioDeal(recordId)
  if (!record) return undefined

  const companyRefId = getCompanyRefId(record)
  const personRefId = getPersonRefId(record)

  const [companyRecord, personRecord, members, configs, activeConfig] =
    await Promise.all([
      companyRefId ? getAttioCompany(companyRefId) : Promise.resolve(null),
      personRefId ? getAttioPerson(personRefId) : Promise.resolve(null),
      listAttioMembers().catch(() => []),
      getConfigsForDeal(recordId).catch(() => []),
      getActiveConfigForDeal(recordId).catch(() => undefined),
    ])

  return mapAttioDeal(record, {
    companyRecord,
    personRecord,
    members,
    configurations: configs,
    activeConfigId: activeConfig?.id,
  })
}
