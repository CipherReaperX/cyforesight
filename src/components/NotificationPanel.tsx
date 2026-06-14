import { useEffect, useRef } from 'react'
import { Bell, CheckCheck, Rss, AlertCircle, Info, X } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { useNotifications } from '@/hooks/useNotifications'

interface Props {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  feed_sync:  <Rss         className="h-4 w-4 text-green-400" />,
  feed_error: <AlertCircle className="h-4 w-4 text-red-400"   />,
  ioc_spike:  <AlertCircle className="h-4 w-4 text-orange-400"/>,
  system:     <Info        className="h-4 w-4 text-blue-400"  />,
}

export function NotificationPanel({ open, onClose, anchorRef }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const { items, unread, markAllRead, markOne } = useNotifications()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose, anchorRef])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 w-96 origin-top-right animate-in fade-in slide-in-from-top-2 duration-150"
      role="dialog"
      aria-label="Notifications"
    >
      <div className="rounded-xl border border-[#1f2d3d] bg-[#0f1726] shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f2d3d] px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-slate-300" />
            <span className="font-semibold text-slate-100">Notifications</span>
            {unread > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                All read
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-500">
              <Bell className="h-8 w-8 opacity-30" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs">Feed syncs and alerts will appear here</p>
            </div>
          ) : (
            <ul>
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`group flex gap-3 border-b border-[#1f2d3d] px-4 py-3 transition-colors hover:bg-slate-800/50 ${
                    !n.read ? 'bg-cyan-500/5' : ''
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {TYPE_ICON[n.type] ?? TYPE_ICON.system}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${n.read ? 'text-slate-300' : 'font-semibold text-slate-100'}`}>
                        {n.title}
                      </p>
                      <span className="flex-shrink-0 text-[10px] text-slate-500">
                        {formatRelativeTime(n.ts)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">{n.body}</p>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => markOne(n.id)}
                      className="mt-0.5 flex-shrink-0 rounded p-0.5 text-slate-500 opacity-0 transition-opacity hover:text-slate-300 group-hover:opacity-100"
                      title="Mark as read"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-[#1f2d3d] px-4 py-2 text-center">
            <span className="text-xs text-slate-500">
              Showing {items.length} notification{items.length !== 1 ? 's' : ''} · clears on restart
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
