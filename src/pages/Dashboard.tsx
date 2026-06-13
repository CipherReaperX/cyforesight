import { useState, useMemo } from 'react'
import { AlertTriangle, Shield, ShieldCheck, Database, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Button } from '@/components/ui/Button'
import {
  useDashboardOverview,
  useRealtimePulse,
} from '@/hooks/useDashboard'
import { formatNumber, formatRelativeTime } from '@/lib/utils'
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts'

type BadgeVariant = 'default' | 'critical' | 'high' | 'medium' | 'low' | 'success' | 'warning' | 'danger'

function mapSeverity(severity: string): BadgeVariant {
  if (severity === 'info') {
    return 'default'
  }
  if (['critical', 'high', 'medium', 'low', 'success', 'warning', 'danger'].includes(severity)) {
    return severity as BadgeVariant
  }
  return 'default'
}

export default function Dashboard() {
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const { data: overview, isLoading: statsLoading } = useDashboardOverview(30, 10)
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
    () => trendData.map((t) => ({
      date: t.date,
      pressure: (t.critical || 0) * 4 + (t.high || 0) * 3 + (t.medium || 0) * 2 + (t.low || 0),
    })),
    [trendData]
  )

  if (statsLoading) {
    return <div className="text-slate-400">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Threat Dashboard</h1>
          <p className="text-slate-400">Real-time threat overview and analytics</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">Filter</Button>
          <Button variant="outline">Refresh</Button>
          <Button variant="primary">Export</Button>
        </div>
      </div>

      {/* Summary Cards */}
      {pulse && (
        <Card>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div><p className="text-xs text-slate-400">Realtime IOCs</p><p className="text-xl font-bold text-cyan-300">{formatNumber(pulse.totalIocs || 0)}</p></div>
              <div><p className="text-xs text-slate-400">New Threats</p><p className="text-xl font-bold text-red-400">{formatNumber(pulse.newThreats || 0)}</p></div>
              <div><p className="text-xs text-slate-400">Assets At Risk</p><p className="text-xl font-bold text-amber-300">{formatNumber(pulse.assetsAtRisk || 0)}</p></div>
              <div><p className="text-xs text-slate-400">Open Incidents</p><p className="text-xl font-bold text-violet-300">{formatNumber(pulse.incidentsOpen || 0)}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Critical Threats */}
        <Card hoverable>
          <CardContent>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Critical Threats</p>
                <p className="mt-2 text-3xl font-bold text-red-500">{stats?.criticalThreats || 0}</p>
                <div className="mt-2 flex items-center text-sm">
                  {(stats?.criticalChange || 0) > 0 ? (
                    <TrendingUp className="mr-1 h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingDown className="mr-1 h-4 w-4 text-green-500" />
                  )}
                  <span className={stats?.criticalChange && stats.criticalChange > 0 ? 'text-red-500' : 'text-green-500'}>
                    {Math.abs(stats?.criticalChange || 0)}%
                  </span>
                  <span className="ml-1 text-slate-400">from last week</span>
                </div>
              </div>
              <div className="rounded-full bg-red-500/10 p-3">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total IOCs */}
        <Card hoverable>
          <CardContent>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Total IOCs</p>
                <p className="mt-2 text-3xl font-bold text-blue-500">{formatNumber(stats?.totalIOCs || 0)}</p>
                <div className="mt-2 text-xs text-slate-400">
                  IP: {formatNumber(stats?.iocBreakdown?.ip || 0)} | Domain: {formatNumber(stats?.iocBreakdown?.domain || 0)}
                </div>
              </div>
              <div className="rounded-full bg-blue-500/10 p-3">
                <Shield className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Blocked Threats */}
        <Card hoverable>
          <CardContent>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Blocked Threats</p>
                <p className="mt-2 text-3xl font-bold text-green-500">{formatNumber(stats?.blockedThreats || 0)}</p>
                <div className="mt-2 text-sm text-green-500">
                  94.5% success rate
                </div>
              </div>
              <div className="rounded-full bg-green-500/10 p-3">
                <ShieldCheck className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assets at Risk */}
        <Card hoverable>
          <CardContent>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Assets at Risk</p>
                <p className="mt-2 text-3xl font-bold text-orange-500">{stats?.assetsAtRisk || 0}</p>
                <div className="mt-2 flex space-x-2">
                  <Badge variant="critical">High: 12</Badge>
                  <Badge variant="medium">Med: 23</Badge>
                </div>
              </div>
              <div className="rounded-full bg-orange-500/10 p-3">
                <Database className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Threat Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Threat Activity Trend (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} />
                <Line type="monotone" dataKey="high" stroke="#f97316" strokeWidth={2} />
                <Line type="monotone" dataKey="medium" stroke="#eab308" strokeWidth={2} />
                <Line type="monotone" dataKey="low" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* IOC Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>IOC Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="count"
                  label
                >
                  {distribution?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Threat Pressure Index */}
        <Card>
          <CardHeader>
            <CardTitle>Threat Pressure Index</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={pressureData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
                <Area type="monotone" dataKey="pressure" stroke="#22d3ee" fill="#0891b233" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Threat Detections */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Threat Detections</CardTitle>
              <div className="flex items-center space-x-2">
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
                <Button variant="ghost" size="sm">View All</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentThreats?.map((threat) => {
                const badgeVariant = mapSeverity(threat.severity)
                return (
                  <div
                    key={threat.id}
                    className="rounded-lg border border-slate-700 bg-slate-700/30 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Badge variant={badgeVariant}>{threat.severity}</Badge>
                          <span className="font-semibold text-slate-100">{threat.name}</span>
                          <span className="text-sm text-slate-400">
                            {formatRelativeTime(threat.timestamp)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center space-x-4 text-sm text-slate-400">
                          <span>Assets: {threat.affectedAssets}</span>
                          <span>IOCs: {threat.iocCount}</span>
                          <span>Techniques: {threat.techniques.join(', ')}</span>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-slate-400">Confidence:</span>
                            <Progress value={threat.confidence} className="w-32" />
                            <span className="text-xs text-slate-400">{threat.confidence}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex space-x-2">
                      <Button size="sm" variant="primary">Investigate</Button>
                      <Button size="sm" variant="danger">Block</Button>
                      <Button size="sm" variant="ghost">Dismiss</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top MITRE Techniques */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top MITRE ATT&CK Techniques</CardTitle>
              <Button variant="ghost" size="sm">View Matrix</Button>
            </div>
          </CardHeader>
          <CardContent>
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
                  {topTechniques?.map((technique) => {
                    const badgeVariant = mapSeverity(technique.severity)
                    return (
                      <tr key={technique.id} className="border-b border-slate-700/50">
                        <td className="py-3">
                          <div>
                            <span className="font-mono text-sm text-blue-400">{technique.id}</span>
                            <p className="text-sm text-slate-300">{technique.name}</p>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="font-semibold text-slate-100">{technique.detections}</span>
                        </td>
                        <td className="py-3">
                          {technique.trend === 'up' && <TrendingUp className="h-4 w-4 text-red-500" />}
                          {technique.trend === 'down' && <TrendingDown className="h-4 w-4 text-green-500" />}
                        </td>
                        <td className="py-3">
                          <Badge variant={badgeVariant}>{technique.severity}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feed Health Status */}
      <Card>
        <CardHeader>
          <CardTitle>Threat Feed Health Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {feeds?.map((feed) => (
              <div key={feed.id} className="rounded-lg border border-slate-700 bg-slate-700/30 p-4">
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-slate-100">{feed.name}</h4>
                  <div className={`h-3 w-3 rounded-full ${
                    feed.status === 'active'
                      ? 'bg-green-500'
                      : feed.status === 'warning' || feed.status === 'paused'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`} />
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-400">
                  <p>Last Fetch: {formatRelativeTime(feed.lastFetch)}</p>
                  <p>IOCs Today: {formatNumber(feed.iocsToday)}</p>
                  <p>Total IOCs: {formatNumber(feed.totalIOCs)}</p>
                  <p>Frequency: {feed.frequency}</p>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Health</span>
                    <span>{feed.healthScore}%</span>
                  </div>
                  <Progress
                    value={feed.healthScore}
                    className="mt-1"
                    barClassName={
                      feed.healthScore >= 90
                        ? 'bg-green-500'
                        : feed.healthScore >= 70
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }
                  />
                </div>
                <div className="mt-3 flex space-x-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    Fetch Now
                  </Button>
                  <Button size="sm" variant="ghost">
                    Settings
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Feed Volume Graphics */}
      <Card>
        <CardHeader>
          <CardTitle>Feed IOC Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={feeds.map((f) => ({ name: f.name.slice(0, 16), iocs: f.iocsToday || 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="iocs" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Threat Actor Intelligence */}
      <Card>
        <CardHeader>
          <CardTitle>Threat Actor Signals From IOC Feeds</CardTitle>
        </CardHeader>
        <CardContent>
          {threatActors.length === 0 ? (
            <div className="text-sm text-slate-400">No actor signals identified yet.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {threatActors.slice(0, 6).map((actor) => (
                <div key={actor.actor} className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">{actor.actor}</span>
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
