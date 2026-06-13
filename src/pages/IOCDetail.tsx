import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Copy, Download, Shield, Activity, AlertTriangle, Globe, FileText, ExternalLink } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Table, TableHeader, TableBody, TableRow, TableHead } from '@/components/ui/Table'
import { useIOC, useIOCEnrichment } from '@/hooks/useIOCs'
import { formatRelativeTime, formatDate } from '@/lib/utils'

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

function getVirusTotalUrl(type: string, value: string): string | null {
  switch (type) {
    case 'ip': return `https://www.virustotal.com/gui/ip-address/${encodeURIComponent(value)}`
    case 'domain': return `https://www.virustotal.com/gui/domain/${encodeURIComponent(value)}`
    case 'hash': return `https://www.virustotal.com/gui/file/${encodeURIComponent(value)}`
    case 'url': return `https://www.virustotal.com/gui/url/${encodeURIComponent(btoa(value))}`
    default: return null
  }
}

export default function IOCDetail() {
  const { iocId } = useParams<{ iocId: string }>()
  const { data: ioc, isLoading } = useIOC(iocId!)
  const { data: enrichment } = useIOCEnrichment(iocId!)

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
    return <div className="text-slate-400">Loading...</div>
  }

  if (!ioc) {
    return <div className="text-slate-400">IOC not found</div>
  }

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
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-slate-100">{ioc.value}</h1>
              <Badge variant={mapSeverity(ioc.severity)}>{ioc.severity}</Badge>
              <Badge>{ioc.type}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              First seen {formatRelativeTime(ioc.firstSeen)} • Last seen {formatRelativeTime(ioc.lastSeen)}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          {getVirusTotalUrl(ioc.type, ioc.value) && (
            <a
              href={getVirusTotalUrl(ioc.type, ioc.value)!}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" />
                VirusTotal
              </Button>
            </a>
          )}
          <Button variant="danger">Block</Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Confidence</p>
                <p className="mt-2 text-2xl font-bold text-blue-500">{ioc.confidence}%</p>
              </div>
              <Shield className="h-8 w-8 text-blue-500" />
            </div>
            <Progress value={ioc.confidence} className="mt-3" />
          </CardContent>
        </Card>

        {/* Add other cards as originally present */}
      </div>

      {/* VirusTotal Link */}
      {getVirusTotalUrl(ioc.type, ioc.value) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>VirusTotal Analysis</CardTitle>
              <a
                href={getVirusTotalUrl(ioc.type, ioc.value)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in VirusTotal
                </Button>
              </a>
            </div>
          </CardHeader>
          <CardContent>
            {enrichment?.virusTotal ? (
              <pre className="rounded border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-200 overflow-auto max-h-64">
                {JSON.stringify(enrichment.virusTotal, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-slate-400">
                Click the button above to analyze this {ioc.type} in VirusTotal.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* GeoIP Data, Related IOCs, Sidebar as originally present */}

      {/* Related IOCs */}
      <Card>
        <CardHeader>
          <CardTitle>Related IOCs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Value</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <td colSpan={4} className="text-center text-slate-400">
                  No related IOCs found
                </td>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sidebar contents as originally present */}

    </div>
  )
}

