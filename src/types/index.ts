// =========================================
// PRICING TYPES
// =========================================

export type PlanTier = 'starter' | 'growth' | 'pro'

export type AddonId =
  | 'kds'
  | 'kiosk'
  | 'stock'
  | 'analytics_premium'
  | 'delivery_integrations'
  | 'datafono'

export type HardwareId =
  | 'ipad'
  | 'bouncepad_kiosk'
  | 'counter_stand'

export type HardwareMode = 'included' | 'sold' | 'financed'

export interface HardwareLineItem {
  hardwareId: HardwareId
  quantity: number
  mode: HardwareMode
  unitCost: number        // internal cost (Platomico)
  unitPrice: number       // client price
  financeMonths?: number  // only for 'financed' mode
}

// =========================================
// DEAL CONFIGURATION
// =========================================

export interface DealConfiguration {
  id: string
  dealId: string
  version: number
  label?: string

  // Simulator inputs
  dailyOrdersPerLocation: number
  locations: number
  averageTicket: number          // € — for GMV / datafono fee
  estimatedGrowthPercent: number

  // Auto-suggested but can be overridden
  plan: PlanTier
  planOverridden: boolean

  // Add-ons
  activeAddons: AddonId[]

  // Hardware
  hardware: HardwareLineItem[]

  // Snapshot at save time
  economics: DealEconomics

  createdAt: string
}

export interface DealEconomics {
  // Volume
  monthlyVolumePerLocation: number  // orders
  totalMonthlyVolume: number
  monthlyGMVPerLocation: number     // €
  totalMonthlyGMV: number           // €

  // Software Revenue breakdown
  planFeeMonthly: number            // fixed + variable × locations
  addonFeeMonthly: number           // addon sum (excl. datafono)
  datafonoFeeMonthly: number        // % of GMV
  softwareRevenueMonthly: number    // plan + addon + datafono

  // Hardware Revenue
  hardwareRevenueUpfront: number    // sold (one-time)
  hardwareRevenueMonthly: number    // financed installments

  // Total Revenue (software + hardware monthly)
  totalMonthlyRevenue: number
  annualRevenue: number
  revenuePerLocation: number        // monthly

  // Hardware Investment
  hardwareCostTotal: number         // sum cost of all hardware items
  hardwareNetInvestment: number     // net cost Platomico bears (excl. sold)

  // Margin
  grossMarginPercent: number
  grossMarginMonthly: number

  // Payback — null if no net investment
  paybackMonths: number | null

  // Backward compat (kept for existing Supabase snapshots)
  hardwareRevenueTotal: number      // = hardwareRevenueUpfront
  hasReviewManualItems: boolean     // always false — hardware is now real
}

// =========================================
// DEAL
// =========================================

export type DealStage =
  | 'prospecting'
  | 'qualified'
  | 'proposal_sent'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost'

export type DealCommercialStatus =
  | 'no_config'
  | 'configured'
  | 'proposal_created'  // draft saved, not sent
  | 'proposal_sent'     // sent for signature, not yet opened
  | 'proposal_viewed'   // client opened it
  | 'negotiating'       // deal.stage === 'negotiation' after sending
  | 'signed'            // DocuSeal confirmed

export interface Deal {
  id: string
  attioId?: string

  company: {
    name: string
    cif?: string
    address?: string
    city?: string
  }

  contact: {
    name: string
    email: string
    phone?: string
  }

  owner: string
  stage: DealStage

  configurations: DealConfiguration[]
  activeConfigId?: string

  /** Computed server-side in getDeals(). Never derive this in components. */
  commercialStatus: DealCommercialStatus
  /** true if a saved proposal exists for the active config version. */
  hasProposal: boolean
  /** ISO timestamp of the most recent deal_event, or null if none. */
  lastActivityAt: string | null
  /** ISO timestamp of the most recent proposal_viewed event, or null if none. */
  lastProposalViewAt: string | null

  notes?: string

  createdAt: string
  updatedAt: string
}

// =========================================
// PROPOSAL
// =========================================

export type ProposalStatus = 'draft' | 'sent' | 'signed' | 'rejected'

export interface Proposal {
  id: string
  dealId: string
  configurationId: string
  version: number
  status: ProposalStatus
  docusealSubmissionId?: string
  sentAt?: string
  signedAt?: string
  pdfUrl?: string
  createdAt: string
}

/** Free-text sections the sales rep edits in the proposal screen */
export interface ProposalSections {
  executiveSummary: string
  solution: string
  economicsSummary: string
  nextSteps: string
}

/** Persisted proposal record (one per deal, tied to config at save time) */
export interface ProposalRecord {
  id: string
  attioDealId: string
  configId: string
  sections: ProposalSections
  sentForSignatureAt: string | null
  // DocuSeal
  docusealSubmissionId: string | null
  docusealStatus: 'pending' | 'completed' | null  // pending = awaiting; completed = signed
  signedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Lightweight summary used for batch status enrichment in getDeals() */
export interface ProposalSummary {
  configId: string
  sentForSignatureAt: string | null
  docusealStatus: 'pending' | 'completed' | null
  signedAt: string | null
}
