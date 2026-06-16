import { cn } from '@/lib/utils'

interface TableProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function Table({ children, className }: TableProps) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn('w-full caption-bottom text-sm', className)}>{children}</table>
    </div>
  )
}

export function TableHeader({ children, className }: TableProps) {
  return <thead className={cn('border-b border-slate-700', className)}>{children}</thead>
}

export function TableBody({ children, className }: TableProps) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)}>{children}</tbody>
}

export function TableRow({ children, className, onClick }: TableProps) {
  return (
    <tr
      className={cn(
        'border-b border-slate-700 transition-colors hover:bg-slate-700/50',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function TableHead({ children, className }: TableProps) {
  return (
    <th
      className={cn(
        'h-12 px-4 text-left align-middle font-medium text-slate-400',
        'cursor-pointer hover:text-slate-300',
        className
      )}
    >
      {children}
    </th>
  )
}

export function TableCell({ children, className }: TableProps) {
  return <td className={cn('p-4 align-middle', className)}>{children}</td>
}
