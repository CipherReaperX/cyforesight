import { Plug, Check, X, TrendingUp, BarChart, AlertCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'

export default function Integrations() {
  const integrations = [
    { id: 1, name: 'VirusTotal', status: 'connected', apiCalls: 15234, limit: 100000, lastSync: '5 mins ago', icon: '🛡️' },
    { id: 2, name: 'AbuseIPDB', status: 'connected', apiCalls: 8942, limit: 50000, lastSync: '10 mins ago', icon: '🔍' },
    { id: 3, name: 'Shodan', status: 'connected', apiCalls: 3421, limit: 10000, lastSync: '1 hour ago', icon: '🌐' },
    { id: 4, name: 'AlienVault OTX', status: 'error', apiCalls: 0, limit: 0, lastSync: 'Never', icon: '👽' },
    { id: 5, name: 'IBM X-Force', status: 'connected', apiCalls: 5123, limit: 25000, lastSync: '30 mins ago', icon: '💼' },
    { id: 6, name: 'URLhaus', status: 'connected', apiCalls: 2341, limit: 0, lastSync: '2 hours ago', icon: '🔗' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">API Integrations</h1>
          <p className="text-slate-400">Manage external threat intelligence sources</p>
        </div>
        <Button variant="primary">
          <Plug className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Active Integrations</p>
                <p className="mt-2 text-2xl font-bold text-green-500">5</p>
              </div>
              <Check className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Failed</p>
                <p className="mt-2 text-2xl font-bold text-red-500">1</p>
              </div>
              <X className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total API Calls</p>
                <p className="mt-2 text-2xl font-bold text-blue-500">35,061</p>
              </div>
              <BarChart className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Avg Response Time</p>
                <p className="mt-2 text-2xl font-bold text-purple-500">245ms</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <Card key={integration.id} hoverable>
            <CardContent>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-3xl">{integration.icon}</div>
                  <div>
                    <h4 className="font-semibold text-slate-100">{integration.name}</h4>
                    <p className="text-xs text-slate-400">Last sync: {integration.lastSync}</p>
                  </div>
                </div>
                {integration.status === 'connected' ? (
                  <Badge variant="success">
                    <Check className="mr-1 h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="danger">
                    <X className="mr-1 h-3 w-3" />
                    Error
                  </Badge>
                )}
              </div>

              {integration.status === 'connected' ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">API Calls</span>
                    <span className="font-semibold text-slate-300">
                      {integration.apiCalls.toLocaleString()}
                      {integration.limit > 0 && ` / ${integration.limit.toLocaleString()}`}
                    </span>
                  </div>
                  {integration.limit > 0 && (
                    <div>
                      <Progress
                        value={(integration.apiCalls / integration.limit) * 100}
                        barClassName={
                          (integration.apiCalls / integration.limit) > 0.9 ? 'bg-red-500' :
                          (integration.apiCalls / integration.limit) > 0.7 ? 'bg-yellow-500' : 'bg-green-500'
                        }
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded border border-red-500/20 bg-red-500/10 p-3">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <p className="text-xs text-red-400">Authentication failed. Please check your API key.</p>
                  </div>
                </div>
              )}

              <div className="mt-4 flex space-x-2">
                <Button size="sm" variant="outline" className="flex-1">
                  Configure
                </Button>
                <Button size="sm" variant="primary">
                  Test
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
