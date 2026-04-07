import { redirect } from 'next/navigation'
import { getCurrentUser, getWorkspaceMembersAdmin } from '@/lib/auth'
import { createUserAction, createUserManualAction } from '@/app/actions/create-user'
import { UserList } from '@/components/admin/user-list'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/deals')

  const { error, success } = await searchParams
  const members = await getWorkspaceMembersAdmin()

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Usuarios</h1>
        <p className="text-sm text-zinc-400 mt-1">Gestión de usuarios del workspace</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success === '1' && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg">
          Invitación enviada. El usuario recibirá un email para configurar su contraseña.
        </div>
      )}
      {success === 'manual' && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg">
          Usuario creado correctamente.
        </div>
      )}

      {/* User list */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
            Usuarios actuales ({members.length})
          </h2>
        </div>
        {members.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-400">No hay usuarios registrados.</p>
        ) : (
          <UserList members={members} currentUserId={user.id} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Invite user form */}
        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">
            Invitar por email
          </h2>
          <p className="text-xs text-zinc-400 mb-5">
            Supabase envía un enlace para que el usuario cree su propia contraseña.
          </p>

          <form action={createUserAction} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nombre</label>
              <input
                type="text"
                name="name"
                placeholder="Ej: María García"
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="maria@empresa.com"
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Rol</label>
              <select
                name="role"
                defaultValue="sales"
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition bg-white"
              >
                <option value="sales">Sales</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Enviar invitación →
              </button>
            </div>
          </form>
        </div>

        {/* Manual create form */}
        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">
            Crear con contraseña
          </h2>
          <p className="text-xs text-zinc-400 mb-5">
            Crea el usuario directamente sin enviar ningún email.
          </p>

          <form action={createUserManualAction} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nombre</label>
              <input
                type="text"
                name="name"
                placeholder="Ej: María García"
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="maria@empresa.com"
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Contraseña <span className="text-red-500">*</span>
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
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Rol</label>
              <select
                name="role"
                defaultValue="sales"
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition bg-white"
              >
                <option value="sales">Sales</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Crear usuario →
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
