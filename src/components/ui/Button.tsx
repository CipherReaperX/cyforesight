import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'md', className, children, ...props }, ref) => {
    const variants = {
      default: 'bg-slate-700 text-slate-100 hover:bg-slate-600',
      primary: 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-[0_8px_20px_-12px_rgba(6,182,212,0.8)]',
      secondary: 'bg-[#1e293b] text-slate-100 hover:bg-[#334155]',
      danger: 'bg-red-600 text-white hover:bg-red-700',
      ghost: 'bg-transparent text-slate-300 hover:bg-slate-800',
      outline: 'border border-[#304357] bg-transparent text-slate-300 hover:border-cyan-400/40 hover:bg-cyan-500/10',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    }

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
          'disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
