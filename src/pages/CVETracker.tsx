import { useState } from 'react'
import { Search, Bug, Download, Filter, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { useCVEs } from '@/hooks/useCVEs'
import { useCVEStats } from '@/hooks/useCVEStats'
import { formatDate } from '@/lib/utils'

type BadgeVariant = 'default' | 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success' | 'warning' | 'danger'

export default function CVETracker() {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    skip: 0,
    take: 25,
  })

  const { data: statData, isLoading: statsLoading } = useCVEStats()
  const stats = statData || {}
  const { critical = 0, withExploit = 0, patchAvailable = 0, total = 0 } = stats

  const { data, isLoading } = useCVEs({ ...filters, search })
  const cves = data || { items: [], total: 0 }
  const cveItems = cves?.items || []
  const cveTotal = cves?.total || 0

  const getCVSSColor = (score: number) => {
    if (score >= 9.0) return 'text-red-500'
    if (score >= 7.0) return 'text-orange-500'
    if (score >= 4.0) return 'text-yellow-500'
    return 'text-green-500'
  }

  const mapSeverityToBadge = (severity: string): BadgeVariant =>
    severity === 'info' ? 'default' : (severity as BadgeVariant)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">CVE Tracker</h1>
          <p className="text-slate-400">{cveTotal} vulnerabilities tracked</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="primary">Scan Assets</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Critical CVEs</p>
                <p className="mt-2 text-2xl font-bold text-red-500">
                  {statsLoading ? '...' : critical}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">With Exploit</p>
                <p className="mt-2 text-2xl font-bold text-orange-500">
                  {statsLoading ? '...' : withExploit}
                </p>
              </div>
              <ShieldAlert className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Patch Available</p>
                <p className="mt-2 text-2xl font-bold text-green-500">
                  {statsLoading ? '...' : patchAvailable}
                </p>
              </div>
              <Bug className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total CVEs</p>
                <p className="mt-2 text-2xl font-bold text-blue-500">
                  {statsLoading ? '...' : total}
                </p>
              </div>
              <Bug className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search CVEs by ID, description, or vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>
      </Card>

      {/* CVE Table */}
      <Card>
        {isLoading ? (
          <div className="py-12 text-center text-slate-400">Loading CVEs...</div>
        ) : cveItems.length === 0 ? (
          <div className="py-12 text-center text-slate-400">No CVEs found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CVE ID</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>CVSS Score</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Affected Assets</TableHead>
                <TableHead>Exploit</TableHead>
                <TableHead>Patch Status</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cveItems.map((cve) => {
                const score = Number(cve.cvssScore) || 0
                return (
                  <TableRow key={cve.id}>
                    <TableCell>
                      <span className="font-mono font-semibold text-blue-400">{cve.cveId}</span>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-md truncate text-sm text-slate-300">{cve.description}</p>
                    </TableCell>
                    <TableCell>
                      <span className={`text-lg font-bold ${getCVSSColor(score)}`}>
                        {score.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={mapSeverityToBadge(cve.severity)}>{cve.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      {(cve.affectedAssets || 0) > 0 ? (
                        <Badge variant="danger">{cve.affectedAssets}</Badge>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {cve.exploitAvailable ? (
                        <Badge variant="danger">Yes</Badge>
                      ) : (
                        <Badge variant="default">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          cve.patchStatus === 'available' ? 'success' :
                          cve.patchStatus === 'pending' ? 'warning' : 'danger'
                        }
                      >
                        {cve.patchStatus || 'unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-400">
                        {cve.publishedDate ? formatDate(cve.publishedDate, 'MMM dd, yyyy') : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="ghost">Details</Button>
                        <Button size="sm" variant="primary">Remediate</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
