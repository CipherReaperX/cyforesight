import { useEffect, useState, Fragment } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings as SettingsIcon, Bell, Users, Database, Shield, Key,
  Plus, UserX, UserCheck, Trash2, KeyRound, RefreshCw, CheckCircle2, XCircle, Circle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import api from '@/lib/api'
import {
  usePlatformSettings, useApiKeys, useNotificationPrefs, useUsers,
  type NotificationPref,
} from '@/hooks/useSettings'

const inputCls =
  'mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="peer h-6 w-11 rounded-full bg-slate-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-600 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
    </label>
  )
}

// ---------------- General ----------------
function GeneralPanel() {
  const { data, isLoading, save, refetch } = usePlatformSettings()
  const [form, setForm] = useState<Record<string, string>>({})

  useEffect(() => { if (data) setForm(data) }, [data])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  if (isLoading) return <div className="text-sm text-slate-400">Loading settings...</div>

  return (
    <Card>
      <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400">Platform Name</label>
            <Input className="mt-1" value={form.platform_name || ''} onChange={(e) => set('platform_name', e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-slate-400">Default Theme</label>
            <select className={inputCls} value={form.default_theme || 'dark'} onChange={(e) => set('default_theme', e.target.value)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400">Timezone</label>
            <select className={inputCls} value={form.timezone || 'UTC'} onChange={(e) => set('timezone', e.target.value)}>
              <option value="UTC">UTC</option>
              <option value="EST">EST</option>
              <option value="PST">PST</option>
              <option value="IST">IST</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400">Data Refresh Interval (seconds)</label>
            <Input className="mt-1" type="number" value={form.data_refresh_interval || ''} onChange={(e) => set('data_refresh_interval', e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-slate-400">Session Timeout (hours)</label>
            <Input className="mt-1" type="number" value={form.session_timeout_hours || ''} onChange={(e) => set('session_timeout_hours', e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-slate-400">Max IOCs Per Page</label>
            <Input className="mt-1" type="number" value={form.max_iocs_per_page || ''} onChange={(e) => set('max_iocs_per_page', e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-slate-400">Data Retention (days)</label>
            <select className={inputCls} value={form.data_retention_days || '90'} onChange={(e) => set('data_retention_days', e.target.value)}>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="0">Forever</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-2">
          <Button variant="outline" onClick={() => refetch()}>Reset</Button>
          <Button variant="primary" onClick={() => save.mutate(form)} disabled={save.isPending}>
            {save.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------- Notifications ----------------
const EVENT_TYPES = [
  { key: 'critical_ioc', label: 'Critical IOC Detected' },
  { key: 'feed_failure', label: 'Feed Sync Failure' },
  { key: 'new_incident', label: 'New Incident Created' },
  { key: 'asset_alert', label: 'Asset Alert' },
  { key: 'login_failure', label: 'Login Failure' },
]

function NotificationsPanel() {
  const { data, isLoading, save } = useNotificationPrefs()
  const [prefs, setPrefs] = useState<Record<string, NotificationPref>>({})

  useEffect(() => {
    const base: Record<string, NotificationPref> = {}
    for (const et of EVENT_TYPES) base[et.key] = { eventType: et.key, inApp: true, email: false }
    for (const p of data || []) base[p.eventType] = p
    setPrefs(base)
  }, [data])

  const update = (key: string, field: 'inApp' | 'email', val: boolean) =>
    setPrefs((p) => ({ ...p, [key]: { ...p[key], [field]: val } }))

  if (isLoading) return <div className="text-sm text-slate-400">Loading preferences...</div>

  return (
    <Card>
      <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Event</div>
          <div className="text-xs font-semibold uppercase text-slate-500">In-App</div>
          <div className="text-xs font-semibold uppercase text-slate-500">Email</div>
          {EVENT_TYPES.map((et) => (
            <Fragment key={et.key}>
              <span className="text-sm text-slate-300">{et.label}</span>
              <Toggle checked={prefs[et.key]?.inApp ?? false} onChange={(v) => update(et.key, 'inApp', v)} />
              <Toggle checked={prefs[et.key]?.email ?? false} onChange={(v) => update(et.key, 'email', v)} />
            </Fragment>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={() => save.mutate(Object.values(prefs))} disabled={save.isPending}>
            {save.isPending ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------- Users & Permissions ----------------
function UserManagementPanel() {
  const { data: users = [], isLoading, create, update, remove, resetPassword } = useUsers()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'analyst' })
  const [resetFor, setResetFor] = useState<string | null>(null)
  const [newPwd, setNewPwd] = useState('')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-100">Platform Users</h3>
        <Button size="sm" variant="primary" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-2 h-4 w-4" /> Add User
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
                <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="analyst">Analyst</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex space-x-2">
              <Button size="sm" variant="primary" disabled={create.isPending}
                onClick={() => create.mutate(form, { onSuccess: () => { setForm({ username: '', email: '', password: '', role: 'analyst' }); setShowCreate(false) } })}>
                {create.isPending ? 'Creating...' : 'Create User'}
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
          {users.map((user) => (
            <div key={user.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-100">{user.username}</span>
                    <Badge variant={user.role === 'admin' ? 'critical' : user.role === 'analyst' ? 'warning' : 'default'}>{user.role}</Badge>
                    {!user.isActive && <Badge variant="danger">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-slate-400">{user.email}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <select className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200"
                    value={user.role} onChange={(e) => update.mutate({ id: user.id, role: e.target.value })}>
                    <option value="viewer">Viewer</option>
                    <option value="analyst">Analyst</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button size="sm" variant="ghost" title={user.isActive ? 'Disable user' : 'Enable user'}
                    onClick={() => update.mutate({ id: user.id, isActive: !user.isActive })}>
                    {user.isActive ? <UserX className="h-4 w-4 text-red-400" /> : <UserCheck className="h-4 w-4 text-green-400" />}
                  </Button>
                  <Button size="sm" variant="ghost" title="Reset password"
                    onClick={() => { setResetFor(resetFor === user.id ? null : user.id); setNewPwd('') }}>
                    <KeyRound className="h-4 w-4 text-amber-400" />
                  </Button>
                  <Button size="sm" variant="ghost" title="Delete user"
                    onClick={() => { if (confirm(`Delete user ${user.username}?`)) remove.mutate(user.id) }}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
              {resetFor === user.id && (
                <div className="mt-3 flex items-center space-x-2 border-t border-slate-700 pt-3">
                  <Input className="flex-1" type="password" placeholder="New password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
                  <Button size="sm" variant="primary" disabled={!newPwd || resetPassword.isPending}
                    onClick={() => resetPassword.mutate({ id: user.id, newPassword: newPwd }, { onSuccess: () => { setResetFor(null); setNewPwd('') } })}>
                    Set Password
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setResetFor(null)}>Cancel</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------- Data Sources ----------------
interface Feed {
  id: string
  name: string
  status: string
  frequency: string
  enabled: boolean
  lastFetch: string | null
  totalIocs: number
  healthScore: number
}

function DataSourcesPanel() {
  const queryClient = useQueryClient()
  const { data: feeds = [], isLoading } = useQuery<Feed[]>({
    queryKey: ['settings-feeds'],
    queryFn: async () => {
      const { data } = await api.get('/feeds')
      return data.data || []
    },
  })

  const patchFeed = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; enabled?: boolean; frequency?: string }) => {
      const { data } = await api.patch(`/feeds/${id}`, updates)
      return data.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings-feeds'] }); toast.success('Feed updated') },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update feed'),
  })

  const syncFeed = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/feeds/${id}/sync`)
      return data.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings-feeds'] }); toast.success('Feed synced') },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Sync failed'),
  })

  if (isLoading) return <div className="text-sm text-slate-400">Loading feeds...</div>

  return (
    <Card>
      <CardHeader><CardTitle>Threat Feed Sources</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {feeds.map((feed) => (
            <div key={feed.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-semibold text-slate-100">{feed.name}</h4>
                    <Badge variant={feed.status === 'active' ? 'success' : feed.status === 'error' ? 'danger' : 'default'}>{feed.status}</Badge>
                  </div>
                  <div className="mt-1 flex items-center space-x-3 text-xs text-slate-500">
                    <span>Last sync: {feed.lastFetch ? new Date(feed.lastFetch).toLocaleString() : 'never'}</span>
                    <span>•</span>
                    <span>{feed.totalIocs ?? 0} IOCs</span>
                    <span>•</span>
                    <span>Health: {feed.healthScore ?? 0}%</span>
                  </div>
                </div>
                <Toggle checked={feed.enabled} onChange={(v) => patchFeed.mutate({ id: feed.id, enabled: v })} />
              </div>
              <div className="mt-3 flex items-center space-x-2">
                <select className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200"
                  value={feed.frequency} onChange={(e) => patchFeed.mutate({ id: feed.id, frequency: e.target.value })}>
                  <option value="15min">Every 15 min</option>
                  <option value="30min">Every 30 min</option>
                  <option value="hourly">Hourly</option>
                  <option value="6h">Every 6 hours</option>
                  <option value="daily">Daily</option>
                </select>
                <Button size="sm" variant="outline" disabled={syncFeed.isPending} onClick={() => syncFeed.mutate(feed.id)}>
                  <RefreshCw className={`mr-2 h-3 w-3 ${syncFeed.isPending ? 'animate-spin' : ''}`} /> Sync Now
                </Button>
              </div>
            </div>
          ))}
          {feeds.length === 0 && <div className="text-sm text-slate-400">No threat feeds configured.</div>}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------- Security ----------------
function SecurityPanel() {
  const { data: settings } = usePlatformSettings()
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })

  const changePassword = useMutation({
    mutationFn: async () => {
      await api.post('/auth/change-password', { currentPassword: pwd.current, newPassword: pwd.next })
    },
    onSuccess: () => { toast.success('Password changed'); setPwd({ current: '', next: '', confirm: '' }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to change password'),
  })

  const { data: audit = [] } = useQuery<any[]>({
    queryKey: ['login-audit'],
    queryFn: async () => {
      const { data } = await api.get('/auth/audit-log')
      return data.data || []
    },
  })

  const submit = () => {
    if (pwd.next !== pwd.confirm) return toast.error('Passwords do not match')
    changePassword.mutate()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-slate-400">Current Password</label>
              <Input className="mt-1" type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-slate-400">New Password</label>
              <Input className="mt-1" type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
              <p className="mt-1 text-xs text-slate-500">Min 12 chars, with uppercase, lowercase, number and special character.</p>
            </div>
            <div>
              <label className="text-sm text-slate-400">Confirm New Password</label>
              <Input className="mt-1" type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
            </div>
            <Button variant="primary" disabled={changePassword.isPending || !pwd.current || !pwd.next} onClick={submit}>
              {changePassword.isPending ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Session & Tokens</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Session Timeout</span>
            <span className="text-slate-200">{settings?.session_timeout_hours || '24'} hours</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Login Activity</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {audit.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded border border-slate-700 bg-slate-800/40 px-3 py-2 text-sm">
                <div>
                  <span className="text-slate-200">{u.username}</span>
                  <span className="ml-2 text-xs text-slate-500">{u.role}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'never'}
                  {u.failedLoginAttempts > 0 && <span className="ml-2 text-red-400">{u.failedLoginAttempts} failed</span>}
                </div>
              </div>
            ))}
            {audit.length === 0 && <div className="text-sm text-slate-400">No login activity.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------- API Keys ----------------
const SERVICE_LABELS: Record<string, string> = {
  virustotal: 'VirusTotal',
  abuseipdb: 'AbuseIPDB',
  shodan: 'Shodan',
  otx: 'AlienVault OTX',
}

function ApiKeysPanel() {
  const { data: keys = [], isLoading, saveKey, testKey, deleteKey } = useApiKeys()
  const [editing, setEditing] = useState<string | null>(null)
  const [value, setValue] = useState('')

  if (isLoading) return <div className="text-sm text-slate-400">Loading API keys...</div>

  return (
    <Card>
      <CardHeader><CardTitle>Enrichment API Keys</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {keys.map((k) => (
            <div key={k.service} className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <Circle className={`h-2.5 w-2.5 ${k.isActive && k.configured ? 'fill-green-500 text-green-500' : 'fill-slate-600 text-slate-600'}`} />
                    <h4 className="font-semibold text-slate-100">{SERVICE_LABELS[k.service] || k.service}</h4>
                    {k.source === 'env' && <Badge variant="info">env</Badge>}
                    {k.lastTestStatus === 'ok' && <Badge variant="success">Valid</Badge>}
                    {k.lastTestStatus === 'fail' && <Badge variant="danger">Invalid</Badge>}
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-400">{k.configured ? k.keyMasked : 'Not configured'}</p>
                </div>
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(editing === k.service ? null : k.service); setValue('') }}>
                    {editing === k.service ? 'Close' : 'Edit'}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={testKey.isPending} title="Test key"
                    onClick={() => testKey.mutate({ service: k.service })}>
                    {testKey.isPending && testKey.variables?.service === k.service
                      ? <RefreshCw className="h-4 w-4 animate-spin" />
                      : <CheckCircle2 className="h-4 w-4 text-cyan-400" />}
                  </Button>
                  {k.configured && k.source !== 'env' && (
                    <Button size="sm" variant="ghost" title="Remove key"
                      onClick={() => { if (confirm(`Remove ${SERVICE_LABELS[k.service]} key?`)) deleteKey.mutate(k.service) }}>
                      <XCircle className="h-4 w-4 text-red-400" />
                    </Button>
                  )}
                </div>
              </div>
              {editing === k.service && (
                <div className="mt-3 flex items-center space-x-2 border-t border-slate-700 pt-3">
                  <Input className="flex-1 font-mono" type="password" placeholder="Paste API key" value={value} onChange={(e) => setValue(e.target.value)} />
                  <Button size="sm" variant="primary" disabled={!value || saveKey.isPending}
                    onClick={() => saveKey.mutate({ service: k.service, key: value }, { onSuccess: () => { setEditing(null); setValue('') } })}>
                    Save
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------- Main ----------------
export default function Settings() {
  const [activeTab, setActiveTab] = useState('General')
  const tabs = [
    { icon: SettingsIcon, label: 'General' },
    { icon: Bell, label: 'Notifications' },
    { icon: Users, label: 'Users & Permissions' },
    { icon: Database, label: 'Data Sources' },
    { icon: Shield, label: 'Security' },
    { icon: Key, label: 'API Keys' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-100">Settings & Configuration</h1>
        <p className="text-slate-400">Manage platform settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-2">
          <Card>
            <CardContent className="space-y-1 p-2">
              {tabs.map((item) => (
                <button key={item.label} onClick={() => setActiveTab(item.label)}
                  className={`flex w-full items-center space-x-3 rounded-md px-3 py-2 text-left text-sm ${
                    activeTab === item.label ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                  }`}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'General' && <GeneralPanel />}
          {activeTab === 'Notifications' && <NotificationsPanel />}
          {activeTab === 'Users & Permissions' && (
            <Card>
              <CardHeader><CardTitle>Users &amp; Permissions</CardTitle></CardHeader>
              <CardContent><UserManagementPanel /></CardContent>
            </Card>
          )}
          {activeTab === 'Data Sources' && <DataSourcesPanel />}
          {activeTab === 'Security' && <SecurityPanel />}
          {activeTab === 'API Keys' && <ApiKeysPanel />}
        </div>
      </div>
    </div>
  )
}
