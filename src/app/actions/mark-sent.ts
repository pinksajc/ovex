'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
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
 *   1. Validate inputs
 *   2. Load deal + config + proposal sections from DB
 *   3. Guard: reject if already pending or signed
 *   4. Render self-contained HTML → PDF via puppeteer-core
 *   5. Upload PDF to DocuSeal (creates a one-time template with signature fields)
 *   6. Create a signing submission — DocuSeal emails the client automatically
 *   7. Persist docuseal_submission_id + status = 'pending'
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
  const tag = `[mark-sent deal=${dealId} cfg=${configId}]`

  // ── Temporary env debug log ───────────────────────────────────────────────
  const keyPreview = process.env.DOCUSEAL_API_KEY
    ? `${process.env.DOCUSEAL_API_KEY.slice(0, 10)}…`
    : '(not set)'
  console.log(`${tag} env: DOCUSEAL_API_KEY=${keyPreview} DOCUSEAL_API_URL=${process.env.DOCUSEAL_API_URL ?? '(not set)'}`)

  // ── Input validation ──────────────────────────────────────────────────────
  if (!dealId || !configId) {
    return { ok: false, error: 'Faltan parámetros obligatorios (dealId, configId)' }
  }
  if (!signerEmail || !signerEmail.includes('@')) {
    return { ok: false, error: 'Email del firmante no válido' }
  }
  if (!signerName?.trim()) {
    return { ok: false, error: 'Nombre del firmante requerido' }
  }

  try {
    const { isDocuSealConfigured } = await import('@/lib/docuseal/client')

    if (isDocuSealConfigured()) {
      // ── 1. Load data ─────────────────────────────────────────────────────
      console.log(`${tag} loading deal and config`)
      const { getDeal, getActiveConfig, getProposal } = await import('@/lib/deals')
      const deal = await getDeal(dealId)
      if (!deal) throw new Error(`Deal ${dealId} no encontrado`)

      const cfg = getActiveConfig(deal)
      if (!cfg) throw new Error(`No hay configuración activa para el deal ${dealId}`)
      if (cfg.id !== configId) throw new Error(`La configuración activa (${cfg.id}) no coincide con la solicitada (${configId})`)

      const saved = await getProposal(dealId, configId)

      // ── 2. Guard: idempotency ─────────────────────────────────────────────
      if (saved?.signedAt || saved?.docusealStatus === 'completed') {
        return { ok: false, error: 'Esta propuesta ya ha sido firmada' }
      }
      if (saved?.docusealStatus === 'pending') {
        return { ok: false, error: 'La propuesta ya está pendiente de firma — revisa el email enviado al cliente' }
      }

      // ── 3. Resolve sections ───────────────────────────────────────────────
      const { PLANS, ADDONS, HARDWARE } = await import('@/lib/pricing/catalog')
      const { formatCurrency, formatNumber } = await import('@/lib/format')

      let sections = saved?.sections
      if (!sections) {
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

      // ── 4. Generate PDF ───────────────────────────────────────────────────
      console.log(`${tag} generating PDF`)
      const t0 = Date.now()
      let pdfBuffer: Buffer
      try {
        const { generateProposalPdf } = await import('@/lib/pdf/generate')
        pdfBuffer = await generateProposalPdf(deal, cfg, sections)
      } catch (pdfErr) {
        console.error(`${tag} PDF generation failed:`, pdfErr)
        throw new Error(`PDF: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}`)
      }
      console.log(`${tag} PDF ready (${Date.now() - t0}ms, ${pdfBuffer.length} bytes)`)

      // ── 5 & 6. Upload to DocuSeal + create submission ─────────────────────
      console.log(`${tag} uploading to DocuSeal`)
      const t1 = Date.now()
      let submissionId: string
      let signerUrl: string
      try {
        const { uploadPdfAndCreateSubmission } = await import('@/lib/docuseal/client')
        const documentName = `platomico-propuesta-${dealId}-v${cfg.version}.pdf`
        const result = await uploadPdfAndCreateSubmission({
          pdfBuffer,
          documentName,
          signerName,
          signerEmail,
          metadata: { deal_id: dealId, config_id: configId },
        })
        submissionId = result.submissionId
        signerUrl = result.signerUrl
      } catch (dsErr) {
        console.error(`${tag} DocuSeal failed:`, dsErr)
        throw new Error(`DocuSeal: ${dsErr instanceof Error ? dsErr.message : String(dsErr)}`)
      }
      console.log(`${tag} DocuSeal submission=${submissionId} (${Date.now() - t1}ms)`)

      // ── 7. Persist ────────────────────────────────────────────────────────
      const { markProposalSentWithDocuSeal } = await import('@/lib/supabase/proposals')
      await markProposalSentWithDocuSeal(dealId, configId, submissionId)
      void logEvent('proposal_sent_for_signature', dealId)
      revalidatePath(`/deals/${dealId}/propuesta`)
      revalidatePath('/deals')
      revalidateTag('attio-deals', 'max')
      console.log(`${tag} done`)
      return { ok: true, submissionId, signerUrl }
    }

    // ── Fallback: no DocuSeal ─────────────────────────────────────────────
    console.log(`${tag} DocuSeal not configured — fallback mode`)
    const { markProposalSentForSignature } = await import('@/lib/supabase/proposals')
    await markProposalSentForSignature(dealId, configId)
    void logEvent('proposal_sent_for_signature', dealId)
    revalidatePath(`/deals/${dealId}/propuesta`)
    revalidatePath('/deals')
    revalidateTag('attio-deals', 'max')
    return { ok: true }
  } catch (err) {
    console.error(`${tag} failed:`, err)
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg || 'Error al generar o enviar la propuesta — inténtalo de nuevo' }
  }
}
