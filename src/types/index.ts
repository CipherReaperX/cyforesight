export interface IOC {
  id: string
  value: string
  type: IOCType
  severity: Severity
  confidence: number
  tags: string[]
  sources: string[]
  firstSeen: string
  lastSeen: string
  affectedAssets: number
  mitreTechniques: string[]
  mlScore: number
  status: IOCStatus
  description?: string
  createdAt: string
  updatedAt: string
}

export type IOCType = 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'registry' | 'mutex' | 'user-agent'

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type IOCStatus = 'active' | 'blocked' | 'whitelisted' | 'archived'

export interface DashboardStats {
  criticalThreats: number
  totalIOCs: number
  blockedThreats: number
  assetsAtRisk: number
  criticalChange: number
  iocBreakdown: {
    ip: number
    domain: number
    hash: number
    url: number
  }
}

export interface ThreatTrend {
  date: string
  critical: number
  high: number
  medium: number
  low: number
}

export interface IOCDistribution {
  type: string
  count: number
  color: string
}

export interface MitreTechnique {
  id: string
  name: string
  detections: number
  trend: 'up' | 'down' | 'stable'
  affectedAssets: number
  latestDetection: string
  severity: Severity
  description?: string
}

export interface ThreatDetection {
  id: string
  name: string
  type: string
  severity: Severity
  affectedAssets: number
  iocCount: number
  techniques: string[]
  confidence: number
  source: string
  timestamp: string
}

export interface FeedHealth {
  id: string
  name: string
  status: 'active' | 'paused' | 'warning' | 'error'
  lastFetch: string
  iocsToday: number
  totalIOCs: number
  frequency: string
  healthScore: number
  errorMessage?: string
}

export interface DashboardOverview {
  stats: DashboardStats
  threatTrend: ThreatTrend[]
  iocDistribution: IOCDistribution[]
  topTechniques: MitreTechnique[]
  threatActors: ThreatActor[]
  recentThreats: ThreatDetection[]
  feedHealth: FeedHealth[]
}

export interface ThreatActor {
  actor: string
  iocCount: number
  latestSeen: string
  samples?: string[]
}

export interface Asset {
  id: string
  name: string
  type: AssetType
  ip?: string
  hostname?: string
  macAddress?: string
  os?: string
  osVersion?: string
  department?: string
  owner?: string
  location?: string
  riskScore: number
  criticality: number
  activeThreats: number
  unpatchedCves: number
  status: 'online' | 'offline' | 'unknown'
  tags: string[]
  metadata?: Record<string, unknown>
  lastScan?: string
  createdAt?: string
  updatedAt?: string
}

export type AssetType = 'server' | 'workstation' | 'network_device' | 'cloud_resource' | 'application'

export interface CVE {
  id: string
  cveId: string
  description: string
  cvssScore: number | string
  severity: Severity
  affectedAssets: number
  publishedDate: string
  patchStatus: 'available' | 'pending' | 'unavailable'
  exploitAvailable: boolean
}

export interface Feed {
  id: string
  name: string
  url: string
  type: 'json' | 'csv' | 'xml' | 'stix'
  status: 'active' | 'paused' | 'error'
  lastFetch: string
  iocsImported: number
  totalIOCs: number
  frequency: string
  healthScore: number
}

export interface EnrichmentData {
  virusTotal?: {
    detectionRatio: string
    positives: number
    total: number
    vendors: Array<{ name: string; result: string }>
  }
  abuseIPDB?: {
    abuseConfidence: number
    totalReports: number
    country: string
    isp: string
  }
  whois?: {
    registrar: string
    registered: string
    expires: string
    nameServers: string[]
  }
  dns?: {
    a: string[]
    mx: string[]
    txt: string[]
  }
  geo?: {
    country: string
    city: string
    lat: number
    lon: number
  }
}
