// =========================================
// PRICING TYPES
// =========================================

export type PlanTier = 'starter' | 'growth' | 'pro'

export type AddonId =
  | 'kds'
  | 'kiosk'
  | 'loyalty'
  | 'analytics_premium'
  | 'delivery_integrations'
  | 'datafono'

export type HardwareId =
  | 'terminal_pos'
  | 'kds_screen'
  | 'kiosk_unit'
  | 'printer'
  | 'router'

export type HardwareMode = 'sell' | 'rent' | 'free'

export interface HardwareLineItem {
  hardwareId: HardwareId
  quantity: number
  mode: HardwareMode
  unitCost: number        // internal cost — ⚠️ review_manual
  unitPrice: number | null // client price — ⚠️ review_manual
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

  // Hardware — ⚠️ review_manual
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

  // Revenue breakdown
  planFeeMonthly: number            // fixed + variable × locations
  addonFeeMonthly: number           // addon sum (excl. datafono)
  datafonoFeeMonthly: number        // % of GMV
  totalMonthlyRevenue: number
  annualRevenue: number
  revenuePerLocation: number        // monthly

  // Hardware — ⚠️ review_manual
  hardwareCostTotal: number
  hardwareRevenueTotal: number

  // Margin — ⚠️ review_manual (internal cost unknown)
  grossMarginPercent: number
  grossMarginMonthly: number

  // Payback — null if hardware cost unknown
  paybackMonths: number | null

  hasReviewManualItems: boolean
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
