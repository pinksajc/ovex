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
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="bg-surface border border-border-subtle rounded-lg p-8 w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">Cambia tu contraseña</h1>
          <p className="text-[13px] text-text-tertiary mt-1">
            Por seguridad, debes establecer una contraseña personal antes de continuar.
          </p>
        </div>

        {error && (
          <div className="mb-5 bg-danger/8 border border-danger/20 text-danger text-[13px] px-4 py-3 rounded-[6px]">
            {error}
          </div>
        )}

        <form action={changePasswordAction} className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">
              Nueva contraseña <span className="text-danger">*</span>
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              placeholder="Mín. 6 caracteres"
              className="w-full text-[13px] bg-base border border-border-subtle rounded-[6px] px-3 h-9 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-2">
              Confirmar contraseña <span className="text-danger">*</span>
            </label>
            <input
              type="password"
              name="password2"
              required
              minLength={6}
              placeholder="Repite la contraseña"
              className="w-full text-[13px] bg-base border border-border-subtle rounded-[6px] px-3 h-9 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-accent text-base text-[13px] font-medium h-9 rounded-[6px] hover:bg-accent-hover transition-colors mt-2"
          >
            Guardar contraseña →
          </button>
        </form>
      </div>
    </div>
  )
}
