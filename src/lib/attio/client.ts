// =========================================
// ATTIO API CLIENT
// server-only — nunca importar en Client Components
// =========================================

const ATTIO_BASE = 'https://api.attio.com/v2'

function getKey(): string {
  const key = process.env.ATTIO_API_KEY
  if (!key) throw new Error('ATTIO_API_KEY no configurada')
  return key
}

async function attioFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${ATTIO_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getKey()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    // Sin cache en server components — datos frescos siempre
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Attio ${res.status} en ${path}: ${body}`)
  }

  return res.json() as Promise<T>
}

// ---- Tipos crudos de Attio ----
// Solo lo que usamos. Extender si necesitas más campos.

export interface AttioValue<T> {
  active_from: string
  active_until: string | null
  attribute_type: string
  value?: T
  // status attributes
  status?: { id: string; title: string; is_archived: boolean }
  // record-reference attributes
  target_object?: string
  target_record_id?: string
  // actor-reference (owner)
  referenced_actor_type?: string
  referenced_actor_id?: string
  // email/phone
  email_address?: string
  phone_number?: string
  is_primary?: boolean
}

export interface AttioRecord {
  id: {
    workspace_id: string
    object_id: string
    record_id: string
  }
  created_at: string
  values: Record<string, AttioValue<unknown>[]>
}

export interface AttioListResponse {
  data: AttioRecord[]
  next_page_token?: string
}

export interface AttioSingleResponse {
  data: AttioRecord
}

export interface AttioWorkspaceMember {
  id: { workspace_member_id: string }
  first_name: string
  last_name: string
  email_address: string
  avatar_url: string | null
}

export interface AttioMembersResponse {
  data: AttioWorkspaceMember[]
}

// ---- API calls ----

/**
 * Lista todos los deals (hasta 100).
 * CUSTOMIZE: Ajusta el object slug si tu workspace usa otro nombre (ej. 'opportunities')
 */
export async function listAttioDeals(): Promise<AttioRecord[]> {
  const res = await attioFetch<AttioListResponse>('/objects/deals/records/query', {
    method: 'POST',
    body: JSON.stringify({
      limit: 100,
      sorts: [{ direction: 'desc', attribute: 'created_at' }],
    }),
  })
  return res.data
}

/**
 * Obtiene un deal por record_id.
 */
export async function getAttioDeal(recordId: string): Promise<AttioRecord | null> {
  try {
    const res = await attioFetch<AttioSingleResponse>(
      `/objects/deals/records/${recordId}`
    )
    return res.data
  } catch (e) {
    if (e instanceof Error && e.message.includes('404')) return null
    throw e
  }
}

/**
 * Obtiene una empresa por record_id.
 */
export async function getAttioCompany(recordId: string): Promise<AttioRecord | null> {
  try {
    const res = await attioFetch<AttioSingleResponse>(
      `/objects/companies/records/${recordId}`
    )
    return res.data
  } catch (e) {
    if (e instanceof Error && e.message.includes('404')) return null
    throw e
  }
}

/**
 * Obtiene una persona por record_id.
 */
export async function getAttioPerson(recordId: string): Promise<AttioRecord | null> {
  try {
    const res = await attioFetch<AttioSingleResponse>(
      `/objects/people/records/${recordId}`
    )
    return res.data
  } catch (e) {
    if (e instanceof Error && e.message.includes('404')) return null
    throw e
  }
}

/**
 * Actualiza nombre y email de una persona en Attio.
 */
export async function patchAttioPerson(
  recordId: string,
  firstName: string,
  lastName: string,
  email: string
): Promise<AttioRecord> {
  const res = await attioFetch<AttioSingleResponse>(
    `/objects/people/records/${recordId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          values: {
            name: [{ full_name: [firstName, lastName].filter(Boolean).join(' ') }],
            email_addresses: [{ email_address: email, is_primary: true }],
          },
        },
      }),
    }
  )
  return res.data
}

/**
 * Lista los miembros del workspace (para resolver nombres de owner).
 */
export async function listAttioMembers(): Promise<AttioWorkspaceMember[]> {
  const res = await attioFetch<AttioMembersResponse>('/workspace_members')
  return res.data
}

// ---- Helper para leer valores de Attio ----

export function attioVal<T>(
  values: Record<string, AttioValue<unknown>[]>,
  key: string
): AttioValue<T> | undefined {
  const arr = values[key]
  if (!arr || arr.length === 0) return undefined
  return arr[0] as AttioValue<T>
}

export function attioText(
  values: Record<string, AttioValue<unknown>[]>,
  key: string
): string | undefined {
  return attioVal<string>(values, key)?.value as string | undefined
}
