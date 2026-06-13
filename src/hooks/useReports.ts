import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { toast } from 'sonner'

export function useReports(limit: number = 100) {
  return useQuery({
    queryKey: ['reports', limit],
    queryFn: async () => {
      const { data } = await apiClient.get(`/reports?limit=${limit}`)
      return data.data || []
    },
    refetchInterval: 60000,
  })
}

export function useReportStats() {
  return useQuery({
    queryKey: ['reports', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/stats')
      return data.data || {
        totalReports: 0,
        scheduledReports: 0,
        thisMonth: 0,
        avgGenerationTimeSec: 0,
      }
    },
    refetchInterval: 60000,
  })
}

export function useGenerateReport() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { name: string; type: string; template?: string; schedule?: string }) => {
      const { data } = await apiClient.post('/reports/generate', payload)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Report generated')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to generate report')
    },
  })
}

export function useReportContent() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.get(`/reports/${id}/content`)
      return data.data
    },
  })
}

export async function downloadReport(id: string, name?: string) {
  const response = await apiClient.get(`/reports/${id}/download`, { responseType: 'blob' })
  const blob = new Blob([response.data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(name || 'report').replace(/\s+/g, '_')}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
