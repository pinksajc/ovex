interface BadgeProps {
  variant?: 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'pendiente' | 'pagada' | 'vencida' | 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'default'
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  borrador: 'bg-border-subtle text-text-tertiary',
  default: 'bg-border-subtle text-text-tertiary',
  enviado: 'bg-info/12 text-info',
  info: 'bg-info/12 text-info',
  aceptado: 'bg-success/12 text-success',
  pagada: 'bg-success/12 text-success',
  success: 'bg-success/12 text-success',
  rechazado: 'bg-danger/12 text-danger',
  vencida: 'bg-danger/12 text-danger',
  danger: 'bg-danger/12 text-danger',
  pendiente: 'bg-warning/12 text-warning',
  warning: 'bg-warning/12 text-warning',
  accent: 'bg-accent-muted text-accent-text',
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-[4px] px-2 py-0.5',
        'text-[11px] font-medium uppercase tracking-wide',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
