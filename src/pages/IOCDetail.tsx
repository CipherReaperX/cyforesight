import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft, Copy, Download, Shield, Activity, AlertTriangle,
  ExternalLink, Hash, Clock, Database, Cpu,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { useIOC, useRelatedIOCs } from '@/hooks/useIOCs'
import { formatRelativeTime, formatDate } from '@/lib/utils'
import { IOC } from '@/types'

type BadgeVariant = 'default' | 'critical' | 'high' | 'medium' | 'low' | 'success' | 'warning' | 'danger'

function mapSeverity(severity: string): BadgeVariant {
  if (['critical', 'high', 'medium', 'low', 'success', 'warning', 'danger'].includes(severity)) {
    return severity as BadgeVariant
  }
  return 'default'
}

function getVirusTotalUrl(type: string, value: string): string | null {
  switch (type) {
    case 'ip': return `https://www.virustotal.com/gui/ip-address/${encodeURIComponent(value)}`
    case 'domain': return `https://www.virustotal.com/gui/domain/${encodeURIComponent(value)}`
    case 'hash': return `https://www.virustotal.com/gui/file/${encodeURIComponent(value)}`
    case 'url': return `https://www.virustotal.com/gui/url/${encodeURIComponent(btoa(value))}`
    default: return null
  }
}

const SEV_WEIGHT: Record<string, number> = {
  critical: 1.0, high: 0.8, medium: 0.55, low: 0.35, info: 0.2,
}

function computeThreatScore(ioc: IOC) {
  const severityWeight = SEV_WEIGHT[ioc.severity] ?? 0.4
  const confidenceFactor = Math.max(0.1, (ioc.confidence ?? 50) / 100)
  const daysSince = (Date.now() - new Date(ioc.lastSeen).getTime()) / 86400000
  const recencyFactor =
    daysSince <= 1 ? 1.0 :
    daysSince <= 7 ? 0.9 :
    daysSince <= 30 ? 0.75 :
    daysSince <= 90 ? 0.6 : 0.45
  const sourcesCount = (ioc.sources ?? []).length
  const sourceMultiplier = 1.0 + Math.min(0.3, sourcesCount * 0.1)
  const mitreBonus = (ioc.mitreTechniques ?? []).length > 0 ? 0.15 : 0
  const rawScore = (severityWeight + mitreBonus) * confidenceFactor * recencyFactor * sourceMultiplier
  const score = Math.min(100, Math.round(rawScore * 100))
  return {
    score,
    components: [
      {
        label: 'Severity Weight',
        pct: severityWeight * 100,
        color: 'bg-red-500',
        desc: `"${ioc.severity}" → base weight ${severityWeight}`,
      },
      {
        label: 'Confidence Factor',
        pct: confidenceFactor * 100,
        color: 'bg-blue-500',
        desc: `${ioc.confidence ?? 50}% reported confidence`,
      },
      {
        label: 'Recency Factor',
        pct: recencyFactor * 100,
        color: 'bg-cyan-500',
        desc: `Last seen ${Math.round(daysSince)}d ago → factor ${recencyFactor}`,
      },
      {
        label: 'Source Corroboration',
        pct: (sourceMultiplier - 1) / 0.3 * 100,
        color: 'bg-emerald-500',
        desc: `${sourcesCount} source(s) → ×${sourceMultiplier.toFixed(2)} multiplier`,
      },
      {
        label: 'MITRE Mapping Bonus',
        pct: mitreBonus > 0 ? 100 : 0,
        color: 'bg-violet-500',
        desc: mitreBonus > 0
          ? `${(ioc.mitreTechniques ?? []).length} technique(s) mapped → +0.15 bonus`
          : 'No MITRE mapping → no bonus',
      },
    ],
  }
}

export default function IOCDetail() {
  const { iocId } = useParams<{ iocId: string }>()
  const { data: ioc, isLoading } = useIOC(iocId!)
  const { data: relatedIOCs = [] } = useRelatedIOCs(iocId!)

  const handleCopy = () => {
    if (!ioc) return
    navigator.clipboard.writeText(ioc.value)
    toast.success('Copied to clipboard')
  }

  const handleExport = () => {
    if (!ioc) return
    const blob = new Blob([JSON.stringify(ioc, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ioc-${ioc.id}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('IOC exported')
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-800/60" />
        ))}
      </div>
    )
  }

  if (!ioc) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-slate-400">
        <AlertTriangle className="h-12 w-12 text-slate-600" />
        <p>IOC not found</p>
        <Link to="/iocs"><Button variant="outline">Back to IOCs</Button></Link>
      </div>
    )
  }

  const vtUrl = getVirusTotalUrl(ioc.type, ioc.value)
  const { score, components } = computeThreatScore(ioc)
  const scoreColor = score >= 75 ? 'text-red-400' : score >= 50 ? 'text-orange-400' : score >= 25 ? 'text-yellow-400' : 'text-green-400'
  const scoreBarColor = score >= 75 ? 'bg-red-500' : score >= 50 ? 'bg-orange-500' : score >= 25 ? 'bg-yellow-500' : 'bg-green-500'
  const mitreTechniques = ioc.mitreTechniques ?? []
  const sources = ioc.sources ?? []
  const tags = ioc.tags ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/iocs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-all font-mono text-xl font-bold text-slate-100">{ioc.value}</h1>
              <Badge variant={mapSeverity(ioc.severity)}>{ioc.severity}</Badge>
              <Badge>{ioc.type}</Badge>
              <Badge variant={ioc.status === 'active' ? 'success' : 'default'}>{ioc.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              First seen {formatDate(ioc.firstSeen)} • Last seen {formatRelativeTime(ioc.lastSeen)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          {vtUrl && (
            <a href={vtUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-4 w-4" />
                VirusTotal
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Threat Score</p>
                <p className={`mt-2 text-3xl font-bold ${scoreColor}`}>{score}</p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${scoreColor}`} />
            </div>
            <Progress value={score} className="mt-3" barClassName={scoreBarColor} />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Confidence</p>
                <p className="mt-2 text-3xl font-bold text-blue-400">{ioc.confidence ?? 50}%</p>
              </div>
              <Shield className="h-8 w-8 text-blue-400" />
            </div>
            <Progress value={ioc.confidence ?? 50} className="mt-3" />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">MITRE Techniques</p>
                <p className="mt-2 text-3xl font-bold text-violet-400">{mitreTechniques.length}</p>
              </div>
              <Cpu className="h-8 w-8 text-violet-400" />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {mitreTechniques.length > 0 ? mitreTechniques.slice(0, 3).join(', ') + (mitreTechniques.length > 3 ? '…' : '') : 'Not mapped'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Sources</p>
                <p className="mt-2 text-3xl font-bold text-emerald-400">{sources.length}</p>
              </div>
              <Database className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {sources.length > 0 ? sources.slice(0, 2).join(', ') + (sources.length > 2 ? '…' : '') : 'No sources'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Threat Score Breakdown */}
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                Threat Score Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`text-5xl font-bold tabular-nums ${scoreColor}`}>{score}</div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">Composite Threat Score</p>
                  <p className="text-xs text-slate-400">
                    Formula: (severity_weight + mitre_bonus) × confidence × recency × source_multiplier × 100
                  </p>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                {components.map((c) => (
                  <div key={c.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-300">{c.label}</span>
                      <span className="font-mono text-slate-400">{c.pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-700/60">
                      <div
                        className={`h-2 rounded-full transition-all ${c.color}`}
                        style={{ width: `${Math.min(100, Math.max(0, c.pct))}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">{c.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Related IOCs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-cyan-400" />
                Related IOCs
                {relatedIOCs.length > 0 && (
                  <Badge variant="default">{relatedIOCs.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {relatedIOCs.length === 0 ? (
                <p className="text-sm text-slate-500">No related IOCs found with matching type, tags, sources, or MITRE techniques.</p>
              ) : (
                <div className="space-y-2">
                  {relatedIOCs.map((rel) => (
                    <Link
                      key={rel.id}
                      to={`/iocs/${rel.id}`}
                      className="block rounded-md border border-slate-700 bg-slate-900/70 p-3 transition-colors hover:border-cyan-500/50 hover:bg-slate-800/80"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-xs text-slate-200">{rel.value}</span>
                        <div className="flex shrink-0 gap-1">
                          <Badge variant={mapSeverity(rel.severity)}>{rel.severity}</Badge>
                          <Badge>{rel.type}</Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Confidence {rel.confidence}% • Last seen {formatRelativeTime(rel.lastSeen)}
                        {(rel.mitreTechniques ?? []).length > 0 && ` • MITRE: ${(rel.mitreTechniques ?? []).slice(0, 2).join(', ')}`}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Metadata */}
          <Card>
            <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Type</span>
                <span className="font-mono text-slate-200">{ioc.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Severity</span>
                <Badge variant={mapSeverity(ioc.severity)}>{ioc.severity}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <Badge variant={ioc.status === 'active' ? 'success' : 'default'}>{ioc.status}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ML Score</span>
                <span className="font-mono text-slate-200">{ioc.mlScore ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                First seen {formatDate(ioc.firstSeen)}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                Last seen {formatDate(ioc.lastSeen)}
              </div>
            </CardContent>
          </Card>

          {/* MITRE Techniques */}
          {mitreTechniques.length > 0 && (
            <Card>
              <CardHeader><CardTitle>MITRE Techniques</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {mitreTechniques.map((tid) => (
                    <Link key={tid} to="/mitre">
                      <span className="inline-block rounded border border-violet-700/60 bg-violet-900/30 px-2 py-1 font-mono text-xs text-violet-300 hover:border-violet-400">
                        {tid}
                      </span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* VirusTotal */}
          {vtUrl && (
            <Card>
              <CardHeader><CardTitle>External Lookup</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <a
                  href={vtUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-between rounded border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 hover:border-slate-600"
                >
                  VirusTotal <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {ioc.type === 'ip' && (
                  <a
                    href={`https://shodan.io/host/${encodeURIComponent(ioc.value)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-between rounded border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 hover:border-slate-600"
                  >
                    Shodan <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {(ioc.type === 'domain' || ioc.type === 'url') && (
                  <a
                    href={`https://urlscan.io/search/#${encodeURIComponent(ioc.value)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-between rounded border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 hover:border-slate-600"
                  >
                    URLScan.io <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sources */}
          {sources.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Intelligence Sources</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {sources.map((src) => (
                    <li key={src} className="flex items-center gap-2 text-xs text-slate-400">
                      <Database className="h-3 w-3 text-emerald-500" />
                      {src}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {ioc.description && (
            <Card>
              <CardHeader><CardTitle>Description</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-slate-400">{ioc.description}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
