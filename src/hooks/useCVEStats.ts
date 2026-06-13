import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'

export function useCVEStats() {
  return useQuery({
    queryKey: ['cve-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/cves/stats')
      return data.data
    }
  })
}

