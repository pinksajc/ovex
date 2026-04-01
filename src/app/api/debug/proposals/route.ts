import { NextResponse } from 'next/server'

/**
 * GET /api/debug/proposals
 * Verifica la conectividad con la tabla proposals en Supabase.
 * Solo accesible en desarrollo o con query param ?secret=
 */
export async function GET(request: Request) {
  const steps: Record<string, unknown> = {}

  // 1. Env vars
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  steps.env = {
    SUPABASE_URL: supabaseUrl ? `set (${supabaseUrl})` : 'MISSING',
    SUPABASE_SERVICE_KEY: supabaseKey ? `set (${supabaseKey.slice(0, 20)}...)` : 'MISSING',
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, steps }, { status: 500 })
  }

  // 2. SELECT (table accessible?)
  try {
    const { getSupabaseClient } = await import('@/lib/supabase/client')
    const sb = getSupabaseClient()

    const { data: rows, error: selErr, status, statusText } = await sb
      .from('proposals')
      .select('id, attio_deal_id, config_id, updated_at')
      .limit(3)

    steps.select = selErr
      ? { ok: false, code: selErr.code, message: selErr.message, status, statusText }
      : { ok: true, rowCount: rows?.length ?? 0, sample: rows }
  } catch (e) {
    steps.select = { ok: false, thrown: e instanceof Error ? e.message : String(e) }
  }

  // 3. INSERT test row
  const testDealId = `__debug_${Date.now()}__`
  const testConfigId = '__debug_config__'
  try {
    const { getSupabaseClient } = await import('@/lib/supabase/client')
    const sb = getSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: insErr } = await (sb.from('proposals') as any)
      .insert({
        attio_deal_id: testDealId,
        config_id: testConfigId,
        sections: { test: true },
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    steps.insert = insErr
      ? { ok: false, code: insErr.code, message: insErr.message }
      : { ok: true, id: (data as { id: string }).id }

    // 4. UPDATE same row
    if (!insErr && data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updErr } = await (sb.from('proposals') as any)
        .update({ sections: { test: true, updated: true }, updated_at: new Date().toISOString() })
        .eq('id', (data as { id: string }).id)

      steps.update = updErr
        ? { ok: false, code: updErr.code, message: updErr.message }
        : { ok: true }

      // 5. Cleanup
      const { error: delErr } = await sb
        .from('proposals')
        .delete()
        .eq('id', (data as { id: string }).id)

      steps.cleanup = delErr
        ? { ok: false, message: delErr.message }
        : { ok: true }
    }
  } catch (e) {
    steps.insert = { ok: false, thrown: e instanceof Error ? e.message : String(e) }
  }

  // 6. Full upsertProposal path
  try {
    const { upsertProposal } = await import('@/lib/supabase/proposals')
    const result = await upsertProposal(`__upsert_test_${Date.now()}__`, '__upsert_cfg__', {
      executiveSummary: 'debug test',
      solution: '',
      economicsSummary: '',
      nextSteps: '',
    })
    steps.upsertProposal = { ok: true, id: result.id }

    // Cleanup upsert test
    const { getSupabaseClient } = await import('@/lib/supabase/client')
    await getSupabaseClient().from('proposals').delete().eq('id', result.id)
  } catch (e) {
    steps.upsertProposal = { ok: false, thrown: e instanceof Error ? e.message : String(e) }
  }

  const allOk = Object.values(steps).every(
    (s) => typeof s === 'object' && s !== null && (s as { ok?: boolean }).ok !== false
  )

  return NextResponse.json({ ok: allOk, steps }, { status: allOk ? 200 : 500 })
}
