// npx tsx scripts/gen-contract-pdf.mts
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { generateContractPdf } from '../src/lib/pdf/contract.js'

process.env.CHROME_EXECUTABLE_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const SUPABASE_URL = 'https://pqkzdeezkelfcbbfvnqu.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxa3pkZWV6a2VsZmNiYmZ2bnF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ0OTI3MiwiZXhwIjoyMDkwMDI1MjcyfQ.TwiGHfJzCEBp7jdB2iqNpddCigC7yg3WXUEuBnw7b3E'

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const { data: row } = await db
  .from('presupuestos')
  .select('*')
  .eq('id', '15331696-3e1c-463b-8d62-62525be59f68')
  .single()

if (!row) throw new Error('Presupuesto no encontrado')

const presupuesto = {
  id: row.id,
  number: row.number,
  clientName: 'Grupo Kay Barcelona, S.L.',
  clientCif: 'B56791858',
  clientAddress: 'Plaza Dr. Letamendi 30-33, Local 4, 08007, Barcelona',
  amountNet: row.amount_net,
  amountTotal: row.amount_total,
  vatRate: row.vat_rate,
  concept: row.concept,
  lineItems: Array.isArray(row.line_items) ? row.line_items : [],
  status: row.status,
  dealId: row.deal_id,
  notes: row.notes,
  validUntil: row.valid_until,
  createdAt: row.created_at,
  requiresSignature: row.requires_signature ?? false,
  approvalStatus: row.approval_status ?? 'pending',
  approvalNotes: row.approval_notes,
  contractStartDate: row.contract_start_date,
  signedContractUrl: row.signed_contract_url,
  signedContractFilename: row.signed_contract_filename,
  signedAt: row.signed_at,
}

console.log('Generando PDF para:', presupuesto.number, presupuesto.clientName)

const equipment = [
  { n: 1, tipo: 'Counter Platomico', marca: 'Platomico', color: 'Gris', serie: 'C1401005726410032', funcion: 'POS', origen: 'Platomico', cuotaMensual: '' },
  { n: 2, tipo: 'Counter Platomico', marca: 'Platomico', color: 'Gris', serie: 'C1401005726410029', funcion: 'POS', origen: 'Platomico', cuotaMensual: '' },
  { n: 3, tipo: 'Counter Platomico', marca: 'Platomico', color: 'Gris', serie: 'C1401005726410038', funcion: 'POS', origen: 'Platomico', cuotaMensual: '' },
  { n: 4, tipo: 'Bouncepad Kiosk Platomico', marca: 'Platomico', color: 'Negro', serie: 'K002', funcion: 'Kiosk', origen: 'Platomico', cuotaMensual: '' },
  { n: 5, tipo: 'Bouncepad Kiosk Platomico', marca: 'Platomico', color: 'Negro', serie: 'K003', funcion: 'Kiosk', origen: 'Platomico', cuotaMensual: '' },
  { n: 6, tipo: 'Bouncepad Kiosk Platomico', marca: 'Platomico', color: 'Negro', serie: 'K004', funcion: 'Kiosk', origen: 'Platomico', cuotaMensual: '' },
  { n: 7, tipo: 'Tablet XIAOMI REDMI Pad 2 Pro', marca: 'Xiaomi', color: 'Plata', serie: '—', funcion: 'POS', origen: 'Platomico', cuotaMensual: '' },
  { n: 8, tipo: 'Tablet XIAOMI REDMI Pad 2 Pro', marca: 'Xiaomi', color: 'Plata', serie: '—', funcion: 'POS', origen: 'Platomico', cuotaMensual: '' },
  { n: 9, tipo: 'Tablet XIAOMI REDMI Pad 2 Pro', marca: 'Xiaomi', color: 'Plata', serie: '—', funcion: 'POS', origen: 'Platomico', cuotaMensual: '' },
]

const pdf = await generateContractPdf(presupuesto as any, {
  duracionMeses: 12,
  permanenciaMeses: 12,
  formaPago: 'Transferencia bancaria',
  fechaInicio: '2026-07-06',
  contactName: 'Pol Vilà Giné',
  contactEmail: 'pol@kevabro.com',
  notas: null,
  equipment,
})

const outPath = '/Users/antoniocasanova/Downloads/contrato-test.pdf'
writeFileSync(outPath, pdf)
console.log('✓ PDF guardado en:', outPath)
