import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser, getWorkspaceMembers } from '@/lib/auth'
import { createDealAction } from '@/app/actions/create-deal'
import type { DealStage } from '@/types'

const STAGE_OPTIONS: { value: DealStage; label: string }[] = [
  { value: 'prospecting',    label: 'Prospecting' },
  { value: 'qualified',      label: 'Qualified' },
  { value: 'proposal_sent',  label: 'Propuesta enviada' },
  { value: 'negotiation',    label: 'Negociación' },
  { value: 'closed_won',     label: 'Cerrado ganado' },
  { value: 'closed_lost',    label: 'Cerrado perdido' },
]

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { error } = await searchParams
  const isAdmin = user.role === 'admin'
  const members = isAdmin ? await getWorkspaceMembers() : []

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <Link href="/deals" className="hover:text-zinc-700 transition-colors">Deals</Link>
        <span>/</span>
        <span className="text-zinc-700 font-medium">Nuevo deal</span>
      </div>

      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-8">Nuevo deal</h1>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form action={createDealAction} className="space-y-8">
        {/* Empresa */}
        <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Empresa</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Nombre de empresa <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="companyName"
              required
              autoFocus
              placeholder="Ej: Burger & Roll"
              className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">CIF</label>
              <input
                type="text"
                name="companyCif"
                placeholder="Ej: B12345678"
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Dirección fiscal</label>
              <input
                type="text"
                name="companyAddress"
                placeholder="Ej: Calle Mayor 1, Madrid"
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition"
              />
            </div>
          </div>
        </section>

        {/* Contacto */}
        <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Contacto</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nombre</label>
              <input
                type="text"
                name="contactFirstName"
                placeholder="Ej: María"
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Apellido</label>
              <input
                type="text"
                name="contactLastName"
                placeholder="Ej: García"
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email</label>
            <input
              type="email"
              name="contactEmail"
              placeholder="maria@empresa.com"
              className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Teléfono</label>
            <input
              type="tel"
              name="contactPhone"
              placeholder="+34 600 000 000"
              className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition"
            />
          </div>
        </section>

        {/* Deal */}
        <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Deal</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Stage inicial</label>
            <select
              name="stage"
              defaultValue="prospecting"
              className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition bg-white"
            >
              {STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {isAdmin && members.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Owner</label>
              <select
                name="ownerId"
                defaultValue={user.id}
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition bg-white"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.email}{m.id === user.id ? ' (tú)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Hidden owner for non-admins */}
          {!isAdmin && (
            <input type="hidden" name="ownerId" value={user.id} />
          )}
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Link
            href="/deals"
            className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="bg-zinc-900 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Crear deal →
          </button>
        </div>
      </form>
    </div>
  )
}
