'use client'

import { useState, useTransition } from 'react'
import {
  inviteUserAction,
  updateUserRoleAction,
  updateUserStatusAction,
  deleteUsuarioAction,
  reinviteAction,
} from '@/app/actions/usuarios'
import type { WorkspaceMember, UserRole } from '@/lib/auth'
import { ROLE_LABEL, ROLE_COLOR, ROLES } from '@/lib/permissions'

interface Props {
  members: WorkspaceMember[]
  currentUserId: string
  currentUserRole: UserRole
}

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLOR[role] ?? 'bg-zinc-100 text-zinc-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${color}`}>
      {ROLE_LABEL[role] ?? role}
    </span>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WorkspaceMember['status'] }) {
  const map: Record<WorkspaceMember['status'], string> = {
    active:   'bg-emerald-50 text-emerald-700',
    pending:  'bg-amber-50 text-amber-700',
    inactive: 'bg-zinc-100 text-zinc-500',
  }
  const label: Record<WorkspaceMember['status'], string> = {
    active:   'Activo',
    pending:  'Pendiente',
    inactive: 'Inactivo',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${map[status]}`}>
      {label[status]}
    </span>
  )
}

// ── Single user row ───────────────────────────────────────────────────────────

function UserRow({
  member,
  isSelf,
  isOwnerUser,
  currentUserRole,
  onError,
  onSuccess,
}: {
  member: WorkspaceMember
  isSelf: boolean
  isOwnerUser: boolean
  currentUserRole: UserRole
  onError: (msg: string) => void
  onSuccess: (msg: string) => void
}) {
  const [roleValue, setRoleValue] = useState<UserRole>(member.role)
  const [isPending, startTransition] = useTransition()

  const canModify =
    !isSelf &&
    member.role !== 'owner' &&
    !(currentUserRole === 'admin' && member.role === 'admin')

  const canDelete = currentUserRole === 'owner' && !isSelf && member.role !== 'owner'

  function handleRoleChange(newRole: UserRole) {
    if (newRole === roleValue) return
    startTransition(async () => {
      const res = await updateUserRoleAction(member.id, newRole)
      if (res.ok) {
        setRoleValue(newRole)
        onSuccess('Rol actualizado')
      } else {
        onError(res.error)
      }
    })
  }

  function handleStatusToggle() {
    const newStatus = member.status === 'inactive' ? 'active' : 'inactive'
    startTransition(async () => {
      const res = await updateUserStatusAction(member.id, newStatus)
      if (res.ok) {
        onSuccess(newStatus === 'inactive' ? 'Usuario desactivado' : 'Usuario activado')
      } else {
        onError(res.error)
      }
    })
  }

  function handleReinvite() {
    startTransition(async () => {
      const res = await reinviteAction(member.email)
      if (res.ok) onSuccess('Invitación reenviada')
      else onError(res.error)
    })
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar a ${member.name ?? member.email}? Esta acción no se puede deshacer.`)) return
    startTransition(async () => {
      const res = await deleteUsuarioAction(member.id)
      if (!res.ok) onError(res.error)
      else onSuccess('Usuario eliminado')
    })
  }

  const formattedDate = member.createdAt
    ? new Date(member.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  return (
    <tr className={`border-b border-zinc-100 transition-colors ${isPending ? 'opacity-60' : 'hover:bg-zinc-50/60'}`}>
      {/* Nombre + email */}
      <td className="py-3.5 pl-6 pr-4">
        <div className="font-medium text-sm text-zinc-900 leading-snug">
          {member.name ?? <span className="text-zinc-400 italic">Sin nombre</span>}
          {isSelf && <span className="ml-1.5 text-[10px] font-semibold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">tú</span>}
        </div>
        <div className="text-[12px] text-zinc-500 truncate max-w-[220px]">{member.email}</div>
      </td>

      {/* Rol */}
      <td className="py-3.5 px-4">
        {canModify ? (
          <select
            value={roleValue}
            onChange={(e) => handleRoleChange(e.target.value as UserRole)}
            disabled={isPending}
            className="text-[12px] font-semibold border border-zinc-200 rounded px-2 py-1 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300 cursor-pointer disabled:opacity-50"
          >
            {ROLES.filter((r) => r !== 'owner').map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        ) : (
          <RoleBadge role={roleValue} />
        )}
      </td>

      {/* Estado */}
      <td className="py-3.5 px-4">
        <StatusBadge status={member.status} />
      </td>

      {/* Fecha creación */}
      <td className="py-3.5 px-4 text-[12px] text-zinc-500 whitespace-nowrap">
        {formattedDate}
      </td>

      {/* Acciones */}
      <td className="py-3.5 pr-6 pl-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {/* Re-invite only for pending */}
          {member.status === 'pending' && (currentUserRole === 'owner' || currentUserRole === 'admin') && (
            <button
              onClick={handleReinvite}
              disabled={isPending}
              title="Reenviar invitación"
              className="text-[11px] text-zinc-500 hover:text-zinc-800 border border-zinc-200 px-2 py-1 rounded transition-colors disabled:opacity-40"
            >
              Reenviar
            </button>
          )}

          {/* Activate/Deactivate */}
          {canModify && member.status !== 'pending' && (
            <button
              onClick={handleStatusToggle}
              disabled={isPending}
              title={member.status === 'inactive' ? 'Activar usuario' : 'Desactivar usuario'}
              className="text-[11px] text-zinc-500 hover:text-zinc-800 border border-zinc-200 px-2 py-1 rounded transition-colors disabled:opacity-40"
            >
              {member.status === 'inactive' ? 'Activar' : 'Desactivar'}
            </button>
          )}

          {/* Delete */}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              title="Eliminar usuario"
              className="text-[11px] text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 px-2 py-1 rounded transition-colors disabled:opacity-40"
            >
              Eliminar
            </button>
          )}

          {/* No actions available */}
          {!canModify && !canDelete && (
            <span className="text-[11px] text-zinc-300">—</span>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteModal({
  onClose,
  onSuccess,
  onError,
}: {
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('sales')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    startTransition(async () => {
      const res = await inviteUserAction(name, email, role)
      if (res.ok) {
        onSuccess(`Invitación enviada a ${email}`)
        onClose()
      } else {
        onError(res.error)
      }
    })
  }

  const inputCls = 'w-full text-sm border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent transition bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 pt-6 pb-0 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Invitar usuario</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pt-5 pb-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Nombre <span className="text-zinc-400">(opcional)</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre completo"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className={inputCls}
            >
              {ROLES.filter((r) => r !== 'owner').map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-zinc-400">
              {role === 'admin' && 'Acceso completo a todos los módulos excepto cashflow.'}
              {role === 'sales' && 'Acceso a deals, pipeline y ofertas.'}
              {role === 'finance' && 'Acceso a facturas y cashflow.'}
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !email.trim()}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Enviando…' : 'Enviar invitación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function UsuariosClient({ members, currentUserId, currentUserRole }: Props) {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  function showToast(kind: 'success' | 'error', msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const filtered = members.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (m.name ?? '').toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    )
  })

  // Stats
  const byRole = ROLES.reduce<Record<string, number>>((acc, r) => {
    acc[r] = members.filter((m) => m.role === r).length
    return acc
  }, {})
  const activeCount = members.filter((m) => m.status === 'active').length
  const pendingCount = members.filter((m) => m.status === 'pending').length

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
            toast.kind === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Usuarios</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{members.length} miembro{members.length !== 1 ? 's' : ''} en el workspace</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 bg-zinc-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-700 transition-colors shrink-0"
        >
          + Invitar usuario
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {ROLES.map((r) => (
          <div key={r} className="bg-white border border-zinc-100 rounded-xl px-4 py-3 shadow-sm">
            <div className="text-xs text-zinc-400 font-medium mb-0.5">{ROLE_LABEL[r]}</div>
            <div className="text-2xl font-bold text-zinc-900">{byRole[r] ?? 0}</div>
          </div>
        ))}
      </div>

      {/* ── Status summary ── */}
      <div className="flex gap-4 mb-5 text-[12px] text-zinc-500">
        <span><span className="font-semibold text-emerald-700">{activeCount}</span> activos</span>
        <span><span className="font-semibold text-amber-600">{pendingCount}</span> pendientes</span>
        <span><span className="font-semibold text-zinc-500">{members.length - activeCount - pendingCount}</span> inactivos</span>
      </div>

      {/* ── Search ── */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o rol…"
          className="w-full sm:w-72 text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
        />
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/60">
              <th className="py-3 pl-6 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Nombre</th>
              <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Rol</th>
              <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Estado</th>
              <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Alta</th>
              <th className="py-3 pr-6 pl-4 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-zinc-400">
                  {search ? 'Sin resultados para esa búsqueda.' : 'No hay usuarios todavía.'}
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <UserRow
                  key={m.id}
                  member={m}
                  isSelf={m.id === currentUserId}
                  isOwnerUser={m.role === 'owner'}
                  currentUserRole={currentUserRole}
                  onError={(msg) => showToast('error', msg)}
                  onSuccess={(msg) => showToast('success', msg)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Invite modal ── */}
      {modalOpen && (
        <InviteModal
          onClose={() => setModalOpen(false)}
          onSuccess={(msg) => showToast('success', msg)}
          onError={(msg) => showToast('error', msg)}
        />
      )}
    </div>
  )
}
