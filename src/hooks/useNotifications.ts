import { useSocketCtx, type AppNotification, type NotificationType } from '@/providers/SocketProvider'

// Re-export types for consumers that imported them from here
export type { AppNotification as Notification, NotificationType }

export function useNotifications() {
  const { notifications, unreadCount, markAllRead, markNotificationRead } = useSocketCtx()
  return {
    items: notifications,
    unread: unreadCount,
    markAllRead,
    markOne: markNotificationRead,
  }
}
