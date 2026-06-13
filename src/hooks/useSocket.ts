import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export type SocketStatus = 'connecting' | 'connected' | 'disconnected'

const BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || '/api')
  .replace(/\/api\/?$/, '')
  .replace(/\/$/, '') || 'http://localhost:9999'

let sharedSocket: Socket | null = null
let sharedRefCount = 0

function getOrCreateSocket(token: string): Socket {
  if (sharedSocket?.connected) return sharedSocket
  if (sharedSocket) {
    sharedSocket.disconnect()
    sharedSocket = null
  }
  sharedSocket = io(BACKEND_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: Infinity,
    timeout: 10000,
  })
  return sharedSocket
}

export function useSocket() {
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setStatus('disconnected'); return }

    sharedRefCount++
    const s = getOrCreateSocket(token)
    socketRef.current = s

    const onConnect    = () => { setStatus('connected');    s.emit('pulse:request') }
    const onDisconnect = () => setStatus('disconnected')
    const onConnectErr = () => setStatus('disconnected')

    if (s.connected) setStatus('connected')
    s.on('connect',       onConnect)
    s.on('disconnect',    onDisconnect)
    s.on('connect_error', onConnectErr)

    return () => {
      s.off('connect',       onConnect)
      s.off('disconnect',    onDisconnect)
      s.off('connect_error', onConnectErr)
      sharedRefCount--
      if (sharedRefCount <= 0) {
        sharedRefCount = 0
        s.disconnect()
        sharedSocket = null
      }
    }
  }, [])

  const on = useCallback(<T = unknown>(event: string, handler: (data: T) => void) => {
    socketRef.current?.on(event, handler)
    return () => { socketRef.current?.off(event, handler) }
  }, [])

  return { socket: socketRef.current, status, on }
}
