import { useEffect, useState, useCallback } from 'react'
import { useSocketCtx } from '@/providers/SocketProvider'
import api from '@/lib/api'

export type NotificationType = 'feed_sync' | 'feed_error' | 'ioc_spike' | 'system'

export type Notification = {
  id: string
  type: NotificationType
  title: string
  body: string
  meta?: Record<string, unknown>
  read: boolean
  ts: string
}

export function useNotifications() {
  const { socket } = useSocketCtx()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)

  // Seed from REST on mount (catches notifications emitted before socket connected)
  useEffect(() => {
    api.get('/notifications').then(res => {
      const data = res.data?.data ?? res.data
      if (Array.isArray(data?.items)) {
        setItems(data.items)
        setUnread(data.unread ?? data.items.filter((n: Notification) => !n.read).length)
      }
    }).catch(() => { /* ignore — socket events will still populate */ })
  }, [])

  // Live socket events
  useEffect(() => {
    if (!socket) return

    const onInit = (payload: { items: Notification[]; unread: number }) => {
      setItems(payload.items)
      setUnread(payload.unread)
    }

    const onNew = (n: Notification) => {
      setItems(prev => {
        const updated = [n, ...prev].slice(0, 100)
        setUnread(updated.filter(x => !x.read).length)
        return updated
      })
    }

    socket.on('notification:init', onInit)
    socket.on('notification:new', onNew)
    return () => {
      socket.off('notification:init', onInit)
      socket.off('notification:new', onNew)
    }
  }, [socket])

  const markAllRead = useCallback(async () => {
    setItems(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
    try { await api.post('/notifications/read-all') } catch { /* optimistic — ignore */ }
  }, [])

  const markOne = useCallback(async (id: string) => {
    setItems(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n)
      setUnread(updated.filter(n => !n.read).length)
      return updated
    })
    try { await api.post(`/notifications/${id}/read`) } catch { /* optimistic — ignore */ }
  }, [])

  return { items, unread, markAllRead, markOne }
}
