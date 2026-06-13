export interface PaginationParams {
  skip?: number;
  take?: number;
}

export interface IOCCreateInput {
  value: string;
  type: 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'registry' | 'mutex' | 'user-agent';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence?: number;
  tags?: string[];
  sources?: string[];
  description?: string;
}

export interface IOCUpdateInput {
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status?: 'active' | 'blocked' | 'whitelisted' | 'archived';
  tags?: string[];
  confidence?: number;
}

export interface AssetCreateInput {
  name: string;
  type: 'server' | 'workstation' | 'network_device' | 'cloud_resource' | 'application';
  ip?: string;
  hostname?: string;
  os?: string;
  department?: string;
  owner?: string;
  criticality?: number;
  tags?: string[];
}

export interface DashboardStats {
  criticalThreats: number;
  totalIOCs: number;
  blockedThreats: number;
  assetsAtRisk: number;
  criticalChange?: number;
  iocBreakdown: {
    ip: number;
    domain: number;
    hash: number;
    url: number;
  };
}

export interface EnrichmentData {
  virusTotal?: any;
  abuseIPDB?: any;
  whois?: any;
  dns?: any;
  geo?: any;
}

export interface ThreatDetection {
  id: string;
  name: string;
  type?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence?: number;
  affectedAssets: string[];
  iocIds: string[];
  techniqueIds: string[];
  source?: string;
  timestamp: Date;
}
