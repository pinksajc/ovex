'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { insertPlannedItem, deletePlannedItem } from '@/lib/supabase/cashflow-planned'

function assertOwner(role: string) {
  if (role !== 'owner' && role !== 'admin') throw new Error('No autorizado')
}

// ── Add planned item ─────────────────────────────────────────────────────────

export interface AddPlannedItemPayload {
  date: string
  description: string
  amount: number       // positive; sign derived from type
  type: 'income' | 'expense'
  category: string
  isRecurring: boolean
}

export async function addPlannedItemAction(
  payload: AddPlannedItemPayload,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)
    await insertPlannedItem({
      date: payload.date,
      description: payload.description,
      amount: Math.abs(payload.amount),
      type: payload.type,
      category: payload.category,
      isRecurring: payload.isRecurring,
      source: 'manual',
    })
    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
  }
}

// ── Delete planned item ──────────────────────────────────────────────────────

export async function deletePlannedItemAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)
    await deletePlannedItem(id)
    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
  }
}

// ── Confirm suggested recurring expense ──────────────────────────────────────

export interface ConfirmRecurringPayload {
  description: string
  amount: number
  category: string
}

export async function confirmSuggestedRecurringAction(
  payload: ConfirmRecurringPayload,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    assertOwner(user.role)

    // Start from the 1st of next month
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const date = next.toISOString().split('T')[0]

    await insertPlannedItem({
      date,
      description: payload.description,
      amount: Math.abs(payload.amount),
      type: 'expense',
      category: payload.category,
      isRecurring: true,
      source: 'manual',
    })
    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
  }
}
