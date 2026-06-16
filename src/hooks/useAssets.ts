import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { Asset } from '@/types'
import { toast } from 'sonner'

interface AssetFilters {
  skip?: number
  take?: number
  type?: string
  status?: string
  search?: string
  riskLevel?: string
}

export function useAssets(filters: AssetFilters = {}) {
  return useQuery<{ items: Asset[]; total: number }>({
    queryKey: ['assets', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null) return
        const str = String(value).trim()
        if (str.length === 0) return
        params.append(key, str)
      })
      const { data } = await apiClient.get(`/assets?${params}`)
      return data.data  // ← Fixed: Extract nested data
    },
  })
}

export function useAsset(id: string) {
  return useQuery<Asset>({
    queryKey: ['assets', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/assets/${id}`)
      return data.data  // ← Fixed: Extract nested data
    },
    enabled: !!id,
  })
}

export function useCreateAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (asset: Partial<Asset>) => {
      const { data } = await apiClient.post('/assets', asset)
      return data.data  // ← Fixed: Extract nested data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast.success('Asset created successfully')
    },
    onError: () => {
      toast.error('Failed to create asset')
    },
  })
}

export function useUpdateAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...asset }: Partial<Asset> & { id: string }) => {
      const { data } = await apiClient.put(`/assets/${id}`, asset)
      return data.data  // ← Fixed: Extract nested data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast.success('Asset updated successfully')
    },
    onError: () => {
      toast.error('Failed to update asset')
    },
  })
}

export function useDeleteAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/assets/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast.success('Asset deleted successfully')
    },
    onError: () => {
      toast.error('Failed to delete asset')
    },
  })
}

export function useAssetVulnerabilities(id: string) {
  return useQuery({
    queryKey: ['assets', id, 'vulnerabilities'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/assets/${id}/vulnerabilities`)
      return data.data
    },
    enabled: !!id,
  })
}

export function useAssetThreats(id: string) {
  return useQuery({
    queryKey: ['assets', id, 'threats'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/assets/${id}/threats`)
      return data.data
    },
    enabled: !!id,
  })
}

export function useBootstrapSmallEnterpriseAssets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/assets/bootstrap-small-enterprise')
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Small enterprise asset architecture loaded')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to load enterprise asset data')
    },
  })
}

export function useMapIOCsToAssets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (limitPerAsset: number = 40) => {
      const { data } = await apiClient.post('/assets/map-iocs', { limitPerAsset })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('IOC mapping to assets completed')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to map IOCs to assets')
    },
  })
}

export function useExposurePriorities(limit: number = 25) {
  return useQuery({
    queryKey: ['assets', 'priorities', limit],
    queryFn: async () => {
      const { data } = await apiClient.get(`/assets/priorities?limit=${limit}`)
      return data.data || []
    },
    refetchInterval: 30000,
  })
}

export function useScanAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (assetId: string) => {
      const { data } = await apiClient.post(`/assets/${assetId}/scan`)
      return data.data
    },
    onSuccess: (_data, assetId) => {
      queryClient.invalidateQueries({ queryKey: ['assets', assetId] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast.success('Scan completed')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Scan failed')
    },
  })
}

export function useRecheckAssetIOCsVT() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { assetId: string; limit?: number }) => {
      const { data } = await apiClient.post(`/assets/${payload.assetId}/recheck-vt`, {
        limit: payload.limit ?? 20,
      })
      return data.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assets', variables.assetId, 'threats'] })
      queryClient.invalidateQueries({ queryKey: ['assets', variables.assetId] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast.success('VirusTotal recheck completed')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed VT recheck')
    },
  })
}
