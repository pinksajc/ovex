// Script temporal para generar contrato de prueba
// Ejecutar: node --experimental-vm-modules scripts/gen-contract-test.mjs

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = 'https://pqkzdeezkelfcbbfvnqu.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxa3pkZWV6a2VsZmNiYmZ2bnF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ0OTI3MiwiZXhwIjoyMDkwMDI1MjcyfQ.TwiGHfJzCEBp7jdB2iqNpddCigC7yg3WXUEuBnw7b3E'

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const { data: presupuestos } = await db
  .from('presupuestos')
  .select('id, number, client_name, client_cif, client_address, amount_net, amount_total, vat_rate, concept, line_items')
  .eq('status', 'accepted')
  .order('created_at', { ascending: false })
  .limit(5)

console.log('Presupuestos aceptados disponibles:')
presupuestos?.forEach(p => console.log(`  ${p.id}  →  ${p.number}  ${p.client_name}`))
