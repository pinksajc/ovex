interface OrvexLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
}

export function OrvexLogo({ size = 'md', className }: OrvexLogoProps) {
  return (
    <span
      className={`font-mono font-semibold tracking-tight ${sizeClasses[size]} ${className ?? ''}`}
    >
      <span className="text-accent">O</span>
      <span className="text-text-primary">rvex</span>
    </span>
  )
}
