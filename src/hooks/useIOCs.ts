import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { IOC, EnrichmentData, ThreatActor } from '@/types'
import { toast } from 'sonner'

interface IOCFilters {
  skip?: number
  take?: number
  type?: string
  severity?: string
  status?: string
  search?: string
  technique?: string
}

interface FreshIOCsResponse {
  since: string
  hours: number
  totalFreshToday: number
  items: IOC[]
}

export function useIOCs(filters: IOCFilters = {}, options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== undefined ? options.enabled : true
  return useQuery<{ items: IOC[]; total: number }>({
    queryKey: ['iocs', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null) return
        const str = String(value).trim()
        if (str.length === 0) return
        params.append(key, str)
      })
      const { data } = await apiClient.get(`/iocs?${params}`)
      return data.data
    },
    enabled,
  })
}

export function useIOC(id: string) {
  return useQuery<IOC>({
    queryKey: ['iocs', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/iocs/${id}`)
      return data.data
    },
    enabled: !!id,
  })
}

export function useRelatedIOCs(id: string) {
  return useQuery<IOC[]>({
    queryKey: ['iocs', id, 'related'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/iocs/${id}/related`)
      return data.data as IOC[]
    },
    enabled: !!id,
  })
}

export function useIOCAnomalies() {
  return useQuery({
    queryKey: ['iocs', 'anomalies'],
    queryFn: async () => {
      const { data } = await apiClient.get('/iocs/anomalies')
      return data.data
    },
    refetchInterval: 60000,
  })
}

export function useIOCEnrichment(id: string) {
  return useQuery<EnrichmentData>({
    queryKey: ['iocs', id, 'enrichment'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/iocs/${id}/enrichment`)
      return data
    },
    enabled: !!id,
  })
}

export function useThreatActors(limit: number = 5000) {
  return useQuery<ThreatActor[]>({
    queryKey: ['iocs', 'threat-actors', limit],
    queryFn: async () => {
      const { data } = await apiClient.get(`/iocs/threat-actors?limit=${limit}`)
      return data.data || []
    },
    staleTime: 30000,
  })
}

export function useFreshIOCs(hours: number = 24, limit: number = 100) {
  return useQuery<FreshIOCsResponse>({
    queryKey: ['iocs', 'fresh', hours, limit],
    queryFn: async () => {
      const { data } = await apiClient.get(`/iocs/fresh?hours=${hours}&limit=${limit}`)
      return data.data
    },
    staleTime: 30000,
    refetchInterval: 60000,
  })
}

export function useSyncAllFeedsForIOCs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/feeds/sync-all?wait=true', {}, { timeout: 60000 })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iocs'] })
      queryClient.invalidateQueries({ queryKey: ['iocs', 'fresh'] })
      queryClient.invalidateQueries({ queryKey: ['feeds'] })
      toast.success('Feed sync completed')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to sync feeds')
    },
  })
}

export function useBootstrapDiverseIOCs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (total: number = 120) => {
      const { data } = await apiClient.post('/iocs/bootstrap-diverse', { total })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iocs'] })
      queryClient.invalidateQueries({ queryKey: ['iocs', 'fresh'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Diverse IOC dataset loaded')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to load diverse IOC data')
    },
  })
}

export function useCreateIOC() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ioc: Partial<IOC>) => {
      const { data } = await apiClient.post('/iocs', ioc)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iocs'] })
      toast.success('IOC created successfully')
    },
    onError: () => {
      toast.error('Failed to create IOC')
    },
  })
}

export function useUpdateIOC() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...ioc }: Partial<IOC> & { id: string }) => {
      const { data } = await apiClient.put(`/iocs/${id}`, ioc)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iocs'] })
      toast.success('IOC updated successfully')
    },
    onError: () => {
      toast.error('Failed to update IOC')
    },
  })
}

export function useDeleteIOC() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/iocs/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iocs'] })
      toast.success('IOC deleted successfully')
    },
    onError: () => {
      toast.error('Failed to delete IOC')
    },
  })
}
