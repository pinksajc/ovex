'use server'

import { revalidatePath } from 'next/cache'
import { logEvent } from '@/lib/supabase/events'

export interface SendForSignatureResult {
  ok: boolean
  submissionId?: string
  signerUrl?: string
  error?: string
}

/**
 * Generates the proposal PDF server-side and sends it to DocuSeal for e-signature.
 *
 * When DOCUSEAL_API_KEY is set:
 *   1. Load deal + config + proposal sections from DB
 *   2. Render self-contained HTML → PDF via puppeteer-core
 *   3. Upload PDF to DocuSeal (creates a one-time template with signature fields)
 *   4. Create a signing submission — DocuSeal emails the client automatically
 *   5. Persist docuseal_submission_id + status = 'pending'
 *
 * When DOCUSEAL_API_KEY is not set (local / mock mode):
 *   → Falls back to marking sent_for_signature_at only.
 */
export async function markSentForSignatureAction(
  dealId: string,
  configId: string,
  signerName: string,
  signerEmail: string
): Promise<SendForSignatureResult> {
  try {
    const { isDocuSealConfigured } = await import('@/lib/docuseal/client')

    if (isDocuSealConfigured()) {
      // ── 1. Load data ──
      const { getDeal, getActiveConfig, getProposal } = await import('@/lib/deals')
      const deal = await getDeal(dealId)
      if (!deal) throw new Error(`Deal ${dealId} not found`)

      const cfg = getActiveConfig(deal)
      if (!cfg) throw new Error(`No active config for deal ${dealId}`)

      const saved = await getProposal(dealId, configId)
      // Use saved sections if available; otherwise fall through to defaults
      const { PLANS, ADDONS, HARDWARE } = await import('@/lib/pricing/catalog')
      const { formatCurrency, formatNumber } = await import('@/lib/format')

      let sections = saved?.sections
      if (!sections) {
        // Build default sections inline (mirrors view/page.tsx logic)
        const plan = PLANS[cfg.plan]
        const eco = cfg.economics
        const addonsText = cfg.activeAddons.length > 0
          ? cfg.activeAddons.map((id) => ADDONS[id].label).join(', ')
          : null
        const hwText = cfg.hardware
          .filter((h) => h.quantity > 0)
          .map((h) => `${h.quantity} ${HARDWARE[h.hardwareId].label}`)
          .join(', ') || null

        sections = {
          executiveSummary: [
            `Platomico propone a ${deal.company.name} una solución completa de gestión de pedidos en hostelería basada en el plan ${plan.label}.`,
            `Con ${cfg.locations} local${cfg.locations > 1 ? 'es' : ''} y un volumen estimado de ${formatNumber(cfg.dailyOrdersPerLocation)} pedidos mensuales por local, la plataforma digitaliza y optimiza toda la operación.`,
            `El impacto económico estimado es de ${formatCurrency(eco.totalMonthlyRevenue)}/mes (${formatCurrency(eco.annualRevenue)}/año).`,
          ].join(' '),
          solution: [
            `La solución incluye el plan ${plan.label} con acceso completo a la plataforma Platomico.`,
            addonsText ? `Módulos adicionales contratados: ${addonsText}.` : null,
            hwText ? `Hardware incluido: ${hwText}.` : null,
            'La implementación contempla formación completa del equipo y soporte técnico dedicado durante el arranque.',
          ].filter(Boolean).join(' '),
          economicsSummary: [
            `Ingresos recurrentes estimados: ${formatCurrency(eco.totalMonthlyRevenue)}/mes · ${formatCurrency(eco.annualRevenue)}/año.`,
            eco.hardwareCostTotal > 0
              ? `Inversión en hardware: ${formatCurrency(eco.hardwareCostTotal)}${eco.paybackMonths !== null ? `. Payback estimado: ${eco.paybackMonths} meses.` : '.'}`
              : 'Sin inversión en hardware adicional.',
            `Margen bruto estimado: ${eco.grossMarginPercent.toFixed(0)}% (${formatCurrency(eco.grossMarginMonthly)}/mes).`,
          ].join(' '),
          nextSteps: [
            '1. Revisión y aprobación de la propuesta.',
            '2. Firma del contrato de servicios.',
            '3. Planificación de la instalación y formación del equipo.',
            '4. Fecha de arranque: a confirmar.',
          ].join('\n'),
        }
      }

      // ── 2. Generate PDF ──
      const { generateProposalPdf } = await import('@/lib/pdf/generate')
      const pdfBuffer = await generateProposalPdf(deal, cfg, sections)

      // ── 3 & 4. Upload to DocuSeal + create submission ──
      const { uploadPdfAndCreateSubmission } = await import('@/lib/docuseal/client')
      const documentName = `orvex-propuesta-${dealId}-v${cfg.version}.pdf`
      const { submissionId, signerUrl } = await uploadPdfAndCreateSubmission({
        pdfBuffer,
        documentName,
        signerName,
        signerEmail,
        metadata: { deal_id: dealId, config_id: configId },
      })

      // ── 5. Persist ──
      const { markProposalSentWithDocuSeal } = await import('@/lib/supabase/proposals')
      await markProposalSentWithDocuSeal(dealId, configId, submissionId)
      void logEvent('proposal_sent_for_signature', dealId)
      revalidatePath(`/deals/${dealId}/propuesta`)
      revalidatePath('/deals')
      return { ok: true, submissionId, signerUrl }
    }

    // ── Fallback: no DocuSeal ──
    const { markProposalSentForSignature } = await import('@/lib/supabase/proposals')
    await markProposalSentForSignature(dealId, configId)
    void logEvent('proposal_sent_for_signature', dealId)
    revalidatePath(`/deals/${dealId}/propuesta`)
    revalidatePath('/deals')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
