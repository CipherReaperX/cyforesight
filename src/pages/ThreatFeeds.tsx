import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Rss, Plus, Play, Pause, RefreshCw, Settings, Trash2, CheckCircle, AlertCircle, XCircle, Shield, Globe } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { formatRelativeTime, formatNumber } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export default function ThreatFeeds() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [newFeed, setNewFeed] = useState({ name: '', url: '', type: 'json' })
  const firstInputRef = useRef<HTMLInputElement>(null)

  // Escape key + focus management for modal
  useEffect(() => {
    if (!showAddModal) return
    firstInputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowAddModal(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showAddModal])
  
  // Fetch all threat feeds/integrations
  const { data: feedsData, isLoading, refetch } = useQuery({
    queryKey: ['threat-feeds'],
    queryFn: async () => {
      const response = await api.get('/feeds')
      return response.data.data;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds for live updates
  })

  const feeds = Array.isArray(feedsData) ? feedsData : []

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case 'error':
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-slate-500" />
    }
  }

  const getFeedIcon = (name: string) => {
    const lowerName = name.toLowerCase()
    if (lowerName.includes('virustotal')) return '🛡️'
    if (lowerName.includes('abuse')) return '🚫'
    if (lowerName.includes('shodan')) return '🌐'
    if (lowerName.includes('alienvault') || lowerName.includes('otx')) return '👽'
    if (lowerName.includes('misp')) return '🔗'
    if (lowerName.includes('urlhaus')) return '🔗'
    if (lowerName.includes('xforce') || lowerName.includes('ibm')) return '💼'
    return '📡'
  }

  // Calculate stats safely
  const activeFeeds = feeds.filter(f => f.enabled || f.isActive || f.status === 'active' || f.status === 'connected').length
  const totalIOCs = feeds.reduce((sum, f) => sum + (f.totalIocs || f.iocCount || f.totalIOCs || 0), 0)

  const handleSyncFeed = async (feedId: string) => {
    setSyncingId(feedId)
    try {
      const { data } = await api.post(`/feeds/${feedId}/sync`, {}, { timeout: 30000 })
      const result = data?.data
      refetch()
      toast.success(result ? `Sync done — ${result.inserted ?? 0} new IOCs` : 'Feed synced')
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to sync feed')
    } finally {
      setSyncingId(null)
    }
  }

  const handleAddFeed = async () => {
    if (!newFeed.name.trim() || !newFeed.url.trim()) {
      toast.error('Name and URL are required')
      return
    }
    try {
      await api.post('/feeds', { name: newFeed.name, url: newFeed.url, type: newFeed.type })
      toast.success('Feed added successfully')
      setNewFeed({ name: '', url: '', type: 'json' })
      setShowAddModal(false)
      refetch()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to add feed')
    }
  }

  const handleToggleFeed = async (feedId: string, currentStatus: boolean) => {
    try {
      await api.patch(`/feeds/${feedId}`, { isActive: !currentStatus })
      refetch()
    } catch (error) {
      console.error('Failed to toggle feed:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Threat Intelligence Feeds</h1>
          <p className="text-slate-400">{feeds.length} feeds configured • {activeFeeds} active</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh All
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Feed
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
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
                <p className="text-sm text-slate-400">Failed</p>
                <p className="mt-2 text-2xl font-bold text-red-500">
                  {feeds.filter(f => f.status === 'error' || f.status === 'failed').length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feeds Grid */}
      {isLoading ? (
        <Card>
          <div className="py-12 text-center text-slate-400">Loading feeds...</div>
        </Card>
      ) : feeds.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-slate-400">
            <Rss className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-4">No threat feeds configured yet.</p>
            <Button variant="primary" className="mt-4" onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Feed
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {feeds.map((feed) => (
            <Card key={feed.id} hoverable>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="rounded-lg bg-blue-500/10 p-3 text-2xl">
                      {getFeedIcon(feed.name)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-100">{feed.name || 'Unnamed Feed'}</h4>
                      <p className="text-xs text-slate-400">
                        {feed.type || feed.feedType || 'External API'}
                      </p>
                    </div>
                  </div>
                  {getStatusIcon(feed.status || (feed.isActive ? 'active' : 'inactive'))}
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Last Sync</span>
                    <span className="text-slate-300">
                      {feed.lastFetch
                        ? formatRelativeTime(feed.lastFetch)
                        : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Total IOCs</span>
                    <Badge variant="success">
                      {formatNumber(feed.totalIocs || 0)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Frequency</span>
                    <span className="text-slate-300 capitalize">
                      {feed.frequency || 'Manual'}
                    </span>
                  </div>
                  {feed.url && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Endpoint</span>
                      <span className="truncate text-xs text-slate-500 max-w-[150px]">
                        {feed.url}
                      </span>
                    </div>
                  )}
                </div>

                {(feed.status === 'error' || feed.status === 'failed') && feed.errorMessage && (
                  <div className="mt-3 rounded border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-400">
                    {feed.errorMessage}
                  </div>
                )}

                <div className="mt-4 flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleSyncFeed(feed.id)}
                    disabled={syncingId === feed.id}
                  >
                    <RefreshCw className={`mr-1 h-3 w-3 ${syncingId === feed.id ? 'animate-spin' : ''}`} />
                    {syncingId === feed.id ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleToggleFeed(feed.id, Boolean(feed.enabled ?? feed.isActive))}
                  >
                    {feed.enabled || feed.isActive || feed.status === 'active' ? 
                      <Pause className="h-4 w-4" /> : 
                      <Play className="h-4 w-4" />
                    }
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
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
          aria-labelledby="add-feed-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false) }}
        >
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle id="add-feed-title">Add New Threat Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label htmlFor="feed-name" className="text-sm text-slate-400">Feed Name</label>
                  <input
                    id="feed-name"
                    ref={firstInputRef}
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder="e.g., AlienVault OTX"
                    value={newFeed.name}
                    onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="feed-url" className="text-sm text-slate-400">Feed URL</label>
                  <input
                    id="feed-url"
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder="https://..."
                    value={newFeed.url}
                    onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="feed-type" className="text-sm text-slate-400">Feed Type</label>
                  <select
                    id="feed-type"
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    value={newFeed.type}
                    onChange={(e) => setNewFeed({ ...newFeed, type: e.target.value })}
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                    <option value="xml">XML</option>
                    <option value="stix">STIX</option>
                  </select>
                </div>
                <div className="flex space-x-3 pt-2">
                  <Button variant="primary" onClick={handleAddFeed}>Add Feed</Button>
                  <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
