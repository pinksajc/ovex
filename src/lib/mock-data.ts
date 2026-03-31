// =========================================
// MOCK DATA
// Reemplazar con datos reales de Attio
// =========================================

import { calculateEconomics } from './pricing/engine'
import type { Deal } from '@/types'

const emptyEconomics = calculateEconomics({
  dailyOrdersPerLocation: 0,
  locations: 1,
  averageTicket: 0,
  plan: 'starter',
  activeAddons: [],
  hardware: [],
})

export const MOCK_DEALS: Deal[] = [
  {
    id: 'deal-001',
    company: {
      name: 'Burger & Roll',
      city: 'Madrid',
      address: 'Calle Gran Vía 28, Madrid',
      cif: 'B12345678',
    },
    contact: {
      name: 'Carlos Martínez',
      email: 'carlos@burgerroll.es',
      phone: '+34 611 234 567',
    },
    owner: 'Antonio',
    stage: 'negotiation',
    configurations: [
      {
        id: 'cfg-001-v1',
        dealId: 'deal-001',
        version: 1,
        label: 'Propuesta inicial',
        dailyOrdersPerLocation: 200,
        locations: 3,
        averageTicket: 16,
        estimatedGrowthPercent: 15,
        plan: 'growth',
        planOverridden: false,
        activeAddons: ['kds', 'delivery_integrations'],
        hardware: [],
        economics: calculateEconomics({
          dailyOrdersPerLocation: 200,
          locations: 3,
          averageTicket: 16,
          plan: 'growth',
          activeAddons: ['kds', 'delivery_integrations'],
          hardware: [],
        }),
        createdAt: '2026-03-10T10:00:00Z',
      },
    ],
    activeConfigId: 'cfg-001-v1',
    createdAt: '2026-03-05T09:00:00Z',
    updatedAt: '2026-03-10T10:00:00Z',
    commercialStatus: 'configured' as const,
    hasProposal: false,
    lastActivityAt: null,
    lastProposalViewAt: null,
    ownerId: null,
  },
  {
    id: 'deal-002',
    company: {
      name: 'Sushi Palace',
      city: 'Barcelona',
      address: 'Passeig de Gràcia 45, Barcelona',
      cif: 'B87654321',
    },
    contact: {
      name: 'Laura Sánchez',
      email: 'laura@sushipalace.es',
      phone: '+34 622 345 678',
    },
    owner: 'Antonio',
    stage: 'proposal_sent',
    configurations: [
      {
        id: 'cfg-002-v1',
        dealId: 'deal-002',
        version: 1,
        label: 'Oferta 5 locales',
        dailyOrdersPerLocation: 160,
        locations: 5,
        averageTicket: 28,
        estimatedGrowthPercent: 20,
        plan: 'growth',
        planOverridden: false,
        activeAddons: ['kds', 'kiosk', 'stock', 'delivery_integrations'],
        hardware: [],
        economics: calculateEconomics({
          dailyOrdersPerLocation: 160,
          locations: 5,
          averageTicket: 28,
          plan: 'growth',
          activeAddons: ['kds', 'kiosk', 'stock', 'delivery_integrations'],
          hardware: [],
        }),
        createdAt: '2026-03-15T11:00:00Z',
      },
    ],
    activeConfigId: 'cfg-002-v1',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-15T11:00:00Z',
    commercialStatus: 'configured' as const,
    hasProposal: false,
    lastActivityAt: null,
    lastProposalViewAt: null,
    ownerId: null,
  },
  {
    id: 'deal-003',
    company: {
      name: 'El Rincón Mediterráneo',
      city: 'Valencia',
      address: 'Calle Colón 12, Valencia',
    },
    contact: {
      name: 'Pedro García',
      email: 'pedro@rinconmediterraneo.es',
    },
    owner: 'Ana',
    stage: 'qualified',
    configurations: [
      {
        id: 'cfg-003-v1',
        dealId: 'deal-003',
        version: 1,
        dailyOrdersPerLocation: 75,
        locations: 1,
        averageTicket: 22,
        estimatedGrowthPercent: 10,
        plan: 'starter',
        planOverridden: false,
        activeAddons: [],
        hardware: [],
        economics: calculateEconomics({
          dailyOrdersPerLocation: 75,
          locations: 1,
          averageTicket: 22,
          plan: 'starter',
          activeAddons: [],
          hardware: [],
        }),
        createdAt: '2026-03-20T09:00:00Z',
      },
    ],
    activeConfigId: 'cfg-003-v1',
    createdAt: '2026-03-18T10:00:00Z',
    updatedAt: '2026-03-20T09:00:00Z',
    commercialStatus: 'configured' as const,
    hasProposal: false,
    lastActivityAt: null,
    lastProposalViewAt: null,
    ownerId: null,
  },
  {
    id: 'deal-004',
    company: {
      name: 'FastFood Express',
      city: 'Madrid',
      address: 'Av. de la Castellana 100, Madrid',
      cif: 'A11223344',
    },
    contact: {
      name: 'María López',
      email: 'maria.lopez@fastfoodexpress.es',
      phone: '+34 633 456 789',
    },
    owner: 'Antonio',
    stage: 'prospecting',
    configurations: [
      {
        id: 'cfg-004-v1',
        dealId: 'deal-004',
        version: 1,
        label: 'Estimación inicial',
        dailyOrdersPerLocation: 650,
        locations: 8,
        averageTicket: 12,
        estimatedGrowthPercent: 5,
        plan: 'pro',
        planOverridden: false,
        activeAddons: ['kds', 'kiosk', 'analytics_premium', 'delivery_integrations', 'datafono'],
        hardware: [],
        economics: calculateEconomics({
          dailyOrdersPerLocation: 650,
          locations: 8,
          averageTicket: 12,
          plan: 'pro',
          activeAddons: ['kds', 'kiosk', 'analytics_premium', 'delivery_integrations', 'datafono'],
          hardware: [],
        }),
        createdAt: '2026-03-22T14:00:00Z',
      },
    ],
    activeConfigId: 'cfg-004-v1',
    createdAt: '2026-03-22T08:00:00Z',
    updatedAt: '2026-03-22T14:00:00Z',
    commercialStatus: 'no_config' as const,
    hasProposal: false,
    lastActivityAt: null,
    lastProposalViewAt: null,
    ownerId: null,
  },
]

export function getDealById(id: string): Deal | undefined {
  return MOCK_DEALS.find((d) => d.id === id)
}

export function getActiveConfig(deal: Deal) {
  if (!deal.activeConfigId) return deal.configurations[0]
  return deal.configurations.find((c) => c.id === deal.activeConfigId)
}

// Crea una configuración vacía para un deal nuevo
export function createEmptyConfig(dealId: string): import('@/types').DealConfiguration {
  return {
    id: `cfg-${dealId}-v1`,
    dealId,
    version: 1,
    dailyOrdersPerLocation: 150,
    locations: 1,
    averageTicket: 18,
    estimatedGrowthPercent: 10,
    plan: 'growth',
    planOverridden: false,
    activeAddons: [],
    hardware: [],
    economics: emptyEconomics,
    createdAt: new Date().toISOString(),
  }
}
