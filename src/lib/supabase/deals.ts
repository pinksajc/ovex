// =========================================
// CRUD — deals (native Supabase CRM table)
// server-only
//
// SQL (run once in Supabase):
//   CREATE TABLE deals (
//     id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     company_name        text NOT NULL,
//     company_cif         text,
//     company_address     text,
//     contact_first_name  text,
//     contact_last_name   text,
//     contact_email       text,
//     contact_phone       text,
//     stage               text DEFAULT 'prospecting',
//     owner_id            uuid REFERENCES profiles(id),
//     created_at          timestamptz DEFAULT now(),
//     updated_at          timestamptz DEFAULT now()
//   );
//   ALTER TABLE deals DISABLE ROW LEVEL SECURITY;
//
// Migrations (if table already exists):
//   ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_cif text;
//   ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_address text;
// =========================================

import { getSupabaseClient } from './client'
import type { Deal, DealStage } from '@/types'

interface DealRow {
  id: string
  company_name: string
  company_cif: string | null
  company_address: string | null
  contact_first_name: string | null
  contact_last_name: string | null
  contact_email: string | null
  contact_phone: string | null
  stage: string
  owner_id: string | null
  created_at: string
  updated_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table() { return getSupabaseClient().from('deals') as any }

function rowToDeal(row: DealRow): Deal {
  const contactName = [row.contact_first_name, row.contact_last_name]
    .filter(Boolean).join(' ') || 'Sin contacto'
  return {
    id: row.id,
    company: {
      name: row.company_name,
      cif: row.company_cif ?? undefined,
      address: row.company_address ?? undefined,
    },
    contact: {
      name: contactName,
      email: row.contact_email ?? '',
      phone: row.contact_phone ?? undefined,
    },
    owner: row.owner_id ?? 'Sin asignar', // resolved to name upstream
    stage: (row.stage as DealStage) ?? 'prospecting',
    configurations: [],        // loaded separately
    activeConfigId: undefined, // loaded separately
    commercialStatus: 'no_config',
    hasProposal: false,
    lastActivityAt: null,
    lastProposalViewAt: null,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listDeals(): Promise<Deal[]> {
  const { data, error } = await table()
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Supabase listDeals: ${error.message}`)
  return ((data ?? []) as DealRow[]).map(rowToDeal)
}

export async function getDealById(id: string): Promise<Deal | undefined> {
  const { data, error } = await table()
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`Supabase getDealById: ${error.message}`)
  if (!data) return undefined
  return rowToDeal(data as DealRow)
}

export interface CreateDealInput {
  companyName: string
  companyCif?: string
  companyAddress?: string
  contactFirstName?: string
  contactLastName?: string
  contactEmail?: string
  contactPhone?: string
  stage?: DealStage
  ownerId?: string
}

export interface UpdateCompanyInput {
  cif?: string
  address?: string
}

export async function updateDealStage(id: string, stage: DealStage): Promise<void> {
  const { error } = await table()
    .update({ stage, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Supabase updateDealStage: ${error.message}`)
}

export async function updateDealOwner(id: string, ownerId: string | null): Promise<void> {
  const { error } = await table()
    .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Supabase updateDealOwner: ${error.message}`)
}

export async function updateDealCompany(id: string, input: UpdateCompanyInput): Promise<void> {
  const patch: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  }
  if (input.cif !== undefined) patch.company_cif = input.cif || null
  if (input.address !== undefined) patch.company_address = input.address || null
  const { error } = await table().update(patch).eq('id', id)
  if (error) throw new Error(`Supabase updateDealCompany: ${error.message}`)
}

export async function createDeal(input: CreateDealInput): Promise<Deal> {
  const { data, error } = await table()
    .insert({
      company_name: input.companyName,
      company_cif: input.companyCif || null,
      company_address: input.companyAddress || null,
      contact_first_name: input.contactFirstName || null,
      contact_last_name: input.contactLastName || null,
      contact_email: input.contactEmail || null,
      contact_phone: input.contactPhone || null,
      stage: input.stage ?? 'prospecting',
      owner_id: input.ownerId || null,
    })
    .select()
    .single()
  if (error) throw new Error(`Supabase createDeal: ${error.message}`)
  return rowToDeal(data as DealRow)
}
