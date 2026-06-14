import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import api from '@/lib/api'
import { useSocketCtx } from '@/providers/SocketProvider'

export interface Integration {
  id: string
  type: string
  name: string
  enabled: boolean
  config: IntegrationConfig
  status: 'not_configured' | 'configured' | 'connected' | 'error'
  lastUsed: string | null
  lastResult: { success?: boolean; message?: string; durationMs?: number; error?: string; detail?: unknown } | null
  createdAt: string
  updatedAt: string
}

export interface IntegrationConfig {
  webhookUrl?: string
  url?: string
  method?: string
  headers?: Record<string, string>
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string
  smtpPass?: string
  smtpFrom?: string
  smtpTo?: string
  apiKey?: string
  triggers?: string[]
}

export function useIntegrations() {
  const { socket } = useSocketCtx()
  const queryClient = useQueryClient()

  // Patch individual integration in cache on live update
  useEffect(() => {
    if (!socket) return
    const onUpdate = (updated: Integration) => {
      queryClient.setQueryData<Integration[]>(['integrations'], old =>
        old?.map(i => i.id === updated.id ? { ...i, ...updated } : i) ?? [updated]
      )
    }
    socket.on('integration:update', onUpdate)
    return () => { socket.off('integration:update', onUpdate) }
  }, [socket, queryClient])

  return useQuery<Integration[]>({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data } = await api.get('/integrations')
      return data.data ?? []
    },
    staleTime: 30000,
  })
}
