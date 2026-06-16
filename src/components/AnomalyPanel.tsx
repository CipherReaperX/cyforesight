import { AlertTriangle, TrendingUp, Activity, Info } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useIOCAnomalies } from '@/hooks/useIOCs'
import { formatRelativeTime } from '@/lib/utils'

export default function AnomalyPanel() {
  const { data, isLoading } = useIOCAnomalies()

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center gap-3 py-2">
            <Activity className="h-5 w-5 animate-pulse text-slate-500" />
            <span className="text-sm text-slate-500">Analysing IOC ingestion patterns...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const latestAnomaly = data?.latestAnomaly
  const baseline = data?.baseline ?? 0
  const stddev = data?.stddev ?? 0
  const windowHours = data?.windowHours ?? 0

  return (
    <Card className={latestAnomaly ? 'border-orange-500/60 bg-orange-950/10' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {latestAnomaly ? (
            <AlertTriangle className="h-4 w-4 text-orange-400" />
          ) : (
            <Activity className="h-4 w-4 text-green-400" />
          )}
          Ingestion Anomaly Detector
          {latestAnomaly && (
            <Badge variant="warning">Spike Detected</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Baseline stats row */}
        <div className="flex flex-wrap gap-6 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3 text-sm">
          <div>
            <p className="text-xs text-slate-400">7-Day Hourly Baseline</p>
            <p className="mt-0.5 font-semibold text-slate-200">{baseline} IOCs/h</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Std Deviation</p>
            <p className="mt-0.5 font-semibold text-slate-200">±{stddev}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Spike Threshold</p>
            <p className="mt-0.5 font-semibold text-slate-200">{Math.round(baseline + 2 * stddev)} IOCs/h (μ + 2σ)</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Window</p>
            <p className="mt-0.5 font-semibold text-slate-200">{windowHours}h of data</p>
          </div>
        </div>

        {latestAnomaly ? (
          <div className="rounded-lg border border-orange-500/50 bg-orange-900/20 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-400" />
                  <span className="font-semibold text-orange-300">Ingestion Spike</span>
                  <Badge variant="warning">Z = {latestAnomaly.zScore}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-300">{latestAnomaly.explanation}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Detected at {formatRelativeTime(String(latestAnomaly.hour))}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded border border-orange-700/40 bg-orange-950/30 p-3">
              <p className="text-xs text-slate-400">
                <strong className="text-slate-300">Detection method:</strong>{' '}
                Z-score anomaly detection over a rolling 7-day hourly window.
                A spike is flagged when the IOC count in a 1-hour bucket exceeds μ + 2σ of the baseline distribution.
                This signals a potential feed dump, mass-import, or coordinated indicator sharing event.
              </p>
            </div>
          </div>
        ) : windowHours < 4 ? (
          <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
            <Info className="h-4 w-4 shrink-0 text-slate-400" />
            <p className="text-sm text-slate-400">
              Insufficient data ({windowHours}h). Ingest at least 4 hours of IOCs to enable anomaly detection.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-green-800/40 bg-green-950/20 px-4 py-3">
            <Activity className="h-4 w-4 shrink-0 text-green-400" />
            <p className="text-sm text-green-300">
              Ingestion rates within normal range over the last 7 days. No anomalies detected.
            </p>
          </div>
        )}

        {Array.isArray(data?.anomalies) && data.anomalies.length > 1 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-400">Historical Spikes (7-day window)</p>
            <div className="space-y-1">
              {data.anomalies.slice(1).map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-xs">
                  <span className="text-slate-400">{formatRelativeTime(String(a.hour))}</span>
                  <span className="text-slate-300">{a.count} IOCs</span>
                  <Badge variant="default">Z = {a.zScore}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
