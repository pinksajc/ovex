// =========================================
// APPROVALS — helpers, types, business logic
// server-only
// =========================================

import type { InvoiceLineItem, ApprovalStatus, ApprovalType } from '@/types'
import type { UserRole } from '@/lib/auth'

// ── Unified item for the gestiones queue ─────────────────────────────────────

export interface ApprovalItem {
  id: string
  itemType: 'oferta' | 'factura'
  number: string
  clientName: string
  amountTotal: number
  approvalType: ApprovalType
  approvalStatus: ApprovalStatus
  approvalNotes: string | null
  documentStatus: string
  createdAt: string
}

// ── Discount detection ────────────────────────────────────────────────────────

/**
 * Returns 'discount' if any line item carries a discount of any kind;
 * otherwise 'standard'.
 */
export function detectApprovalType(lineItems: InvoiceLineItem[]): ApprovalType {
  const hasDiscount = lineItems.some(
    (item) =>
      item.type === 'discount' ||
      (item.lineDiscountPercent ?? 0) > 0 ||
      (item.discountValue ?? 0) > 0 ||
      item.amount < 0,
  )
  return hasDiscount ? 'discount' : 'standard'
}

// ── Permission check ──────────────────────────────────────────────────────────

/**
 * Returns true if `role` is allowed to approve an item of `approvalType`.
 *   standard → admin or owner can approve
 *   discount → only owner can approve
 */
export function canApprove(role: UserRole, approvalType: ApprovalType): boolean {
  if (role === 'owner') return true
  if (role === 'admin' && approvalType === 'standard') return true
  return false
}

// ── Download / send gate ──────────────────────────────────────────────────────

/**
 * True when the download/send button should be blocked for this user.
 * Only drafts require approval; non-draft docs are already in the workflow.
 */
export function isDownloadBlocked(
  documentStatus: string,
  approvalStatus: ApprovalStatus,
  role: UserRole,
): boolean {
  if (role === 'owner') return false                    // owner always allowed
  if (documentStatus !== 'draft') return false          // only drafts need approval
  return approvalStatus !== 'approved'
}

// ── Chip config ───────────────────────────────────────────────────────────────

export const APPROVAL_CHIP: Record<
  ApprovalStatus,
  { label: string; cls: string } | null
> = {
  approved:          null, // no chip when approved
  pending_approval:  { label: 'Pendiente aprobación', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  rejected:          { label: 'Rechazado',             cls: 'bg-red-50 text-red-700 border-red-200' },
  changes_requested: { label: 'Cambios solicitados',   cls: 'bg-orange-50 text-orange-700 border-orange-200' },
}
