import { useState, useMemo, useCallback } from 'react'
import { AlertTriangle, Shield, ShieldCheck, Database, TrendingUp, TrendingDown, RefreshCw, Filter, Download, X } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Button } from '@/components/ui/Button'
import { useDashboardOverview, useRealtimePulse } from '@/hooks/useDashboard'
import { formatNumber, formatRelativeTime } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar,
} from 'recharts'

type BadgeVariant = 'default' | 'critical' | 'high' | 'medium' | 'low' | 'success' | 'warning' | 'danger'

function mapSeverity(severity: string): BadgeVariant {
  if (['critical', 'high', 'medium', 'low', 'success', 'warning', 'danger'].includes(severity)) {
    return severity as BadgeVariant
  }
  return 'default'
}

// Skeleton loader primitive
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-700/60 ${className}`} />
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <div className="text-center">
        <Skeleton className="mx-auto h-32 w-48 rounded-lg" />
        <p className="mt-3 text-xs text-slate-500">Loading chart data…</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [dayRange, setDayRange] = useState(30)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [syncingFeedId, setSyncingFeedId] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const { data: overview, isLoading, isFetching } = useDashboardOverview(dayRange, 10)
  const { pulse } = useRealtimePulse()

  const stats = overview?.stats
  const trendData = overview?.threatTrend || []
  const distribution = overview?.iocDistribution || []
  const topTechniques = overview?.topTechniques || []
  const threatActors = overview?.threatActors || []
  const allRecentThreats = overview?.recentThreats || []
  const recentThreats = severityFilter
    ? allRecentThreats.filter((t: any) => t.severity === severityFilter)
    : allRecentThreats
  const feeds = overview?.feedHealth || []

  const pressureData = useMemo(
    () => trendData.map((t: any) => ({
      date: t.date,
      pressure: (t.critical || 0) * 4 + (t.high || 0) * 3 + (t.medium || 0) * 2 + (t.low || 0),
    })),
    [trendData]
  )

  // Slim X-axis labels so they don't crowd
  const chartTrendData = useMemo(() => {
    if (trendData.length <= 14) return trendData
    return trendData.filter((_: any, i: number) => i % Math.ceil(trendData.length / 14) === 0 || i === trendData.length - 1)
  }, [trendData])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await api.post('/dashboard/invalidate-cache')
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Dashboard refreshed')
    } catch {
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Dashboard refreshed')
    } finally {
      setIsRefreshing(false)
    }
  }, [queryClient])

  const handleExport = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      stats,
      threatTrend: trendData,
      recentThreats: allRecentThreats,
      feedHealth: feeds,
      topTechniques,
      threatActors,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cyforesight-dashboard-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Dashboard exported')
  }, [stats, trendData, allRecentThreats, feeds, topTechniques, threatActors])

  const handleFetchNow = useCallback(async (feedId: string, feedName: string) => {
    setSyncingFeedId(feedId)
    try {
      const { data } = await api.post(`/feeds/${feedId}/sync`, {}, { timeout: 30000 })
      const result = data?.data
      toast.success(`${feedName}: ${result?.inserted ?? 0} new IOCs synced`)
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to sync ${feedName}`)
    } finally {
      setSyncingFeedId(null)
    }
  }, [queryClient])

  const handleInvestigate = useCallback((threat: any) => {
    toast.info(`Opening investigation for: ${threat.name}`)
  }, [])

  const handleBlock = useCallback(async (threat: any) => {
    try {
      await api.post(`/iocs/block`, { value: threat.name, id: threat.id })
      toast.success(`Blocked: ${threat.name}`)
    } catch {
      toast.error('Block action unavailable — mark manually in IOC view')
    }
  }, [])

  const handleDismiss = useCallback(async (threat: any) => {
    try {
      await api.patch(`/threats/${threat.id}`, { status: 'dismissed' })
      toast.success('Threat dismissed')
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch {
      toast.info('Dismissed (local view only)')
    }
  }, [queryClient])

  const tooltipStyle = { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Threat Dashboard</h1>
          <p className="text-slate-400">Real-time threat overview · last {dayRange} days</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowFilterPanel((v) => !v)}
            aria-label="Filter dashboard"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing || isFetching}
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing || isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="primary" onClick={handleExport} aria-label="Export dashboard data">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilterPanel && (
        <Card className="border-cyan-500/30">
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-slate-300">Time range:</span>
              {([7, 14, 30, 60, 90] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => { setDayRange(d); setShowFilterPanel(false) }}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    dayRange === d
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {d}d
                </button>
              ))}
              <button
                onClick={() => setShowFilterPanel(false)}
                className="ml-auto text-slate-400 hover:text-slate-200"
                aria-label="Close filter panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Realtime Pulse Strip */}
      {pulse && (
        <Card>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Live IOCs</p>
                <p className="text-xl font-bold text-cyan-300">{formatNumber(pulse.totalIocs || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">New (24h)</p>
                <p className="text-xl font-bold text-red-400">{formatNumber(pulse.newThreats || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Assets At Risk</p>
                <p className="text-xl font-bold text-amber-300">{formatNumber(pulse.assetsAtRisk || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Open Incidents</p>
                <p className="text-xl font-bold text-violet-300">{formatNumber(pulse.incidentsOpen || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          [0, 1, 2, 3].map((i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <Card hoverable>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Critical Threats</p>
                    <p className="mt-2 text-3xl font-bold text-red-500">{formatNumber(stats?.criticalThreats || 0)}</p>
                    <div className="mt-2 flex items-center text-sm">
                      {(stats?.criticalChange || 0) >= 0 ? (
                        <TrendingUp className="mr-1 h-4 w-4 text-red-500" />
                      ) : (
                        <TrendingDown className="mr-1 h-4 w-4 text-green-500" />
                      )}
                      <span className={(stats?.criticalChange || 0) > 0 ? 'text-red-500' : 'text-green-500'}>
                        {Math.abs(stats?.criticalChange || 0)}%
                      </span>
                      <span className="ml-1 text-slate-400">vs last week</span>
                    </div>
                  </div>
                  <div className="rounded-full bg-red-500/10 p-3">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card hoverable>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Total IOCs</p>
                    <p className="mt-2 text-3xl font-bold text-blue-500">{formatNumber(stats?.totalIOCs || 0)}</p>
                    <div className="mt-2 text-xs text-slate-400">
                      IP: {formatNumber(stats?.iocBreakdown?.ip || 0)} · Domain: {formatNumber(stats?.iocBreakdown?.domain || 0)}
                    </div>
                  </div>
                  <div className="rounded-full bg-blue-500/10 p-3">
                    <Shield className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card hoverable>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Blocked Threats</p>
                    <p className="mt-2 text-3xl font-bold text-green-500">{formatNumber(stats?.blockedThreats || 0)}</p>
                    <div className="mt-2 text-sm text-green-500">Active blocks</div>
                  </div>
                  <div className="rounded-full bg-green-500/10 p-3">
                    <ShieldCheck className="h-6 w-6 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card hoverable>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Assets at Risk</p>
                    <p className="mt-2 text-3xl font-bold text-orange-500">{formatNumber(stats?.assetsAtRisk || 0)}</p>
                    <div className="mt-2 text-xs text-slate-400">With active threats</div>
                  </div>
                  <div className="rounded-full bg-orange-500/10 p-3">
                    <Database className="h-6 w-6 text-orange-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Threat Activity Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Threat Activity Trend ({dayRange}d)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : trendData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-slate-500 text-sm">
                No IOC data in the last {dayRange} days
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="high" stroke="#f97316" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="medium" stroke="#eab308" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="low" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* IOC Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>IOC Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : distribution.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-slate-500 text-sm">No IOCs found</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="count"
                    nameKey="type"
                    label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {distribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Threat Pressure Index */}
        <Card>
          <CardHeader>
            <CardTitle>Threat Pressure Index</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : pressureData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-slate-500 text-sm">
                No pressure data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={pressureData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="pressure"
                    stroke="#22d3ee"
                    fill="#0891b233"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Threat Detections */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Recent Threat Detections</CardTitle>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {(['critical', 'high', 'medium', 'low'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(severityFilter === sev ? '' : sev)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      severityFilter === sev
                        ? sev === 'critical' ? 'bg-red-600 text-white'
                          : sev === 'high' ? 'bg-orange-600 text-white'
                          : sev === 'medium' ? 'bg-yellow-600 text-white'
                          : 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-lg border border-slate-700 bg-slate-700/20 p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : recentThreats.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                {severityFilter ? `No ${severityFilter} threats found` : 'No recent threats detected'}
              </div>
            ) : (
              <div className="space-y-4">
                {recentThreats.map((threat: any) => (
                  <div key={threat.id} className="rounded-lg border border-slate-700 bg-slate-700/30 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={mapSeverity(threat.severity)}>{threat.severity}</Badge>
                          <span className="font-semibold text-slate-100 truncate">{threat.name}</span>
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            {formatRelativeTime(threat.timestamp)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                          <span>Assets: {threat.affectedAssets}</span>
                          <span>IOCs: {threat.iocCount}</span>
                          {threat.techniques?.length > 0 && (
                            <span>Techniques: {(threat.techniques || []).slice(0, 2).join(', ')}</span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-slate-400">Confidence</span>
                          <Progress value={threat.confidence} className="w-24" />
                          <span className="text-xs text-slate-400">{threat.confidence}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="primary" onClick={() => handleInvestigate(threat)}>
                        Investigate
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleBlock(threat)}>
                        Block
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDismiss(threat)}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top MITRE Techniques */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top MITRE ATT&CK Techniques</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => window.location.href = '/mitre'}>
                View Matrix
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : topTechniques.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">No MITRE techniques loaded yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-sm text-slate-400">
                      <th className="pb-2">Technique</th>
                      <th className="pb-2">Detections</th>
                      <th className="pb-2">Trend</th>
                      <th className="pb-2">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTechniques.map((technique: any) => (
                      <tr key={technique.id} className="border-b border-slate-700/50">
                        <td className="py-3">
                          <div>
                            <span className="font-mono text-sm text-blue-400">{technique.techniqueId || technique.id}</span>
                            <p className="text-sm text-slate-300">{technique.name}</p>
                          </div>
                        </td>
                        <td className="py-3 font-semibold text-slate-100">{technique.detections}</td>
                        <td className="py-3">
                          {technique.trend === 'up' && <TrendingUp className="h-4 w-4 text-red-500" />}
                          {technique.trend === 'down' && <TrendingDown className="h-4 w-4 text-green-500" />}
                        </td>
                        <td className="py-3">
                          <Badge variant={mapSeverity(technique.severity)}>{technique.severity}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feed Health Status */}
      <Card>
        <CardHeader>
          <CardTitle>Threat Feed Health Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-lg border border-slate-700 p-4 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : feeds.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No active feeds configured</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {feeds.map((feed: any) => (
                <div key={feed.id} className="rounded-lg border border-slate-700 bg-slate-700/30 p-4">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-slate-100 truncate">{feed.name}</h4>
                    <div className={`ml-2 h-3 w-3 flex-shrink-0 rounded-full ${
                      feed.status === 'active' ? 'bg-green-500'
                        : feed.status === 'warning' || feed.status === 'paused' ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`} />
                  </div>
                  <div className="mt-4 space-y-1.5 text-sm text-slate-400">
                    <p>Last Fetch: {feed.lastFetch ? formatRelativeTime(feed.lastFetch) : 'Never'}</p>
                    <p>IOCs Today: {formatNumber(feed.iocsToday || 0)}</p>
                    <p>Total IOCs: {formatNumber(feed.totalIOCs || 0)}</p>
                    <p>Frequency: {feed.frequency || 'Manual'}</p>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Health</span>
                      <span>{feed.healthScore || 100}%</span>
                    </div>
                    <Progress
                      value={feed.healthScore || 100}
                      className="mt-1"
                      barClassName={
                        (feed.healthScore || 100) >= 90 ? 'bg-green-500'
                          : (feed.healthScore || 100) >= 70 ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }
                    />
                  </div>
                  {feed.errorMessage && (
                    <p className="mt-2 rounded border border-red-500/20 bg-red-500/10 p-1.5 text-xs text-red-400">
                      {feed.errorMessage}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleFetchNow(feed.id, feed.name)}
                      disabled={syncingFeedId === feed.id}
                    >
                      <RefreshCw className={`mr-1 h-3 w-3 ${syncingFeedId === feed.id ? 'animate-spin' : ''}`} />
                      {syncingFeedId === feed.id ? 'Syncing…' : 'Fetch Now'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feed IOC Volume Bar Chart */}
      {!isLoading && feeds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Feed IOC Volume (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={feeds.map((f: any) => ({ name: f.name.slice(0, 16), iocs: f.iocsToday || 0, total: f.totalIOCs || 0 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="iocs" name="Today" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Threat Actor Intelligence */}
      <Card>
        <CardHeader>
          <CardTitle>Threat Actor Signals From IOC Feeds</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : threatActors.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No actor signals identified yet. Run a feed sync to ingest IOCs.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {threatActors.slice(0, 6).map((actor: any) => (
                <div key={actor.actor} className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-100 truncate">{actor.actor}</span>
                    <Badge variant="danger">{actor.iocCount}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Last seen: {formatRelativeTime(actor.latestSeen)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
