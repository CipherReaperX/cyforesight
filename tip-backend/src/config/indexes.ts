import db from './database';
import logger from './logger';
import { sql } from 'drizzle-orm';

const indexStatements = [
  'CREATE INDEX IF NOT EXISTS idx_iocs_status ON iocs(status)',
  'CREATE INDEX IF NOT EXISTS idx_iocs_type ON iocs(type)',
  'CREATE INDEX IF NOT EXISTS idx_iocs_severity ON iocs(severity)',
  'CREATE INDEX IF NOT EXISTS idx_iocs_created_at ON iocs(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_iocs_last_seen ON iocs(last_seen DESC)',
  'CREATE INDEX IF NOT EXISTS idx_threat_detections_timestamp ON threat_detections(timestamp DESC)',
  'CREATE INDEX IF NOT EXISTS idx_threat_detections_severity_status ON threat_detections(severity, status)',
  'CREATE INDEX IF NOT EXISTS idx_assets_active_threats ON assets(active_threats)',
  'CREATE INDEX IF NOT EXISTS idx_assets_risk_score ON assets(risk_score DESC)',
  'CREATE INDEX IF NOT EXISTS idx_cves_published_date ON cves(published_date DESC)',
  'CREATE INDEX IF NOT EXISTS idx_cves_severity ON cves(severity)',
  'CREATE INDEX IF NOT EXISTS idx_threat_feeds_enabled_status ON threat_feeds(enabled, status)',
];

export async function ensurePerformanceIndexes() {
  try {
    for (const statement of indexStatements) {
      await db.execute(sql.raw(statement));
    }
    logger.info(`✅ Ensured ${indexStatements.length} performance indexes`);
  } catch (error: any) {
    logger.warn(`⚠️  Failed to ensure performance indexes: ${error.message}`);
  }
}
