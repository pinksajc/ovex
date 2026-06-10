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
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-2xl p-8 w-full max-w-sm shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Cambia tu contraseña</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Por seguridad, debes establecer una contraseña personal antes de continuar.
          </p>
        </div>

        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form action={changePasswordAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Nueva contraseña <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              placeholder="Mín. 6 caracteres"
              className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Confirmar contraseña <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              name="password2"
              required
              minLength={6}
              placeholder="Repite la contraseña"
              className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-700 transition-colors mt-2"
          >
            Guardar contraseña →
          </button>
        </form>
      </div>
    </div>
  )
}
