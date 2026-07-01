import { Worker } from 'bullmq';
import axios from 'axios';
import Papa from 'papaparse';
import db from '../config/database';
import { iocs, threatFeeds } from '../models/schema';
import { eq, inArray } from 'drizzle-orm';
import logger from '../config/logger';
import redis from '../config/redis';
import geoip from 'geoip-lite';
import { emit } from '../services/socket.service';

function geoFields(type: string, value: string): Partial<typeof iocs.$inferInsert> {
  if (type !== 'ip') return {};
  try {
    const g = geoip.lookup(value);
    const lat = g?.ll?.[0];
    const lng = g?.ll?.[1];
    if (
      typeof lat === 'number' && Number.isFinite(lat) && lat !== 0 &&
      typeof lng === 'number' && Number.isFinite(lng)
    ) {
      return { geoLat: String(lat), geoLng: String(lng), geoCountry: g?.country || undefined, geoCity: g?.city || undefined };
    }
  } catch { /* skip on geoip error */ }
  return {};
}

export interface FeedFetchJobData {
  feedId: string;
  feedUrl: string;
  feedType: string;
  feedName: string;
}

const BATCH_SIZE = 500;

export const feedFetchWorker = new Worker(
  'feed-fetch',
  async (job) => {
    const { feedId, feedUrl, feedType, feedName } = job.data;

    logger.info(`Fetching feed: ${feedName} from ${feedUrl}`);

    try {
      if (feedName.includes('AlienVault') || feedName.includes('VirusTotal')) {
        const apiKey = feedName.includes('AlienVault')
          ? process.env.ALIENVAULT_API_KEY
          : process.env.VIRUSTOTAL_API_KEY;

        if (!apiKey) {
          logger.warn(`⚠️  ${feedName} requires API key, skipping...`);
          return { skipped: true, reason: 'API key not configured' };
        }
      }

      const response = await axios.get(feedUrl, {
        timeout: 30000,
        headers: { 'User-Agent': 'CyForesight/1.0' },
        responseType: 'text',
        maxContentLength: 10 * 1024 * 1024,
        decompress: true,
      });

      // Slice very large feeds
      let rawData: string = typeof response.data === 'string' ? response.data : String(response.data);
      if (rawData.length > 3 * 1024 * 1024) {
        const cutAt = rawData.lastIndexOf('\n', 3 * 1024 * 1024);
        rawData = cutAt > 0 ? rawData.slice(0, cutAt) : rawData.slice(0, 3 * 1024 * 1024);
      }

      const now = new Date();
      const toInsert: Array<typeof iocs.$inferInsert> = [];

      if (feedType === 'json') {
        const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        const indicators: any[] = Array.isArray(data)
          ? data
          : data?.results || data?.indicators || data?.data || [];

        for (const indicator of indicators) {
          const iocValue = String(indicator?.indicator || indicator?.value || '').trim();
          if (!iocValue) continue;
          const iocType = detectIOCType(iocValue);
          if (!iocType) continue;

          toInsert.push({
            value: iocValue,
            type: iocType,
            sources: [feedName],
            confidence: Number(indicator?.confidence || 50),
            severity: normalizeSeverity(indicator?.threat_level || indicator?.severity),
            firstSeen: now,
            lastSeen: now,
            tags: Array.isArray(indicator?.tags) ? indicator.tags : [],
            description: indicator?.description || '',
            ...geoFields(iocType, iocValue),
          });
        }
      } else if (feedType === 'csv') {
        const parsed = Papa.parse(rawData, {
          header: false,
          skipEmptyLines: true,
        });

        for (const row of parsed.data as Array<string[]>) {
          const firstCell = typeof row[0] === 'string' ? row[0].trim() : '';
          if (!firstCell || firstCell.startsWith('#')) continue;

          // Scan all cells for a recognizable IOC value
          let iocValue: string | null = null;
          let iocType: ReturnType<typeof detectIOCType> | null = null;
          for (const cell of row) {
            const candidate = String(cell ?? '').trim().replace(/^"(.*)"$/, '$1').trim();
            if (!candidate || candidate.startsWith('#')) continue;
            const t = detectIOCType(candidate);
            if (t) { iocValue = candidate; iocType = t; break; }
          }
          if (!iocValue || !iocType) continue;

          toInsert.push({
            value: iocValue,
            type: iocType,
            sources: [feedName],
            confidence: 70,
            severity: 'medium',
            firstSeen: now,
            lastSeen: now,
            tags: ['imported'],
            description: '',
            ...geoFields(iocType, iocValue),
          });
        }
      }

      // Batch insert with pre-dedup (no unique constraint on iocs table)
      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const batchValues = batch.map((r) => r.value);

        const existing = await db
          .select({ value: iocs.value, type: iocs.type })
          .from(iocs)
          .where(inArray(iocs.value, batchValues));

        const existingSet = new Set(existing.map((r) => `${r.value}|${r.type}`));
        const newOnly = batch.filter((r) => !existingSet.has(`${r.value}|${r.type}`));

        if (newOnly.length === 0) continue;
        const result = await db.insert(iocs).values(newOnly).returning({ id: iocs.id });
        inserted += result.length;
      }

      const syncedAt = new Date();
      await db.update(threatFeeds)
        .set({ lastFetch: syncedAt, iocsImported: inserted, status: 'active', errorMessage: null, updatedAt: syncedAt })
        .where(eq(threatFeeds.id, feedId));

      logger.info(`✅ Fetched ${inserted} new IOCs from ${feedName} (${toInsert.length} parsed)`);

      emit('feed:synced', {
        feedId, feedName, status: 'active',
        iocsInserted: inserted, lastSyncAt: syncedAt.toISOString(),
      });

      return { success: true, inserted, parsed: toInsert.length };

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
      await db.update(threatFeeds)
        .set({ status: 'error', errorMessage: error.message || 'Feed fetch failed', updatedAt: new Date() })
        .where(eq(threatFeeds.id, feedId))
        .catch((dbErr: any) => logger.error('Failed to update feed error status:', dbErr));
      emit('feed:synced', { feedId, feedName, status: 'error', iocsInserted: 0, lastSyncAt: new Date().toISOString(), error: error.message });
      throw error;
    }
  },
  { connection: redis }
);

function detectIOCType(value: string): (typeof iocs.$inferInsert)['type'] | null {
  if (!value) return null;
  const v = value.trim();
  if (/^https?:\/\//.test(v)) return 'url';
  if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(v)) return 'ip';
  if (/^[a-f0-9]{32}$/i.test(v) || /^[a-f0-9]{40}$/i.test(v) || /^[a-f0-9]{64}$/i.test(v)) return 'hash';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'email';
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(v)) return 'domain';
  return null;
}

function normalizeSeverity(value: unknown): (typeof iocs.$inferInsert)['severity'] {
  const s = String(value || '').toLowerCase();
  if (s === 'critical' || s === 'high' || s === 'medium' || s === 'low' || s === 'info') return s;
  return 'medium';
}
