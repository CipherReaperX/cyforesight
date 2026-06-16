import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { CVE } from '@/types'
import { toast } from 'sonner'

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

export interface CVEFilters {
  skip?: number
  take?: number
  severity?: string
  search?: string
  exploitAvailable?: string
  patchStatus?: string
}

export function useCVEs(filters: CVEFilters = {}) {
  return useQuery<{ items: CVE[]; total: number; hasMore: boolean }>({
    queryKey: ['cves', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.append(key, String(value))
      })
      const { data } = await apiClient.get(`/cves?${params}`)
      return data.data
    },
    refetchInterval: 60000,
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

export function useUpdateCVEPatchStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patchStatus }: { id: string; patchStatus: string }) => {
      const { data } = await apiClient.patch(`/cves/${id}`, { patchStatus })
      return data.data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['cves'] })
      qc.invalidateQueries({ queryKey: ['cves', vars.id] })
      qc.invalidateQueries({ queryKey: ['cve-stats'] })
      toast.success(`Patch status updated to "${vars.patchStatus}"`)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update CVE')
    },
  })
}

export function useScanCVEAssets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/cves/scan-assets')
      return data.data as { scanned: number; vulnerable: number; critical: number }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['cves'] })
      qc.invalidateQueries({ queryKey: ['cve-stats'] })
      toast.success(`Scan complete — ${result.vulnerable} of ${result.scanned} CVEs affect assets (${result.critical} critical)`)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Asset scan failed')
    },
  })
}
