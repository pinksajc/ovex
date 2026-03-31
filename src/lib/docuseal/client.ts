// =========================================
// DOCUSEAL API CLIENT
// server-only
//
// Env vars required:
//   DOCUSEAL_API_KEY  — found in DocuSeal → Settings → API
//
// Optional:
//   DOCUSEAL_API_URL         — defaults to https://api.docuseal.com
//   DOCUSEAL_WEBHOOK_SECRET  — HMAC secret for webhook verification
//
// No DOCUSEAL_TEMPLATE_ID needed — the template is created on-the-fly
// from the generated PDF and immediately used for one submission.
// =========================================

export function isDocuSealConfigured(): boolean {
  return !!process.env.DOCUSEAL_API_KEY
}

const BASE_URL = () => process.env.DOCUSEAL_API_URL ?? 'https://api.docuseal.com'
const FETCH_TIMEOUT_MS = 20_000

function authHeaders() {
  return {
    'X-Auth-Token': process.env.DOCUSEAL_API_KEY!,
    'Content-Type': 'application/json',
  }
}

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(FETCH_TIMEOUT_MS)
}

// ---- Types ----

interface DocuSealSubmitter {
  id: number
  submission_id: number
  email: string
  name: string
  slug: string
  embed_src: string
  status: 'awaiting' | 'completed'
  metadata?: Record<string, string>
}

interface DocuSealTemplate {
  id: number
  name: string
}

export interface DocuSealResult {
  submissionId: string
  signerUrl: string
}

// ---- Core flow ----

/**
 * Uploads a PDF to DocuSeal as a one-time template (no manual setup required),
 * adds signature + date fields on the last page, then immediately creates
 * a submission and sends the signing email.
 *
 * Flow: PDF Buffer → POST /templates → POST /submissions → result
 */
export async function uploadPdfAndCreateSubmission(params: {
  pdfBuffer: Buffer
  documentName: string   // e.g. "Propuesta - Burger & Roll v1"
  signerName: string
  signerEmail: string
  metadata?: Record<string, string>
}): Promise<DocuSealResult> {
  const { pdfBuffer, documentName, signerName, signerEmail, metadata } = params

  // Step 1 — Create template from PDF with inline signature fields
  const templateId = await createTemplateFromPdf(pdfBuffer, documentName)

  // Step 2 — Create submission (sends email automatically)
  return createSubmission({ templateId, signerName, signerEmail, metadata })
}

// ---- Step 1: create template ----

async function createTemplateFromPdf(pdfBuffer: Buffer, name: string): Promise<number> {
  const base64 = pdfBuffer.toString('base64')

  const body = {
    name,
    documents: [
      {
        name: `${name}.pdf`,
        type: 'pdf',
        content: base64,
        // Signature field at bottom-right of last page; date at bottom-left.
        // x/y/w/h are percentages of the page dimensions.
        fields: [
          {
            name: 'Firma del cliente',
            role: 'Firmante',
            type: 'signature',
            page: -1,   // last page
            x: 5,
            y: 78,
            w: 42,
            h: 12,
          },
          {
            name: 'Fecha de firma',
            role: 'Firmante',
            type: 'date',
            page: -1,
            x: 53,
            y: 78,
            w: 42,
            h: 12,
          },
        ],
      },
    ],
  }

  const res = await fetch(`${BASE_URL()}/templates`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: timeoutSignal(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`DocuSeal createTemplate ${res.status}: ${text}`)
  }

  const template = (await res.json()) as DocuSealTemplate
  return template.id
}

// ---- Step 2: create submission ----

async function createSubmission(params: {
  templateId: number
  signerName: string
  signerEmail: string
  metadata?: Record<string, string>
}): Promise<DocuSealResult> {
  const { templateId, signerName, signerEmail, metadata } = params

  const body = {
    template_id: templateId,
    send_email: true,
    submitters: [
      {
        role: 'Firmante',
        name: signerName,
        email: signerEmail,
        ...(metadata ? { metadata } : {}),
      },
    ],
  }

  const res = await fetch(`${BASE_URL()}/submissions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: timeoutSignal(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`DocuSeal createSubmission ${res.status}: ${text}`)
  }

  const submitters = (await res.json()) as DocuSealSubmitter[]
  if (!submitters?.length) throw new Error('DocuSeal: empty submitters array')

  const first = submitters[0]
  return {
    submissionId: String(first.submission_id),
    signerUrl: first.embed_src,
  }
}

// ---- Webhook verification ----

/**
 * Verifies the HMAC-SHA256 signature DocuSeal sends as X-DocuSeal-Signature.
 */
export async function verifyDocuSealWebhook(
  secret: string,
  body: string,
  sig: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const sigBytes = Buffer.from(sig, 'hex')
  return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body))
}

// ---- Webhook payload types ----

export interface DocuSealWebhookPayload {
  event_type: 'submission.completed' | 'submission.created' | 'submission.expired' | 'submission.declined' | string
  timestamp: string
  data: {
    id: number
    status: 'completed' | 'pending' | 'expired'
    submitters: DocuSealSubmitter[]
  }
}
