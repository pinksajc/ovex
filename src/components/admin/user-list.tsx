'use client'

import { useState, useTransition } from 'react'
import { deleteUserAction, updateUserAction, reinviteUserAction } from '@/app/actions/manage-user'
import type { WorkspaceMember } from '@/lib/auth'

export function UserList({ members, currentUserId }: { members: WorkspaceMember[]; currentUserId: string }) {
  return (
    <ul className="divide-y divide-border-subtle">
      {members.map((m) => (
        <UserRow key={m.id} member={m} isSelf={m.id === currentUserId} />
      ))}
    </ul>
  )
}

function UserRow({ member, isSelf }: { member: WorkspaceMember; isSelf: boolean }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(member.name ?? '')
  // 'owner' role is assigned via OWNER_EMAIL env var; UI only allows admin/sales
  const effectiveRole = (member.role === 'owner' ? 'admin' : member.role) as 'admin' | 'sales'
  const [role, setRole] = useState<'admin' | 'sales'>(effectiveRole)
  const [displayName, setDisplayName] = useState(member.name ?? '')
  const [displayRole, setDisplayRole] = useState<'admin' | 'sales'>(effectiveRole)
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
            <label className="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full text-[13px] bg-base border border-border-subtle rounded-[6px] px-3 h-9 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="Nombre completo"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'sales')}
              className="w-full text-[13px] bg-base border border-border-subtle rounded-[6px] px-3 h-9 text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="sales">Sales</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-text-tertiary">{member.email}</p>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveEdit}
            disabled={isPending}
            className="text-xs font-medium bg-accent text-base px-3 h-7 rounded-[4px] hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={handleCancelEdit}
            disabled={isPending}
            className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between px-5 py-3 group hover:bg-hover transition-colors duration-150">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-text-primary truncate">
            {displayName || <span className="text-text-tertiary italic">Sin nombre</span>}
          </p>
          {!member.hasLoggedIn && (
            <span className="text-[9px] font-semibold uppercase tracking-widest text-warning bg-warning/10 px-1.5 py-0.5 rounded-[3px] border border-warning/20">
              Pendiente
            </span>
          )}
        </div>
        <p className="text-xs text-text-tertiary truncate">{member.email}</p>
        {error && <p className="text-xs text-danger mt-0.5">{error}</p>}
        {feedback && <p className="text-xs text-success mt-0.5">{feedback}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <span
          className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-[4px] ${
            displayRole === 'admin'
              ? 'bg-accent/12 text-accent-text'
              : 'bg-hover text-text-tertiary'
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
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-warning hover:text-warning font-medium disabled:opacity-50 cursor-pointer"
          >
            {isPending ? '…' : 'Reenviar'}
          </button>
        )}

        {/* Edit */}
        <button
          onClick={() => setEditing(true)}
          disabled={isPending}
          title="Editar usuario"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-[4px] hover:bg-hover text-text-tertiary hover:text-text-secondary cursor-pointer disabled:opacity-50"
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
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-[4px] hover:bg-danger/10 text-text-tertiary hover:text-danger cursor-pointer disabled:opacity-50"
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
