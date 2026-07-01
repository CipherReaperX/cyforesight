import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Bug, Download, AlertTriangle, ShieldAlert,
  RefreshCw, ScanLine, ChevronLeft, ChevronRight,
  Filter, X, CheckCircle, AlertCircle, Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { useCVEs, useUpdateCVEPatchStatus, useScanCVEAssets } from '@/hooks/useCVEs'
import { useCVEStats } from '@/hooks/useCVEStats'
import { formatDate } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

type BadgeVariant = 'default' | 'danger' | 'warning' | 'success'

const SEV_BADGE: Record<string, BadgeVariant> = {
  critical: 'danger',
  high: 'warning',
  medium: 'default',
  low: 'default',
  info: 'default',
}

const PATCH_BADGE: Record<string, BadgeVariant> = {
  available: 'success',
  pending: 'warning',
  unavailable: 'danger',
}

const PATCH_NEXT: Record<string, string> = {
  unavailable: 'pending',
  pending: 'available',
  available: 'unavailable',
}

const PATCH_ICON: Record<string, JSX.Element> = {
  available: <CheckCircle className="mr-1 h-3 w-3 text-emerald-400" />,
  pending: <Clock className="mr-1 h-3 w-3 text-yellow-400" />,
  unavailable: <AlertCircle className="mr-1 h-3 w-3 text-red-400" />,
}

function getCVSSColor(score: number) {
  if (score >= 9.0) return 'text-red-500'
  if (score >= 7.0) return 'text-orange-500'
  if (score >= 4.0) return 'text-yellow-500'
  return 'text-green-500'
}

const PAGE_SIZE = 25

export default function CVETracker() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [severityFilter, setSeverityFilter] = useState('')
  const [exploitFilter, setExploitFilter] = useState('')
  const [patchFilter, setPatchFilter] = useState('')
  const [exportLoading, setExportLoading] = useState(false)

  const filters = {
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
    search: search || undefined,
    severity: severityFilter || undefined,
    exploitAvailable: exploitFilter || undefined,
    patchStatus: patchFilter || undefined,
  }

  const { data, isLoading, isError, refetch } = useCVEs(filters)
  const { data: statData, isLoading: statsLoading, refetch: refetchStats } = useCVEStats()
  const updatePatch = useUpdateCVEPatchStatus()
  const scanAssets = useScanCVEAssets()

  const cveItems = data?.items || []
  const cveTotal = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(cveTotal / PAGE_SIZE))
  const stats = statData || {}
  const { critical = 0, withExploit = 0, patchAvailable = 0, total = 0 } = stats

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const response = await api.get('/cves/export', { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `cve-export-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CVE export downloaded')
    } catch {
      toast.error('Export failed')
    } finally {
      setExportLoading(false)
    }
  }

  const handleRemediate = (cve: any) => {
    const next = PATCH_NEXT[cve.patchStatus] || 'pending'
    updatePatch.mutate({ id: cve.id, patchStatus: next })
  }

  const clearFilters = () => {
    setSeverityFilter('')
    setExploitFilter('')
    setPatchFilter('')
    setSearch('')
    setPage(0)
  }

  const hasActiveFilters = !!(severityFilter || exploitFilter || patchFilter || search)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">CVE Tracker</h1>
          <p className="text-slate-400">
            {statsLoading ? '…' : `${total.toLocaleString()} vulnerabilities tracked`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { refetch(); refetchStats() }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exportLoading}
          >
            <Download className={`mr-2 h-4 w-4 ${exportLoading ? 'animate-bounce' : ''}`} />
            {exportLoading ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button
            variant="primary"
            onClick={() => scanAssets.mutate()}
            disabled={scanAssets.isPending}
          >
            <ScanLine className={`mr-2 h-4 w-4 ${scanAssets.isPending ? 'animate-pulse' : ''}`} />
            {scanAssets.isPending ? 'Scanning…' : 'Scan Assets'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Critical</p>
                <p className="mt-1 text-2xl font-bold text-red-500">{statsLoading ? '…' : critical}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">With Exploit</p>
                <p className="mt-1 text-2xl font-bold text-orange-500">{statsLoading ? '…' : withExploit}</p>
              </div>
              <ShieldAlert className="h-8 w-8 text-orange-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Patch Available</p>
                <p className="mt-1 text-2xl font-bold text-green-500">{statsLoading ? '…' : patchAvailable}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total CVEs</p>
                <p className="mt-1 text-2xl font-bold text-blue-500">{statsLoading ? '…' : total}</p>
              </div>
              <Bug className="h-8 w-8 text-blue-500/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                placeholder="Search CVE ID, description, vendor, product…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              />
            </div>
            <Button
              variant={showFilters ? 'primary' : 'outline'}
              onClick={() => setShowFilters(v => !v)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1.5 rounded-full bg-cyan-500 px-1.5 py-0.5 text-xs text-white">
                  {[severityFilter, exploitFilter, patchFilter].filter(Boolean).length}
                </span>
              )}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" /> Clear
              </Button>
            )}
          </div>

          {/* Expanded filter row */}
          {showFilters && (
            <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-700 pt-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Severity</label>
                <select
                  value={severityFilter}
                  onChange={(e) => { setSeverityFilter(e.target.value); setPage(0) }}
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">All</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Exploit</label>
                <select
                  value={exploitFilter}
                  onChange={(e) => { setExploitFilter(e.target.value); setPage(0) }}
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">Any</option>
                  <option value="true">Has Exploit</option>
                  <option value="false">No Exploit</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Patch Status</label>
                <select
                  value={patchFilter}
                  onChange={(e) => { setPatchFilter(e.target.value); setPage(0) }}
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">All</option>
                  <option value="available">Available</option>
                  <option value="pending">Pending</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CVE Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {hasActiveFilters
                ? `Filtered Results (${cveTotal.toLocaleString()})`
                : `All CVEs (${cveTotal.toLocaleString()})`}
            </CardTitle>
            {/* Pagination */}
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>
                Page {page + 1} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {isLoading ? (
          <CardContent>
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-slate-800/60" />
              ))}
            </div>
          </CardContent>
        ) : isError ? (
          <CardContent>
            <div className="rounded-lg border border-red-700/40 bg-red-950/20 p-6 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
              <p className="mt-3 text-slate-300">Failed to load CVEs.</p>
              <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            </div>
          </CardContent>
        ) : cveItems.length === 0 ? (
          <CardContent>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-10 text-center">
              <Bug className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-slate-400">
                {hasActiveFilters ? 'No CVEs match the current filters.' : 'No CVEs tracked yet.'}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" /> Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CVE ID</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>CVSS</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Assets</TableHead>
                <TableHead>Exploit</TableHead>
                <TableHead>Patch</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cveItems.map((cve: any) => {
                const score = Number(cve.cvssScore) || 0
                const isPatchUpdating = updatePatch.isPending && updatePatch.variables?.id === cve.id
                return (
                  <TableRow
                    key={cve.id}
                    className="cursor-pointer hover:bg-slate-800/40"
                    onClick={() => navigate(`/cves/${cve.id}`)}
                  >
                    <TableCell>
                      <div onClick={(e) => e.stopPropagation()}>
                        <button
                          className="font-mono font-semibold text-blue-400 hover:underline"
                          onClick={() => navigate(`/cves/${cve.id}`)}
                        >
                          {cve.cveId}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-xs truncate text-sm text-slate-300">{cve.description}</p>
                      {(cve.vendor || cve.product) && (
                        <p className="text-xs text-slate-500">{[cve.vendor, cve.product].filter(Boolean).join(' / ')}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`text-lg font-bold ${getCVSSColor(score)}`}>
                        {score.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={SEV_BADGE[cve.severity] ?? 'default'}>{cve.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      {(cve.affectedAssets || 0) > 0 ? (
                        <Badge variant="danger">{cve.affectedAssets}</Badge>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cve.exploitAvailable ? 'danger' : 'default'}>
                        {cve.exploitAvailable ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={PATCH_BADGE[cve.patchStatus] ?? 'default'}>
                        {PATCH_ICON[cve.patchStatus]}
                        {cve.patchStatus || 'unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-400">
                        {cve.publishedDate ? formatDate(cve.publishedDate) : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/cves/${cve.id}`)}
                        >
                          Details
                        </Button>
                        <Button
                          size="sm"
                          variant={cve.patchStatus === 'available' ? 'ghost' : 'primary'}
                          disabled={isPatchUpdating}
                          onClick={() => handleRemediate(cve)}
                          title={`Cycle patch status: ${cve.patchStatus} → ${PATCH_NEXT[cve.patchStatus] ?? 'pending'}`}
                        >
                          {isPatchUpdating ? '…' : 'Remediate'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {/* Bottom pagination */}
        {!isLoading && cveItems.length > 0 && (
          <CardContent className="border-t border-slate-700 py-3">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, cveTotal)} of {cveTotal.toLocaleString()}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
