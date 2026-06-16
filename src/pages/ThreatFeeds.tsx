import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  Rss, Plus, Play, Pause, RefreshCw, Settings, Trash2,
  CheckCircle, AlertCircle, XCircle, Shield, X, Save, Zap,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { formatRelativeTime, formatNumber } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useSocketCtx } from '@/providers/SocketProvider'

interface Feed {
  id: string
  name: string
  url: string
  type: string
  status: 'active' | 'paused' | 'error'
  frequency: string
  enabled: boolean
  lastFetch: string | null
  iocsImported: number
  totalIocs: number
  healthScore: number
  errorMessage: string | null
  errorCount: number
}

const FEED_ICON: Record<string, string> = {
  virustotal: '🛡️',
  abuse: '🚫',
  shodan: '🌐',
  alienvault: '👽',
  otx: '👽',
  misp: '🔗',
  urlhaus: '🔗',
  threatfox: '🦊',
  feodo: '🕷️',
  bazaar: '📦',
  xforce: '💼',
  ibm: '💼',
  blocklist: '🚧',
  cins: '🔒',
}

function getFeedIcon(name: string) {
  const lower = name.toLowerCase()
  for (const [key, icon] of Object.entries(FEED_ICON)) {
    if (lower.includes(key)) return icon
  }
  return '📡'
}

function getStatusIcon(status: string) {
  if (status === 'active') return <CheckCircle className="h-5 w-5 text-green-500" />
  if (status === 'error') return <XCircle className="h-5 w-5 text-red-500" />
  return <AlertCircle className="h-5 w-5 text-yellow-500" />
}

function healthColor(score: number) {
  if (score >= 80) return 'bg-green-500'
  if (score >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function ThreatFeeds() {
  const queryClient = useQueryClient()
  const { socket } = useSocketCtx()

  const [showAddModal, setShowAddModal] = useState(false)
  const [editFeed, setEditFeed] = useState<Feed | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [newFeed, setNewFeed] = useState({ name: '', url: '', type: 'csv', frequency: 'hourly' })
  const [editForm, setEditForm] = useState({ name: '', url: '', type: 'csv', frequency: 'hourly' })
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!showAddModal) return
    firstInputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowAddModal(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showAddModal])

  // Socket: auto-refetch on feed events
  useEffect(() => {
    if (!socket) return
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['threat-feeds'] })
    socket.on('feed:synced', refresh)
    socket.on('feed:error', refresh)
    return () => { socket.off('feed:synced', refresh); socket.off('feed:error', refresh) }
  }, [socket, queryClient])

  const { data: feedsData, isLoading, refetch } = useQuery({
    queryKey: ['threat-feeds'],
    queryFn: async () => {
      const { data } = await api.get('/feeds')
      return data.data as Feed[]
    },
    refetchInterval: 30000,
  })

  const feeds = Array.isArray(feedsData) ? feedsData : []
  const activeFeeds = feeds.filter(f => f.enabled && f.status !== 'error').length
  const totalIOCs = feeds.reduce((s, f) => s + (f.totalIocs || 0), 0)
  const errorFeeds = feeds.filter(f => f.status === 'error').length

  const handleSyncFeed = async (feedId: string) => {
    setSyncingId(feedId)
    try {
      const { data } = await api.post(`/feeds/${feedId}/sync`, {}, { timeout: 30000 })
      const r = data?.data
      await refetch()
      toast.success(r ? `Sync complete — ${r.inserted ?? 0} new IOCs (${r.parsed ?? 0} parsed)` : 'Feed synced')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Feed sync failed')
    } finally {
      setSyncingId(null)
    }
  }

  const handleSyncAll = async () => {
    setSyncingAll(true)
    try {
      const { data } = await api.post('/feeds/sync-all?wait=true', {}, { timeout: 120000 })
      const r = data?.data
      await refetch()
      toast.success(`All feeds synced — ${r?.insertedTotal ?? 0} new IOCs across ${r?.successfulFeeds ?? 0} feeds`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Sync all failed')
    } finally {
      setSyncingAll(false)
    }
  }

  const handleToggle = async (feed: Feed) => {
    const nextEnabled = !feed.enabled
    try {
      await api.patch(`/feeds/${feed.id}`, { enabled: nextEnabled, status: nextEnabled ? 'active' : 'paused' })
      await refetch()
      toast.success(nextEnabled ? `${feed.name} resumed` : `${feed.name} paused`)
    } catch (err: any) {
      toast.error('Failed to toggle feed')
    }
  }

  const handleDelete = async (feedId: string) => {
    try {
      await api.delete(`/feeds/${feedId}`)
      setDeleteConfirm(null)
      await refetch()
      toast.success('Feed deleted')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete feed')
    }
  }

  const handleAddFeed = async () => {
    if (!newFeed.name.trim() || !newFeed.url.trim()) {
      toast.error('Name and URL are required')
      return
    }
    try {
      await api.post('/feeds', newFeed)
      toast.success('Feed added')
      setNewFeed({ name: '', url: '', type: 'csv', frequency: 'hourly' })
      setShowAddModal(false)
      await refetch()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add feed')
    }
  }

  const openEdit = (feed: Feed) => {
    setEditForm({ name: feed.name, url: feed.url, type: feed.type, frequency: feed.frequency })
    setEditFeed(feed)
  }

  const handleSaveEdit = async () => {
    if (!editFeed) return
    try {
      await api.patch(`/feeds/${editFeed.id}`, editForm)
      setEditFeed(null)
      await refetch()
      toast.success('Feed updated')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update feed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Threat Intelligence Feeds</h1>
          <p className="text-slate-400">{feeds.length} configured • {activeFeeds} active • {errorFeeds > 0 ? `${errorFeeds} errors` : 'all healthy'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleSyncAll} disabled={syncingAll}>
            <Zap className={`mr-2 h-4 w-4 ${syncingAll ? 'animate-pulse' : ''}`} />
            {syncingAll ? 'Syncing All...' : 'Sync All'}
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Feed
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Active Feeds</p>
                <p className="mt-2 text-2xl font-bold text-green-500">{activeFeeds}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Feeds</p>
                <p className="mt-2 text-2xl font-bold text-blue-500">{feeds.length}</p>
              </div>
              <Rss className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total IOCs</p>
                <p className="mt-2 text-2xl font-bold text-purple-500">{formatNumber(totalIOCs)}</p>
              </div>
              <Shield className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Errors</p>
                <p className="mt-2 text-2xl font-bold text-red-500">{errorFeeds}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feed Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-800/60" />
          ))}
        </div>
      ) : feeds.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Rss className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-4 text-slate-400">No threat feeds configured yet.</p>
            <Button variant="primary" className="mt-4" onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Feed
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {feeds.map((feed) => (
            <Card key={feed.id} className={feed.status === 'error' ? 'border-red-700/50' : ''}>
              <CardContent>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-500/10 p-3 text-2xl">
                      {getFeedIcon(feed.name)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-100">{feed.name}</h4>
                      <p className="text-xs uppercase tracking-wider text-slate-500">{feed.type} • {feed.frequency}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(feed.status)}
                    <Badge variant={feed.enabled ? 'success' : 'default'} className="ml-1">
                      {feed.enabled ? 'ON' : 'OFF'}
                    </Badge>
                  </div>
                </div>

                {/* Health bar */}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                    <span>Health Score</span>
                    <span className={feed.healthScore >= 80 ? 'text-green-400' : feed.healthScore >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                      {feed.healthScore ?? 100}%
                    </span>
                  </div>
                  <Progress
                    value={feed.healthScore ?? 100}
                    barClassName={healthColor(feed.healthScore ?? 100)}
                  />
                </div>

                {/* Stats */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Last Sync</span>
                    <span className="text-slate-300">{feed.lastFetch ? formatRelativeTime(feed.lastFetch) : 'Never'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Total IOCs</span>
                    <Badge variant="success">{formatNumber(feed.totalIocs || 0)}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Last Batch</span>
                    <span className="text-slate-300">
                      {feed.iocsImported > 0 ? `+${formatNumber(feed.iocsImported)} new` : '0 new'}
                    </span>
                  </div>
                  {feed.errorCount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Errors</span>
                      <span className="text-red-400">{feed.errorCount} consecutive</span>
                    </div>
                  )}
                </div>

                {/* Error message */}
                {feed.status === 'error' && feed.errorMessage && (
                  <div className="mt-3 rounded border border-red-500/30 bg-red-950/30 p-2 text-xs text-red-400">
                    {feed.errorMessage}
                  </div>
                )}

                {/* URL */}
                <p className="mt-3 truncate text-[11px] text-slate-600" title={feed.url}>{feed.url}</p>

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleSyncFeed(feed.id)}
                    disabled={syncingId === feed.id || syncingAll}
                  >
                    <RefreshCw className={`mr-1 h-3 w-3 ${syncingId === feed.id ? 'animate-spin' : ''}`} />
                    {syncingId === feed.id ? 'Syncing…' : 'Sync'}
                  </Button>
                  <Button size="sm" variant="ghost" title={feed.enabled ? 'Pause feed' : 'Resume feed'} onClick={() => handleToggle(feed)}>
                    {feed.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" title="Edit feed" onClick={() => openEdit(feed)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Delete feed"
                    onClick={() => setDeleteConfirm(feed.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>

                {/* Inline delete confirm */}
                {deleteConfirm === feed.id && (
                  <div className="mt-3 rounded border border-red-500/40 bg-red-950/30 p-3">
                    <p className="text-xs text-red-300">Delete <strong>{feed.name}</strong>? This cannot be undone.</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="danger" onClick={() => handleDelete(feed.id)}>Delete</Button>
                      <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Feed Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false) }}
        >
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add New Threat Feed</CardTitle>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400">Feed Name</label>
                  <input
                    ref={firstInputRef}
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    placeholder="e.g., Abuse.ch URLhaus"
                    value={newFeed.name}
                    onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Feed URL</label>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    placeholder="https://..."
                    value={newFeed.url}
                    onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400">Type</label>
                    <select
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      value={newFeed.type}
                      onChange={(e) => setNewFeed({ ...newFeed, type: e.target.value })}
                    >
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                      <option value="xml">XML</option>
                      <option value="stix">STIX</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Frequency</label>
                    <select
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      value={newFeed.frequency}
                      onChange={(e) => setNewFeed({ ...newFeed, frequency: e.target.value })}
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="primary" onClick={handleAddFeed}>Add Feed</Button>
                  <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Feed Modal */}
      {editFeed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setEditFeed(null) }}
        >
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Edit Feed — {editFeed.name}</CardTitle>
                <button onClick={() => setEditFeed(null)} className="text-slate-400 hover:text-slate-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400">Feed Name</label>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Feed URL</label>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                    value={editForm.url}
                    onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400">Type</label>
                    <select
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      value={editForm.type}
                      onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    >
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                      <option value="xml">XML</option>
                      <option value="stix">STIX</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Frequency</label>
                    <select
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                      value={editForm.frequency}
                      onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })}
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="primary" onClick={handleSaveEdit}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setEditFeed(null)}>Cancel</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
