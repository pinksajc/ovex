'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { addCommentAction, deleteCommentAction } from '@/app/actions/deal-comments'
import type { DealComment, CommentType } from '@/lib/supabase/deal-comments'
import { GmailSearchPanel } from '@/components/deals/gmail-search-panel'

// ── Contact type config ────────────────────────────────────────────────────

const CONTACT_TYPES: { value: CommentType; label: string; icon: string }[] = [
  { value: 'call',      label: 'Llamada',  icon: '📞' },
  { value: 'email',     label: 'Email',    icon: '✉️'  },
  { value: 'meeting',   label: 'Reunión',  icon: '🤝' },
  { value: 'whatsapp',  label: 'WhatsApp', icon: '💬' },
  { value: 'other',     label: 'Otro',     icon: '📝' },
]

function typeIcon(type: CommentType) {
  return CONTACT_TYPES.find((t) => t.value === type)?.icon ?? '📝'
}
function typeLabel(type: CommentType) {
  return CONTACT_TYPES.find((t) => t.value === type)?.label ?? 'Otro'
}

// ── Relative date ──────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const now = Date.now()
  const ts = new Date(iso).getTime()
  const diffMs = now - ts
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMs / 3_600_000)
  const diffD = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1)  return 'ahora'
  if (diffMin < 60) return `hace ${diffMin} min`
  if (diffH < 24)   return `hace ${diffH}h`
  if (diffD === 1)  return 'ayer'
  if (diffD < 7)    return `hace ${diffD} días`

  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: diffD > 365 ? 'numeric' : undefined })
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  dealId: string
  currentUserId: string
  initialComments: DealComment[]
  gmailConnected: boolean
  contactEmail: string | null
}

// ── Component ──────────────────────────────────────────────────────────────

export function DealCommentsPanel({ dealId, currentUserId, initialComments, gmailConnected, contactEmail }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()

  // Form state
  const [type, setType] = useState<CommentType>('call')
  const [content, setContent] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Optimistic comments list
  const [comments, setComments] = useState<DealComment[]>(initialComments)

  // Sync when server re-renders
  useEffect(() => { setComments(initialComments) }, [initialComments])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) { setFormError('Escribe algo antes de añadir'); return }
    setFormError(null)

    const optimistic: DealComment = {
      id: `optimistic-${Date.now()}`,
      dealId,
      userId: currentUserId,
      userName: 'Tú',
      type,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    }

    setComments((prev) => [optimistic, ...prev])
    setContent('')
    textareaRef.current?.focus()

    startTransition(async () => {
      const res = await addCommentAction(dealId, type, optimistic.content)
      if (!res.ok) {
        setFormError(res.error ?? 'Error al guardar')
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id))
      } else {
        setToast('Nota añadida')
        router.refresh()
      }
    })
  }

  function handleDelete(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id))
    startDeleteTransition(async () => {
      const res = await deleteCommentAction(id)
      if (!res.ok) {
        setToast('No se pudo eliminar')
        router.refresh() // re-sync
      }
    })
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
          Seguimiento
        </h3>
        <GmailSearchPanel
          dealId={dealId}
          contactEmail={contactEmail}
          gmailConnected={gmailConnected}
        />
      </div>

      {/* Add form */}
      <form onSubmit={handleSubmit} className="mb-5">
        {/* Type selector */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
          {CONTACT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                type === t.value
                  ? 'bg-zinc-900 text-white'
                  : 'border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700'
              }`}
            >
              <span className="text-sm leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => { setContent(e.target.value); setFormError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent) }}
          placeholder="Escribe una nota de seguimiento…"
          rows={3}
          className="w-full text-sm text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-zinc-400 placeholder:text-zinc-400"
        />

        {formError && (
          <p className="text-[11px] text-red-500 mt-1">{formError}</p>
        )}

        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] text-zinc-400">⌘↵ para guardar rápido</p>
          <button
            type="submit"
            disabled={isPending || !content.trim()}
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white px-3.5 py-1.5 rounded-lg hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Guardando…
              </>
            ) : 'Añadir nota'}
          </button>
        </div>
      </form>

      {/* Toast */}
      {toast && (
        <div className="mb-4 text-[11px] text-emerald-600 font-medium bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {toast}
        </div>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-xs text-zinc-400 italic">No hay notas de seguimiento aún.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              isMine={c.userId === currentUserId || c.id.startsWith('optimistic-')}
              onDelete={handleDelete}
              isDeleting={isDeleting}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Individual comment card ────────────────────────────────────────────────

function CommentCard({
  comment,
  isMine,
  onDelete,
  isDeleting,
}: {
  comment: DealComment
  isMine: boolean
  onDelete: (id: string) => void
  isDeleting: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="group relative flex gap-3 p-3 rounded-lg border border-zinc-100 hover:border-zinc-200 transition-colors"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Icon */}
      <span className="text-lg leading-none shrink-0 mt-0.5">{typeIcon(comment.type)}</span>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
            {typeLabel(comment.type)}
          </span>
          <span className="text-[10px] text-zinc-400">{relativeDate(comment.createdAt)}</span>
          {comment.userName && (
            <span className="text-[10px] text-zinc-400">· {comment.userName}</span>
          )}
        </div>
        <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
      </div>

      {/* Delete button — own comments only, visible on hover */}
      {isMine && hovered && (
        <button
          onClick={() => onDelete(comment.id)}
          disabled={isDeleting}
          title="Eliminar nota"
          className="absolute top-2.5 right-2.5 text-zinc-300 hover:text-red-400 transition-colors disabled:opacity-40"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 3.5h10M5.5 3.5V2h3v1.5M3.5 3.5l.5 8h6l.5-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
