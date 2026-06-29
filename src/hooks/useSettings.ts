import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'

export interface ApiKeyRecord {
  service: string
  configured: boolean
  keyMasked: string | null
  isActive: boolean
  lastTestedAt: string | null
  lastTestStatus: 'ok' | 'fail' | null
  updatedAt: string | null
  source?: string
}

export interface NotificationPref {
  eventType: string
  inApp: boolean
  email: boolean
}

export interface PlatformUser {
  id: string
  username: string
  email: string
  role: string
  isActive: boolean
  lastLogin?: string | null
  createdAt?: string
}

// ---------- Platform settings ----------
export function usePlatformSettings() {
  const queryClient = useQueryClient()

  const query = useQuery<Record<string, string>>({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data } = await api.get('/settings')
      return data.data || {}
    },
    staleTime: 30000,
  })

  const save = useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      const { data } = await api.put('/settings', settings)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] })
      toast.success('Settings saved')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save settings'),
  })

  return { ...query, save }
}

// ---------- API keys ----------
export function useApiKeys() {
  const queryClient = useQueryClient()

  const query = useQuery<ApiKeyRecord[]>({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data } = await api.get('/settings/api-keys')
      return data.data || []
    },
    staleTime: 15000,
  })

  const saveKey = useMutation({
    mutationFn: async ({ service, key }: { service: string; key: string }) => {
      const { data } = await api.post('/settings/api-keys', { service, key })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('API key saved')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save key'),
  })

  const testKey = useMutation({
    mutationFn: async ({ service, key }: { service: string; key?: string }) => {
      const { data } = await api.post(`/settings/api-keys/${service}/test`, key ? { key } : {})
      return data.data as { status: 'ok' | 'fail'; latencyMs: number; message?: string }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      if (result.status === 'ok') toast.success(`Valid (${result.latencyMs}ms)`)
      else toast.error(`Invalid${result.message ? ': ' + result.message : ''}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Test failed'),
  })

  const deleteKey = useMutation({
    mutationFn: async (service: string) => {
      await api.delete(`/settings/api-keys/${service}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('API key removed')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to remove key'),
  })

  return { ...query, saveKey, testKey, deleteKey }
}

// ---------- Notification prefs ----------
export function useNotificationPrefs() {
  const queryClient = useQueryClient()

  const query = useQuery<NotificationPref[]>({
    queryKey: ['notification-prefs'],
    queryFn: async () => {
      const { data } = await api.get('/settings/notification-prefs')
      return data.data || []
    },
    staleTime: 30000,
  })

  const save = useMutation({
    mutationFn: async (prefs: NotificationPref[]) => {
      const { data } = await api.put('/settings/notification-prefs', { prefs })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-prefs'] })
      toast.success('Notification preferences saved')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save preferences'),
  })

  return { ...query, save }
}

// ---------- Users ----------
export function useUsers() {
  const queryClient = useQueryClient()

  const query = useQuery<PlatformUser[]>({
    queryKey: ['platform-users'],
    queryFn: async () => {
      const { data } = await api.get('/users')
      return data.data || []
    },
  })

  const create = useMutation({
    mutationFn: async (payload: { username: string; email: string; password: string; role: string }) => {
      const { data } = await api.post('/users', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] })
      toast.success('User created')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create user'),
  })

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; role?: string; isActive?: boolean }) => {
      const { data } = await api.patch(`/users/${id}`, updates)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] })
      toast.success('User updated')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update user'),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] })
      toast.success('User deleted')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to delete user'),
  })

  const resetPassword = useMutation({
    mutationFn: async ({ id, newPassword }: { id: string; newPassword: string }) => {
      await api.post(`/users/${id}/reset-password`, { newPassword })
    },
    onSuccess: () => toast.success('Password reset'),
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to reset password'),
  })

  return { ...query, create, update, remove, resetPassword }
}
