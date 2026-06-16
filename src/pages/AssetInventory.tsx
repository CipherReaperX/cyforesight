import { useState, useEffect } from 'react'
import { Search, Plus, Download, Upload, Server, Monitor, Network, Cloud, Grid, List, AlertTriangle, Link2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { useAssets, useBootstrapSmallEnterpriseAssets, useAssetThreats, useAssetVulnerabilities, useMapIOCsToAssets, useScanAsset } from '@/hooks/useAssets'
import { formatRelativeTime } from '@/lib/utils'
import apiClient from '@/lib/api'
import { Link } from 'react-router-dom'

export default function AssetInventory() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    skip: 0,
    take: 25,
    search: '',
  })
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)

  // Safe data handling with multiple fallback levels
  const { data, isLoading, refetch } = useAssets(filters)
  const bootstrapEnterprise = useBootstrapSmallEnterpriseAssets()
  const mapIOCs = useMapIOCsToAssets()
  const scanAsset = useScanAsset()
  const [scanningId, setScanningId] = useState<string | null>(null)
  const { data: selectedThreats } = useAssetThreats(selectedAssetId || '')
  const { data: selectedVulns } = useAssetVulnerabilities(selectedAssetId || '')
  const assets = data || { items: [], total: 0 }
  const assetItems = assets?.items || []
  const assetTotal = assets?.total || 0
  const selectedAsset = assetItems.find((a) => a.id === selectedAssetId) || null

  // Real-time polling every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (refetch) refetch()
    }, 60000)
    return () => clearInterval(interval)
  }, [refetch])

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'server': return Server
      case 'workstation': return Monitor
      case 'network_device': return Network
      case 'cloud_resource': return Cloud
      default: return Server
    }
  }

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-500'
    if (score >= 60) return 'text-orange-500'
    if (score >= 40) return 'text-yellow-500'
    return 'text-green-500'
  }

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

      await apiClient.post('/assets/upload-csv', formData)

      alert('Assets uploaded successfully!')
      setCsvFile(null)
      if (refetch) refetch()
    } catch (error: any) {
      alert(`Error uploading CSV: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleLoadEnterpriseBlueprint = async () => {
    await bootstrapEnterprise.mutateAsync()
    if (refetch) refetch()
  }

  const handleMapIOCsToAssets = async () => {
    await mapIOCs.mutateAsync(40)
    if (refetch) refetch()
  }

  const handleScan = async (assetId: string) => {
    setScanningId(assetId)
    try {
      await scanAsset.mutateAsync(assetId)
    } finally {
      setScanningId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Asset Inventory</h1>
          <p className="text-slate-400">{assetTotal} assets monitored</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="primary" onClick={handleLoadEnterpriseBlueprint} disabled={bootstrapEnterprise.isPending}>
            {bootstrapEnterprise.isPending ? 'Loading...' : 'Load Enterprise Blueprint'}
          </Button>
          <Button variant="primary" onClick={handleMapIOCsToAssets} disabled={mapIOCs.isPending}>
            <Link2 className="mr-2 h-4 w-4" />
            {mapIOCs.isPending ? 'Mapping...' : 'Map IOCs to Assets'}
          </Button>
          <Button variant="outline" onClick={() => document.getElementById('asset-csv-upload')?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <input
            id="asset-csv-upload"
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
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="primary">
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">High Risk</p>
                <p className="mt-2 text-2xl font-bold text-red-500">24</p>
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
                <p className="mt-2 text-2xl font-bold text-orange-500">127</p>
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
                <p className="mt-2 text-2xl font-bold text-yellow-500">342</p>
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
                <p className="mt-2 text-2xl font-bold text-blue-500">45/100</p>
              </div>
              <Server className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and View Toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search assets by name, IP, department..."
                value={search}
                onChange={(e) => {
                  const val = e.target.value
                  setSearch(val)
                  setFilters((prev) => ({ ...prev, skip: 0, search: val || '' }))
                }}
                className="pl-10"
              />
            </div>
            <Button variant="outline">Filters</Button>
          </div>
          <div className="ml-4 flex space-x-2">
            <Button
              variant={viewMode === 'list' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Assets Display */}
      {viewMode === 'list' ? (
        <Card>
          {isLoading ? (
            <div className="py-12 text-center text-slate-400">Loading assets...</div>
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
                  return (
                    <TableRow key={asset.id}>
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
                          <Progress
                            value={asset.riskScore || 0}
                            className="w-20"
                            barClassName={
                              (asset.riskScore || 0) >= 80 ? 'bg-red-500' :
                              (asset.riskScore || 0) >= 60 ? 'bg-orange-500' :
                              (asset.riskScore || 0) >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                            }
                          />
                          <span className={`text-sm font-semibold ${getRiskColor(asset.riskScore || 0)}`}>
                            {asset.riskScore || 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(asset.activeThreats || 0) > 0 ? (
                          <Badge variant="danger">{asset.activeThreats}</Badge>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(asset.unpatchedCVEs || 0) > 0 ? (
                          <Badge variant="warning">{asset.unpatchedCVEs}</Badge>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
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
                        <div className="flex space-x-2">
                          <Link to={`/assets/${asset.id}`}>
                            <Button size="sm" variant="ghost">View</Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={scanningId === asset.id}
                            onClick={() => handleScan(asset.id)}
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
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {assetItems.map((asset) => {
            const Icon = getAssetIcon(asset.type)
            return (
              <Card key={asset.id} hoverable>
                <CardContent>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
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
                    <div>
                      <Progress
                        value={asset.riskScore || 0}
                        barClassName={
                          (asset.riskScore || 0) >= 80 ? 'bg-red-500' :
                          (asset.riskScore || 0) >= 60 ? 'bg-orange-500' :
                          (asset.riskScore || 0) >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Active Threats</span>
                      <Badge variant={(asset.activeThreats || 0) > 0 ? 'danger' : 'default'}>
                        {asset.activeThreats || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Unpatched CVEs</span>
                      <Badge variant={(asset.unpatchedCVEs || 0) > 0 ? 'warning' : 'default'}>
                        {asset.unpatchedCVEs || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Status</span>
                      <div className="flex items-center space-x-2">
                        <div className={`h-2 w-2 rounded-full ${
                          asset.status === 'online' ? 'bg-green-500' :
                          asset.status === 'offline' ? 'bg-red-500' : 'bg-gray-500'
                        }`} />
                        <span className="capitalize">{asset.status || 'unknown'}</span>
                      </div>
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
                      onClick={() => handleScan(asset.id)}
                    >
                      {scanningId === asset.id ? 'Scanning…' : 'Scan Now'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {selectedAsset && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedAsset.name} - Vulnerabilities & Mapped IOCs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h4 className="mb-3 text-sm font-semibold text-slate-200">Top Vulnerabilities</h4>
                <div className="space-y-2">
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

              <div>
                <h4 className="mb-3 text-sm font-semibold text-slate-200">Mapped IOCs</h4>
                <div className="space-y-2">
                  {(selectedThreats?.items || []).slice(0, 10).map((ioc: any) => (
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
                    <p className="text-sm text-slate-500">No IOC mapping available yet.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
