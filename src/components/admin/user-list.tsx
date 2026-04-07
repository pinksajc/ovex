'use client'

import { useState, useTransition } from 'react'
import { deleteUserAction, updateUserAction, reinviteUserAction } from '@/app/actions/manage-user'
import type { WorkspaceMember } from '@/lib/auth'

export function UserList({ members, currentUserId }: { members: WorkspaceMember[]; currentUserId: string }) {
  return (
    <ul className="divide-y divide-zinc-100">
      {members.map((m) => (
        <UserRow key={m.id} member={m} isSelf={m.id === currentUserId} />
      ))}
    </ul>
  )
}

function UserRow({ member, isSelf }: { member: WorkspaceMember; isSelf: boolean }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(member.name ?? '')
  const [role, setRole] = useState<'admin' | 'sales'>(member.role)
  const [displayName, setDisplayName] = useState(member.name ?? '')
  const [displayRole, setDisplayRole] = useState<'admin' | 'sales'>(member.role)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCancelEdit() {
    setName(displayName)
    setRole(displayRole)
    setError(null)
    setEditing(false)
  }

  function handleSaveEdit() {
    setError(null)
    startTransition(async () => {
      const result = await updateUserAction(member.id, name, role)
      if (result.ok) {
        setDisplayName(name)
        setDisplayRole(role)
        setEditing(false)
      } else {
        setError(result.error)
      }
    })
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar a ${displayName || member.email}? Esta acción no se puede deshacer.`)) return
    startTransition(async () => {
      const result = await deleteUserAction(member.id)
      if (!result.ok) setError(result.error)
      // on ok the page will re-render via revalidatePath
    })
  }

  function handleReinvite() {
    setFeedback(null)
    setError(null)
    startTransition(async () => {
      const result = await reinviteUserAction(member.email)
      if (result.ok) {
        setFeedback('Invitación reenviada')
        setTimeout(() => setFeedback(null), 3000)
      } else {
        setError(result.error)
      }
    })
  }

  if (editing) {
    return (
      <li className="px-5 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
              placeholder="Nombre completo"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-1">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'sales')}
              className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="sales">Sales</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-zinc-400">{member.email}</p>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveEdit}
            disabled={isPending}
            className="text-xs font-medium bg-zinc-900 text-white px-3 py-1.5 rounded-md hover:bg-zinc-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={handleCancelEdit}
            disabled={isPending}
            className="text-xs text-zinc-400 hover:text-zinc-700 cursor-pointer disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between px-5 py-3 group">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-zinc-900 truncate">
            {displayName || <span className="text-zinc-400 italic">Sin nombre</span>}
          </p>
          {!member.hasLoggedIn && (
            <span className="text-[9px] font-semibold uppercase tracking-widest text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">
              Pendiente
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-400 truncate">{member.email}</p>
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
        {feedback && <p className="text-xs text-emerald-600 mt-0.5">{feedback}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <span
          className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
            displayRole === 'admin'
              ? 'bg-violet-50 text-violet-700'
              : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          {displayRole}
        </span>

        {/* Re-invite — only when user hasn't logged in yet */}
        {!member.hasLoggedIn && (
          <button
            onClick={handleReinvite}
            disabled={isPending}
            title="Reenviar invitación"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50 cursor-pointer"
          >
            {isPending ? '…' : 'Reenviar'}
          </button>
        )}

        {/* Edit */}
        <button
          onClick={() => setEditing(true)}
          disabled={isPending}
          title="Editar usuario"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 cursor-pointer disabled:opacity-50"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Delete — hidden for self */}
        {!isSelf && (
          <button
            onClick={handleDelete}
            disabled={isPending}
            title="Eliminar usuario"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-red-50 text-zinc-400 hover:text-red-600 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 4h10M6 4V2h4v2M5 4l.5 9h5L11 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </li>
  )
}
