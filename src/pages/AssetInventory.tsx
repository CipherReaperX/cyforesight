import { useState, useRef } from 'react'
import {
  Search, Plus, Download, Upload, Server, Monitor, Network, Cloud,
  Grid, List, AlertTriangle, Link2, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import {
  useAssets, useAssetStats, useCreateAsset,
  useBootstrapSmallEnterpriseAssets, useAssetThreats, useAssetVulnerabilities,
  useMapIOCsToAssets, useScanAsset,
} from '@/hooks/useAssets'
import { formatRelativeTime } from '@/lib/utils'
import apiClient from '@/lib/api'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

const ASSET_TYPES = ['server', 'workstation', 'network_device', 'cloud_resource', 'application']
const ASSET_STATUSES = ['online', 'offline', 'unknown']

const BLANK_FORM = { name: '', type: 'server', ip: '', hostname: '', os: '', department: '', owner: '' }

function getAssetIcon(type: string) {
  switch (type) {
    case 'server': return Server
    case 'workstation': return Monitor
    case 'network_device': return Network
    case 'cloud_resource': return Cloud
    default: return Server
  }
}

function getRiskColor(score: number) {
  if (score >= 80) return 'text-red-500'
  if (score >= 60) return 'text-orange-500'
  if (score >= 40) return 'text-yellow-500'
  return 'text-green-500'
}

function getRiskBarClass(score: number) {
  if (score >= 80) return 'bg-red-500'
  if (score >= 60) return 'bg-orange-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-green-500'
}

export default function AssetInventory() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [scanningId, setScanningId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ ...BLANK_FORM })

  const filters = { skip: page * PAGE_SIZE, take: PAGE_SIZE, search, type: typeFilter, status: statusFilter }

  const { data, isLoading, refetch } = useAssets(filters)
  const { data: stats } = useAssetStats()
  const bootstrapEnterprise = useBootstrapSmallEnterpriseAssets()
  const mapIOCs = useMapIOCsToAssets()
  const scanAsset = useScanAsset()
  const createAsset = useCreateAsset()
  const { data: selectedThreats } = useAssetThreats(selectedAssetId || '')
  const { data: selectedVulns } = useAssetVulnerabilities(selectedAssetId || '')

  const assetItems = data?.items ?? []
  const assetTotal = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(assetTotal / PAGE_SIZE))
  const selectedAsset = assetItems.find((a) => a.id === selectedAssetId) ?? null

  const handleScan = async (assetId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setScanningId(assetId)
    try {
      const result = await scanAsset.mutateAsync(assetId)
      const checks = result?.checksRun ?? 0
      const errCount = Object.keys(result?.errors ?? {}).length
      toast.success(`Scan complete — ${checks} check${checks !== 1 ? 's' : ''} run${errCount ? `, ${errCount} blocked (private range)` : ''}`)
    } finally {
      setScanningId(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setCsvFile(e.target.files[0])
  }

  const handleUploadCsv = async () => {
    if (!csvFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      await apiClient.post('/assets/upload-csv', formData)
      toast.success('Assets uploaded successfully')
      setCsvFile(null)
      refetch()
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleExport = async () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (typeFilter) params.set('type', typeFilter)
    if (statusFilter) params.set('status', statusFilter)
    try {
      const resp = await apiClient.get(`/assets/export?${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(resp.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'assets.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    try {
      await createAsset.mutateAsync({
        name: form.name.trim(),
        type: form.type as any,
        ip: form.ip.trim() || undefined,
        hostname: form.hostname.trim() || undefined,
        os: form.os.trim() || undefined,
        department: form.department.trim() || undefined,
        owner: form.owner.trim() || undefined,
      })
      setAddOpen(false)
      setForm({ ...BLANK_FORM })
      refetch()
    } catch { /* toast shown by mutation */ }
  }

  const applySearch = (val: string) => {
    setSearch(val)
    setPage(0)
  }

  const applyTypeFilter = (val: string) => {
    setTypeFilter(val)
    setPage(0)
  }

  const applyStatusFilter = (val: string) => {
    setStatusFilter(val)
    setPage(0)
  }

  const selectRow = (id: string) => {
    setSelectedAssetId(prev => prev === id ? null : id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Asset Inventory</h1>
          <p className="text-slate-400">{assetTotal} assets monitored</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => bootstrapEnterprise.mutateAsync().then(() => refetch())} disabled={bootstrapEnterprise.isPending}>
            {bootstrapEnterprise.isPending ? 'Loading…' : 'Load Enterprise Blueprint'}
          </Button>
          <Button variant="primary" onClick={() => mapIOCs.mutateAsync(40).then(() => refetch())} disabled={mapIOCs.isPending}>
            <Link2 className="mr-2 h-4 w-4" />
            {mapIOCs.isPending ? 'Mapping…' : 'Map IOCs'}
          </Button>
          <Button variant="outline" onClick={() => document.getElementById('asset-csv-upload')?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <input id="asset-csv-upload" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} disabled={uploading} />
          {csvFile && (
            <Button onClick={handleUploadCsv} disabled={uploading}>
              {uploading ? 'Uploading…' : `Upload ${csvFile.name}`}
            </Button>
          )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Live Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">High Risk</p>
                <p className="mt-2 text-2xl font-bold text-red-500">{stats?.highRisk ?? '—'}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Active Threats</p>
                <p className="mt-2 text-2xl font-bold text-orange-500">{stats?.totalThreats ?? '—'}</p>
              </div>
              <Server className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Unpatched CVEs</p>
                <p className="mt-2 text-2xl font-bold text-yellow-500">{stats?.totalCVEs ?? '—'}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Avg Risk Score</p>
                <p className="mt-2 text-2xl font-bold text-blue-500">{stats ? `${stats.avgRisk}/100` : '—'}</p>
              </div>
              <Server className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filters + View Toggle */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search assets by name, IP, hostname…"
              value={search}
              onChange={(e) => applySearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => applyTypeFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {ASSET_TYPES.map(t => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => applyStatusFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {ASSET_STATUSES.map(s => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </select>
          {(typeFilter || statusFilter || search) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); setPage(0) }}>
              <X className="mr-1 h-3 w-3" /> Clear
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant={viewMode === 'list' ? 'primary' : 'ghost'} size="sm" onClick={() => setViewMode('list')}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'grid' ? 'primary' : 'ghost'} size="sm" onClick={() => setViewMode('grid')}>
              <Grid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Asset List */}
      {viewMode === 'list' ? (
        <Card>
          {isLoading ? (
            <div className="py-12 text-center text-slate-400">Loading assets…</div>
          ) : assetItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400">No assets found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead>Threats</TableHead>
                  <TableHead>CVEs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Scan</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetItems.map((asset) => {
                  const Icon = getAssetIcon(asset.type)
                  const isSelected = selectedAssetId === asset.id
                  return (
                    <TableRow
                      key={asset.id}
                      onClick={() => selectRow(asset.id)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-900/30' : 'hover:bg-slate-800/50'}`}
                    >
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Icon className="h-5 w-5 text-blue-500" />
                          <div>
                            <p className="font-semibold text-slate-100">{asset.name}</p>
                            <p className="text-xs text-slate-400">{asset.department || 'N/A'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge>{(asset.type || 'unknown').replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-slate-300">{asset.ip || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Progress value={asset.riskScore || 0} className="w-20" barClassName={getRiskBarClass(asset.riskScore || 0)} />
                          <span className={`text-sm font-semibold ${getRiskColor(asset.riskScore || 0)}`}>
                            {asset.riskScore || 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(asset.activeThreats || 0) > 0
                          ? <Badge variant="danger">{asset.activeThreats}</Badge>
                          : <span className="text-slate-500">0</span>}
                      </TableCell>
                      <TableCell>
                        {(asset.unpatchedCVEs || 0) > 0
                          ? <Badge variant="warning">{asset.unpatchedCVEs}</Badge>
                          : <span className="text-slate-500">0</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className={`h-2 w-2 rounded-full ${
                            asset.status === 'online' ? 'bg-green-500' :
                            asset.status === 'offline' ? 'bg-red-500' : 'bg-gray-500'
                          }`} />
                          <span className="text-sm text-slate-400 capitalize">{asset.status || 'unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-400">
                          {asset.lastScan ? formatRelativeTime(asset.lastScan) : 'Never'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                          <Link to={`/assets/${asset.id}`}>
                            <Button size="sm" variant="ghost">View</Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={scanningId === asset.id}
                            onClick={(e) => handleScan(asset.id, e)}
                          >
                            {scanningId === asset.id ? 'Scanning…' : 'Scan'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          {/* Pagination */}
          {assetTotal > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-slate-700 px-4 py-3">
              <span className="text-sm text-slate-400">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, assetTotal)} of {assetTotal}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="flex items-center px-2 text-sm text-slate-400">
                  {page + 1} / {totalPages}
                </span>
                <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}><CardContent><div className="h-40 animate-pulse rounded bg-slate-700/50" /></CardContent></Card>
                ))
              : assetItems.map((asset) => {
                  const Icon = getAssetIcon(asset.type)
                  const isSelected = selectedAssetId === asset.id
                  return (
                    <Card key={asset.id} hoverable className={isSelected ? 'ring-2 ring-blue-500' : ''}>
                      <CardContent>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => selectRow(asset.id)}>
                            <div className="rounded-lg bg-blue-500/10 p-3">
                              <Icon className="h-6 w-6 text-blue-500" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-100">{asset.name}</h4>
                              <p className="text-sm text-slate-400">{asset.department || 'N/A'}</p>
                            </div>
                          </div>
                          <Badge>{(asset.type || 'unknown').replace('_', ' ')}</Badge>
                        </div>

                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">IP Address</span>
                            <span className="font-mono text-slate-300">{asset.ip || 'N/A'}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">Risk Score</span>
                            <span className={`font-semibold ${getRiskColor(asset.riskScore || 0)}`}>
                              {asset.riskScore || 0}/100
                            </span>
                          </div>
                          <Progress value={asset.riskScore || 0} barClassName={getRiskBarClass(asset.riskScore || 0)} />
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">Threats / CVEs</span>
                            <div className="flex gap-1">
                              <Badge variant={(asset.activeThreats || 0) > 0 ? 'danger' : 'default'}>{asset.activeThreats || 0}</Badge>
                              <Badge variant={(asset.unpatchedCVEs || 0) > 0 ? 'warning' : 'default'}>{asset.unpatchedCVEs || 0}</Badge>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">Last Scan</span>
                            <span className="text-slate-400">{asset.lastScan ? formatRelativeTime(asset.lastScan) : 'Never'}</span>
                          </div>
                        </div>

                        <div className="mt-4 flex space-x-2">
                          <Link to={`/assets/${asset.id}`} className="flex-1">
                            <Button size="sm" variant="outline" className="w-full">View Details</Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={scanningId === asset.id}
                            onClick={(e) => handleScan(asset.id, e)}
                          >
                            {scanningId === asset.id ? 'Scanning…' : 'Scan Now'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
          </div>
          {/* Grid pagination */}
          {assetTotal > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-4">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-sm text-slate-400">{page + 1} / {totalPages}</span>
              <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Selected Asset Detail Panel */}
      {selectedAsset && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedAsset.name} — Threats & Vulnerabilities</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setSelectedAssetId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h4 className="mb-3 text-sm font-semibold text-slate-200">Mapped IOCs</h4>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {(selectedThreats?.items || []).slice(0, 15).map((ioc: any) => (
                    <div key={ioc.id} className="rounded border border-slate-700 bg-slate-900/70 p-3">
                      <div className="flex items-center justify-between">
                        <span className="truncate font-mono text-xs text-cyan-300">{ioc.value}</span>
                        <Badge variant="danger">{ioc.severity}</Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{ioc.type}</span>
                        <span>score {ioc.score?.toFixed ? ioc.score.toFixed(2) : ioc.score}</span>
                      </div>
                    </div>
                  ))}
                  {(selectedThreats?.items || []).length === 0 && (
                    <p className="text-sm text-slate-500">No IOC mapping available yet. Run "Map IOCs" first.</p>
                  )}
                </div>
              </div>
              <div>
                <h4 className="mb-3 text-sm font-semibold text-slate-200">Top Vulnerabilities</h4>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {(selectedVulns?.items || []).slice(0, 8).map((v: any) => (
                    <div key={v.id || v.cveId} className="rounded border border-slate-700 bg-slate-900/70 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-orange-400">{v.cveId}</span>
                        <Badge variant={v.severity === 'critical' ? 'danger' : v.severity === 'high' ? 'warning' : 'default'}>
                          {v.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{v.description}</p>
                    </div>
                  ))}
                  {(selectedVulns?.items || []).length === 0 && (
                    <p className="text-sm text-slate-500">No vulnerabilities mapped yet.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Asset Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">Add Asset</h2>
              <button onClick={() => setAddOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddAsset} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-400">Name *</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. WEB-SRV01"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">IP Address</label>
                  <Input
                    value={form.ip}
                    onChange={(e) => setForm(f => ({ ...f, ip: e.target.value }))}
                    placeholder="e.g. 10.10.1.50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Hostname</label>
                  <Input
                    value={form.hostname}
                    onChange={(e) => setForm(f => ({ ...f, hostname: e.target.value }))}
                    placeholder="e.g. web-srv01.corp.local"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">OS</label>
                  <Input
                    value={form.os}
                    onChange={(e) => setForm(f => ({ ...f, os: e.target.value }))}
                    placeholder="e.g. Ubuntu 22.04"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Department</label>
                  <Input
                    value={form.department}
                    onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))}
                    placeholder="e.g. Engineering"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Owner</label>
                  <Input
                    value={form.owner}
                    onChange={(e) => setForm(f => ({ ...f, owner: e.target.value }))}
                    placeholder="e.g. Platform Team"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={createAsset.isPending}>
                  {createAsset.isPending ? 'Creating…' : 'Create Asset'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
