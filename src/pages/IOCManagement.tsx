import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Search, Plus, Download, Upload, Eye, MoreVertical, Copy, RefreshCw, X, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { useBootstrapDiverseIOCs, useCreateIOC, useDeleteIOC, useFreshIOCs, useIOCs, useSyncAllFeedsForIOCs } from '@/hooks/useIOCs'
import { formatNumber, formatRelativeTime, truncate } from '@/lib/utils'
import { Link } from 'react-router-dom'
import apiClient from '@/lib/api'
import { useIOCDistribution } from '@/hooks/useDashboard'

type BadgeVariant = 'default' | 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success' | 'warning' | 'danger'

const IOC_TYPES = ['ip', 'domain', 'hash', 'url', 'email', 'registry', 'mutex', 'user-agent'] as const
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const

export default function IOCManagement() {
  const [searchParams] = useSearchParams()

  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '')
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [filters, setFilters] = useState(() => ({
    skip: 0,
    take: 25,
    type: searchParams.get('type') || '',
    severity: searchParams.get('severity') || '',
    status: searchParams.get('status') || '',
  }))

  // Sync filters when URL params change (e.g. stat card navigation while page is mounted)
  useEffect(() => {
    setFilters(f => ({
      ...f,
      skip: 0,
      type: searchParams.get('type') || '',
      severity: searchParams.get('severity') || '',
      status: searchParams.get('status') || '',
    }))
    const s = searchParams.get('search') || ''
    setSearchInput(s)
    setSearch(s)
  }, [searchParams])

  // Debounce search input by 350ms
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 350)
    return () => clearTimeout(id)
  }, [searchInput])

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Add IOC modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState({
    value: '',
    type: 'ip' as typeof IOC_TYPES[number],
    severity: 'medium' as typeof SEVERITIES[number],
    confidence: 50,
    tags: '',
    description: '',
  })

  // MoreVertical dropdown state — stores the ioc id whose menu is open
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    if (openMenuId) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  const { data, isLoading, refetch } = useIOCs({ ...filters, search: search || undefined })
  const { data: freshData, refetch: refetchFresh } = useFreshIOCs(24, 100)
  const { data: distribution = [] } = useIOCDistribution()
  const syncAllFeeds = useSyncAllFeedsForIOCs()
  const bootstrapDiverse = useBootstrapDiverseIOCs()
  const createIOC = useCreateIOC()
  const deleteIOC = useDeleteIOC()

  const iocs = data || { items: [], total: 0 }
  const iocItems = iocs?.items || []
  const iocTotal = iocs?.total || 0
  const freshTodayCount = freshData?.totalFreshToday || 0

  const mapSeverityToBadge = (severity: string): BadgeVariant =>
    severity === 'info' ? 'default' : (severity as BadgeVariant)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setCsvFile(e.target.files[0])
  }

  const handleUploadCsv = async () => {
    if (!csvFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      await apiClient.post('/iocs/upload-csv', formData)
      toast.success('IOCs uploaded successfully!')
      setCsvFile(null)
      refetch()
    } catch (error: any) {
      toast.error(`Error uploading CSV: ${error?.response?.data?.message || error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleFetchFreshIOCs = async () => {
    try {
      await syncAllFeeds.mutateAsync()
      await Promise.all([refetch(), refetchFresh()])
    } catch {
      // onError in the hook already shows the toast
    }
  }

  const handleLoadDiverseIOCs = async () => {
    try {
      await bootstrapDiverse.mutateAsync(160)
      await Promise.all([refetch(), refetchFresh()])
    } catch {
      // onError in the hook already shows the toast
    }
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

  const handleAddIOC = async (e: React.FormEvent) => {
    e.preventDefault()
    await createIOC.mutateAsync({
      value: form.value.trim(),
      type: form.type,
      severity: form.severity,
      confidence: form.confidence,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      description: form.description || undefined,
    } as any)
    setShowAddModal(false)
    setForm({ value: '', type: 'ip', severity: 'medium', confidence: 50, tags: '', description: '' })
  }

  const handleDelete = async (id: string) => {
    setOpenMenuId(null)
    await deleteIOC.mutateAsync(id)
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
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
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
            {IOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, skip: 0, severity: e.target.value })}
            className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
          >
            <option value="">All Severity</option>
            {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
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
                    <div className="flex items-center space-x-2">
                      <Link to={`/iocs/${ioc.id}`}>
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <div className="relative">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOpenMenuId(openMenuId === ioc.id ? null : ioc.id)}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                        {openMenuId === ioc.id && (
                          <div
                            ref={menuRef}
                            className="absolute right-0 top-8 z-50 w-36 rounded-md border border-slate-700 bg-slate-800 shadow-lg"
                          >
                            <Link
                              to={`/iocs/${ioc.id}`}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                              onClick={() => setOpenMenuId(null)}
                            >
                              <Eye className="h-4 w-4" /> View Details
                            </Link>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700"
                              onClick={() => handleDelete(ioc.id)}
                              disabled={deleteIOC.isPending}
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
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

      {/* Add IOC Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-100">Add New IOC</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddIOC} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">IOC Value *</label>
                <Input
                  placeholder="e.g. 192.168.1.1, malicious.com, abc123..."
                  value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Type *</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as typeof IOC_TYPES[number] }))}
                    className="w-full h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
                    required
                  >
                    {IOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Severity *</label>
                  <select
                    value={form.severity}
                    onChange={e => setForm(f => ({ ...f, severity: e.target.value as typeof SEVERITIES[number] }))}
                    className="w-full h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
                    required
                  >
                    {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">
                  Confidence: {form.confidence}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.confidence}
                  onChange={e => setForm(f => ({ ...f, confidence: Number(e.target.value) }))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Tags (comma-separated)</label>
                <Input
                  placeholder="e.g. ransomware, apt28, c2"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Description</label>
                <textarea
                  rows={3}
                  placeholder="Optional description..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={createIOC.isPending}>
                  {createIOC.isPending ? 'Creating...' : 'Create IOC'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
