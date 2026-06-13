import { createContext, useContext, useEffect, useRef, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

type SocketCtx = { socket: Socket | null }
const Ctx = createContext<SocketCtx>({ socket: null })
export const useSocketCtx = () => useContext(Ctx)

const BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || '/api')
  .replace(/\/api\/?$/, '')
  .replace(/\/$/, '') || 'http://localhost:9999'

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const s = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
    })
    socketRef.current = s

    s.on('connect', () => {
      s.emit('pulse:request')
    })

    // When new IOCs arrive → invalidate trend + geo map (non-intrusive refresh)
    s.on('ioc:new', (data: { feedId: string; feedName: string; count: number }) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'geo-threats'] })
      toast.info(`${data.feedName}: +${data.count} new IOCs`, { duration: 3000 })
    })

    // Feed sync done → refresh feed health panel
    s.on('feed:synced', (data: { feedName: string; inserted: number }) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] })
    })

    // Cache invalidated server-side → refresh everything
    s.on('dashboard:refresh', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    })

    return () => {
      s.disconnect()
      socketRef.current = null
    }
  }, [queryClient])

  return (
    <Ctx.Provider value={{ socket: socketRef.current }}>
      {children}
    </Ctx.Provider>
  )
}
