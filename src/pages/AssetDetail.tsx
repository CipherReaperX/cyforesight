import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Server, ShieldAlert, Bug, Activity, ShieldCheck, Scan } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAsset, useAssetThreats, useAssetVulnerabilities, useRecheckAssetIOCsVT, useScanAsset } from '@/hooks/useAssets'
import { formatRelativeTime } from '@/lib/utils'
import { toast } from 'sonner'

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#38bdf8',
}

export default function AssetDetail() {
  const { assetId } = useParams<{ assetId: string }>()
  const { data: asset, isLoading, refetch } = useAsset(assetId || '')
  const { data: threatData } = useAssetThreats(assetId || '')
  const { data: vulnData } = useAssetVulnerabilities(assetId || '')
  const recheckVT = useRecheckAssetIOCsVT()
  const scanAsset = useScanAsset()
  const [scanning, setScanning] = useState(false)

  const handleScan = async () => {
    if (!asset) return
    setScanning(true)
    try {
      const result = await scanAsset.mutateAsync(asset.id)
      const checks = result?.checksRun ?? 0
      toast.success(`Scan complete — ${checks} check${checks !== 1 ? 's' : ''} run`)
      refetch()
    } catch (e: any) {
      toast.error(`Scan failed: ${e?.message}`)
    } finally {
      setScanning(false)
    }
  }

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
            <p className="text-slate-400">{(asset.type || '').replace('_', ' ')} • {asset.department || 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScan}
            disabled={scanning}
          >
            <Scan className="mr-2 h-4 w-4" />
            {scanning ? 'Scanning…' : 'Scan Now'}
          </Button>
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

      {/* Meta row */}
      {(asset.hostname || asset.ip || asset.os || asset.owner) && (
        <div className="flex flex-wrap gap-6 rounded-lg border border-slate-700 bg-slate-800/40 px-5 py-3 text-sm">
          {asset.ip && <span className="text-slate-400">IP: <span className="font-mono text-slate-200">{asset.ip}</span></span>}
          {asset.hostname && <span className="text-slate-400">Host: <span className="font-mono text-slate-200">{asset.hostname}</span></span>}
          {asset.os && <span className="text-slate-400">OS: <span className="text-slate-200">{asset.os}</span></span>}
          {asset.owner && <span className="text-slate-400">Owner: <span className="text-slate-200">{asset.owner}</span></span>}
          {asset.lastScan && <span className="text-slate-400">Last scan: <span className="text-slate-200">{formatRelativeTime(asset.lastScan)}</span></span>}
        </div>
      )}

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
        {/* Mapped IOCs — each row links to full IOC detail */}
        <Card>
          <CardHeader><CardTitle>Mapped IOCs ({iocs.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {iocs.slice(0, 30).map((ioc: any) => (
                <Link
                  key={ioc.id}
                  to={`/iocs/${ioc.id}`}
                  className="block rounded-md border border-slate-700 bg-slate-900/70 p-3 transition-colors hover:border-cyan-500/60 hover:bg-slate-800/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs text-slate-200">{ioc.value}</span>
                    <Badge variant="danger">{ioc.severity}</Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {ioc.type} • score {Number(ioc.score || 0).toFixed(2)}
                  </div>
                </Link>
              ))}
              {iocs.length === 0 && (
                <p className="text-sm text-slate-500">No mapped IOCs yet. Run "Map IOCs" from the Asset Inventory page.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mapped Vulnerabilities — each row links to full CVE detail */}
        <Card>
          <CardHeader><CardTitle>Mapped Vulnerabilities ({vulns.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {vulns.slice(0, 30).map((cve: any) => (
                <Link
                  key={cve.id || cve.cveId}
                  to={`/cves/${cve.id}`}
                  className="block rounded-md border border-slate-700 bg-slate-900/70 p-3 transition-colors hover:border-orange-500/60 hover:bg-slate-800/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-orange-300">{cve.cveId}</span>
                    <Badge variant={cve.severity === 'critical' ? 'danger' : cve.severity === 'high' ? 'warning' : 'default'}>
                      {cve.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{cve.description}</p>
                  {cve.cvssScore && (
                    <p className="mt-0.5 text-[11px] text-slate-500">CVSS {Number(cve.cvssScore).toFixed(1)}</p>
                  )}
                </Link>
              ))}
              {vulns.length === 0 && (
                <p className="text-sm text-slate-500">No vulnerabilities mapped yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
