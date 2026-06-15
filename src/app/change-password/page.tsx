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

      {/* ── Left panel — dark form ──────────────────────────────── */}
      <div
        className="flex-1 flex flex-col px-8 py-10 md:px-14"
        style={{ background: '#0E0E11' }}
      >
        {/* Logo */}
        <div>
          <div className="flex items-baseline gap-0.5">
            <span className="font-bold text-xl tracking-tight" style={{ color: '#7C72E8' }}>O</span>
            <span className="font-bold text-xl tracking-tight text-white">rvex</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5 font-medium tracking-widest uppercase">Sales OS</p>
        </div>

        {/* Form — vertically centred */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold text-white tracking-tight mb-1">
              Cambia tu contraseña
            </h1>
            <p className="text-sm text-zinc-400 mb-8">
              Por seguridad, establece una contraseña personal antes de continuar.
            </p>

            {error && (
              <div
                className="text-xs text-red-400 rounded-lg px-4 py-3 border mb-6"
                style={{ background: 'rgba(127,29,29,0.25)', borderColor: 'rgba(153,27,27,0.4)' }}
              >
                {error}
              </div>
            )}

            <form action={changePasswordAction} className="space-y-5">
              {/* New password */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-widest">
                  Nueva contraseña <span style={{ color: '#7C72E8' }}>*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  placeholder="Mín. 8 caracteres"
                  className="w-full px-4 py-3 text-sm text-white rounded-lg border transition-all focus:outline-none placeholder:text-zinc-600"
                  style={{ background: '#1C1C21', borderColor: '#33333B' }}
                />
              </div>

              {/* Confirm password */}
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

              {/* Submit */}
              <SubmitButton />
            </form>
          </div>
        </div>

        {/* Bottom spacer */}
        <div className="h-10" />
      </div>

      {/* ── Right panel — background image (hidden on mobile) ───── */}
      <div
        className="hidden md:block md:w-1/2 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/fondo_login.png')" }}
        aria-hidden="true"
      />
    </div>
  )
}

/* ── Client submit button (for hover effect) ───────────────────────────── */
function SubmitButton() {
  return (
    <button
      type="submit"
      className="w-full text-white text-sm font-semibold py-3 rounded-lg transition-colors"
      style={{ background: '#7C72E8' }}
    >
      Guardar contraseña →
    </button>
  )
}
