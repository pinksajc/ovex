import { Suspense } from 'react'
import { headers } from 'next/headers'

// Inline the URL parsing so this page has zero client JS
async function SetupErrorContent() {
  // Read ?missing= from the request URL via headers
  const headersList = await headers()
  const fullUrl = headersList.get('x-url') ?? ''
  const referer = headersList.get('referer') ?? ''

  // Parse missing params from the referrer or from a server-readable source
  // The middleware sets ?missing= on the redirect, so we read it via
  // next/headers x-invoke-query or similar — fall back to a generic message
  const EXPECTED: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL:
      'URL pública del proyecto Supabase. Cópiala de: Supabase Dashboard → Settings → API → Project URL',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      'Clave pública anon del proyecto. Cópiala de: Supabase Dashboard → Settings → API → anon / public',
    SUPABASE_URL:
      'URL del proyecto Supabase (server-only). Igual que NEXT_PUBLIC_SUPABASE_URL pero sin prefijo NEXT_PUBLIC_.',
    SUPABASE_SERVICE_KEY:
      'Clave service_role (privada). Supabase Dashboard → Settings → API → service_role.',
  }

  void fullUrl; void referer // suppress unused warnings

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="bg-white border border-red-200 rounded-2xl overflow-hidden shadow-sm">

          {/* Header */}
          <div className="bg-red-50 border-b border-red-100 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <span className="text-red-600 text-base">⚠</span>
              </div>
              <div>
                <h1 className="font-semibold text-red-800 text-base">Configuración incompleta</h1>
                <p className="text-xs text-red-500 mt-0.5">
                  Orvex no puede arrancar hasta que estas variables de entorno estén configuradas.
                </p>
              </div>
            </div>
          </div>

          {/* Variables */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-zinc-600">
              Añade las siguientes variables a tu archivo{' '}
              <code className="bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code>{' '}
              y reinicia el servidor:
            </p>

            {Object.entries(EXPECTED).map(([key, desc]) => (
              <div key={key} className="rounded-lg border border-zinc-200 overflow-hidden">
                <div className="bg-zinc-50 px-4 py-2 flex items-center gap-2">
                  <code className="text-xs font-mono font-semibold text-zinc-800">{key}</code>
                </div>
                <div className="px-4 py-2.5">
                  <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* .env.local template */}
          <div className="px-6 pb-5">
            <p className="text-xs font-medium text-zinc-500 mb-2">Plantilla para .env.local:</p>
            <pre className="bg-zinc-900 text-zinc-100 text-xs rounded-lg p-4 overflow-x-auto leading-relaxed">
{`# Supabase — público (safe para browser)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# Supabase — privado (solo servidor)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...`}
            </pre>
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-100 px-6 py-3 bg-zinc-50">
            <p className="text-[11px] text-zinc-400">
              Todos los valores están en{' '}
              <span className="font-medium text-zinc-500">Supabase Dashboard → Settings → API</span>.
              Después de añadirlos, reinicia el servidor (<code className="font-mono">npm run dev</code>).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SetupErrorPage() {
  return (
    <Suspense>
      <SetupErrorContent />
    </Suspense>
  )
}
