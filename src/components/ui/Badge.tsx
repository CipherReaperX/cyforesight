import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success' | 'warning' | 'danger'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-slate-700 text-slate-100',
    critical: 'bg-red-500/10 text-red-500 border border-red-500/20',
    high: 'bg-orange-500/10 text-orange-500 border border-orange-500/20',
    medium: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
    low: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
    info: 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20',
    success: 'bg-green-500/10 text-green-500 border border-green-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    danger: 'bg-red-500/10 text-red-500 border border-red-500/20',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
