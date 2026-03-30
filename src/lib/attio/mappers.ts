// =========================================
// ATTIO → Deal MAPPER
// =========================================
//
// ⚠️ CUSTOMIZE: Los slugs de atributos dependen de tu workspace de Attio.
// Para ver los slugs exactos de tu workspace:
//   GET https://api.attio.com/v2/objects/deals
//   → mira el array "attributes[].api_slug"
//
// Los valores por defecto son los slugs más comunes en workspaces Attio estándar.
// =========================================

import type { Deal, DealStage, DealConfiguration } from '@/types'
import type { AttioRecord, AttioWorkspaceMember } from './client'
import { attioText, attioVal } from './client'

// ---- Configuración de slugs ----
// CUSTOMIZE: ajusta estos si tus slugs son diferentes

const SLUG = {
  deal: {
    name: 'name',
    stage: 'stage',                    // attribute_type: "status"
    owner: 'owner',                    // attribute_type: "actor-reference"
    company: 'associated_company',     // attribute_type: "record-reference"
    person: 'associated_people',        // attribute_type: "record-reference" (multi-select)
  },
  company: {
    name: 'name',
    cif: 'vat_number',                 // ⚠️ review_manual: puede ser diferente
    city: 'primary_location',          // attribute_type: "location" → tiene .city
    address: 'primary_location',
  },
  person: {
    name: 'name',
    email: 'email_addresses',          // attribute_type: "email-address"
    phone: 'phone_numbers',            // attribute_type: "phone-number"
  },
} as const

// ---- Mapeo de stages ----
// CUSTOMIZE: ajusta los títulos a los de tu pipeline en Attio

const ATTIO_STAGE_TO_DEAL_STAGE: Record<string, DealStage> = {
  Lead: 'prospecting',
  Prospecting: 'prospecting',
  'In Progress': 'qualified',
  Qualified: 'qualified',
  'Proposal Sent': 'proposal_sent',
  'Propuesta enviada': 'proposal_sent',
  Negotiation: 'negotiation',
  Negociación: 'negotiation',
  'Won 🎉': 'closed_won',
  'Closed Won': 'closed_won',
  'Ganado': 'closed_won',
  Lost: 'closed_lost',
  'Closed Lost': 'closed_lost',
  'Perdido': 'closed_lost',
}

function mapStage(title: string | undefined): DealStage {
  if (!title) return 'prospecting'
  return ATTIO_STAGE_TO_DEAL_STAGE[title] ?? 'prospecting'
}

// ---- Mapper principal ----

export function mapAttioDeal(
  dealRecord: AttioRecord,
  options: {
    companyRecord?: AttioRecord | null
    personRecord?: AttioRecord | null
    members?: AttioWorkspaceMember[]
    configurations?: DealConfiguration[]
    activeConfigId?: string
  } = {}
): Deal {
  const { companyRecord, personRecord, members = [], configurations = [], activeConfigId } = options
  const v = dealRecord.values

  // Stage
  const stageTitle = attioVal(v, SLUG.deal.stage)?.status?.title
  const stage = mapStage(stageTitle)

  // Owner — resuelve nombre desde miembros
  const ownerRef = attioVal(v, SLUG.deal.owner)
  const ownerMemberId = ownerRef?.referenced_actor_id
  const ownerMember = members.find(
    (m) => m.id.workspace_member_id === ownerMemberId
  )
  const owner = ownerMember
    ? `${ownerMember.first_name} ${ownerMember.last_name}`.trim()
    : ownerMemberId ?? 'Sin asignar'

  // Company ref ID (para saber qué company se adjuntó)
  const companyRefId = attioVal(v, SLUG.deal.company)?.target_record_id

  // ---- Company ----
  let company: Deal['company'] = {
    name: 'Sin empresa',
  }

  if (companyRecord) {
    const cv = companyRecord.values
    const location = attioVal<{ city?: string; full_address?: string }>(
      cv,
      SLUG.company.address
    )
    company = {
      name: attioText(cv, SLUG.company.name) ?? 'Sin nombre',
      cif: attioText(cv, SLUG.company.cif),
      city: (location?.value as { city?: string } | undefined)?.city,
      address: (location?.value as { full_address?: string } | undefined)
        ?.full_address,
    }
  } else if (companyRefId) {
    // Si no tenemos el record completo, al menos mostramos el ref ID
    company = { name: `(Empresa ${companyRefId.slice(0, 8)}…)` }
  } else {
    // Fallback: usar el nombre del deal como nombre de empresa
    company = { name: attioText(v, SLUG.deal.name) ?? 'Sin nombre' }
  }

  // ---- Contact ----
  let contact: Deal['contact'] = {
    name: 'Sin contacto',
    email: '',
  }

  if (personRecord) {
    const pv = personRecord.values

    // Email — busca primary o primera
    const emails = pv[SLUG.person.email] ?? []
    const primaryEmail = emails.find((e) => e.is_primary) ?? emails[0]
    const email = primaryEmail?.email_address ?? ''

    // Teléfono
    const phones = pv[SLUG.person.phone] ?? []
    const primaryPhone = phones.find((p) => p.is_primary) ?? phones[0]
    const phone = primaryPhone?.phone_number

    contact = {
      name: attioText(pv, SLUG.person.name) ?? 'Sin nombre',
      email,
      phone,
    }
  }

  return {
    id: dealRecord.id.record_id,
    attioId: dealRecord.id.record_id,
    company,
    contact,
    owner,
    stage,
    configurations,
    activeConfigId,
    // Defaults — overwritten by getDeals() after batch proposal lookup
    commercialStatus: 'no_config',
    hasProposal: false,
    lastActivityAt: null,
    lastProposalViewAt: null,
    createdAt: dealRecord.created_at,
    updatedAt: dealRecord.created_at,
  }
}

/**
 * Extrae el record_id de la empresa referenciada en un deal.
 */
export function getCompanyRefId(dealRecord: AttioRecord): string | undefined {
  return attioVal(dealRecord.values, SLUG.deal.company)?.target_record_id
}

/**
 * Extrae el record_id del contacto referenciado en un deal.
 */
export function getPersonRefId(dealRecord: AttioRecord): string | undefined {
  return attioVal(dealRecord.values, SLUG.deal.person)?.target_record_id
}
