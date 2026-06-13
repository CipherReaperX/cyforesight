import { useMutation } from '@tanstack/react-query'
import apiClient from '@/lib/api'

export type ReconTool = 'whois' | 'dns' | 'geoip' | 'ssl'

export function useReconLookup() {
  return useMutation({
    mutationFn: async ({ tool, query }: { tool: ReconTool; query: string }) => {
      const { data } = await apiClient.get(`/recon/${tool}?query=${encodeURIComponent(query)}`)
      return data.data
    },
  })
}
