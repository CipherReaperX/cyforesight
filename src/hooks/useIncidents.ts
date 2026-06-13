import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { toast } from 'sonner'

export function useIncidents(status?: string, limit: number = 100) {
  return useQuery({
    queryKey: ['incidents', status, limit],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status) params.append('status', status)
      params.append('limit', String(limit))
      const { data } = await apiClient.get(`/incidents?${params}`)
      return data.data || []
    },
    refetchInterval: 30000,
  })
}

export function useIncidentStats() {
  return useQuery({
    queryKey: ['incidents', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/incidents/stats')
      return data.data || { new: 0, inProgress: 0, resolved: 0 }
    },
    refetchInterval: 30000,
  })
}

export function useBootstrapIncidents() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (limit: number = 140) => {
      const { data } = await apiClient.post('/incidents/bootstrap', { limit })
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Incident clusters generated')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to generate incidents')
    },
  })
}

export function useUpdateIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; status?: string; assignedTo?: string | null; note?: string }) => {
      const { id, ...rest } = payload
      const { data } = await apiClient.patch(`/incidents/${id}`, rest)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] })
      toast.success('Incident updated')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update incident')
    },
  })
}

