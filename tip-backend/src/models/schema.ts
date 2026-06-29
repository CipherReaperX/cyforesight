import { pgTable, uuid, varchar, integer, boolean, timestamp, text, jsonb, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Enums
export const iocTypeEnum = pgEnum('ioc_type', ['ip', 'domain', 'hash', 'url', 'email', 'registry', 'mutex', 'user-agent']);
export const severityEnum = pgEnum('severity', ['critical', 'high', 'medium', 'low', 'info']);
export const iocStatusEnum = pgEnum('ioc_status', ['active', 'blocked', 'whitelisted', 'archived']);
export const assetTypeEnum = pgEnum('asset_type', ['server', 'workstation', 'network_device', 'cloud_resource', 'application']);
export const assetStatusEnum = pgEnum('asset_status', ['online', 'offline', 'unknown']);
export const feedTypeEnum = pgEnum('feed_type', ['json', 'csv', 'xml', 'stix']);
export const feedStatusEnum = pgEnum('feed_status', ['active', 'paused', 'error']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'analyst', 'viewer']);

// Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('viewer'),
  permissions: text('permissions').array().default(sql`ARRAY[]::text[]`),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  isActive: boolean('is_active').default(true),
  lastLogin: timestamp('last_login', { withTimezone: true }),
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// IOCs Table
export const iocs = pgTable('iocs', {
  id: uuid('id').defaultRandom().primaryKey(),
  value: varchar('value', { length: 2048 }).notNull(),
  type: iocTypeEnum('type').notNull(),
  severity: severityEnum('severity').notNull(),
  confidence: integer('confidence').notNull(),
  mlScore: integer('ml_score'),
  status: iocStatusEnum('status').notNull().default('active'),
  tags: text('tags').array().default(sql`ARRAY[]::text[]`),
  sources: text('sources').array().default(sql`ARRAY[]::text[]`),
  mitreTechniques: text('mitre_techniques').array().default(sql`ARRAY[]::text[]`),
  affectedAssets: integer('affected_assets').default(0),
  description: text('description'),
  // Geo-resolution fields (populated at insert time for IP and URL/domain IOCs)
  geoLat: decimal('geo_lat', { precision: 9, scale: 6 }),
  geoLng: decimal('geo_lng', { precision: 9, scale: 6 }),
  geoCountry: varchar('geo_country', { length: 2 }),
  geoCity: varchar('geo_city', { length: 100 }),
  firstSeen: timestamp('first_seen', { withTimezone: true }).defaultNow().notNull(),
  lastSeen: timestamp('last_seen', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
});

// Assets Table
export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: assetTypeEnum('type').notNull(),
  ip: varchar('ip', { length: 45 }),
  hostname: varchar('hostname', { length: 255 }),
  macAddress: varchar('mac_address', { length: 17 }),
  os: varchar('os', { length: 100 }),
  osVersion: varchar('os_version', { length: 50 }),
  department: varchar('department', { length: 100 }),
  owner: varchar('owner', { length: 255 }),
  location: varchar('location', { length: 255 }),
  riskScore: integer('risk_score').default(0),
  criticality: integer('criticality').default(1),
  activeThreats: integer('active_threats').default(0),
  unpatchedCves: integer('unpatched_cves').default(0),
  status: assetStatusEnum('status').notNull().default('unknown'),
  tags: text('tags').array().default(sql`ARRAY[]::text[]`),
  metadata: jsonb('metadata').default({}),
  lastScan: timestamp('last_scan', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// CVEs Table
export const cves = pgTable('cves', {
  id: uuid('id').defaultRandom().primaryKey(),
  cveId: varchar('cve_id', { length: 50 }).notNull().unique(),
  description: text('description').notNull(),
  cvssScore: decimal('cvss_score', { precision: 3, scale: 1 }).notNull(),
  cvssVector: varchar('cvss_vector', { length: 100 }),
  severity: severityEnum('severity').notNull(),
  affectedAssets: integer('affected_assets').default(0),
  publishedDate: timestamp('published_date', { withTimezone: true }).notNull(),
  modifiedDate: timestamp('modified_date', { withTimezone: true }),
  patchStatus: varchar('patch_status', { length: 20 }).default('unavailable'),
  exploitAvailable: boolean('exploit_available').default(false),
  cweIds: text('cwe_ids').array().default(sql`ARRAY[]::text[]`),
  references: jsonb('references').default(sql`'[]'::jsonb`),
  vendor: varchar('vendor', { length: 255 }),
  product: varchar('product', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Threat Feeds Table
export const threatFeeds = pgTable('threat_feeds', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  url: text('url').notNull(),
  type: feedTypeEnum('type').notNull(),
  status: feedStatusEnum('status').notNull().default('active'),
  frequency: varchar('frequency', { length: 20 }).notNull().default('hourly'),
  lastFetch: timestamp('last_fetch', { withTimezone: true }),
  nextFetch: timestamp('next_fetch', { withTimezone: true }),
  iocsImported: integer('iocs_imported').default(0),
  totalIocs: integer('total_iocs').default(0),
  healthScore: integer('health_score').default(100),
  errorMessage: text('error_message'),
  errorCount: integer('error_count').default(0),
  apiKey: text('api_key'),
  headers: jsonb('headers').default({}),
  parserConfig: jsonb('parser_config').default({}),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// MITRE Tactics Table
export const mitreTactics = pgTable('mitre_tactics', {
  id: uuid('id').defaultRandom().primaryKey(),
  tacticId: varchar('tactic_id', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  techniqueCount: integer('technique_count').default(0),
  detectionCount: integer('detection_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// MITRE Techniques Table
export const mitreTechniques = pgTable('mitre_techniques', {
  id: uuid('id').defaultRandom().primaryKey(),
  techniqueId: varchar('technique_id', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  tacticId: uuid('tactic_id').references(() => mitreTactics.id, { onDelete: 'cascade' }),
  description: text('description'),
  platforms: text('platforms').array().default(sql`ARRAY[]::text[]`),
  detections: integer('detections').default(0),
  affectedAssets: integer('affected_assets').default(0),
  latestDetection: timestamp('latest_detection', { withTimezone: true }),
  severity: severityEnum('severity').default('medium'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Threat Detections Table
export const threatDetections = pgTable('threat_detections', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }),
  severity: severityEnum('severity').notNull(),
  confidence: integer('confidence'),
  affectedAssets: text('affected_assets').array().default(sql`ARRAY[]::text[]`),
  iocIds: text('ioc_ids').array().default(sql`ARRAY[]::text[]`),
  techniqueIds: text('technique_ids').array().default(sql`ARRAY[]::text[]`),
  source: varchar('source', { length: 100 }),
  description: text('description'),
  rawData: jsonb('raw_data'),
  status: varchar('status', { length: 20 }).default('new'),
  assignedTo: uuid('assigned_to').references(() => users.id),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Enrichment Cache Table
export const enrichmentCache = pgTable('enrichment_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  iocId: uuid('ioc_id').references(() => iocs.id, { onDelete: 'cascade' }).notNull(),
  source: varchar('source', { length: 50 }).notNull(),
  data: jsonb('data').notNull(),
  cachedAt: timestamp('cached_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// API Integrations Table
export const apiIntegrations = pgTable('api_integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  type: varchar('type', { length: 50 }).notNull(),
  apiKey: text('api_key').notNull(),
  apiSecret: text('api_secret'),
  baseUrl: text('base_url'),
  status: varchar('status', { length: 20 }).notNull().default('inactive'),
  apiCallsCount: integer('api_calls_count').default(0),
  apiCallsLimit: integer('api_calls_limit'),
  rateLimit: integer('rate_limit'),
  rateLimitWindow: varchar('rate_limit_window', { length: 20 }),
  lastSync: timestamp('last_sync', { withTimezone: true }),
  healthScore: integer('health_score').default(100),
  errorMessage: text('error_message'),
  config: jsonb('config').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Audit Logs Table
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }),
  resourceId: uuid('resource_id'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  details: jsonb('details').default({}),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});

// Refresh Tokens Table
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Threat Hunt Queries Table
export const threatHuntQueries = pgTable('threat_hunt_queries', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  query: text('query').notNull(),
  queryLanguage: varchar('query_language', { length: 20 }).default('kql'),
  description: text('description'),
  tags: text('tags').array().default(sql`ARRAY[]::text[]`),
  createdBy: uuid('created_by').references(() => users.id),
  lastRun: timestamp('last_run', { withTimezone: true }),
  runCount: integer('run_count').default(0),
  isScheduled: boolean('is_scheduled').default(false),
  scheduleCron: varchar('schedule_cron', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Integrations Table (Slack, Teams, Discord, Webhook, Email, VirusTotal)
export const integrations = pgTable('integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 50 }).notNull(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  enabled: boolean('enabled').default(false).notNull(),
  config: jsonb('config').default({}).notNull(),
  status: varchar('status', { length: 30 }).default('not_configured').notNull(),
  lastUsed: timestamp('last_used', { withTimezone: true }),
  lastResult: jsonb('last_result'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Platform settings — key/value store
export const platformSettings = pgTable('platform_settings', {
  key: varchar('key', { length: 128 }).primaryKey(),
  value: text('value'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// API keys (encrypted/masked)
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  service: varchar('service', { length: 64 }).notNull().unique(), // 'virustotal','abuseipdb','shodan','otx'
  keyHash: text('key_hash'),      // bcrypt hash for verification
  keyMasked: varchar('key_masked', { length: 32 }), // first 4 + **** + last 4
  keyEncrypted: text('key_encrypted'), // AES-256 encrypted full key for actual use
  isActive: boolean('is_active').default(true),
  lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
  lastTestStatus: varchar('last_test_status', { length: 16 }), // 'ok'|'fail'|null
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Notification preferences
export const notificationPrefs = pgTable('notification_prefs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  inApp: boolean('in_app').default(true),
  email: boolean('email').default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Reports Table
export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  template: varchar('template', { length: 100 }),
  schedule: varchar('schedule', { length: 20 }),
  scheduleCron: varchar('schedule_cron', { length: 100 }),
  lastGenerated: timestamp('last_generated', { withTimezone: true }),
  recipients: text('recipients').array().default(sql`ARRAY[]::text[]`),
  filters: jsonb('filters').default({}),
  filePath: text('file_path'),
  fileSize: integer('file_size'),
  status: varchar('status', { length: 20 }).default('draft'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
