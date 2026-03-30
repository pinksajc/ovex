// =========================================
// DOCUSEAL API CLIENT
// server-only
//
// Env vars required:
//   DOCUSEAL_TOKEN       — API key (found in DocuSeal → Settings → API)
//   DOCUSEAL_TEMPLATE_ID — numeric template ID for the proposal document
//
// Optional:
//   DOCUSEAL_API_URL     — defaults to https://api.docuseal.com
//                          (set to your self-hosted URL if applicable)
// =========================================

export function isDocuSealConfigured(): boolean {
  return !!(process.env.DOCUSEAL_TOKEN && process.env.DOCUSEAL_TEMPLATE_ID)
}

const BASE_URL = () => process.env.DOCUSEAL_API_URL ?? 'https://api.docuseal.com'

// ---- Types ----

interface DocuSealSubmitter {
  id: number
  submission_id: number
  email: string
  name: string
  slug: string
  /** Direct signing URL — opens in browser without re-auth */
  embed_src: string
  status: 'awaiting' | 'completed'
  /** Arbitrary metadata attached at submission creation time */
  metadata?: Record<string, string>
}

export interface DocuSealResult {
  submissionId: string
  signerUrl: string   // embed_src of the first submitter
}

// ---- API ----

/**
 * Creates a DocuSeal submission from the configured template.
 * The template must already exist and have a "Signer" role.
 * DocuSeal sends an email to signerEmail automatically.
 *
 * @returns submissionId + direct signing URL
 */
export async function createDocuSealSubmission(params: {
  signerName: string
  signerEmail: string
  /** Extra metadata attached to the submission (visible in DocuSeal dashboard) */
  metadata?: Record<string, string>
}): Promise<DocuSealResult> {
  const token = process.env.DOCUSEAL_TOKEN!
  const templateId = Number(process.env.DOCUSEAL_TEMPLATE_ID!)
  const { signerName, signerEmail, metadata } = params

  const body = {
    template_id: templateId,
    send_email: true,
    submitters: [
      {
        role: 'Signer',
        name: signerName,
        email: signerEmail,
        ...(metadata ? { metadata } : {}),
      },
    ],
  }

  const res = await fetch(`${BASE_URL()}/submissions`, {
    method: 'POST',
    headers: {
      'X-Auth-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`DocuSeal API error ${res.status}: ${text}`)
  }

  const submitters = (await res.json()) as DocuSealSubmitter[]
  if (!submitters?.length) throw new Error('DocuSeal: empty submitters response')

  const first = submitters[0]
  return {
    submissionId: String(first.submission_id),
    signerUrl: first.embed_src,
  }
}

// ---- Webhook signature verification ----

/**
 * Verifies DocuSeal webhook HMAC-SHA256 signature.
 * DocuSeal sets X-DocuSeal-Signature = HMAC-SHA256(secret, body).
 *
 * @param secret  DOCUSEAL_WEBHOOK_SECRET env var
 * @param body    Raw request body (Buffer / string)
 * @param sig     Value of X-DocuSeal-Signature header
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
  event_type: 'submission.completed' | 'submission.created' | 'submission.expired' | string
  timestamp: string
  data: {
    id: number
    status: 'completed' | 'pending' | 'expired'
    submitters: DocuSealSubmitter[]
  }
}
