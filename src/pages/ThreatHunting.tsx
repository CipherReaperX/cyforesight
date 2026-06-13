import { useMemo, useState } from 'react'
import { Search, Play, Save, Download, History, Bot } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  useCreateHuntQuery,
  useHuntQueries,
  useHuntRuns,
  useRunHuntAutomation,
  useRunSavedHunt,
  useRunThreatHunt,
} from '@/hooks/useHunting'
import { formatRelativeTime } from '@/lib/utils'

export default function ThreatHunting() {
  const [query, setQuery] = useState('ioc.severity:critical AND ioc.type:domain')
  const [dataSource, setDataSource] = useState<'all' | 'iocs' | 'assets' | 'cves'>('all')
  const [hours, setHours] = useState(24)
  const [lastRun, setLastRun] = useState<any | null>(null)

  const { data: savedQueries = [] } = useHuntQueries(100)
  const { data: recentRuns = [] } = useHuntRuns(25)
  const runMutation = useRunThreatHunt()
  const saveMutation = useCreateHuntQuery()
  const runSavedMutation = useRunSavedHunt()
  const automationMutation = useRunHuntAutomation()

  const latestRun = useMemo(() => lastRun || recentRuns[0] || null, [lastRun, recentRuns])

  const handleRun = async () => {
    const result = await runMutation.mutateAsync({
      query,
      dataSource,
      hours,
      limit: 250,
    })
    setLastRun(result)
  }

  const handleSave = async () => {
    await saveMutation.mutateAsync({
      name: `Hunt - ${new Date().toLocaleString()}`,
      query,
      description: 'Saved from Threat Hunting workspace',
      isScheduled: true,
      scheduleCron: '*/30 * * * *',
      tags: ['auto', dataSource],
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Threat Hunting Workspace</h1>
          <p className="text-slate-400">Run real hunt logic, save hunts, and automate scheduled executions</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => automationMutation.mutate()} disabled={automationMutation.isPending}>
            <Bot className="mr-2 h-4 w-4" />
            {automationMutation.isPending ? 'Running...' : 'Run Automation'}
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Results
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Query Builder</CardTitle>
            <div className="flex space-x-2">
              <Button size="sm" variant="ghost">
                KQL-Compatible
              </Button>
              <Button size="sm" variant="ghost" onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Save Query
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <textarea
              className="w-full rounded-md border border-slate-600 bg-slate-900 p-3 font-mono text-sm text-slate-100"
              rows={5}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Examples: ioc.severity:critical AND ioc.type:domain | cve.severity:high | text:"powershell"'
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <select
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                >
                  <option value={24}>Last 24 hours</option>
                  <option value={24 * 7}>Last 7 days</option>
                  <option value={24 * 30}>Last 30 days</option>
                </select>
                <select
                  value={dataSource}
                  onChange={(e) => setDataSource(e.target.value as any)}
                  className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="all">All data sources</option>
                  <option value="iocs">IOCs only</option>
                  <option value="assets">Assets only</option>
                  <option value="cves">CVEs only</option>
                </select>
              </div>
              <Button variant="primary" onClick={handleRun} disabled={runMutation.isPending}>
                <Play className="mr-2 h-4 w-4" />
                {runMutation.isPending ? 'Running...' : 'Run Query'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Saved Queries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {savedQueries.map((sq: any) => (
                <div key={sq.id} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                  <h4 className="font-semibold text-slate-100">{sq.name}</h4>
                  <p className="mt-1 line-clamp-2 font-mono text-xs text-slate-400">{sq.query}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{sq.lastRun ? `Last run ${formatRelativeTime(sq.lastRun)}` : 'Never run'}</span>
                    <span>Runs: {sq.runCount || 0}</span>
                  </div>
                  <div className="mt-3 flex space-x-2">
                    <Button size="sm" variant="ghost" onClick={() => setQuery(sq.query)}>Load</Button>
                    <Button size="sm" variant="primary" onClick={() => runSavedMutation.mutate(sq.id)} disabled={runSavedMutation.isPending}>
                      <Play className="mr-1 h-3 w-3" />
                      Run
                    </Button>
                  </div>
                </div>
              ))}
              {savedQueries.length === 0 && <p className="text-sm text-slate-500">No saved queries yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Run History</CardTitle>
              <Badge variant="success">{recentRuns.length} runs</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentRuns.map((run: any) => (
                <div key={run.runId} className="rounded border border-slate-700 bg-slate-900/60 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-slate-200">{run.queryName || run.query}</span>
                    <span className="text-slate-400">{run.totalMatches} matches</span>
                  </div>
                  <p className="mt-1 text-slate-500">{formatRelativeTime(run.finishedAt)}</p>
                </div>
              ))}
              {recentRuns.length === 0 && <p className="text-sm text-slate-500">No runs yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Query Results</CardTitle>
            <Badge variant="warning">{latestRun?.totalMatches || 0} results</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!latestRun ? (
            <div className="py-12 text-center text-slate-400">
              <Search className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4">Run a query to see real findings</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded border border-slate-700 bg-slate-900/70 p-3"><p className="text-xs text-slate-500">IOC matches</p><p className="text-lg font-bold text-cyan-300">{latestRun.summary?.iocMatches || 0}</p></div>
                <div className="rounded border border-slate-700 bg-slate-900/70 p-3"><p className="text-xs text-slate-500">Asset matches</p><p className="text-lg font-bold text-amber-300">{latestRun.summary?.assetMatches || 0}</p></div>
                <div className="rounded border border-slate-700 bg-slate-900/70 p-3"><p className="text-xs text-slate-500">CVE matches</p><p className="text-lg font-bold text-orange-300">{latestRun.summary?.cveMatches || 0}</p></div>
                <div className="rounded border border-slate-700 bg-slate-900/70 p-3"><p className="text-xs text-slate-500">Critical</p><p className="text-lg font-bold text-red-300">{latestRun.summary?.criticalFindings || 0}</p></div>
              </div>

              <div className="space-y-2">
                {(latestRun.findings || []).slice(0, 50).map((f: any) => (
                  <div key={`${f.dataset}-${f.id}`} className="rounded border border-slate-700 bg-slate-900/70 p-3">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-semibold text-slate-100">{f.title}</span>
                      <Badge variant={f.severity === 'critical' ? 'danger' : f.severity === 'high' ? 'warning' : 'default'}>{f.severity}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{f.dataset.toUpperCase()} • {f.subtitle}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

