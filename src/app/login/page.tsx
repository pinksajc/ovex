'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createAuthBrowserClient } from '@/lib/supabase/auth'

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
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">

          {/* Brand */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-7 h-7 bg-zinc-900 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">O</span>
            </div>
            <span className="font-semibold text-zinc-900 text-sm">Orvex</span>
            <span className="text-zinc-300 text-xs ml-auto">Sales OS</span>
          </div>

          <h1 className="text-lg font-semibold text-zinc-900 mb-1">Accede a tu cuenta</h1>
          <p className="text-sm text-zinc-400 mb-6">Introduce tus credenciales para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                placeholder="tu@platomico.com"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all placeholder:text-zinc-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <span className="w-3 h-3 rounded-full border border-white/40 border-t-white animate-spin" />
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
