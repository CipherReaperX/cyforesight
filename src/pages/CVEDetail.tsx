import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ShieldAlert, AlertTriangle, CheckCircle, XCircle, ExternalLink, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { useCVE } from '@/hooks/useCVEs'
import { formatDate, formatRelativeTime } from '@/lib/utils'

const SEVERITY_VARIANT: Record<string, 'danger' | 'warning' | 'default'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'default',
  low: 'default',
  info: 'default',
}

const CVSS_COLOR = (score: number) => {
  if (score >= 9) return 'text-red-500'
  if (score >= 7) return 'text-orange-500'
  if (score >= 4) return 'text-yellow-500'
  return 'text-green-500'
}

const CVSS_BAR = (score: number) => {
  if (score >= 9) return 'bg-red-500'
  if (score >= 7) return 'bg-orange-500'
  if (score >= 4) return 'bg-yellow-500'
  return 'bg-green-500'
}

export default function CVEDetail() {
  const { cveId } = useParams<{ cveId: string }>()
  const { data: cve, isLoading } = useCVE(cveId || '')

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-800/60" />
        ))}
      </div>
    )
  }

  if (!cve) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-slate-400">
        <ShieldAlert className="h-12 w-12 text-slate-600" />
        <p>CVE not found</p>
        <Link to="/cves"><Button variant="outline">Back to CVE Tracker</Button></Link>
      </div>
    )
  }

  const cvss = Number(cve.cvssScore || 0)
  const refs = Array.isArray(cve.references) ? cve.references : []
  const cweIds = Array.isArray(cve.cweIds) ? cve.cweIds : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link to="/cves">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-3xl font-bold text-slate-100">{cve.cveId}</h1>
              <Badge variant={SEVERITY_VARIANT[cve.severity] ?? 'default'}>{cve.severity}</Badge>
              {cve.exploitAvailable && (
                <Badge variant="danger">Exploit Available</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Published {cve.publishedDate ? formatDate(cve.publishedDate) : '—'}
              {cve.modifiedDate && ` • Modified ${formatRelativeTime(cve.modifiedDate)}`}
            </p>
          </div>
        </div>
        {cve.cveId && (
          <a
            href={`https://nvd.nist.gov/vuln/detail/${cve.cveId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              NVD
            </Button>
          </a>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-400">CVSS Score</p>
            <p className={`mt-2 text-3xl font-bold ${CVSS_COLOR(cvss)}`}>{cvss.toFixed(1)}</p>
            <Progress value={cvss * 10} className="mt-2" barClassName={CVSS_BAR(cvss)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-400">Patch Status</p>
            <div className="mt-2 flex items-center gap-2">
              {cve.patchStatus === 'available'
                ? <CheckCircle className="h-6 w-6 text-green-500" />
                : <XCircle className="h-6 w-6 text-red-500" />}
              <span className="text-sm font-semibold capitalize text-slate-200">
                {cve.patchStatus || 'unavailable'}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-400">Exploit</p>
            <div className="mt-2 flex items-center gap-2">
              {cve.exploitAvailable
                ? <AlertTriangle className="h-6 w-6 text-red-500" />
                : <CheckCircle className="h-6 w-6 text-green-500" />}
              <span className="text-sm font-semibold text-slate-200">
                {cve.exploitAvailable ? 'Available' : 'Not Known'}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-400">Affected Assets</p>
            <p className="mt-2 text-3xl font-bold text-orange-400">{cve.affectedAssets ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Description + technical details */}
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Description</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-300">{cve.description}</p>
            </CardContent>
          </Card>

          {refs.length > 0 && (
            <Card>
              <CardHeader><CardTitle>References ({refs.length})</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {refs.map((ref: any, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                      <a
                        href={ref.url || ref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        {ref.url || ref}
                      </a>
                      {ref.name && <span className="text-xs text-slate-500">({ref.name})</span>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Technical Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {cve.vendor && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Vendor</span>
                  <span className="font-medium text-slate-200">{cve.vendor}</span>
                </div>
              )}
              {cve.product && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Product</span>
                  <span className="font-medium text-slate-200">{cve.product}</span>
                </div>
              )}
              {cve.cvssVector && (
                <div>
                  <span className="text-slate-400">CVSS Vector</span>
                  <p className="mt-1 break-all font-mono text-xs text-slate-300">{cve.cvssVector}</p>
                </div>
              )}
              {cweIds.length > 0 && (
                <div>
                  <span className="text-slate-400">CWE IDs</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cweIds.map(cwe => (
                      <span key={cwe} className="rounded bg-slate-700 px-2 py-0.5 font-mono text-xs text-slate-300">
                        {cwe}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs text-slate-500">
                  Published {cve.publishedDate ? formatDate(cve.publishedDate) : '—'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <a
                href={`https://nvd.nist.gov/vuln/detail/${cve.cveId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-between rounded border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 hover:border-slate-600"
              >
                View on NVD <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={`https://www.exploit-db.com/search?cve=${cve.cveId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-between rounded border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 hover:border-slate-600"
              >
                Search ExploitDB <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={`https://github.com/search?q=${cve.cveId}&type=repositories`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-between rounded border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 hover:border-slate-600"
              >
                GitHub PoC Search <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
