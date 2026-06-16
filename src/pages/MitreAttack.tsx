import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Target, TrendingUp, Shield, Loader2, Search, Radar, Network, X, ChevronRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  useMitreTactics,
  useMitreCoverage,
  useMapIOCsToMitre,
  useMitreMapStatus,
  useMitreTechniquesAdvanced,
  useMitreAssetCorrelation,
} from '@/hooks/useMitre'
import { useThreatActors, useIOCs } from '@/hooks/useIOCs'
import { formatNumber, formatRelativeTime } from '@/lib/utils'

export default function MitreAttack() {
  const [selectedTactic, setSelectedTactic] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [onlyDetected, setOnlyDetected] = useState(false)
  const [drillTechnique, setDrillTechnique] = useState<{ id: string; name: string } | null>(null)

  const { data: tacticsData } = useMitreTactics()
  const { data: coverageData } = useMitreCoverage()
  const { data: mapStatus } = useMitreMapStatus()
  const { data: techniquesData = [], isLoading: techniquesLoading } = useMitreTechniquesAdvanced({
    tactic: selectedTactic || undefined,
    hasDetections: onlyDetected,
    search: search || undefined,
    limit: 5000,
  })
  const { data: correlationData, isLoading: correlationLoading } = useMitreAssetCorrelation(120, 6)
  const { data: threatActorsData } = useThreatActors(10000)
  const mapIOCsMutation = useMapIOCsToMitre()

  const { data: drillIOCsData, isLoading: drillLoading } = useIOCs(
    drillTechnique ? { technique: drillTechnique.id, take: 20 } : {},
    { enabled: !!drillTechnique },
  )

  const tactics = Array.isArray(tacticsData) ? tacticsData : []
  const techniques = Array.isArray(techniquesData) ? techniquesData : []
  const threatActors = Array.isArray(threatActorsData) ? threatActorsData : []
  const coverage = coverageData || { percentage: 0, detected: 0, total: 0, trending: 0 }
  const correlationTechniques = Array.isArray(correlationData?.techniques) ? correlationData.techniques : []
  const tacticSummary = Array.isArray(correlationData?.tacticSummary) ? correlationData.tacticSummary : []

  const activeTacticName = useMemo(() => {
    if (!selectedTactic) return 'All Tactics'
    const row = tactics.find((t: any) => t.id === selectedTactic)
    return row?.name || 'Selected Tactic'
  }, [selectedTactic, tactics])

  const tacticColors: Record<string, string> = {
    'Initial Access': 'border-red-500/50 bg-red-500/10',
    Execution: 'border-orange-500/50 bg-orange-500/10',
    Persistence: 'border-yellow-500/50 bg-yellow-500/10',
    'Privilege Escalation': 'border-green-500/50 bg-green-500/10',
    'Defense Evasion': 'border-sky-500/50 bg-sky-500/10',
    'Credential Access': 'border-indigo-500/50 bg-indigo-500/10',
    Discovery: 'border-violet-500/50 bg-violet-500/10',
    'Lateral Movement': 'border-pink-500/50 bg-pink-500/10',
    Collection: 'border-cyan-500/50 bg-cyan-500/10',
    Exfiltration: 'border-teal-500/50 bg-teal-500/10',
    'Command and Control': 'border-lime-500/50 bg-lime-500/10',
    Impact: 'border-rose-500/50 bg-rose-500/10',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">MITRE ATT&CK Matrix</h1>
          <p className="text-slate-400">Complete TTP coverage, IOC mapping, and asset correlation intelligence</p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="primary"
            onClick={() => mapIOCsMutation.mutate({ batchSize: 3000, maxBatches: 20, async: true })}
            disabled={mapIOCsMutation.isPending || mapStatus?.running}
          >
            {mapIOCsMutation.isPending || mapStatus?.running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mapping in Progress
              </>
            ) : (
              'Map Diverse IOCs to TTPs'
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Coverage</p>
                <p className="mt-2 text-2xl font-bold text-blue-500">
                  {coverage.percentage || 0}%
                </p>
              </div>
              <Shield className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Detected Techniques</p>
                <p className="mt-2 text-2xl font-bold text-green-500">
                  {formatNumber(coverage.detected || 0)}
                </p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Techniques</p>
                <p className="mt-2 text-2xl font-bold text-slate-400">
                  {formatNumber(coverage.total || 0)}
                </p>
              </div>
              <Radar className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Trending</p>
                <p className="mt-2 text-2xl font-bold text-orange-500">
                  {formatNumber(coverage.trending || 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>Tactic Radar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tactics.map((tactic: any) => (
                <button
                  key={tactic.id}
                  onClick={() => setSelectedTactic(tactic.id === selectedTactic ? null : tactic.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedTactic === tactic.id
                      ? 'border-blue-500 bg-blue-500/15'
                      : tacticColors[tactic.name] || 'border-slate-700 bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">{tactic.name}</span>
                    <Badge variant={selectedTactic === tactic.id ? 'success' : 'default'}>{tactic.techniqueCount || 0}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Detections: {formatNumber(tactic.detectionCount || 0)}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-8">
          <CardHeader>
            <CardTitle>Technique Explorer ({activeTacticName})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[250px] flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search TID or technique name..."
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 pl-10 pr-3 text-sm text-slate-200"
                />
              </div>
              <Button
                variant={onlyDetected ? 'primary' : 'outline'}
                onClick={() => setOnlyDetected((v) => !v)}
              >
                {onlyDetected ? 'Showing Detected Only' : 'Show Detected Only'}
              </Button>
            </div>

            {techniquesLoading ? (
              <div className="py-12 text-center text-slate-400">Loading techniques...</div>
            ) : techniques.length === 0 ? (
              <div className="py-12 text-center text-slate-400">No techniques match current filters.</div>
            ) : (
              <div className="space-y-2">
                {techniques.map((technique: any) => {
                  const hasDetections = Number(technique.detections || 0) > 0
                  const isSelected = drillTechnique?.id === technique.techniqueId
                  return (
                    <button
                      key={technique.id}
                      onClick={() => setDrillTechnique(
                        isSelected ? null : { id: technique.techniqueId, name: technique.name }
                      )}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/40'
                          : hasDetections
                          ? 'border-orange-700/60 bg-orange-900/10 hover:border-orange-500/60'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-xs text-blue-400">{technique.techniqueId || technique.id}</p>
                          <h4 className="text-sm font-semibold text-slate-100">{technique.name}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={hasDetections ? 'danger' : 'default'}>
                            {technique.detections || 0} detections
                          </Badge>
                          <Badge variant="warning">{technique.affectedAssets || 0} assets</Badge>
                          <ChevronRight className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2">{technique.description || 'No description available'}</p>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Technique IOC Drill-in Panel */}
      {drillTechnique && (
        <Card className="border-cyan-500/40 bg-cyan-950/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-cyan-300">
                <Target className="h-4 w-4" />
                IOCs mapped to {drillTechnique.id} — {drillTechnique.name}
              </CardTitle>
              <button onClick={() => setDrillTechnique(null)} className="rounded p-1 text-slate-400 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {drillLoading ? (
              <div className="py-8 text-center text-slate-400">Loading IOCs...</div>
            ) : (drillIOCsData?.items ?? []).length === 0 ? (
              <p className="py-4 text-sm text-slate-500">No IOCs are mapped to this technique yet. Run "Map Diverse IOCs to TTPs" first.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(drillIOCsData?.items ?? []).map((ioc: any) => (
                  <Link
                    key={ioc.id}
                    to={`/iocs/${ioc.id}`}
                    className="block rounded border border-slate-700 bg-slate-900/70 p-3 hover:border-cyan-500/50 hover:bg-slate-800/80"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate font-mono text-xs text-slate-200">{ioc.value}</span>
                      <Badge variant={ioc.severity === 'critical' ? 'danger' : ioc.severity === 'high' ? 'warning' : 'default'}>
                        {ioc.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {ioc.type} • conf {ioc.confidence}% • {formatRelativeTime(ioc.lastSeen)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
            {(drillIOCsData?.total ?? 0) > 20 && (
              <p className="mt-3 text-xs text-slate-500">Showing 20 of {drillIOCsData?.total} IOCs. Filter by this technique in the IOC list for the full set.</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader>
            <CardTitle>IOC-to-Asset Correlated TTPs</CardTitle>
          </CardHeader>
          <CardContent>
            {correlationLoading ? (
              <div className="py-12 text-center text-slate-400">Building MITRE asset correlation...</div>
            ) : correlationTechniques.length === 0 ? (
              <div className="py-12 text-center text-slate-400">No correlations available yet. Run IOC mapping first.</div>
            ) : (
              <div className="space-y-3">
                {correlationTechniques.slice(0, 12).map((row: any) => (
                  <div key={row.techniqueId} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-xs text-blue-400">{row.techniqueId} • {row.tactic}</p>
                        <h4 className="font-semibold text-slate-100">{row.techniqueName}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="danger">{row.iocCount} IOCs</Badge>
                        <Badge variant="warning">{row.affectedAssetCount} assets</Badge>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {Array.isArray(row.topAssets) && row.topAssets.map((asset: any) => (
                        <div key={asset.assetId} className="rounded border border-slate-700 bg-slate-900/70 p-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-200">{asset.assetName}</span>
                            <span className="text-amber-400">score {asset.score}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                            <span>{asset.assetType}</span>
                            <span>{asset.department || 'N/A'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>Tactic Pressure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tacticSummary.slice(0, 10).map((row: any) => (
                <div key={row.tactic} className="rounded-md border border-slate-700 bg-slate-900/60 p-2">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-200">{row.tactic}</span>
                    <span className="text-slate-400">{row.iocCount} IOC refs</span>
                  </div>
                  <div className="h-2 rounded bg-slate-700">
                    <div
                      className="h-2 rounded bg-gradient-to-r from-cyan-500 to-blue-500"
                      style={{ width: `${Math.min(100, row.iocCount / 3)}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{row.techniques} techniques</span>
                    <span>{row.affectedAssets} affected assets</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-slate-700 bg-slate-800/40 p-3">
              <div className="mb-2 flex items-center gap-2 text-slate-200">
                <Network className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-semibold">Threat Actors From IOC Intel</span>
              </div>
              {threatActors.length === 0 ? (
                <p className="text-xs text-slate-500">No actor signatures detected yet.</p>
              ) : (
                <div className="space-y-2">
                  {threatActors.slice(0, 5).map((actor: any) => (
                    <div key={actor.actor} className="flex items-center justify-between text-xs">
                      <span className="truncate text-slate-300">{actor.actor}</span>
                      <Badge variant="danger">{actor.iocCount}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
