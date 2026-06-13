import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { Search, Plus, Download, Upload, Eye, MoreVertical, Copy, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { useBootstrapDiverseIOCs, useFreshIOCs, useIOCs, useSyncAllFeedsForIOCs } from '@/hooks/useIOCs'
import { formatNumber, formatRelativeTime, truncate } from '@/lib/utils'
import { Link } from 'react-router-dom'
import apiClient from '@/lib/api'
import { useIOCDistribution } from '@/hooks/useDashboard'

type BadgeVariant = 'default' | 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success' | 'warning' | 'danger'

export default function IOCManagement() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    skip: 0,
    take: 25,
    type: '',
    severity: '',
    status: '',
  })

  // Debounce search input by 350ms
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 350)
    return () => clearTimeout(id)
  }, [searchInput])
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Safe default with multiple fallback levels
  const { data, isLoading, refetch } = useIOCs({ ...filters, search: search || undefined })
  const { data: freshData, refetch: refetchFresh } = useFreshIOCs(24, 100)
  const { data: distribution = [] } = useIOCDistribution()
  const syncAllFeeds = useSyncAllFeedsForIOCs()
  const bootstrapDiverse = useBootstrapDiverseIOCs()
  const iocs = data || { items: [], total: 0 }
  const iocItems = iocs?.items || []
  const iocTotal = iocs?.total || 0
  const freshTodayCount = freshData?.totalFreshToday || 0

  const mapSeverityToBadge = (severity: string): BadgeVariant =>
    severity === 'info' ? 'default' : (severity as BadgeVariant)

  // Real-time polling every 60 seconds to show new feeds
  useEffect(() => {
    const interval = setInterval(() => {
      if (refetch) refetch()
    }, 60000) // 60 seconds
    return () => clearInterval(interval)
  }, [refetch])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setCsvFile(e.target.files[0])
    }
  }

  const handleUploadCsv = async () => {
    if (!csvFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', csvFile)

      await apiClient.post('/iocs/upload-csv', formData)

      alert('IOCs uploaded successfully!')
      setCsvFile(null)
      if (refetch) refetch() // Refresh the IOC list
    } catch (error: any) {
      alert(`Error uploading CSV: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleFetchFreshIOCs = async () => {
    await syncAllFeeds.mutateAsync()
    await Promise.all([refetch(), refetchFresh()])
  }

  const handleLoadDiverseIOCs = async () => {
    await bootstrapDiverse.mutateAsync(160)
    await Promise.all([refetch(), refetchFresh()])
  }

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams({ format })
      if (filters.type) params.append('type', filters.type)
      if (filters.severity) params.append('severity', filters.severity)
      if (filters.status) params.append('status', filters.status)
      const response = await apiClient.get(`/iocs/export?${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `iocs.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported IOCs as ${format.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">IOC Management</h1>
          <p className="text-slate-400">{iocTotal} indicators tracked • {freshTodayCount} fresh today</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="primary" onClick={handleFetchFreshIOCs} disabled={syncAllFeeds.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncAllFeeds.isPending ? 'animate-spin' : ''}`} />
            Fetch Fresh IOCs
          </Button>
          <Button variant="outline" onClick={() => document.getElementById('csv-file-input')?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button variant="outline" onClick={handleLoadDiverseIOCs} disabled={bootstrapDiverse.isPending}>
            {bootstrapDiverse.isPending ? 'Loading...' : 'Load Diverse IOC Set'}
          </Button>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            disabled={uploading}
          />
          {csvFile && (
            <Button onClick={handleUploadCsv} disabled={uploading}>
              {uploading ? 'Uploading...' : `Upload ${csvFile.name}`}
            </Button>
          )}
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport('json')}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
          <Button variant="primary">
            <Plus className="mr-2 h-4 w-4" />
            Add IOC
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        {distribution.map((d) => (
          <Card key={d.type}>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-500">{d.type}</p>
              <p className="text-lg font-bold text-slate-100">{formatNumber(d.count)}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search IOCs by value, tag, source..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, skip: 0, type: e.target.value })}
            className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
          >
            <option value="">All Types</option>
            <option value="ip">IP</option>
            <option value="domain">Domain</option>
            <option value="hash">Hash</option>
            <option value="url">URL</option>
            <option value="email">Email</option>
            <option value="registry">Registry</option>
            <option value="mutex">Mutex</option>
            <option value="user-agent">User Agent</option>
          </select>
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, skip: 0, severity: e.target.value })}
            className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
          >
            <option value="">All Severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, skip: 0, status: e.target.value })}
            className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
            <option value="whitelisted">Whitelisted</option>
            <option value="archived">Archived</option>
          </select>
          <Button
            variant="outline"
            onClick={() => setFilters({ skip: 0, take: filters.take, type: '', severity: '', status: '' })}
          >
            Clear
          </Button>
        </div>
      </Card>

      {/* IOC Table */}
      <Card>
        {isLoading ? (
          <div className="py-12 text-center text-slate-400">Loading IOCs...</div>
        ) : iocItems.length === 0 ? (
          <div className="py-12 text-center text-slate-400">No indicators found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <input type="checkbox" className="rounded" />
                </TableHead>
                <TableHead>IOC Value</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>First Seen</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Assets</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {iocItems.map((ioc) => (
                <TableRow key={ioc.id}>
                  <TableCell>
                    <input type="checkbox" className="rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm text-slate-300">
                        {truncate(ioc.value, 30)}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(ioc.value)
                          toast.success('Copied to clipboard')
                        }}
                        className="text-slate-400 hover:text-slate-300"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge>{ioc.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={mapSeverityToBadge(ioc.severity)}>{ioc.severity}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Progress value={ioc.confidence || 0} className="w-20" />
                      <span className="text-sm text-slate-400">{ioc.confidence || 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(ioc.tags || []).slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="default" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {(ioc.tags || []).length > 2 && (
                        <Badge variant="default" className="text-xs">
                          +{ioc.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-400">
                      {formatRelativeTime(ioc.firstSeen)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-400">
                      {formatRelativeTime(ioc.lastSeen)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="warning">{ioc.affectedAssets || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Link to={`/iocs/${ioc.id}`}>
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button size="sm" variant="ghost">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-700 pt-4">
          <div className="text-sm text-slate-400">
            Showing {filters.skip + 1} to {Math.min(filters.skip + filters.take, iocTotal)} of {iocTotal}
          </div>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              disabled={filters.skip === 0}
              onClick={() => setFilters({ ...filters, skip: Math.max(0, filters.skip - filters.take) })}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={filters.skip + filters.take >= iocTotal}
              onClick={() => setFilters({ ...filters, skip: filters.skip + filters.take })}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
