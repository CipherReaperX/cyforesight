import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export type SocketStatus = 'connecting' | 'connected' | 'disconnected'

export type PulseData = {
  ts: string
  totalIocs: number
  newThreats: number
  assetsAtRisk: number
  incidentsOpen: number
}

type SocketCtx = {
  socket: Socket | null
  status: SocketStatus
  pulse: PulseData | null
  lastIocFlash: number   // increments on every ioc:new → consumers compare to prev
}

const defaultCtx: SocketCtx = { socket: null, status: 'connecting', pulse: null, lastIocFlash: 0 }
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

  // All state in one object to minimise renders
  const [ctxValue, setCtxValue] = useState<SocketCtx>(defaultCtx)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setCtxValue(v => ({ ...v, status: 'disconnected' }))
      return
    }

    const s = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    })
    socketRef.current = s

    // Expose socket immediately so consumers can add listeners even before connect
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

    return () => {
      s.disconnect()
      socketRef.current = null
      setCtxValue(defaultCtx)
    }
  }, [queryClient])

  return <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>
}
