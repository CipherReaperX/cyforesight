import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { DashboardStats, ThreatTrend, IOCDistribution, MitreTechnique, ThreatDetection, FeedHealth, DashboardOverview } from '@/types'
import { useEffect, useState, useCallback, useRef } from 'react'

export type SSEStatus = 'connecting' | 'connected' | 'disconnected'

export function useDashboardOverview(days: number = 30, limit: number = 10) {
  return useQuery<DashboardOverview>({
    queryKey: ['dashboard', 'overview', days, limit],
    queryFn: async () => {
      const { data } = await apiClient.get(`/dashboard/overview?days=${days}&limit=${limit}`)
      return data.data
    },
    refetchInterval: 30000,
    staleTime: 15000,
  })
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/stats')
      return data.data // Unwrap the data
    },
    refetchInterval: 30000,
  })
}

export function useThreatTrend(days: number = 30) {
  return useQuery<ThreatTrend[]>({
    queryKey: ['dashboard', 'threat-trend', days],
    queryFn: async () => {
      const { data } = await apiClient.get(`/dashboard/threat-trend?days=${days}`)
      return data.data // Unwrap the data
    },
  })
}

export function useIOCDistribution() {
  return useQuery<IOCDistribution[]>({
    queryKey: ['iocs', 'distribution'],
    queryFn: async () => {
      const { data } = await apiClient.get('/iocs/distribution')
      return data.data // Unwrap the data
    },
  })
}

export function useTopMitreTechniques(limit: number = 5) {
  return useQuery<MitreTechnique[]>({
    queryKey: ['mitre', 'top-techniques', limit],
    queryFn: async () => {
      const { data } = await apiClient.get(`/mitre/top-techniques?limit=${limit}`)
      return data.data // Unwrap the data
    },
  })
}

export function useRecentThreats(limit: number = 10) {
  return useQuery<ThreatDetection[]>({
    queryKey: ['threats', 'recent', limit],
    queryFn: async () => {
      const { data } = await apiClient.get(`/threats/recent?limit=${limit}`)
      return data.data // Unwrap the data
    },
  })
}

export function useFeedHealth() {
  return useQuery<FeedHealth[]>({
    queryKey: ['feeds', 'health'],
    queryFn: async () => {
      const { data } = await apiClient.get('/feeds')
      return data.data || []
    },
    refetchInterval: 300000,
  })
}

export function useGeoThreats() {
  return useQuery<any[]>({
    queryKey: ['dashboard', 'geo-threats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/geo-threats')
      return data.data ?? []
    },
    staleTime: 300000,
    refetchInterval: 300000,
  })
}

export function useRealtimePulse(): { pulse: any; status: SSEStatus } {
  const [pulse, setPulse] = useState<any>(null)
  const [status, setStatus] = useState<SSEStatus>('connecting')
  const esRef = useRef<EventSource | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryDelayRef = useRef(1000)
  const unmountedRef = useRef(false)

  const connect = useCallback(() => {
    if (unmountedRef.current) return
    const token = localStorage.getItem('token')
    if (!token) { setStatus('disconnected'); return }

    setStatus('connecting')
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
    const url = baseUrl.startsWith('http') ? `${baseUrl}/dashboard/stream` : `/api/dashboard/stream`
    const es = new EventSource(`${url}?token=${encodeURIComponent(token)}`)
    esRef.current = es

    es.addEventListener('pulse', (evt: MessageEvent) => {
      try {
        if (!unmountedRef.current) {
          setPulse(JSON.parse(evt.data))
          setStatus('connected')
          retryDelayRef.current = 1000
        }
      } catch { /* ignore malformed events */ }
    })

    es.onerror = () => {
      if (unmountedRef.current) return
      es.close()
      setStatus('disconnected')
      const delay = retryDelayRef.current
      retryDelayRef.current = Math.min(delay * 2, 30000)
      retryRef.current = setTimeout(connect, delay)
    }
  }, [])

  useEffect(() => {
    unmountedRef.current = false
    connect()

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !unmountedRef.current) {
        esRef.current?.close()
        if (retryRef.current) clearTimeout(retryRef.current)
        retryDelayRef.current = 1000
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      unmountedRef.current = true
      esRef.current?.close()
      if (retryRef.current) clearTimeout(retryRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [connect])

  return { pulse, status }
}
