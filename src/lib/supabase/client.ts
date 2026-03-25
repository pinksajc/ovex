// =========================================
// SUPABASE CLIENT
// server-only — usa service role key
// nunca importar en Client Components
// =========================================

import { createClient } from '@supabase/supabase-js'

// Singleton por proceso (reutiliza conexión en el mismo worker)
let _client: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (_client) return _client

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridas. ' +
        'Consulta .env.local.example'
    )
  }

  _client = createClient(url, key, {
    auth: {
      // Service role no necesita sesión
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return _client
}
