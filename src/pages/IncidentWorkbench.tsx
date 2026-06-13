import { useMemo, useState } from 'react'
import { Play, CheckCircle2, Clock3, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useBootstrapIncidents, useIncidentStats, useIncidents, useUpdateIncident } from '@/hooks/useIncidents'
import { formatRelativeTime } from '@/lib/utils'

export default function IncidentWorkbench() {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const { data: incidents = [] } = useIncidents(statusFilter || undefined, 100)
  const { data: stats } = useIncidentStats()
  const bootstrap = useBootstrapIncidents()
  const updateIncident = useUpdateIncident()

  const ordered = useMemo(
    () => [...incidents].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [incidents]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Incident Workbench</h1>
          <p className="text-slate-400">Clustered high-risk IOC incidents, assignment, and workflow tracking</p>
        </div>
        <Button variant="primary" onClick={() => bootstrap.mutate(160)} disabled={bootstrap.isPending}>
          <Play className="mr-2 h-4 w-4" />
          {bootstrap.isPending ? 'Generating...' : 'Generate Incident Clusters'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card><CardContent><div className="flex items-center justify-between"><div><p className="text-xs text-slate-400">New</p><p className="text-2xl font-bold text-red-400">{stats?.new || 0}</p></div><AlertTriangle className="h-6 w-6 text-red-400" /></div></CardContent></Card>
        <Card><CardContent><div className="flex items-center justify-between"><div><p className="text-xs text-slate-400">In Progress</p><p className="text-2xl font-bold text-amber-400">{stats?.inProgress || 0}</p></div><Clock3 className="h-6 w-6 text-amber-400" /></div></CardContent></Card>
        <Card><CardContent><div className="flex items-center justify-between"><div><p className="text-xs text-slate-400">Resolved</p><p className="text-2xl font-bold text-emerald-400">{stats?.resolved || 0}</p></div><CheckCircle2 className="h-6 w-6 text-emerald-400" /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Incident Queue</CardTitle>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            >
              <option value="">All</option>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ordered.map((incident: any) => (
              <div key={incident.id} className="rounded-lg border border-slate-700 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-100">{incident.name}</h4>
                    <p className="text-xs text-slate-400">
                      {incident.iocCount} IOCs • {incident.techniqueCount} techniques • {formatRelativeTime(incident.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={incident.severity === 'critical' ? 'danger' : incident.severity === 'high' ? 'warning' : 'default'}>
                      {incident.severity}
                    </Badge>
                    <Badge variant="default">{incident.status}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => updateIncident.mutate({ id: incident.id, status: 'in_progress' })}>
                    Start
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateIncident.mutate({ id: incident.id, status: 'resolved' })}>
                    Resolve
                  </Button>
                </div>
              </div>
            ))}
            {ordered.length === 0 && <p className="text-sm text-slate-500">No incidents yet. Generate clusters to begin.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
