// =========================================
// DEALS SERVICE LAYER
// Reads from native Supabase deals table.
// Falls back to mock data when Supabase is not configured.
// =========================================

import { unstable_cache } from 'next/cache'
import type { Deal, DealCommercialStatus, DealConfiguration, ProposalRecord, ProposalSections, ProposalSummary } from '@/types'
import { getLastActivityByDeal, getLastProposalViewByDeal } from './supabase/events'
import type { ContactOverride } from './supabase/contact-overrides'

// ---- Flags ----

function isSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
}

// =========================================
// READS
// =========================================

/**
 * Lista todos los deals con commercialStatus y hasProposal precalculados.
 * Cacheado 60 s — invalidar con revalidateTag('attio-deals').
 */
export const getDeals: () => Promise<Deal[]> = unstable_cache(
  async () => {
    const baseDeals = isSupabaseConfigured()
      ? await getDealsFromSupabase()
      : await import('./mock-data').then((m) => m.MOCK_DEALS)

    return enrichWithCommercialStatus(baseDeals)
  },
  ['deals-list'],
  { revalidate: 60, tags: ['attio-deals'] }
)

/**
 * Obtiene un deal por ID.
 * Cacheado 60 s — invalidar con revalidateTag('attio-deals').
 */
export const getDeal: (id: string) => Promise<Deal | undefined> = unstable_cache(
  async (id: string) => {
    const base = isSupabaseConfigured()
      ? await getDealFromSupabase(id)
      : await import('./mock-data').then((m) => m.getDealById(id))

    if (!base) return undefined
    const [enriched] = await enrichWithCommercialStatus([base])
    return enriched
  },
  ['deal'],
  { revalidate: 60, tags: ['attio-deals'] }
)

/**
 * Retorna la configuración activa de un deal.
 */
export function getActiveConfig(deal: Deal): DealConfiguration | undefined {
  if (!deal.activeConfigId) return deal.configurations[0]
  return deal.configurations.find((c) => c.id === deal.activeConfigId)
}

// =========================================
// WRITES
// =========================================

export async function saveConfig(
  dealId: string,
  config: Omit<DealConfiguration, 'dealId'>
): Promise<DealConfiguration> {
  if (!isSupabaseConfigured()) return { ...config, dealId }

  const { saveConfig: sbSave } = await import('./supabase/configs')
  return sbSave(dealId, config)
}

export async function setActiveConfig(dealId: string, configId: string): Promise<void> {
  if (!isSupabaseConfigured()) return

  const { setActiveConfig: sbSet } = await import('./supabase/configs')
  return sbSet(dealId, configId)
}

export async function saveActiveConfig(
  dealId: string,
  config: Omit<DealConfiguration, 'dealId'>
): Promise<{ config: DealConfiguration; persisted: boolean }> {
  if (!isSupabaseConfigured()) {
    return { config: { ...config, dealId }, persisted: false }
  }

  const { upsertActiveConfig } = await import('./supabase/configs')
  const saved = await upsertActiveConfig(dealId, config)
  return { config: saved, persisted: true }
}

export async function saveNewConfigVersion(
  dealId: string,
  configData: Omit<DealConfiguration, 'dealId' | 'id' | 'version' | 'createdAt'>
): Promise<{ config: DealConfiguration; persisted: boolean }> {
  if (!isSupabaseConfigured()) {
    return {
      config: {
        ...configData,
        id: `${dealId}-v1-mock`,
        dealId,
        version: 1,
        createdAt: new Date().toISOString(),
      },
      persisted: false,
    }
  }

  const { insertVersion } = await import('./supabase/configs')
  const saved = await insertVersion(dealId, configData)
  return { config: saved, persisted: true }
}

export async function nextVersion(dealId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    const deal = await getDeal(dealId)
    return (deal?.configurations.length ?? 0) + 1
  }

  const { nextVersionForDeal } = await import('./supabase/configs')
  return nextVersionForDeal(dealId)
}

// =========================================
// PROPOSALS
// =========================================

export async function getProposal(
  dealId: string,
  configId: string
): Promise<ProposalRecord | null> {
  if (!isSupabaseConfigured()) return null
  const { getProposalForDeal } = await import('./supabase/proposals')
  return getProposalForDeal(dealId, configId).catch(() => null)
}

export async function saveProposal(
  dealId: string,
  configId: string,
  sections: ProposalSections
): Promise<{ proposal: ProposalRecord; persisted: boolean }> {
  if (!isSupabaseConfigured()) {
    return {
      proposal: {
        id: `${dealId}-proposal-mock`,
        attioDealId: dealId,
        configId,
        sections,
        sentForSignatureAt: null,
        docusealSubmissionId: null,
        docusealStatus: null,
        signedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      persisted: false,
    }
  }
  const { upsertProposal } = await import('./supabase/proposals')
  const proposal = await upsertProposal(dealId, configId, sections)
  return { proposal, persisted: true }
}

// =========================================
// ENRICHMENT (private)
// =========================================

async function enrichWithCommercialStatus(deals: Deal[]): Promise<Deal[]> {
  let proposalSummaries = new Map<string, ProposalSummary>()
  let lastActivityMap = new Map<string, string>()
  let lastProposalViewMap = new Map<string, string>()
  let ownerMap = new Map<string, string>()
  let contactOverrideMap = new Map<string, ContactOverride>()

  if (isSupabaseConfigured() && deals.length > 0) {
    const dealIds = deals.map((d) => d.id)
    const [summaries, activityMap, proposalViewMap, owners, contactOverrides] = await Promise.all([
      import('./supabase/proposals')
        .then((m) => m.getProposalSummariesForDeals(dealIds))
        .catch(() => new Map<string, ProposalSummary>()),
      getLastActivityByDeal(dealIds).catch(() => new Map<string, string>()),
      getLastProposalViewByDeal(dealIds).catch(() => new Map<string, string>()),
      import('./supabase/deal-owners')
        .then((m) => m.getDealOwnerMap(dealIds))
        .catch(() => new Map<string, string>()),
      import('./supabase/contact-overrides')
        .then((m) => m.getContactOverridesForDeals(dealIds))
        .catch(() => new Map<string, ContactOverride>()),
    ])
    proposalSummaries = summaries
    lastActivityMap = activityMap
    lastProposalViewMap = proposalViewMap
    ownerMap = owners
    contactOverrideMap = contactOverrides
  }

  const NEGOTIATING_DAYS = 5

  const STATUS_PRIORITY: Record<DealCommercialStatus, number> = {
    signed: 0,
    negotiating: 1,
    viewed: 2,
    proposal_sent: 3,
    proposal_created: 4,
    configured: 5,
    no_config: 6,
  }

  return deals
    .map((deal) => {
      const activeCfg = getActiveConfig(deal)
      const summary = activeCfg ? proposalSummaries.get(activeCfg.id) : undefined
      const hasProposal = !!summary
      const lastActivityAt = lastActivityMap.get(deal.id) ?? null
      const lastProposalViewAt = lastProposalViewMap.get(deal.id) ?? null

      let commercialStatus: DealCommercialStatus = 'no_config'
      if (!activeCfg) {
        commercialStatus = 'no_config'
      } else if (!summary) {
        commercialStatus = 'configured'
      } else if (summary.docusealStatus === 'completed' || summary.signedAt) {
        commercialStatus = 'signed'
      } else if (summary.sentForSignatureAt && lastProposalViewAt) {
        const daysSinceView =
          (Date.now() - new Date(lastProposalViewAt).getTime()) / (1000 * 60 * 60 * 24)
        commercialStatus = daysSinceView >= NEGOTIATING_DAYS ? 'negotiating' : 'viewed'
      } else if (summary.sentForSignatureAt) {
        commercialStatus = 'proposal_sent'
      } else {
        commercialStatus = 'proposal_created'
      }

      // deal_owners overrides deals.owner_id for admin reassignments
      const ownerId = ownerMap.get(deal.id) ?? deal.ownerId ?? null

      // Apply contact override if present
      const override = contactOverrideMap.get(deal.id)
      const contact = override
        ? {
            ...deal.contact,
            name: `${override.firstName} ${override.lastName}`.trim() || deal.contact.name,
            email: override.email || deal.contact.email,
          }
        : deal.contact

      return { ...deal, contact, commercialStatus, hasProposal, lastActivityAt, lastProposalViewAt, ownerId }
    })
    .sort((a, b) => {
      const pa = STATUS_PRIORITY[a.commercialStatus]
      const pb = STATUS_PRIORITY[b.commercialStatus]
      if (pa !== pb) return pa - pb
      const arrA = getActiveConfig(a)?.economics.annualRevenue ?? 0
      const arrB = getActiveConfig(b)?.economics.annualRevenue ?? 0
      return arrB - arrA
    })
}

// =========================================
// IMPLEMENTATION — Supabase
// =========================================

async function getDealsFromSupabase(): Promise<Deal[]> {
  const { listDeals } = await import('./supabase/deals')
  const { getConfigsForDeal, getActiveConfigForDeal } = await import('./supabase/configs')
  const { getSupabaseClient } = await import('./supabase/client')

  const baseDeals = await listDeals()
  if (baseDeals.length === 0) return []

  // Fetch profiles once for owner name resolution
  const db = getSupabaseClient()
  type ProfileRow = { id: string; name: string | null; email: string }
  const { data: profiles } = await db
    .from('profiles')
    .select('id, name, email') as { data: ProfileRow[] | null; error: unknown }
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.name ?? p.email]))

  const deals = await Promise.all(
    baseDeals.map(async (deal) => {
      const [configs, activeConfig] = await Promise.all([
        getConfigsForDeal(deal.id).catch(() => [] as DealConfiguration[]),
        getActiveConfigForDeal(deal.id).catch(() => undefined),
      ])
      const ownerName = deal.ownerId
        ? (profileMap.get(deal.ownerId) ?? 'Sin asignar')
        : 'Sin asignar'
      return {
        ...deal,
        owner: ownerName,
        configurations: configs,
        activeConfigId: activeConfig?.id,
      }
    })
  )

  return deals
}

async function getDealFromSupabase(id: string): Promise<Deal | undefined> {
  const { getDealById } = await import('./supabase/deals')
  const { getConfigsForDeal, getActiveConfigForDeal } = await import('./supabase/configs')
  const { getSupabaseClient } = await import('./supabase/client')

  const deal = await getDealById(id)
  if (!deal) return undefined

  const [configs, activeConfig] = await Promise.all([
    getConfigsForDeal(deal.id).catch(() => [] as DealConfiguration[]),
    getActiveConfigForDeal(deal.id).catch(() => undefined),
  ])

  let ownerName = 'Sin asignar'
  if (deal.ownerId) {
    const db = getSupabaseClient()
    type ProfileRow = { name: string | null; email: string }
    const { data: profile } = await db
      .from('profiles')
      .select('name, email')
      .eq('id', deal.ownerId)
      .maybeSingle() as { data: ProfileRow | null; error: unknown }
    if (profile) ownerName = profile.name ?? profile.email
  }

  return {
    ...deal,
    owner: ownerName,
    configurations: configs,
    activeConfigId: activeConfig?.id,
  }
}
