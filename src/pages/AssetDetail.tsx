import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Server, ShieldAlert, Bug, Activity, ShieldCheck } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAsset, useAssetThreats, useAssetVulnerabilities, useRecheckAssetIOCsVT } from '@/hooks/useAssets'
import { formatRelativeTime } from '@/lib/utils'

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#38bdf8',
}

export default function AssetDetail() {
  const { assetId } = useParams<{ assetId: string }>()
  const { data: asset, isLoading } = useAsset(assetId || '')
  const { data: threatData } = useAssetThreats(assetId || '')
  const { data: vulnData } = useAssetVulnerabilities(assetId || '')
  const recheckVT = useRecheckAssetIOCsVT()

  if (isLoading) {
    return <div className="text-slate-400">Loading asset details...</div>
  }

  if (!asset) {
    return <div className="text-slate-400">Asset not found</div>
  }

  const iocs = Array.isArray(threatData?.items) ? threatData.items : []
  const vulns = Array.isArray(vulnData?.items) ? vulnData.items : []

  const iocByType = Object.values(
    iocs.reduce((acc: Record<string, { type: string; count: number }>, ioc: any) => {
      const type = ioc.type || 'unknown'
      acc[type] = acc[type] || { type, count: 0 }
      acc[type].count += 1
      return acc
    }, {})
  )

  const vulnBySeverity = Object.values(
    vulns.reduce((acc: Record<string, { name: string; value: number }>, cve: any) => {
      const sev = cve.severity || 'info'
      acc[sev] = acc[sev] || { name: sev, value: 0 }
      acc[sev].value += 1
      return acc
    }, {})
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/assets">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-100">{asset.name}</h1>
            <p className="text-slate-400">{asset.type.replace('_', ' ')} • {asset.department || 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => recheckVT.mutate({ assetId: asset.id, limit: 20 })}
            disabled={recheckVT.isPending}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {recheckVT.isPending ? 'Rechecking VT...' : 'Recheck IOC Reputation (VT)'}
          </Button>
          <Badge variant={asset.status === 'online' ? 'success' : asset.status === 'offline' ? 'danger' : 'default'}>
            {asset.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card><CardContent><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">Risk Score</p><p className="text-2xl font-bold text-amber-400">{asset.riskScore || 0}</p></div><ShieldAlert className="h-7 w-7 text-amber-400" /></div></CardContent></Card>
        <Card><CardContent><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">Mapped IOCs</p><p className="text-2xl font-bold text-cyan-400">{threatData?.total || 0}</p></div><Activity className="h-7 w-7 text-cyan-400" /></div></CardContent></Card>
        <Card><CardContent><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">Vulnerabilities</p><p className="text-2xl font-bold text-orange-400">{vulnData?.total || 0}</p></div><Bug className="h-7 w-7 text-orange-400" /></div></CardContent></Card>
        <Card><CardContent><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">Last Scan</p><p className="text-sm font-semibold text-slate-200">{asset.lastScan ? formatRelativeTime(asset.lastScan) : 'Never'}</p></div><Server className="h-7 w-7 text-blue-400" /></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Vulnerability Severity</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={vulnBySeverity} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {vulnBySeverity.map((entry: any) => (
                    <Cell key={entry.name} fill={severityColors[entry.name] || '#64748b'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>IOC Type Coverage</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={iocByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="type" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Mapped IOCs</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {iocs.slice(0, 20).map((ioc: any) => (
                <div key={ioc.id} className="rounded-md border border-slate-700 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-mono text-xs text-slate-200">{ioc.value}</span>
                    <Badge variant="danger">{ioc.severity}</Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {ioc.type} • score {Number(ioc.score || 0).toFixed(2)}
                  </div>
                </div>
              ))}
              {iocs.length === 0 && <p className="text-sm text-slate-500">No mapped IOCs yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Mapped Vulnerabilities</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {vulns.slice(0, 20).map((cve: any) => (
                <div key={cve.id || cve.cveId} className="rounded-md border border-slate-700 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-orange-300">{cve.cveId}</span>
                    <Badge variant={cve.severity === 'critical' ? 'danger' : cve.severity === 'high' ? 'warning' : 'default'}>
                      {cve.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{cve.description}</p>
                </div>
              ))}
              {vulns.length === 0 && <p className="text-sm text-slate-500">No mapped vulnerabilities yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
