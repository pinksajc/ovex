import { NextResponse } from 'next/server'

export async function GET() {
  const attio = !!process.env.ATTIO_API_KEY
  const supabaseUrl = !!process.env.SUPABASE_URL
  const supabaseKey = !!process.env.SUPABASE_SERVICE_KEY
  const real = attio && supabaseUrl && supabaseKey

  return NextResponse.json({
    mode: real ? 'REAL' : 'MOCK',
    deals: real ? 'Attio' : 'mock-data',
    config: real ? 'guarda en Supabase' : 'NO guarda (state-only)',
    propuesta: real ? 'guarda en Supabase' : 'NO guarda (state-only)',
    vars: {
      ATTIO_API_KEY: attio ? `set (${process.env.ATTIO_API_KEY!.slice(0, 8)}...)` : 'MISSING',
      SUPABASE_URL: supabaseUrl ? process.env.SUPABASE_URL : 'MISSING',
      SUPABASE_SERVICE_KEY: supabaseKey ? 'set' : 'MISSING',
    },
  })
}
