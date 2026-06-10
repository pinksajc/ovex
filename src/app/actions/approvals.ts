'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { canApprove } from '@/lib/approvals'
import {
  approveItem,
  rejectItem,
  requestChangesItem,
  getItemDealInfo,
} from '@/lib/supabase/approvals'
import { logApprovalEvent } from '@/lib/supabase/events'
import type { ApprovalType } from '@/types'

type Result = { ok: true } | { ok: false; error: string }

// ── Approve ───────────────────────────────────────────────────────────────────

export async function approveItemAction(
  itemType: 'oferta' | 'factura',
  itemId: string,
  approvalType: ApprovalType,
): Promise<Result> {
  try {
    const me = await requireAuth()
    if (!canApprove(me.role, approvalType)) {
      return {
        ok: false,
        error: approvalType === 'discount'
          ? 'Solo el owner puede aprobar documentos con descuento.'
          : 'Solo admin u owner pueden aprobar.',
      }
    }
    await approveItem(itemType, itemId, me.id)

    // Log approval event to deal timeline
    const info = await getItemDealInfo(itemType, itemId)
    if (info?.dealId) {
      await logApprovalEvent(info.dealId, 'approval_approved', {
        actor:          me.name ?? me.email.split('@')[0],
        documentNumber: info.number,
      })
      revalidatePath(`/deals/${info.dealId}`)
    }

    revalidatePath('/gestiones')
    revalidatePath(`/${itemType === 'oferta' ? 'ofertas' : 'facturas'}/${itemId}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error aprobando' }
  }
}

// ── Reject ────────────────────────────────────────────────────────────────────

export async function rejectItemAction(
  itemType: 'oferta' | 'factura',
  itemId: string,
  notes: string,
): Promise<Result> {
  try {
    const me = await requireAuth()
    if (me.role !== 'admin' && me.role !== 'owner') {
      return { ok: false, error: 'No autorizado' }
    }
    await rejectItem(itemType, itemId, notes.trim(), me.id)

    // Log rejection event to deal timeline
    const info = await getItemDealInfo(itemType, itemId)
    if (info?.dealId) {
      await logApprovalEvent(info.dealId, 'approval_rejected', {
        actor:          me.name ?? me.email.split('@')[0],
        documentNumber: info.number,
        notes:          notes.trim(),
      })
      revalidatePath(`/deals/${info.dealId}`)
    }

    revalidatePath('/gestiones')
    revalidatePath(`/${itemType === 'oferta' ? 'ofertas' : 'facturas'}/${itemId}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error rechazando' }
  }
}

// ── Request changes ───────────────────────────────────────────────────────────

export async function requestChangesAction(
  itemType: 'oferta' | 'factura',
  itemId: string,
  notes: string,
): Promise<Result> {
  try {
    const me = await requireAuth()
    if (me.role !== 'admin' && me.role !== 'owner') {
      return { ok: false, error: 'No autorizado' }
    }
    await requestChangesItem(itemType, itemId, notes.trim(), me.id)

    // Log changes-requested event to deal timeline
    const info = await getItemDealInfo(itemType, itemId)
    if (info?.dealId) {
      await logApprovalEvent(info.dealId, 'approval_changes_requested', {
        actor:          me.name ?? me.email.split('@')[0],
        documentNumber: info.number,
        notes:          notes.trim(),
      })
      revalidatePath(`/deals/${info.dealId}`)
    }

    revalidatePath('/gestiones')
    revalidatePath(`/${itemType === 'oferta' ? 'ofertas' : 'facturas'}/${itemId}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error solicitando cambios' }
  }
}
