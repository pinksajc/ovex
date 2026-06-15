import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { changePasswordAction } from '@/app/actions/change-password'

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { error } = await searchParams

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ─────────────────────────────────────────────── */}
      <div
        className="flex-1 relative flex items-center justify-center"
        style={{ background: '#0E0E11', minHeight: '100vh' }}
      >
        {/* Logo */}
        <div style={{ position: 'absolute', top: 40, left: 40 }}>
          <div className="flex items-baseline gap-0.5">
            <span className="font-bold text-xl tracking-tight" style={{ color: '#7C72E8' }}>O</span>
            <span className="font-bold text-xl tracking-tight text-white">rvex</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5 font-medium tracking-widest uppercase">Sales OS</p>
        </div>

        {/* Form block — centred */}
        <form
          action={changePasswordAction}
          style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: 380, padding: '0 24px' }}
        >
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight" style={{ marginBottom: 4 }}>
              Cambia tu contraseña
            </h1>
            <p className="text-sm text-zinc-400">
              Por seguridad, establece una contraseña personal antes de continuar.
            </p>
          </div>

          {error && (
            <div
              className="text-xs text-red-400 rounded-lg px-4 py-3 border"
              style={{ background: 'rgba(127,29,29,0.25)', borderColor: 'rgba(153,27,27,0.4)' }}
            >
              {error}
            </div>
          )}

          {/* Nueva contraseña */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-widest">
              Nueva contraseña <span style={{ color: '#7C72E8' }}>*</span>
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoFocus
              placeholder="Mín. 8 caracteres"
              className="w-full px-4 py-3 text-sm text-white rounded-lg border transition-all focus:outline-none placeholder:text-zinc-600"
              style={{ background: '#1C1C21', borderColor: '#33333B' }}
            />
          </div>

          {/* Confirmar contraseña */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-widest">
              Confirmar contraseña <span style={{ color: '#7C72E8' }}>*</span>
            </label>
            <input
              type="password"
              name="password2"
              required
              minLength={8}
              placeholder="Repite la contraseña"
              className="w-full px-4 py-3 text-sm text-white rounded-lg border transition-all focus:outline-none placeholder:text-zinc-600"
              style={{ background: '#1C1C21', borderColor: '#33333B' }}
            />
          </div>

          <button
            type="submit"
            className="w-full text-white text-sm font-semibold py-3 rounded-lg transition-colors"
            style={{ background: '#7C72E8' }}
          >
            Guardar contraseña →
          </button>
        </form>

        {/* Footer */}
        <p style={{ position: 'absolute', bottom: 24, left: 40, fontSize: 11, letterSpacing: 1.5, color: '#62626B' }}>
          © 2026 Orvex · by Platomico
        </p>
      </div>

      {/* ── Right panel — CSS orbs (hidden on mobile) ──────────────── */}
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
