import { useState, useEffect } from 'react'
import { Bell, LogOut, Menu, RefreshCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useRealtimePulse } from '@/hooks/useDashboard'
import { useQueryClient } from '@tanstack/react-query'
import { useSidebar } from './MainLayout'

function decodeJWTUser(): { username: string; role: string } | null {
  try {
    const token = localStorage.getItem('token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { username: payload.username || payload.sub || 'user', role: payload.role || 'viewer' }
  } catch {
    return null
  }
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-300 border-red-500/30',
  analyst: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  viewer: 'bg-slate-700 text-slate-300 border-slate-600',
}

export default function TopBar() {
  const { status } = useRealtimePulse()
  const queryClient = useQueryClient()
  const { toggle } = useSidebar()
  const [user] = useState(decodeJWTUser)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [tick, setTick] = useState(0)

  // Tick every 30s so "last updated" label stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await queryClient.invalidateQueries()
    setLastUpdate(new Date())
    setTimeout(() => setIsRefreshing(false), 800)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  const elapsed = Math.floor((Date.now() - lastUpdate.getTime()) / 1000)
  const lastUpdateLabel = elapsed < 10 ? 'just now' : elapsed < 60 ? `${elapsed}s ago` : `${Math.floor(elapsed / 60)}m ago`

  return (
    <div className="flex h-16 items-center justify-between border-b border-[#1f2d3d] bg-[#0f1724]/90 px-4 backdrop-blur md:px-6">
      <div className="flex items-center space-x-3">
        {/* Hamburger — visible only on tablet/mobile */}
        <button
          onClick={toggle}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 lg:hidden"
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold tracking-tight text-slate-100 md:text-lg">CyForesight Console</h1>

        {/* SSE connection status */}
        <div className="flex items-center space-x-1.5">
          {status === 'connected' ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="text-xs font-medium text-green-400">LIVE</span>
            </>
          ) : status === 'connecting' ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
              <span className="text-xs text-yellow-400">CONNECTING</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-red-400" />
              <span className="text-xs text-red-400">OFFLINE</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Last updated */}
        <div className="rounded-md border border-[#1f2d3d] bg-[#0a1220] px-2.5 py-1 text-xs text-slate-400">
          {/* tick forces re-render for the elapsed label */}
          {tick >= 0 && `Updated ${lastUpdateLabel}`}
        </div>

        {/* Refresh all queries */}
        <Button variant="outline" size="sm" onClick={handleRefresh} aria-label="Refresh all data">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>

        {/* Notifications bell */}
        <Button variant="outline" size="sm" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
        </Button>

        {/* User info + logout */}
        {user && (
          <div className="flex items-center space-x-2 rounded-lg border border-[#1f2d3d] bg-[#0a1220] px-3 py-1.5">
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-100">{user.username}</p>
              <span className={`rounded border px-1 py-0.5 text-[10px] font-bold uppercase ${ROLE_COLORS[user.role] || ROLE_COLORS.viewer}`}>
                {user.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="ml-1 rounded p-1 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
