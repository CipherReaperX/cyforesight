import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import MainLayout from './components/layout/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import IOCManagement from './pages/IOCManagement'
import AssetInventory from './pages/AssetInventory'
import AssetDetail from './pages/AssetDetail'
import MitreAttack from './pages/MitreAttack'
import CVETracker from './pages/CVETracker'
import ThreatFeeds from './pages/ThreatFeeds'
import ThreatHunting from './pages/ThreatHunting'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import ReconTools from './pages/ReconTools'
import Integrations from './pages/Integrations'
import IOCDetail from './pages/IOCDetail'
import IncidentWorkbench from './pages/IncidentWorkbench'
import ExposurePriorities from './pages/ExposurePriorities'

function App() {
  return (
    <>
      <Routes>
        {/* Public route - Login (outside MainLayout) */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected routes - Inside MainLayout */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="iocs" element={<IOCManagement />} />
          <Route path="iocs/:iocId" element={<IOCDetail />} />
          <Route path="assets" element={<AssetInventory />} />
          <Route path="assets/:assetId" element={<AssetDetail />} />
          <Route path="mitre" element={<MitreAttack />} />
          <Route path="cves" element={<CVETracker />} />
          <Route path="feeds" element={<ThreatFeeds />} />
          <Route path="hunt" element={<ThreatHunting />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="recon" element={<ReconTools />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="incidents" element={<IncidentWorkbench />} />
          <Route path="exposure" element={<ExposurePriorities />} />
        </Route>
      </Routes>
      <Toaster position="top-right" theme="dark" />
    </>
  )
}

export default App
