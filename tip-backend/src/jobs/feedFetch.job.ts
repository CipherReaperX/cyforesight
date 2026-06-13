import { Worker } from 'bullmq';
import axios from 'axios';
import Papa from 'papaparse';
import db from '../config/database';
import { iocs, threatFeeds } from '../models/schema';
import { eq } from 'drizzle-orm';
import logger from '../config/logger';
import redis from '../config/redis';

export interface FeedFetchJobData {
  feedId: string;
  feedUrl: string;
  feedType: string;
  feedName: string;
}

export const feedFetchWorker = new Worker(
  'feed-fetch',
  async (job) => {
    const { feedId, feedUrl, feedType, feedName } = job.data;

    logger.info(`Fetching feed: ${feedName} from ${feedUrl}`);

    try {
      // Check if API key required
      if (feedName.includes('AlienVault') || feedName.includes('VirusTotal')) {
        const apiKey = feedName.includes('AlienVault') 
          ? process.env.ALIENVAULT_API_KEY 
          : process.env.VIRUSTOTAL_API_KEY;
        
        if (!apiKey) {
          logger.warn(`⚠️  ${feedName} requires API key, skipping...`);
          return { skipped: true, reason: 'API key not configured' };
        }
      }

      // Fetch feed data
      const response = await axios.get(feedUrl, {
        timeout: 30000,
        headers: { 'User-Agent': 'CyForesight/1.0' }
      });

      let iocCount = 0;

      // Parse based on feed type
      if (feedType === 'json') {
        const data = response.data;
        const indicators: any[] = data.results || data.indicators || [];
        
        for (const indicator of indicators) {
          const iocValue = indicator.indicator || indicator.value;
          if (!iocValue) continue;

          const iocType = detectIOCType(iocValue);
          if (!iocType) continue;

          await db.insert(iocs).values({
            value: iocValue,
            type: iocType,
            sources: [feedName],
            confidence: indicator.confidence || 50,
            severity: normalizeSeverity(indicator.threat_level),
            firstSeen: new Date(),
            lastSeen: new Date(),
            tags: indicator.tags || [],
            description: indicator.description || '',
          }).onConflictDoNothing();
          
          iocCount++;
        }
      } else if (feedType === 'csv') {
        // Use Papa Parse for CSV
        const parsed = Papa.parse(response.data, {
          header: false,
          skipEmptyLines: true,
        });

        for (const row of parsed.data as Array<string[]>) {
          // Skip comments
          if (typeof row[0] === 'string' && row[0].startsWith('#')) continue;
          
          const iocValue = row[0]?.toString().trim();
          if (!iocValue) continue;

          const iocType = detectIOCType(iocValue);
          if (!iocType) continue;

          await db.insert(iocs).values({
            value: iocValue,
            type: iocType,
            sources: [feedName],
            confidence: 70,
            severity: 'medium',
            firstSeen: new Date(),
            lastSeen: new Date(),
            tags: ['imported'],
            description: row[1]?.toString().trim() || '',
          }).onConflictDoNothing();
          
          iocCount++;
        }
      }

      // Update feed last_fetched timestamp
      await db.update(threatFeeds)
        .set({ lastFetch: new Date() })
        .where(eq(threatFeeds.id, feedId));

      logger.info(`✅ Fetched ${iocCount} IOCs from ${feedName}`);
      
      return { success: true, iocCount };
      
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        logger.warn(`⚠️  ${feedName}: API authentication failed`);
        return { skipped: true, reason: 'Authentication failed' };
      }
      
      if (error.response?.status === 404) {
        logger.warn(`⚠️  ${feedName}: URL not found (404)`);
        return { skipped: true, reason: 'URL not found' };
      }

      logger.error(`❌ Error fetching feed ${feedName}:`, error.message);
      throw error;
    }
  },
  { connection: redis }
);

// Helper function to detect IOC type
function detectIOCType(value: string): (typeof iocs.$inferInsert)['type'] | null {
  if (!value) return null;
  
  value = value.trim();
  
  // URL
  if (/^https?:\/\//.test(value)) return 'url';
  
  // IP address
  if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value)) return 'ip';
  
  // Hash (MD5, SHA1, SHA256)
  if (/^[a-f0-9]{32}$/i.test(value)) return 'hash';
  if (/^[a-f0-9]{40}$/i.test(value)) return 'hash';
  if (/^[a-f0-9]{64}$/i.test(value)) return 'hash';
  
  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
  
  // Domain (if it has a dot and no protocol)
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(value)) return 'domain';
  
  return null;
}

function normalizeSeverity(value: unknown): (typeof iocs.$inferInsert)['severity'] {
  const severity = String(value || '').toLowerCase();
  if (severity === 'critical' || severity === 'high' || severity === 'medium' || severity === 'low' || severity === 'info') {
    return severity;
  }
  return 'medium';
}
