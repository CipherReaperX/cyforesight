import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import MainLayout from './components/layout/MainLayout'
import { ErrorBoundary } from './components/ErrorBoundary'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const IOCManagement = lazy(() => import('./pages/IOCManagement'))
const AssetInventory = lazy(() => import('./pages/AssetInventory'))
const AssetDetail = lazy(() => import('./pages/AssetDetail'))
const MitreAttack = lazy(() => import('./pages/MitreAttack'))
const CVETracker = lazy(() => import('./pages/CVETracker'))
const ThreatFeeds = lazy(() => import('./pages/ThreatFeeds'))
const ThreatHunting = lazy(() => import('./pages/ThreatHunting'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const ReconTools = lazy(() => import('./pages/ReconTools'))
const Integrations = lazy(() => import('./pages/Integrations'))
const IOCDetail = lazy(() => import('./pages/IOCDetail'))
const IncidentWorkbench = lazy(() => import('./pages/IncidentWorkbench'))
const ExposurePriorities = lazy(() => import('./pages/ExposurePriorities'))
const CVEDetail = lazy(() => import('./pages/CVEDetail'))

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex space-x-2">
        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" />
      </div>
    </div>
  )
}

function App() {
  return (
    <>
      <ErrorBoundary>
      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#0b1220]"><PageLoader /></div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
            <Route path="iocs" element={<Suspense fallback={<PageLoader />}><IOCManagement /></Suspense>} />
            <Route path="iocs/:iocId" element={<Suspense fallback={<PageLoader />}><IOCDetail /></Suspense>} />
            <Route path="assets" element={<Suspense fallback={<PageLoader />}><AssetInventory /></Suspense>} />
            <Route path="assets/:assetId" element={<Suspense fallback={<PageLoader />}><AssetDetail /></Suspense>} />
            <Route path="mitre" element={<Suspense fallback={<PageLoader />}><MitreAttack /></Suspense>} />
            <Route path="cves" element={<Suspense fallback={<PageLoader />}><CVETracker /></Suspense>} />
            <Route path="cves/:cveId" element={<Suspense fallback={<PageLoader />}><CVEDetail /></Suspense>} />
            <Route path="feeds" element={<Suspense fallback={<PageLoader />}><ThreatFeeds /></Suspense>} />
            <Route path="hunt" element={<Suspense fallback={<PageLoader />}><ThreatHunting /></Suspense>} />
            <Route path="reports" element={<Suspense fallback={<PageLoader />}><Reports /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
            <Route path="recon" element={<Suspense fallback={<PageLoader />}><ReconTools /></Suspense>} />
            <Route path="integrations" element={<Suspense fallback={<PageLoader />}><Integrations /></Suspense>} />
            <Route path="incidents" element={<Suspense fallback={<PageLoader />}><IncidentWorkbench /></Suspense>} />
            <Route path="exposure" element={<Suspense fallback={<PageLoader />}><ExposurePriorities /></Suspense>} />
          </Route>
        </Routes>
      </Suspense>
      </ErrorBoundary>
      <Toaster position="top-right" theme="dark" />
    </>
  )
}

export default App
