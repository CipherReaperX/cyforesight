import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Shield, Server, AlertTriangle, Database, Rss, 
  Search, FileText, Settings as SettingsIcon, Puzzle
} from 'lucide-react';
import Dashboard from '../pages/Dashboard';
import IOCManagement from '../pages/IOCManagement';
import IOCDetail from '../pages/IOCDetail';
import AssetInventory from '../pages/AssetInventory';
import MitreAttack from '../pages/MitreAttack';
import CVETracker from '../pages/CVETracker';
import ThreatFeeds from '../pages/ThreatFeeds';
import ThreatHunting from '../pages/ThreatHunting';
import Reports from '../pages/Reports';
import Settings from '../pages/Settings';
import ReconTools from '../pages/ReconTools';
import Integrations from '../pages/Integrations';

const Layout: React.FC = () => {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'IOC Management', href: '/iocs', icon: Shield },
    { name: 'Assets', href: '/assets', icon: Server },
    { name: 'MITRE ATT&CK', href: '/mitre', icon: AlertTriangle },
    { name: 'CVE Tracker', href: '/cves', icon: Database },
    { name: 'Threat Feeds', href: '/feeds', icon: Rss },
    { name: 'Threat Hunting', href: '/hunting', icon: Search },
    { name: 'Recon Tools', href: '/recon', icon: Puzzle },
    { name: 'Reports', href: '/reports', icon: FileText },
    { name: 'Integrations', href: '/integrations', icon: Puzzle },
    { name: 'Settings', href: '/settings', icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen bg-gray-900">
      <div className="w-64 bg-gray-800 border-r border-gray-700">
        <div className="flex items-center gap-3 p-6 border-b border-gray-700">
          <Shield className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-xl font-bold text-white">TIP</h1>
            <p className="text-xs text-gray-400">Threat Intel Platform</p>
          </div>
        </div>
        <nav className="p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex-1 overflow-auto">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/iocs" element={<IOCManagement />} />
          <Route path="/iocs/:id" element={<IOCDetail />} />
          <Route path="/assets" element={<AssetInventory />} />
          <Route path="/mitre" element={<MitreAttack />} />
          <Route path="/cves" element={<CVETracker />} />
          <Route path="/feeds" element={<ThreatFeeds />} />
          <Route path="/hunting" element={<ThreatHunting />} />
          <Route path="/recon" element={<ReconTools />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
};

export default Layout;
