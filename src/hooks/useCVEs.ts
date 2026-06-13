import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { CVE } from '@/types'

interface CVEFilters {
  skip?: number
  take?: number
  severity?: string
  search?: string
}

export function useCVEs(filters: CVEFilters = {}) {
  return useQuery<{ items: CVE[]; total: number }>({
    queryKey: ['cves', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value))
      })
      const { data } = await apiClient.get(`/cves?${params}`)
      return data.data;
    },
  })
}
