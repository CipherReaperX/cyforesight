import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { CVE } from '@/types'

export interface CVERecord {
  id: string
  cveId: string
  description: string
  cvssScore: number
  cvssVector?: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  affectedAssets: number
  publishedDate: string
  modifiedDate?: string
  patchStatus: string
  exploitAvailable: boolean
  cweIds: string[]
  references: Array<{ url: string; name?: string; tags?: string[] }>
  vendor?: string
  product?: string
  createdAt: string
  updatedAt: string
}

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
      return data.data
    },
  })
}

export function useCVE(id: string) {
  return useQuery<CVERecord>({
    queryKey: ['cves', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/cves/${id}`)
      return data.data
    },
    enabled: !!id,
  })
}
