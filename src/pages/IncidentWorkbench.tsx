import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Play, CheckCircle2, Clock3, AlertTriangle, Plus, Trash2, Edit2,
  Link2, Server, RefreshCw, ChevronDown, ChevronUp, X, Save,
  StickyNote, Shield, AlertOctagon, Search,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { toast } from 'sonner'
import {
  useBootstrapIncidents,
  useCreateIncident,
  useDeleteIncident,
  useIncidentDetail,
  useIncidentStats,
  useIncidents,
  useUpdateIncident,
} from '@/hooks/useIncidents'
import { formatRelativeTime } from '@/lib/utils'
import api from '@/lib/api'
import { useSocketCtx } from '@/providers/SocketProvider'

// ─── helpers ────────────────────────────────────────────────────────────────

const SEV_VARIANT: Record<string, string> = {
  critical: 'danger',
  high: 'warning',
  medium: 'default',
  low: 'default',
  info: 'default',
}

const SEV_COLOR: Record<string, string> = {
  critical: 'text-red-400 border-red-700/50',
  high: 'text-orange-400 border-orange-700/40',
  medium: 'text-yellow-400 border-slate-700',
  low: 'text-slate-400 border-slate-700',
  info: 'text-slate-500 border-slate-700',
}

const STATUS_VARIANT: Record<string, 'danger' | 'warning' | 'success' | 'default'> = {
  new: 'danger',
  in_progress: 'warning',
  resolved: 'success',
}

function parseTimeline(description: string) {
  if (!description) return []
  return description
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^\[NOTE ([^\]]+)\] (.+)$/)
      if (m) return { type: 'note' as const, time: m[1], text: m[2] }
      return { type: 'info' as const, time: null, text: line }
    })
}

// ─── sub-components ─────────────────────────────────────────────────────────

function IncidentDetail({ id }: { id: string }) {
  const { data, isLoading } = useIncidentDetail(id)

  if (isLoading) {
    return (
      <div className="mt-3 space-y-2 border-t border-slate-700 pt-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-slate-800" />
        ))}
      </div>
    )
  }

  const { incident, relatedIOCs = [], relatedAssets = [] } = data ?? {}
  const timeline = parseTimeline(incident?.description || '')

  return (
    <div className="mt-3 space-y-4 border-t border-slate-700 pt-3">
      {/* Linked IOCs */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Linked IOCs ({relatedIOCs.length})
        </p>
        {relatedIOCs.length === 0 ? (
          <p className="text-xs text-slate-600">No IOCs linked yet.</p>
        ) : (
          <div className="space-y-1">
            {relatedIOCs.map((ioc: any) => (
              <Link
                key={ioc.id}
                to={`/iocs/${ioc.id}`}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-800"
              >
                <Badge variant={SEV_VARIANT[ioc.severity] as any}>{ioc.severity}</Badge>
                <span className="font-mono text-slate-300 truncate">{ioc.value}</span>
                <span className="ml-auto text-slate-500">{ioc.type}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Linked Assets */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Linked Assets ({relatedAssets.length})
        </p>
        {relatedAssets.length === 0 ? (
          <p className="text-xs text-slate-600">No assets linked yet.</p>
        ) : (
          <div className="space-y-1">
            {relatedAssets.map((asset: any) => (
              <Link
                key={asset.id}
                to={`/assets/${asset.id}`}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-800"
              >
                <Server className="h-3 w-3 text-slate-500" />
                <span className="text-slate-300">{asset.name}</span>
                <span className="text-slate-500">{asset.type}</span>
                <span className="ml-auto text-slate-500">risk {asset.riskScore}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Timeline
          </p>
          <div className="space-y-1.5">
            {timeline.map((entry, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="shrink-0 text-slate-600">
                  {entry.time ? new Date(entry.time).toLocaleString() : '•'}
                </span>
                <span className={entry.type === 'note' ? 'text-cyan-300' : 'text-slate-400'}>
                  {entry.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LinkIOCModal({
  incident,
  onClose,
  onLink,
}: {
  incident: any
  onClose: () => void
  onLink: (iocId: string) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (q.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await api.get(`/iocs?search=${encodeURIComponent(q)}&take=10`)
        setResults(data.data?.items || [])
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const linked = new Set<string>(incident.iocIds || [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Link IOC to "{incident.name}"</CardTitle>
            <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              ref={inputRef}
              className="w-full rounded-md border border-slate-600 bg-slate-700 py-2 pl-9 pr-3 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
              placeholder="Search IOC by value…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
            {searching && <p className="py-3 text-center text-xs text-slate-500">Searching…</p>}
            {!searching && q.length >= 2 && results.length === 0 && (
              <p className="py-3 text-center text-xs text-slate-500">No IOCs found for "{q}"</p>
            )}
            {results.map((ioc: any) => {
              const alreadyLinked = linked.has(ioc.id)
              return (
                <button
                  key={ioc.id}
                  disabled={alreadyLinked}
                  onClick={() => { onLink(ioc.id); onClose() }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-700 disabled:opacity-50"
                >
                  <Badge variant={SEV_VARIANT[ioc.severity] as any}>{ioc.severity}</Badge>
                  <span className="flex-1 truncate font-mono text-slate-200">{ioc.value}</span>
                  <span className="text-slate-500">{ioc.type}</span>
                  {alreadyLinked && <span className="text-emerald-500">linked</span>}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Currently linked: {incident.iocCount} IOC{incident.iocCount !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function LinkAssetModal({
  incident,
  onClose,
  onLink,
}: {
  incident: any
  onClose: () => void
  onLink: (assetId: string) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (q.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await api.get(`/assets?search=${encodeURIComponent(q)}&take=10`)
        setResults(data.data?.items || [])
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const linked = new Set<string>(incident.affectedAssets || [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Link Asset to "{incident.name}"</CardTitle>
            <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              ref={inputRef}
              className="w-full rounded-md border border-slate-600 bg-slate-700 py-2 pl-9 pr-3 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
              placeholder="Search asset by name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
            {searching && <p className="py-3 text-center text-xs text-slate-500">Searching…</p>}
            {!searching && q.length >= 2 && results.length === 0 && (
              <p className="py-3 text-center text-xs text-slate-500">No assets found for "{q}"</p>
            )}
            {results.map((asset: any) => {
              const alreadyLinked = linked.has(asset.id)
              return (
                <button
                  key={asset.id}
                  disabled={alreadyLinked}
                  onClick={() => { onLink(asset.id); onClose() }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-700 disabled:opacity-50"
                >
                  <Server className="h-3 w-3 text-slate-500 shrink-0" />
                  <span className="flex-1 text-slate-200">{asset.name}</span>
                  <span className="text-slate-500">{asset.type}</span>
                  <span className="text-slate-600">risk {asset.riskScore}</span>
                  {alreadyLinked && <span className="text-emerald-500">linked</span>}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Currently linked: {incident.assetCount} asset{incident.assetCount !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── main page ──────────────────────────────────────────────────────────────

export default function IncidentWorkbench() {
  const { socket } = useSocketCtx()

  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [linkIOCTarget, setLinkIOCTarget] = useState<any | null>(null)
  const [linkAssetTarget, setLinkAssetTarget] = useState<any | null>(null)
  const [noteState, setNoteState] = useState<{ id: string; text: string } | null>(null)

  const [createForm, setCreateForm] = useState({ name: '', severity: 'high', description: '' })
  const [editForm, setEditForm] = useState({ name: '', severity: 'high', description: '' })

  const { data: incidents = [], isLoading, isError, refetch } = useIncidents(statusFilter || undefined, 100)
  const { data: stats, refetch: refetchStats } = useIncidentStats()
  const bootstrap = useBootstrapIncidents()
  const createIncident = useCreateIncident()
  const updateIncident = useUpdateIncident()
  const deleteIncident = useDeleteIncident()

  // Real-time: socket events already invalidate queries via SocketProvider,
  // but also refetch stats so the counters stay in sync.
  useEffect(() => {
    if (!socket) return
    const refresh = () => { refetch(); refetchStats() }
    socket.on('incident:created', refresh)
    socket.on('incident:updated', refresh)
    socket.on('incident:deleted', refresh)
    return () => {
      socket.off('incident:created', refresh)
      socket.off('incident:updated', refresh)
      socket.off('incident:deleted', refresh)
    }
  }, [socket, refetch, refetchStats])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return [...(incidents as any[])]
      .filter((i) => !q || i.name.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [incidents, search])

  const handleCreate = async () => {
    if (!createForm.name.trim()) { toast.error('Name is required'); return }
    await createIncident.mutateAsync(createForm)
    setCreateForm({ name: '', severity: 'high', description: '' })
    setCreateOpen(false)
  }

  const handleSaveEdit = async () => {
    if (!editTarget) return
    await updateIncident.mutateAsync({ id: editTarget.id, ...editForm })
    setEditTarget(null)
  }

  const openEdit = (incident: any) => {
    setEditForm({ name: incident.name, severity: incident.severity, description: incident.description || '' })
    setEditTarget(incident)
  }

  const handleStatus = (incident: any, newStatus: string) => {
    updateIncident.mutate({ id: incident.id, status: newStatus })
  }

  const handleDelete = async (id: string) => {
    await deleteIncident.mutateAsync(id)
    setDeleteConfirm(null)
    if (expandedId === id) setExpandedId(null)
  }

  const handleAddNote = async () => {
    if (!noteState?.text.trim()) return
    await updateIncident.mutateAsync({ id: noteState.id, note: noteState.text })
    setNoteState(null)
    if (expandedId === noteState.id) {
      // detail refetches via query invalidation
    }
  }

  const handleLinkIOC = async (incident: any, iocId: string) => {
    const current: string[] = incident.iocIds || []
    if (current.includes(iocId)) { toast.info('IOC already linked'); return }
    await updateIncident.mutateAsync({ id: incident.id, iocIds: [...current, iocId] })
    if (expandedId === incident.id) {
      // detail query is invalidated by useUpdateIncident
    }
  }

  const handleLinkAsset = async (incident: any, assetId: string) => {
    const current: string[] = incident.affectedAssets || []
    if (current.includes(assetId)) { toast.info('Asset already linked'); return }
    await updateIncident.mutateAsync({ id: incident.id, affectedAssets: [...current, assetId] })
  }

  const STATUS_TABS = [
    { value: '', label: 'All', count: stats?.total ?? (incidents as any[]).length },
    { value: 'new', label: 'New', count: stats?.new ?? 0 },
    { value: 'in_progress', label: 'In Progress', count: stats?.inProgress ?? 0 },
    { value: 'resolved', label: 'Resolved', count: stats?.resolved ?? 0 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Incident Workbench</h1>
          <p className="text-slate-400">
            IOC-clustered incident triage, assignment, and workflow tracking
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { refetch(); refetchStats() }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => bootstrap.mutate(160)} disabled={bootstrap.isPending}>
            <Play className="mr-2 h-4 w-4" />
            {bootstrap.isPending ? 'Generating…' : 'Generate Clusters'}
          </Button>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Incident
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-slate-400">New</p><p className="text-2xl font-bold text-red-400">{stats?.new ?? 0}</p></div>
              <AlertTriangle className="h-7 w-7 text-red-400/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-slate-400">In Progress</p><p className="text-2xl font-bold text-amber-400">{stats?.inProgress ?? 0}</p></div>
              <Clock3 className="h-7 w-7 text-amber-400/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-slate-400">Resolved</p><p className="text-2xl font-bold text-emerald-400">{stats?.resolved ?? 0}</p></div>
              <CheckCircle2 className="h-7 w-7 text-emerald-400/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-slate-400">Total</p><p className="text-2xl font-bold text-slate-300">{stats?.total ?? 0}</p></div>
              <Shield className="h-7 w-7 text-slate-500/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            {/* Status tabs */}
            <div className="flex gap-1">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    statusFilter === tab.value
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 rounded-full bg-slate-700 px-1.5 py-0.5 text-xs">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative ml-auto">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="rounded-md border border-slate-700 bg-slate-800 py-1.5 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                placeholder="Search incidents…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-slate-800/60" />)}
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-red-700/40 bg-red-950/20 p-6 text-center">
              <AlertOctagon className="mx-auto h-10 w-10 text-red-500" />
              <p className="mt-3 text-slate-300">Failed to load incidents.</p>
              <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-10 text-center">
              <Shield className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-slate-400">
                {search ? `No incidents match "${search}"` : 'No incidents yet.'}
              </p>
              {!search && (
                <div className="mt-4 flex justify-center gap-3">
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Incident
                  </Button>
                  <Button variant="outline" onClick={() => bootstrap.mutate(160)} disabled={bootstrap.isPending}>
                    <Play className="mr-2 h-4 w-4" /> Generate Clusters
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((incident: any) => (
                <div
                  key={incident.id}
                  className={`rounded-lg border bg-slate-900/70 ${SEV_COLOR[incident.severity] ?? 'border-slate-700'}`}
                >
                  {/* Row */}
                  <div
                    className="cursor-pointer p-4"
                    onClick={() => setExpandedId(expandedId === incident.id ? null : incident.id)}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      {/* Meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-slate-100">{incident.name}</h4>
                          <Badge variant={SEV_VARIANT[incident.severity] as any}>{incident.severity}</Badge>
                          <Badge variant={STATUS_VARIANT[incident.status] ?? 'default'}>
                            {incident.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {incident.iocCount} IOC{incident.iocCount !== 1 ? 's' : ''} •{' '}
                          {incident.assetCount} asset{incident.assetCount !== 1 ? 's' : ''} •{' '}
                          {incident.techniqueCount} technique{incident.techniqueCount !== 1 ? 's' : ''} •{' '}
                          {formatRelativeTime(incident.createdAt)}
                        </p>
                      </div>

                      {/* Expand toggle */}
                      <div className="shrink-0 text-slate-500">
                        {expandedId === incident.id
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div
                      className="mt-3 flex flex-wrap gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Status transitions */}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={incident.status === 'in_progress' || incident.status === 'resolved' || updateIncident.isPending}
                        onClick={() => handleStatus(incident, 'in_progress')}
                        title={incident.status === 'in_progress' ? 'Already in progress' : 'Start investigation'}
                      >
                        <Clock3 className="mr-1 h-3 w-3" /> Start
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={incident.status === 'resolved' || updateIncident.isPending}
                        onClick={() => handleStatus(incident, 'resolved')}
                        title={incident.status === 'resolved' ? 'Already resolved' : 'Mark resolved'}
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" /> Resolve
                      </Button>

                      {/* Edit */}
                      <Button size="sm" variant="ghost" onClick={() => openEdit(incident)} title="Edit incident">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>

                      {/* Link IOC */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLinkIOCTarget(incident)}
                        title="Link an IOC"
                      >
                        <Shield className="mr-1 h-3.5 w-3.5 text-cyan-500" /> IOC
                      </Button>

                      {/* Link Asset */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLinkAssetTarget(incident)}
                        title="Link an asset"
                      >
                        <Server className="mr-1 h-3.5 w-3.5 text-purple-400" /> Asset
                      </Button>

                      {/* Add Note */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setNoteState(noteState?.id === incident.id ? null : { id: incident.id, text: '' })
                        }
                        title="Add a note"
                      >
                        <StickyNote className="mr-1 h-3.5 w-3.5 text-yellow-400" /> Note
                      </Button>

                      {/* Delete */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirm(incident.id)}
                        title="Delete incident"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>

                    {/* Inline note input */}
                    {noteState?.id === incident.id && (
                      <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          autoFocus
                          className="flex-1 rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                          placeholder="Add a note to the timeline…"
                          value={noteState!.text}
                          onChange={(e) => setNoteState({ id: noteState!.id, text: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote() }}
                        />
                        <Button size="sm" variant="primary" onClick={handleAddNote}>
                          <Save className="mr-1 h-3 w-3" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setNoteState(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {/* Inline delete confirm */}
                    {deleteConfirm === incident.id && (
                      <div
                        className="mt-3 rounded border border-red-500/40 bg-red-950/30 p-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-xs text-red-300">
                          Delete <strong>{incident.name}</strong>? This cannot be undone.
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="danger" onClick={() => handleDelete(incident.id)}>
                            Delete
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {expandedId === incident.id && (
                    <div className="px-4 pb-4">
                      <IncidentDetail id={incident.id} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create Incident Modal ── */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setCreateOpen(false) }}
        >
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>New Incident</CardTitle>
                <button onClick={() => setCreateOpen(false)}><X className="h-5 w-5 text-slate-400" /></button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400">Incident Name *</label>
                  <input
                    autoFocus
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    placeholder="e.g., Lateral Movement — Finance Subnet"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Severity</label>
                  <select
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    value={createForm.severity}
                    onChange={(e) => setCreateForm({ ...createForm, severity: e.target.value })}
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Description</label>
                  <textarea
                    rows={3}
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    placeholder="Initial description or context…"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <Button variant="primary" onClick={handleCreate} disabled={createIncident.isPending}>
                    {createIncident.isPending ? 'Creating…' : 'Create Incident'}
                  </Button>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Edit Incident Modal ── */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditTarget(null) }}
        >
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Edit Incident</CardTitle>
                <button onClick={() => setEditTarget(null)}><X className="h-5 w-5 text-slate-400" /></button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400">Incident Name</label>
                  <input
                    autoFocus
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Severity</label>
                  <select
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    value={editForm.severity}
                    onChange={(e) => setEditForm({ ...editForm, severity: e.target.value })}
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Description</label>
                  <textarea
                    rows={4}
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <Button variant="primary" onClick={handleSaveEdit} disabled={updateIncident.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateIncident.isPending ? 'Saving…' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Link IOC Modal ── */}
      {linkIOCTarget && (
        <LinkIOCModal
          incident={linkIOCTarget}
          onClose={() => setLinkIOCTarget(null)}
          onLink={(iocId) => handleLinkIOC(linkIOCTarget, iocId)}
        />
      )}

      {/* ── Link Asset Modal ── */}
      {linkAssetTarget && (
        <LinkAssetModal
          incident={linkAssetTarget}
          onClose={() => setLinkAssetTarget(null)}
          onLink={(assetId) => handleLinkAsset(linkAssetTarget, assetId)}
        />
      )}
    </div>
  )
}
