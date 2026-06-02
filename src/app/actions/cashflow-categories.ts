'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import {
  listCategoriesWithCounts,
  createCategory,
  renameCategory,
  deleteCategory,
} from '@/lib/supabase/cashflow-categories'
import type { CategoryWithCount } from '@/lib/supabase/cashflow-categories'

export type { CategoryWithCount }

function assertAdmin(role: string) {
  if (role !== 'owner' && role !== 'admin') throw new Error('No autorizado')
}

interface ActionResult {
  ok: boolean
  error?: string
}

export async function listCategoriesAction(): Promise<{ ok: boolean; data?: CategoryWithCount[]; error?: string }> {
  try {
    await requireAuth()
    const data = await listCategoriesWithCounts()
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function createCategoryAction(name: string, color?: string): Promise<ActionResult> {
  try {
    const user = await requireAuth()
    assertAdmin(user.role)
    await createCategory(name, color)
    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function renameCategoryAction(id: string, oldName: string, newName: string): Promise<ActionResult> {
  try {
    const user = await requireAuth()
    assertAdmin(user.role)
    await renameCategory(id, oldName, newName)
    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function deleteCategoryAction(
  id: string | null,
  name: string,
  reassignTo?: string,
): Promise<ActionResult> {
  try {
    const user = await requireAuth()
    assertAdmin(user.role)
    await deleteCategory(id, name, reassignTo)
    revalidatePath('/cashflow')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
