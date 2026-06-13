import { AlertOctagon, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useExposurePriorities } from '@/hooks/useAssets'

export default function ExposurePriorities() {
  const { data: priorities = [] } = useExposurePriorities(50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-100">Exposure Prioritization Engine</h1>
        <p className="text-slate-400">Unified asset risk queue based on IOC pressure, CVEs, criticality, and current exposure</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Priority Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {priorities.map((row: any) => (
              <div key={row.assetId} className="rounded-lg border border-slate-700 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-red-500/10 p-2">
                      {row.priorityScore >= 80 ? <AlertOctagon className="h-5 w-5 text-red-400" /> : <ShieldAlert className="h-5 w-5 text-amber-400" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-100">{row.name}</h4>
                      <p className="text-xs text-slate-400">{row.type.replace('_', ' ')} • {row.department || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Priority Score</p>
                    <p className="text-2xl font-bold text-red-400">{row.priorityScore}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="danger">{row.activeThreats} IOC correlations</Badge>
                  <Badge variant="warning">{row.unpatchedCves} CVEs</Badge>
                  <Badge variant="default">risk {row.riskScore}</Badge>
                  <Badge variant="default">criticality {row.criticality}/5</Badge>
                </div>
                {Array.isArray(row.reasons) && row.reasons.length > 0 && (
                  <p className="mt-2 text-xs text-slate-400">Drivers: {row.reasons.join(' | ')}</p>
                )}
              </div>
            ))}
            {priorities.length === 0 && <p className="text-sm text-slate-500">No exposure data available.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

