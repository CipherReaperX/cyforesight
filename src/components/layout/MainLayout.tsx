import { Outlet, useLocation } from 'react-router-dom'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { ErrorBoundary } from '../ErrorBoundary'
import { SocketProvider } from '@/providers/SocketProvider'

interface SidebarCtx { open: boolean; toggle: () => void; close: () => void }
export const SidebarContext = createContext<SidebarCtx>({ open: true, toggle: () => {}, close: () => {} })
export const useSidebar = () => useContext(SidebarContext)

function PageTransition({ children, routeKey }: { children: React.ReactNode; routeKey: string }) {
  return (
    <div key={routeKey} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
      {children}
    </div>
  )
}

export default function MainLayout() {
  const location = useLocation()
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen')
    return saved !== null ? saved === 'true' : window.innerWidth >= 1024
  })

  const toggle = useCallback(() => setOpen((v) => {
    const next = !v
    localStorage.setItem('sidebarOpen', String(next))
    return next
  }), [])

  const close = useCallback(() => {
    setOpen(false)
    localStorage.setItem('sidebarOpen', 'false')
  }, [])

  // Close sidebar on tablet/mobile when navigating
  useEffect(() => {
    if (window.innerWidth < 1024) close()
  }, [location.pathname, close])

  // Close on overlay click (mobile)
  const onOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) close()
  }

  return (
    <SocketProvider>
    <SidebarContext.Provider value={{ open, toggle, close }}>
      <div className="flex h-screen overflow-hidden bg-[#0b1220]">
        {/* Overlay for mobile/tablet when sidebar open */}
        {open && (
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            aria-hidden="true"
            onClick={onOverlay}
          />
        )}

        {/* Sidebar: fixed on mobile, inline on desktop */}
        <div
          className={[
            'fixed inset-y-0 left-0 z-30 transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:translate-x-0',
            open ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <Sidebar />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <main
            id="main-content"
            className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_8%_10%,rgba(6,182,212,0.08),transparent_35%),radial-gradient(circle_at_92%_2%,rgba(249,115,22,0.08),transparent_30%)] p-4 md:p-6 lg:p-7"
          >
            <ErrorBoundary>
              <PageTransition routeKey={location.pathname}>
                <Outlet />
              </PageTransition>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
    </SocketProvider>
  )
}
