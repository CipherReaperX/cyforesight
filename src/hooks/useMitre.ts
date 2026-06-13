import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function useMitreTactics() {
  return useQuery({
    queryKey: ['mitre', 'tactics'],
    queryFn: async () => {
      const { data } = await apiClient.get('/mitre/tactics')
      return data.data  // ← Fixed: Extract nested data
    },
  })
}

export function useMitreTechniques(tacticId?: string) {
  return useQuery({
    queryKey: ['mitre', 'techniques', tacticId],
    queryFn: async () => {
      const url = tacticId ? `/mitre/techniques?tactic=${tacticId}` : '/mitre/techniques'
      const { data } = await apiClient.get(url)
      return data.data  // ← Fixed: Extract nested data
    },
  })
}

export function useMitreTechniquesAdvanced(input?: {
  tactic?: string
  hasDetections?: boolean
  search?: string
  limit?: number
}) {
  return useQuery({
    queryKey: ['mitre', 'techniques-advanced', input],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (input?.tactic) params.append('tactic', input.tactic)
      if (input?.hasDetections) params.append('hasDetections', 'true')
      if (input?.search) params.append('search', input.search)
      if (input?.limit) params.append('limit', String(input.limit))
      const { data } = await apiClient.get(`/mitre/techniques?${params}`)
      return data.data || []
    },
  })
}

export function useMitreCoverage() {
  return useQuery({
    queryKey: ['mitre', 'coverage'],
    queryFn: async () => {
      const { data } = await apiClient.get('/mitre/coverage')
      return data.data  // ← Fixed: Extract nested data
    },
  })
}

export function useMapIOCsToMitre() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input?: { batchSize?: number; maxBatches?: number; async?: boolean }) => {
      const { data } = await apiClient.post('/mitre/map-iocs', input || {})
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mitre'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['iocs'] })
      toast.success('MITRE mapping completed')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'MITRE mapping failed')
    },
  })
}

export function useMitreMapStatus() {
  return useQuery({
    queryKey: ['mitre', 'map-status'],
    queryFn: async () => {
      const { data } = await apiClient.get('/mitre/map-status')
      return data.data
    },
    refetchInterval: 5000,
  })
}

export function useMitreAssetCorrelation(limitTechniques: number = 100, assetsPerTechnique: number = 8) {
  return useQuery({
    queryKey: ['mitre', 'asset-correlation', limitTechniques, assetsPerTechnique],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/mitre/asset-correlation?limitTechniques=${limitTechniques}&assetsPerTechnique=${assetsPerTechnique}`
      )
      return data.data
    },
    refetchInterval: 45000,
  })
}
