import { useMemo, useState } from 'react'
import { FileText, Download, Calendar, TrendingUp, BarChart, Eye, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatRelativeTime, formatNumber } from '@/lib/utils'
import { downloadReport, useGenerateReport, useReportContent, useReports, useReportStats } from '@/hooks/useReports'
import { toast } from 'sonner'

const templates = [
  { id: 'executive', name: 'Executive Summary' },
  { id: 'detailed', name: 'Technical Analysis' },
  { id: 'compliance', name: 'Compliance' },
  { id: 'summary', name: 'Incident Response' },
]

export default function Reports() {
  const { data: reports = [], isLoading } = useReports(100)
  const { data: stats } = useReportStats()
  const generateMutation = useGenerateReport()
  const contentMutation = useReportContent()
  const [selectedReport, setSelectedReport] = useState<any | null>(null)

  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [reports])

  const handleGenerate = async (type: string, templateName?: string) => {
    await generateMutation.mutateAsync({
      name: `${templateName || type} Report`,
      type,
      template: templateName,
      schedule: null as any,
    })
  }

  const handleView = async (id: string) => {
    try {
      const data = await contentMutation.mutateAsync(id)
      setSelectedReport(data)
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load report')
    }
  }

  const handleDownload = async (id: string, name: string) => {
    try {
      await downloadReport(id, name)
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to download report')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Reports & Analytics</h1>
          <p className="text-slate-400">Generate, view, and download threat intelligence reports</p>
        </div>
        <Button
          variant="primary"
          onClick={() => handleGenerate('summary', 'Quick Summary')}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Create Report
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card><CardContent><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">Total Reports</p><p className="mt-2 text-2xl font-bold text-blue-500">{formatNumber(stats?.totalReports || 0)}</p></div><FileText className="h-8 w-8 text-blue-500" /></div></CardContent></Card>
        <Card><CardContent><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">Scheduled</p><p className="mt-2 text-2xl font-bold text-green-500">{formatNumber(stats?.scheduledReports || 0)}</p></div><Calendar className="h-8 w-8 text-green-500" /></div></CardContent></Card>
        <Card><CardContent><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">This Month</p><p className="mt-2 text-2xl font-bold text-purple-500">{formatNumber(stats?.thisMonth || 0)}</p></div><TrendingUp className="h-8 w-8 text-purple-500" /></div></CardContent></Card>
        <Card><CardContent><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">Avg Gen Time</p><p className="mt-2 text-2xl font-bold text-yellow-500">{stats?.avgGenerationTimeSec || 0}s</p></div><BarChart className="h-8 w-8 text-yellow-500" /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Report Templates</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {templates.map((template) => (
              <div key={template.id} className="rounded-lg border-2 border-dashed border-slate-700 p-6 text-center transition-colors hover:border-blue-500">
                <FileText className="mx-auto h-8 w-8 text-slate-400" />
                <h4 className="mt-3 font-semibold text-slate-100">{template.name}</h4>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => handleGenerate(template.id, template.name)} disabled={generateMutation.isPending}>
                  Use Template
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Reports</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-slate-400">Loading reports...</div>
          ) : sortedReports.length === 0 ? (
            <div className="py-10 text-center text-slate-400">No reports generated yet.</div>
          ) : (
            <div className="space-y-3">
              {sortedReports.map((report: any) => (
                <div key={report.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <div className="flex items-center space-x-4">
                    <div className="rounded-lg bg-blue-500/10 p-3"><FileText className="h-6 w-6 text-blue-500" /></div>
                    <div>
                      <h4 className="font-semibold text-slate-100">{report.name}</h4>
                      <div className="mt-1 flex items-center space-x-3 text-sm text-slate-400">
                        <span>Type: {report.type}</span>
                        <span>•</span>
                        <span>Generated: {report.lastGenerated ? formatRelativeTime(report.lastGenerated) : 'N/A'}</span>
                        <span>•</span>
                        <span>Size: {report.fileSize ? `${(report.fileSize / 1024).toFixed(1)} KB` : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge variant="success">{report.status || 'ready'}</Badge>
                    <Button size="sm" variant="outline" onClick={() => handleDownload(report.id, report.name)}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => handleView(report.id)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedReport && (
        <Card>
          <CardHeader>
            <CardTitle>Report Viewer: {selectedReport.report?.name || 'Report'}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[500px] overflow-auto rounded border border-slate-700 bg-slate-900/80 p-4 text-xs text-slate-200">
              {JSON.stringify(selectedReport.content, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
