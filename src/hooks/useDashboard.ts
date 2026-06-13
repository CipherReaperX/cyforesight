import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { DashboardStats, ThreatTrend, IOCDistribution, MitreTechnique, ThreatDetection, FeedHealth, DashboardOverview } from '@/types'
import { useEffect, useState } from 'react'

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

export function useRealtimePulse() {
  const [pulse, setPulse] = useState<any>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
    const streamUrl = baseUrl.startsWith('http')
      ? `${baseUrl}/dashboard/stream`
      : `/api/dashboard/stream`
    const es = new EventSource(`${streamUrl}?token=${encodeURIComponent(token)}`)

    const onPulse = (evt: MessageEvent) => {
      try {
        setPulse(JSON.parse(evt.data))
      } catch {
        // ignore malformed events
      }
    }

    es.addEventListener('pulse', onPulse as EventListener)
    return () => {
      es.removeEventListener('pulse', onPulse as EventListener)
      es.close()
    }
  }, [])

  return pulse
}
