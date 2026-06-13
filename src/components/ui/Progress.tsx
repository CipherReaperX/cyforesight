import { cn } from '@/lib/utils'

interface ProgressProps {
  value: number
  max?: number
  className?: string
  barClassName?: string
}

export function Progress({ value, max = 100, className, barClassName }: ProgressProps) {
  const percentage = Math.min((value / max) * 100, 100)

  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-700', className)}>
      <div
        className={cn('h-full bg-blue-500 transition-all', barClassName)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
