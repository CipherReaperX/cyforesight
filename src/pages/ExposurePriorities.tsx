import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertOctagon, ShieldAlert, RefreshCw, Scan, GitMerge,
  ChevronRight, AlertTriangle, Activity, Server,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import {
  useExposurePriorities,
  useScanAsset,
  useMapIOCsToAssets,
  useBootstrapSmallEnterpriseAssets,
} from '@/hooks/useAssets'

function priorityColor(score: number) {
  if (score >= 80) return 'text-red-400'
  if (score >= 60) return 'text-orange-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-slate-400'
}

function priorityBarClass(score: number) {
  if (score >= 80) return 'bg-red-500'
  if (score >= 60) return 'bg-orange-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-slate-500'
}

function statusBadge(status: string) {
  if (status === 'online' || status === 'active') return <Badge variant="success">online</Badge>
  if (status === 'offline') return <Badge variant="danger">offline</Badge>
  return <Badge variant="warning">{status || 'unknown'}</Badge>
}

export default function ExposurePriorities() {
  const { data: priorities = [], isLoading, isError, refetch, isFetching } = useExposurePriorities(50)
  const scanAsset = useScanAsset()
  const mapIOCs = useMapIOCsToAssets()
  const bootstrap = useBootstrapSmallEnterpriseAssets()

  const [scanningId, setScanningId] = useState<string | null>(null)

  const handleScan = async (e: React.MouseEvent, assetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setScanningId(assetId)
    try {
      await scanAsset.mutateAsync(assetId)
      await refetch()
    } finally {
      setScanningId(null)
    }
  }

  const handleMapIOCs = async () => {
    await mapIOCs.mutateAsync(40)
    await refetch()
  }

  const critical = priorities.filter((r: any) => r.priorityScore >= 80).length
  const high = priorities.filter((r: any) => r.priorityScore >= 60 && r.priorityScore < 80).length
  const medium = priorities.filter((r: any) => r.priorityScore >= 40 && r.priorityScore < 60).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Exposure Prioritization Engine</h1>
          <p className="text-slate-400">
            Unified asset risk queue — IOC pressure, CVEs, criticality, current exposure
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={handleMapIOCs}
            disabled={mapIOCs.isPending}
          >
            <GitMerge className={`mr-2 h-4 w-4 ${mapIOCs.isPending ? 'animate-pulse' : ''}`} />
            {mapIOCs.isPending ? 'Mapping…' : 'Map IOCs → Assets'}
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Critical (≥80)</p>
                <p className="mt-1 text-2xl font-bold text-red-400">{critical}</p>
              </div>
              <AlertOctagon className="h-8 w-8 text-red-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">High (60–79)</p>
                <p className="mt-1 text-2xl font-bold text-orange-400">{high}</p>
              </div>
              <ShieldAlert className="h-8 w-8 text-orange-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Medium (40–59)</p>
                <p className="mt-1 text-2xl font-bold text-yellow-400">{medium}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Priority Queue — Top {priorities.length} Assets</CardTitle>
            <p className="text-xs text-slate-500">
              score = risk×0.4 + IOCs×1.2 + CVEs×1.6 + criticality×8
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-800/60" />
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-red-700/40 bg-red-950/20 p-6 text-center">
              <AlertOctagon className="mx-auto h-10 w-10 text-red-500" />
              <p className="mt-3 text-slate-300">Failed to load exposure data.</p>
              <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : priorities.length === 0 ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-10 text-center">
              <Server className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-slate-400">No assets in the exposure queue yet.</p>
              <p className="mt-1 text-xs text-slate-500">
                Bootstrap demo assets or map IOCs to existing assets to populate the queue.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => bootstrap.mutateAsync()}
                  disabled={bootstrap.isPending}
                >
                  <Activity className={`mr-2 h-4 w-4 ${bootstrap.isPending ? 'animate-pulse' : ''}`} />
                  {bootstrap.isPending ? 'Loading…' : 'Bootstrap Demo Assets'}
                </Button>
                <Button variant="outline" onClick={handleMapIOCs} disabled={mapIOCs.isPending}>
                  <GitMerge className="mr-2 h-4 w-4" />
                  Map IOCs → Assets
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {(priorities as any[]).map((row, idx) => (
                <Link
                  key={row.assetId}
                  to={`/assets/${row.assetId}`}
                  className="group block rounded-lg border border-slate-700 bg-slate-900/70 p-4 transition-colors hover:border-cyan-500/40 hover:bg-slate-800/60"
                >
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="w-8 shrink-0 text-center">
                      <span className={`text-lg font-bold ${priorityColor(row.priorityScore)}`}>
                        #{idx + 1}
                      </span>
                    </div>

                    {/* Icon */}
                    <div className="shrink-0 rounded-md bg-red-500/10 p-2">
                      {row.priorityScore >= 80
                        ? <AlertOctagon className="h-5 w-5 text-red-400" />
                        : <ShieldAlert className="h-5 w-5 text-amber-400" />}
                    </div>

                    {/* Name + meta */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate font-semibold text-slate-100 group-hover:text-cyan-300">
                          {row.name}
                        </h4>
                        {statusBadge(row.status)}
                      </div>
                      <p className="text-xs text-slate-400">
                        {row.type?.replace('_', ' ')} • {row.department || 'No department'}
                      </p>

                      {/* Progress bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <Progress
                          value={row.priorityScore}
                          barClassName={priorityBarClass(row.priorityScore)}
                          className="flex-1"
                        />
                        <span className={`w-8 shrink-0 text-right text-xs font-bold ${priorityColor(row.priorityScore)}`}>
                          {row.priorityScore}
                        </span>
                      </div>

                      {/* Badges */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant={row.activeThreats > 0 ? 'danger' : 'default'}>
                          {row.activeThreats} IOC{row.activeThreats !== 1 ? 's' : ''}
                        </Badge>
                        <Badge variant={row.unpatchedCves > 0 ? 'warning' : 'default'}>
                          {row.unpatchedCves} CVE{row.unpatchedCves !== 1 ? 's' : ''}
                        </Badge>
                        <Badge variant="default">risk {row.riskScore}</Badge>
                        <Badge variant="default">crit {row.criticality}/5</Badge>
                        {Array.isArray(row.reasons) && row.reasons.map((r: string) => (
                          <Badge key={r} variant="default" className="text-slate-400">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Scan button + chevron */}
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleScan(e, row.assetId)}
                        disabled={scanningId === row.assetId}
                        title="Run active scan on this asset"
                      >
                        <Scan className={`mr-1 h-3 w-3 ${scanningId === row.assetId ? 'animate-pulse' : ''}`} />
                        {scanningId === row.assetId ? 'Scanning…' : 'Scan'}
                      </Button>
                      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-cyan-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
