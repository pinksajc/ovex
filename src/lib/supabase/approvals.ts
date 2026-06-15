// =========================================
// APPROVALS — Supabase DB operations
// server-only
// =========================================

import { getSupabaseClient } from './client'
import type { ApprovalItem, HistoryItem } from '@/lib/approvals'
import type { ApprovalStatus, InvoiceLineItem } from '@/types'
import { detectApprovalType } from '@/lib/approvals'

// ── eslint helpers ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function presupuestosTable() { return (getSupabaseClient() as any).from('presupuestos') }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function invoicesTable() { return (getSupabaseClient() as any).from('invoices') }

// ── Fetch pending items ───────────────────────────────────────────────────────

export async function getPendingApprovals(): Promise<ApprovalItem[]> {
  const [presupuestosRes, invoicesRes] = await Promise.all([
    presupuestosTable()
      .select('id, number, client_name, amount_total, approval_status, approval_type, approval_notes, line_items, status, created_at')
      .eq('approval_status', 'pending_approval')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(100),
    invoicesTable()
      .select('id, number, client_name, amount_total, approval_status, approval_type, approval_notes, line_items, status, created_at')
      .eq('approval_status', 'pending_approval')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const presupuestoItems: ApprovalItem[] = (presupuestosRes.data ?? []).map(
    (r: Record<string, unknown>) => ({
      id:             r.id as string,
      itemType:       'oferta' as const,
      number:         r.number as string,
      clientName:     r.client_name as string,
      amountTotal:    Number(r.amount_total),
      approvalType:   detectApprovalType(
        (Array.isArray(r.line_items) ? r.line_items : []) as InvoiceLineItem[]
      ),
      approvalStatus: (r.approval_status ?? 'pending_approval') as ApprovalStatus,
      approvalNotes:  (r.approval_notes as string | null) ?? null,
      documentStatus: r.status as string,
      createdAt:      r.created_at as string,
    })
  )

  const invoiceItems: ApprovalItem[] = (invoicesRes.data ?? []).map(
    (r: Record<string, unknown>) => ({
      id:             r.id as string,
      itemType:       'factura' as const,
      number:         r.number as string,
      clientName:     r.client_name as string,
      amountTotal:    Number(r.amount_total),
      approvalType:   detectApprovalType(
        (Array.isArray(r.line_items) ? r.line_items : []) as InvoiceLineItem[]
      ),
      approvalStatus: (r.approval_status ?? 'pending_approval') as ApprovalStatus,
      approvalNotes:  (r.approval_notes as string | null) ?? null,
      documentStatus: r.status as string,
      createdAt:      r.created_at as string,
    })
  )

  return [...presupuestoItems, ...invoiceItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function getPendingApprovalsCount(): Promise<number> {
  const db = getSupabaseClient()
  const [presRes, invRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).from('presupuestos')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending_approval')
      .eq('status', 'draft'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending_approval')
      .eq('status', 'draft'),
  ])
  return (presRes.count ?? 0) + (invRes.count ?? 0)
}

// ── Deal info helper ──────────────────────────────────────────────────────────

/**
 * Returns the deal_id and document number for an oferta or factura.
 * Returns null if the item has no linked deal.
 */
export async function getItemDealInfo(
  itemType: 'oferta' | 'factura',
  itemId: string,
): Promise<{ dealId: string; number: string } | null> {
  const table = itemType === 'oferta' ? presupuestosTable() : invoicesTable()
  const { data, error } = await table
    .select('deal_id, number')
    .eq('id', itemId)
    .maybeSingle()
  if (error || !data || !data.deal_id) return null
  return { dealId: data.deal_id as string, number: data.number as string }
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function approveItem(
  itemType: 'oferta' | 'factura',
  itemId: string,
  approvedById: string,
): Promise<void> {
  const table = itemType === 'oferta' ? presupuestosTable() : invoicesTable()
  const { error } = await table
    .update({
      approval_status: 'approved',
      approved_by:     approvedById,
      approved_at:     new Date().toISOString(),
      approval_notes:  null,
    })
    .eq('id', itemId)
  if (error) throw error
}

export async function rejectItem(
  itemType: 'oferta' | 'factura',
  itemId: string,
  notes: string,
  rejectedById?: string,
): Promise<void> {
  const table = itemType === 'oferta' ? presupuestosTable() : invoicesTable()
  const { error } = await table
    .update({
      approval_status: 'rejected',
      approval_notes:  notes,
      approved_by:     rejectedById ?? null,
      approved_at:     new Date().toISOString(),
    })
    .eq('id', itemId)
  if (error) throw error
}

export async function requestChangesItem(
  itemType: 'oferta' | 'factura',
  itemId: string,
  notes: string,
  actionedById?: string,
): Promise<void> {
  const table = itemType === 'oferta' ? presupuestosTable() : invoicesTable()
  const { error } = await table
    .update({
      approval_status: 'changes_requested',
      approval_notes:  notes,
      approved_by:     actionedById ?? null,
      approved_at:     new Date().toISOString(),
    })
    .eq('id', itemId)
  if (error) throw error
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getApprovalHistory(): Promise<HistoryItem[]> {
  const STATUSES = ['approved', 'rejected', 'changes_requested']

  const [presupuestosRes, invoicesRes] = await Promise.all([
    presupuestosTable()
      .select('id, number, client_name, amount_total, approval_status, approval_notes, approved_by, approved_at, created_at')
      .in('approval_status', STATUSES)
      .order('approved_at', { ascending: false, nullsFirst: false })
      .limit(100),
    invoicesTable()
      .select('id, number, client_name, amount_total, approval_status, approval_notes, approved_by, approved_at, created_at')
      .in('approval_status', STATUSES)
      .order('approved_at', { ascending: false, nullsFirst: false })
      .limit(100),
  ])

  // Collect unique approver UUIDs for name resolution
  const allRows = [
    ...(presupuestosRes.data ?? []).map((r: Record<string, unknown>) => ({ ...r, _kind: 'oferta' as const })),
    ...(invoicesRes.data ?? []).map((r: Record<string, unknown>) => ({ ...r, _kind: 'factura' as const })),
  ]

  const approverIds = [...new Set(
    allRows
      .map((r) => r.approved_by as string | null)
      .filter((id): id is string => !!id),
  )]

  // Resolve names from profiles
  const nameMap = new Map<string, string>()
  if (approverIds.length > 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profiles } = await (getSupabaseClient() as any)
        .from('profiles')
        .select('id, full_name, email')
        .in('id', approverIds)

      for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null; email: string }>) {
        nameMap.set(p.id, p.full_name ?? p.email.split('@')[0])
      }
    } catch {
      // ignore — names will be null
    }
  }

  const items: HistoryItem[] = allRows.map((r) => ({
    id:             r.id as string,
    itemType:       r._kind,
    number:         r.number as string,
    clientName:     r.client_name as string,
    amountTotal:    Number(r.amount_total),
    approvalStatus: r.approval_status as HistoryItem['approvalStatus'],
    approvalNotes:  (r.approval_notes as string | null) ?? null,
    approvedByName: r.approved_by ? (nameMap.get(r.approved_by as string) ?? null) : null,
    approvedAt:     (r.approved_at as string | null) ?? null,
    createdAt:      r.created_at as string,
  }))

  // Sort newest-actioned first
  return items.sort((a, b) => {
    const ta = a.approvedAt ?? a.createdAt
    const tb = b.approvedAt ?? b.createdAt
    return new Date(tb).getTime() - new Date(ta).getTime()
  })
}
