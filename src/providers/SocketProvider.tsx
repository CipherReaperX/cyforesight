import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'

export type SocketStatus = 'connecting' | 'connected' | 'disconnected'

export type PulseData = {
  ts: string
  totalIocs: number
  newThreats: number
  assetsAtRisk: number
  incidentsOpen: number
}

export type NotificationType = 'feed_sync' | 'feed_error' | 'ioc_spike' | 'system'

export type AppNotification = {
  id: string
  type: NotificationType
  title: string
  body: string
  meta?: Record<string, unknown>
  read: boolean
  ts: string
}

type SocketCtx = {
  socket: Socket | null
  status: SocketStatus
  pulse: PulseData | null
  lastIocFlash: number
  notifications: AppNotification[]
  unreadCount: number
  markAllRead: () => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
}

const noop = async () => {}
const defaultCtx: SocketCtx = {
  socket: null, status: 'connecting', pulse: null, lastIocFlash: 0,
  notifications: [], unreadCount: 0, markAllRead: noop, markNotificationRead: noop,
}
const Ctx = createContext<SocketCtx>(defaultCtx)
export const useSocketCtx = () => useContext(Ctx)

// Socket.IO URL:
// - In dev: connect to window.location.origin so Vite's ws proxy (/socket.io) handles it
// - If VITE_SOCKET_URL is set explicitly, use that (production override)
// - Otherwise strip /api from VITE_API_BASE_URL if it's an absolute URL
const BACKEND_URL = (() => {
  const explicit = import.meta.env.VITE_SOCKET_URL as string | undefined
  if (explicit) return explicit
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (apiBase && apiBase.startsWith('http')) {
    return apiBase.replace(/\/api\/?$/, '').replace(/\/$/, '')
  }
  // Default: same origin → /socket.io goes through Vite WS proxy in dev, nginx in prod
  return window.location.origin
})()

export function SocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const [ctxValue, setCtxValue] = useState<SocketCtx>(defaultCtx)
  const socketRef = useRef<Socket | null>(null)

  // Notification mutations — stable refs so they can be in context without re-renders
  const markAllRead = useCallback(async () => {
    setCtxValue(v => ({
      ...v,
      notifications: v.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }))
    try { await api.post('/notifications/read-all') } catch { /* optimistic */ }
  }, [])

  const markNotificationRead = useCallback(async (id: string) => {
    setCtxValue(v => {
      const updated = v.notifications.map(n => n.id === id ? { ...n, read: true } : n)
      return { ...v, notifications: updated, unreadCount: updated.filter(n => !n.read).length }
    })
    try { await api.post(`/notifications/${id}/read`) } catch { /* optimistic */ }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setCtxValue(v => ({ ...v, status: 'disconnected' }))
      return
    }

    // Seed notification state from REST (ring buffer persists across socket reconnects)
    api.get('/notifications').then(res => {
      const d = res.data?.data ?? res.data
      if (Array.isArray(d?.items)) {
        setCtxValue(v => ({
          ...v,
          notifications: d.items,
          unreadCount: d.unread ?? d.items.filter((n: AppNotification) => !n.read).length,
        }))
      }
    }).catch(() => { /* backend may not be up yet; socket init event will fill in */ })

    const s = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    })
    socketRef.current = s

    setCtxValue(v => ({ ...v, socket: s, status: 'connecting' }))

    s.on('connect', () => {
      setCtxValue(v => ({ ...v, status: 'connected' }))
      s.emit('pulse:request')
    })

    s.on('disconnect', () => {
      setCtxValue(v => ({ ...v, status: 'disconnected' }))
    })

    s.on('connect_error', () => {
      setCtxValue(v => ({ ...v, status: 'disconnected' }))
    })

    s.on('dashboard:pulse', (data: PulseData) => {
      setCtxValue(v => ({ ...v, pulse: data, status: 'connected' }))
    })

    s.on('ioc:new', (data: { feedId: string; feedName: string; count: number }) => {
      setCtxValue(v => ({ ...v, lastIocFlash: v.lastIocFlash + 1 }))
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'geo-threats'] })
      toast.info(`${data.feedName}: +${data.count} new IOCs`, { duration: 3000 })
    })

    s.on('feed:synced', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] })
    })

    s.on('dashboard:refresh', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    })

    // Single source of truth for notification state — handled here, not in useNotifications
    s.on('notification:init', (payload: { items: AppNotification[]; unread: number }) => {
      setCtxValue(v => ({ ...v, notifications: payload.items, unreadCount: payload.unread }))
    })

    s.on('notification:new', (n: AppNotification) => {
      setCtxValue(v => {
        const updated = [n, ...v.notifications].slice(0, 100)
        return { ...v, notifications: updated, unreadCount: updated.filter(x => !x.read).length }
      })
    })

    return () => {
      s.disconnect()
      socketRef.current = null
      setCtxValue(defaultCtx)
    }
  }, [queryClient])

  const value: SocketCtx = { ...ctxValue, markAllRead, markNotificationRead }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
