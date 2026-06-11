import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  // Owner-only guard
  const me = await getCurrentUser()
  if (!me) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (me.role !== 'owner') {
    return NextResponse.json({ error: 'owner only' }, { status: 403 })
  }

  const attio = !!process.env.ATTIO_API_KEY
  const supabaseUrl = !!process.env.SUPABASE_URL
  const supabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const real = attio && supabaseUrl && supabaseKey

  return NextResponse.json({
    mode: real ? 'REAL' : 'MOCK',
    deals: real ? 'Attio' : 'mock-data',
    config: real ? 'guarda en Supabase' : 'NO guarda (state-only)',
    propuesta: real ? 'guarda en Supabase' : 'NO guarda (state-only)',
    vars: {
      ATTIO_API_KEY: attio ? 'set' : 'MISSING',
      SUPABASE_URL: supabaseUrl ? 'set' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: supabaseKey ? 'set' : 'MISSING',
    },
  })
}
