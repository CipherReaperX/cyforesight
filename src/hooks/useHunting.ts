import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { toast } from 'sonner'

export function useHuntQueries(limit: number = 100) {
  return useQuery({
    queryKey: ['hunting', 'queries', limit],
    queryFn: async () => {
      const { data } = await apiClient.get(`/hunting/queries?limit=${limit}`)
      return data.data || []
    },
    refetchInterval: 30000,
  })
}

export function useHuntRuns(limit: number = 40) {
  return useQuery({
    queryKey: ['hunting', 'runs', limit],
    queryFn: async () => {
      const { data } = await apiClient.get(`/hunting/runs?limit=${limit}`)
      return data.data || []
    },
    refetchInterval: 15000,
  })
}

export function useRunThreatHunt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { query: string; dataSource?: 'all' | 'iocs' | 'assets' | 'cves'; hours?: number; limit?: number }) => {
      const { data } = await apiClient.post('/hunting/run', payload)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hunting', 'runs'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Threat hunt completed')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Threat hunt failed')
    },
  })
}

export function useCreateHuntQuery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      query: string;
      description?: string;
      tags?: string[];
      isScheduled?: boolean;
      scheduleCron?: string | null;
    }) => {
      const { data } = await apiClient.post('/hunting/queries', payload)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hunting', 'queries'] })
      toast.success('Saved hunt query created')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to save hunt query')
    },
  })
}

export function useRunSavedHunt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/hunting/queries/${id}/run`)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hunting', 'queries'] })
      qc.invalidateQueries({ queryKey: ['hunting', 'runs'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Saved hunt executed')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to run saved hunt')
    },
  })
}

export function useRunHuntAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/hunting/automation/run', { force: true })
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hunting', 'runs'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Hunt automation executed')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to run hunt automation')
    },
  })
}

