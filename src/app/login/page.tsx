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
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="min-h-screen flex">

      {/* ── Left panel — dark form ──────────────────────────────── */}
      <div
        className="flex-1 relative flex items-center justify-center"
        style={{ background: '#0E0E11', minHeight: '100vh' }}
      >
        {/* Logo — top-left absolute */}
        <div style={{ position: 'absolute', top: 40, left: 40 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/orvex_new_logo.png"
            alt="Orvex"
            style={{ width: '120px', height: 'auto', display: 'block' }}
          />
        </div>

        {/* Form block — perfectly centred unit */}
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: 380, padding: '0 24px' }}
        >
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight" style={{ marginBottom: 4 }}>
              Accede a tu cuenta
            </h1>
            <p className="text-sm text-zinc-400">
              Introduce tus credenciales para continuar
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-widest">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              placeholder="tu@empresa.com"
              className="w-full px-4 py-3 text-sm text-white rounded-lg border transition-all focus:outline-none placeholder:text-zinc-600"
              style={{ background: '#1C1C21', borderColor: '#33333B' }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#7C72E8'
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(124,114,232,0.2)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#33333B'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-widest">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-11 text-sm text-white rounded-lg border transition-all focus:outline-none"
                style={{ background: '#1C1C21', borderColor: '#33333B' }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#7C72E8'
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(124,114,232,0.2)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#33333B'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="text-xs text-red-400 rounded-lg px-4 py-3 border"
              style={{ background: 'rgba(127,29,29,0.25)', borderColor: 'rgba(153,27,27,0.4)' }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full text-white text-sm font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#7C72E8' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#8F86F0' }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#7C72E8' }}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2 justify-center">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Accediendo…
              </span>
            ) : 'Acceder'}
          </button>
        </form>

        {/* Footer — bottom-left absolute */}
        <p style={{ position: 'absolute', bottom: 24, left: 40, fontSize: 11, letterSpacing: 1.5, color: '#62626B' }}>
          © 2026 Orvex · by Platomico
        </p>
      </div>

      {/* ── Right panel — CSS orb background (hidden on mobile) ─── */}
      <div
        className="hidden md:block md:w-1/2"
        style={{
          background: [
            'radial-gradient(ellipse 70% 60% at 25% 35%, rgba(124,114,232,0.22) 0%, transparent 65%)',
            'radial-gradient(ellipse 55% 50% at 75% 65%, rgba(59,130,246,0.18) 0%, transparent 60%)',
            'radial-gradient(ellipse 40% 35% at 55% 20%, rgba(124,114,232,0.10) 0%, transparent 55%)',
            '#0E0E11',
          ].join(', '),
        }}
        aria-hidden="true"
      />
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

/* ── Icons ────────────────────────────────────────────────────────────────── */

function EyeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 2l12 12M6.5 6.6A2 2 0 0010 9.8M4.2 4.3C2.7 5.4 1.5 7 1.5 7s2.5 5 6.5 5c1.3 0 2.4-.4 3.3-1M6 3.2C6.6 3.1 7.3 3 8 3c4 0 6.5 5 6.5 5s-.6 1.2-1.7 2.3" strokeLinecap="round" />
    </svg>
  )
}
