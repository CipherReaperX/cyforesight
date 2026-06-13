import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  hoverable?: boolean
}

export function Card({ children, className, onClick, hoverable = false }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[#1f2d3d] bg-[#0f1726]/90 p-6 shadow-[0_14px_30px_-18px_rgba(2,6,23,0.8)] backdrop-blur-sm',
        hoverable && 'cursor-pointer transition-all duration-200 hover:-translate-y-[1px] hover:border-cyan-400/30 hover:shadow-[0_18px_35px_-18px_rgba(34,211,238,0.35)]',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: React.ReactNode
  className?: string
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={cn('mb-4', className)}>{children}</div>
}

interface CardTitleProps {
  children: React.ReactNode
  className?: string
}

export function CardTitle({ children, className }: CardTitleProps) {
  return <h3 className={cn('text-lg font-semibold text-slate-100', className)}>{children}</h3>
}

interface CardContentProps {
  children: React.ReactNode
  className?: string
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn('', className)}>{children}</div>
}
