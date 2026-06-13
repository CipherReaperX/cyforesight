import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Shield,
  Server,
  Target,
  Bug,
  Rss,
  Search,
  FileText,
  Settings,
  Globe,
  Plug,
  Briefcase,
  Radar,
  UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function getUser(): { username: string; role: string } | null {
  try {
    const token = localStorage.getItem('token')
    if (!token) return null
    const p = JSON.parse(atob(token.split('.')[1]))
    return { username: p.username || 'user', role: p.role || 'viewer' }
  } catch { return null }
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'IOC Management', href: '/iocs', icon: Shield },
  { name: 'Asset Inventory', href: '/assets', icon: Server },
  { name: 'MITRE ATT&CK', href: '/mitre', icon: Target },
  { name: 'CVE Tracker', href: '/cves', icon: Bug },
  { name: 'Threat Feeds', href: '/feeds', icon: Rss },
  { name: 'Threat Hunting', href: '/hunt', icon: Search },
  { name: 'Incident Workbench', href: '/incidents', icon: Briefcase },
  { name: 'Exposure Engine', href: '/exposure', icon: Radar },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Recon Tools', href: '/recon', icon: Globe },
  { name: 'Integrations', href: '/integrations', icon: Plug },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const location = useLocation()
  const user = getUser()

  return (
    <div className="flex h-screen w-72 flex-col border-r border-[#1f2d3d] bg-gradient-to-b from-[#0f1724] via-[#111c2a] to-[#0b1320]">
      <div className="flex h-20 items-center border-b border-[#1f2d3d] px-6">
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2">
          <Shield className="h-6 w-6 text-cyan-300" />
        </div>
        <div className="ml-3">
          <span className="text-lg font-bold tracking-tight text-slate-100">CyForesight</span>
          <p className="text-xs text-slate-400">Threat Intelligence Command</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'border border-cyan-400/40 bg-cyan-500/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]'
                  : 'border border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/70 hover:text-white'
              )}
            >
              <item.icon className={cn('mr-3 h-5 w-5', isActive ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200')} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-[#1f2d3d] p-4">
        {user ? (
          <div className="flex items-center space-x-3 rounded-lg border border-[#1f2d3d] bg-[#0a1220]/70 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20">
              <UserCircle className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-200">{user.username}</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">{user.role}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-[#1f2d3d] bg-[#0a1220]/70 p-3 text-xs text-slate-400">
            <p className="font-semibold text-slate-300">CyForesight v1.0</p>
          </div>
        )}
      </div>
    </div>
  )
}
