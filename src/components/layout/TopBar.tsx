import { Bell, User, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatRelativeTime } from '@/lib/utils'

export default function TopBar() {
  const lastUpdate = new Date()

  return (
    <div className="flex h-16 items-center justify-between border-b border-[#1f2d3d] bg-[#0f1724]/90 px-6 backdrop-blur">
      <div className="flex items-center space-x-4">
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">CyForesight Console</h1>
      </div>

      <div className="flex items-center space-x-4">
        <div className="rounded-md border border-[#1f2d3d] bg-[#0a1220] px-2.5 py-1 text-xs text-slate-400">
          Last updated: {formatRelativeTime(lastUpdate)}
        </div>

        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4" />
        </Button>

        <Button variant="outline" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </Button>

        <Button variant="outline" size="sm">
          <User className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
