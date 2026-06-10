'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createAuthBrowserClient } from '@/lib/supabase/auth'
import { OrvexLogo } from '@/components/ui/orvex-logo'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/deals'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createAuthBrowserClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <div className="bg-surface border border-border-subtle rounded-lg p-8">

          {/* Brand */}
          <div className="flex items-center gap-2 mb-8">
            <OrvexLogo size="md" />
            <span className="text-text-tertiary text-xs ml-auto font-mono">Sales OS</span>
          </div>

          <h1 className="text-[17px] font-semibold text-text-primary mb-1 tracking-tight">Accede a tu cuenta</h1>
          <p className="text-[13px] text-text-tertiary mb-6">Introduce tus credenciales para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                placeholder="tu@platomico.com"
                className="w-full px-3 h-9 text-[13px] bg-base border border-border-subtle rounded-[6px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 h-9 text-[13px] bg-base border border-border-subtle rounded-[6px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
              />
            </div>

            {error && (
              <div className="text-xs text-danger bg-danger/8 border border-danger/20 rounded-[6px] px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-base text-[13px] font-medium h-9 rounded-[6px] hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <span className="w-3 h-3 rounded-full border border-base/40 border-t-base animate-spin" />
                  Accediendo…
                </span>
              ) : 'Acceder'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
