import { useState } from 'react'
import { Globe, Search, Database, MapPin, Lock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useReconLookup, type ReconTool } from '@/hooks/useRecon'
import { formatRelativeTime } from '@/lib/utils'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default marker icons for bundled environments
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

export default function ReconTools() {
  const [activeTool, setActiveTool] = useState<ReconTool>('whois')
  const [query, setQuery] = useState('')
  const [recentLookups, setRecentLookups] = useState<Array<{ tool: string; query: string; timestamp: string; result: any }>>([])
  const lookupMutation = useReconLookup()

  const tools = [
    { id: 'whois', name: 'WHOIS Lookup', icon: Database, description: 'Domain registration information' },
    { id: 'dns', name: 'DNS Lookup', icon: Globe, description: 'DNS records and resolution' },
    { id: 'geoip', name: 'GeoIP Lookup', icon: MapPin, description: 'IP geolocation data' },
    { id: 'ssl', name: 'SSL Certificate', icon: Lock, description: 'SSL/TLS certificate analysis' },
  ] as const

  const handleLookup = async () => {
    if (!query.trim()) return
    try {
      const result = await lookupMutation.mutateAsync({ tool: activeTool, query: query.trim() })
      setRecentLookups((prev) => [
        {
          tool: activeTool.toUpperCase(),
          query: query.trim(),
          timestamp: new Date().toISOString(),
          result,
        },
        ...prev,
      ].slice(0, 10))
    } catch {
      // Error is displayed in result panel
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-100">Reconnaissance Tools</h1>
        <p className="text-slate-400">OSINT and investigation utilities</p>
      </div>

      {/* Tool Selection */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {tools.map((tool) => (
          <Card
            key={tool.id}
            hoverable
            className={`cursor-pointer ${activeTool === tool.id ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setActiveTool(tool.id as ReconTool)}
          >
            <CardContent>
              <div className="text-center">
                <div className="mx-auto w-fit rounded-lg bg-blue-500/10 p-4">
                  <tool.icon className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="mt-3 font-semibold text-slate-100">{tool.name}</h3>
                <p className="mt-1 text-xs text-slate-400">{tool.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tool Interface */}
      <Card>
        <CardHeader>
          <CardTitle>{tools.find(t => t.id === activeTool)?.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder={`Enter ${activeTool === 'whois' || activeTool === 'dns' ? 'domain' : 'IP address'}...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1"
              />
              <Button variant="primary" onClick={handleLookup} disabled={lookupMutation.isPending}>
                <Search className="mr-2 h-4 w-4" />
                {lookupMutation.isPending ? 'Looking up...' : 'Lookup'}
              </Button>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              {!lookupMutation.data && !lookupMutation.error ? (
                <div className="p-4 text-center">
                  <Search className="mx-auto h-12 w-12 text-slate-600" />
                  <p className="mt-4 text-slate-400">Enter a query to see results</p>
                </div>
              ) : lookupMutation.error ? (
                <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  Lookup failed. Please verify input and try again.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge>{activeTool.toUpperCase()}</Badge>
                    <span className="font-mono text-xs text-slate-400">{lookupMutation.data.query}</span>
                  </div>
                  <pre className="max-h-96 overflow-auto rounded border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-200">
                    {JSON.stringify(lookupMutation.data.result, null, 2)}
                  </pre>
                  {activeTool === 'geoip' &&
                    lookupMutation.data.result?.latitude != null &&
                    lookupMutation.data.result?.longitude != null && (
                      <div className="overflow-hidden rounded-lg border border-slate-700" style={{ height: 260 }}>
                        <MapContainer
                          center={[lookupMutation.data.result.latitude, lookupMutation.data.result.longitude]}
                          zoom={6}
                          style={{ height: '100%', width: '100%', background: '#0b1220' }}
                          key={`${lookupMutation.data.result.latitude},${lookupMutation.data.result.longitude}`}
                        >
                          <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                          />
                          <Marker
                            position={[lookupMutation.data.result.latitude, lookupMutation.data.result.longitude]}
                            icon={markerIcon}
                          >
                            <Popup>
                              {lookupMutation.data.query}
                              {lookupMutation.data.result.city && ` — ${lookupMutation.data.result.city}`}
                              {lookupMutation.data.result.country && `, ${lookupMutation.data.result.country}`}
                            </Popup>
                          </Marker>
                        </MapContainer>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Lookups */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Lookups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentLookups.length === 0 ? (
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-400">
                No lookups yet.
              </div>
            ) : recentLookups.map((lookup, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <div className="flex items-center space-x-3">
                  <Badge>{lookup.tool}</Badge>
                  <span className="font-mono text-sm text-slate-300">{lookup.query}</span>
                  <span className="text-xs text-slate-500">{formatRelativeTime(lookup.timestamp)}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => {
                  setQuery(lookup.query)
                  setActiveTool(lookup.tool.toLowerCase() as ReconTool)
                }}>View</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
