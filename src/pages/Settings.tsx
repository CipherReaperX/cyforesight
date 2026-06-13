import { useState } from 'react'
import { toast } from 'sonner'
import { Settings as SettingsIcon, Bell, Users, Database, Shield, Key, Plus, UserX, UserCheck } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'

function UserManagementPanel() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'analyst' })

  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await apiClient.get('/auth/users')
      return data.data || []
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const { data } = await apiClient.post('/auth/users', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User created')
      setForm({ username: '', email: '', password: '', role: 'analyst' })
      setShowCreate(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create user'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; isActive?: boolean; role?: string }) => {
      const { data } = await apiClient.put(`/auth/users/${id}`, updates)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User updated')
    },
    onError: () => toast.error('Failed to update user'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-100">Platform Users</h3>
        <Button size="sm" variant="primary" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Username</label>
                <Input className="mt-1" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="jsmith" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Email</label>
                <Input className="mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="j.smith@corp.com" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Password</label>
                <Input className="mt-1" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Role</label>
                <select className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="analyst">Analyst</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex space-x-2">
              <Button size="sm" variant="primary" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create User'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-sm text-slate-400">Loading users...</div>
      ) : (
        <div className="space-y-2">
          {users.map((user: any) => (
            <div key={user.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-100">{user.username}</span>
                  <Badge variant={user.role === 'admin' ? 'critical' : user.role === 'analyst' ? 'warning' : 'default'}>
                    {user.role}
                  </Badge>
                  {!user.isActive && <Badge variant="danger">Disabled</Badge>}
                </div>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
              <div className="flex space-x-2">
                <select
                  className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200"
                  value={user.role}
                  onChange={(e) => updateMutation.mutate({ id: user.id, role: e.target.value })}
                >
                  <option value="viewer">Viewer</option>
                  <option value="analyst">Analyst</option>
                  <option value="admin">Admin</option>
                </select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => updateMutation.mutate({ id: user.id, isActive: !user.isActive })}
                  title={user.isActive ? 'Disable user' : 'Enable user'}
                >
                  {user.isActive ? <UserX className="h-4 w-4 text-red-400" /> : <UserCheck className="h-4 w-4 text-green-400" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('General')
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-100">Settings & Configuration</h1>
        <p className="text-slate-400">Manage platform settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Settings Navigation */}
        <div className="space-y-2">
          <Card>
            <CardContent className="space-y-1 p-2">
              {[
                { icon: SettingsIcon, label: 'General' },
                { icon: Bell, label: 'Notifications' },
                { icon: Users, label: 'Users & Permissions' },
                { icon: Database, label: 'Data Sources' },
                { icon: Shield, label: 'Security' },
                { icon: Key, label: 'API Keys' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => setActiveTab(item.label)}
                  className={`flex w-full items-center space-x-3 rounded-md px-3 py-2 text-left text-sm ${
                    activeTab === item.label
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Users & Permissions Panel */}
          {activeTab === 'Users & Permissions' && (
            <Card>
              <CardHeader>
                <CardTitle>Users &amp; Permissions</CardTitle>
              </CardHeader>
              <CardContent>
                <UserManagementPanel />
              </CardContent>
            </Card>
          )}

          {/* General Settings */}
          {activeTab === 'General' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-slate-400">Organization Name</label>
                      <Input className="mt-1" defaultValue="Acme Corporation" />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Timezone</label>
                      <select className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100">
                        <option>UTC</option>
                        <option>EST</option>
                        <option>PST</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Data Retention Period</label>
                      <select className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100">
                        <option>30 days</option>
                        <option>90 days</option>
                        <option>1 year</option>
                        <option>Forever</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { label: 'Critical Threat Alerts', enabled: true },
                      { label: 'Daily Summary Email', enabled: true },
                      { label: 'Feed Health Warnings', enabled: false },
                      { label: 'IOC Matches', enabled: true },
                    ].map((notif) => (
                      <div key={notif.label} className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">{notif.label}</span>
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input type="checkbox" className="peer sr-only" defaultChecked={notif.enabled} />
                          <div className="peer h-6 w-11 rounded-full bg-slate-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-600 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>API Keys</CardTitle>
                    <Button size="sm" variant="primary">Generate New Key</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { name: 'Production API Key', created: '2024-01-15', lastUsed: '2 hours ago' },
                      { name: 'Development API Key', created: '2024-02-01', lastUsed: '1 day ago' },
                    ].map((key) => (
                      <div key={key.name} className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-slate-100">{key.name}</h4>
                            <p className="mt-1 font-mono text-xs text-slate-400">sk_live_••••••••••••••••</p>
                            <div className="mt-2 flex items-center space-x-3 text-xs text-slate-500">
                              <span>Created: {key.created}</span>
                              <span>•</span>
                              <span>Last used: {key.lastUsed}</span>
                            </div>
                          </div>
                          <Button size="sm" variant="danger">Revoke</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end space-x-2">
                <Button variant="outline">Cancel</Button>
                <Button variant="primary">Save Changes</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
