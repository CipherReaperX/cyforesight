import axios from 'axios';
import Papa from 'papaparse';
import { eq, and, sql } from 'drizzle-orm';
import db from '../config/database';
import { iocs, threatFeeds } from '../models/schema';
import logger from '../config/logger';
import { feedFetchQueue } from '../config/queue';
import iocService from './ioc.service';

export class FeedService {
  private detectIOCType(value: string): (typeof iocs.$inferInsert)['type'] | null {
    if (!value) return null;
    const normalized = value.trim();
    if (!normalized) return null;
    if (/^https?:\/\//.test(normalized)) return 'url';
    if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(normalized)) return 'ip';
    if (/^[a-f0-9]{32}$/i.test(normalized) || /^[a-f0-9]{40}$/i.test(normalized) || /^[a-f0-9]{64}$/i.test(normalized)) return 'hash';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return 'email';
    if (/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(normalized)) return 'domain';
    return null;
  }

  private normalizeSeverity(value: unknown): (typeof iocs.$inferInsert)['severity'] {
    const severity = String(value || '').toLowerCase();
    if (severity === 'critical' || severity === 'high' || severity === 'medium' || severity === 'low' || severity === 'info') {
      return severity;
    }
    return 'medium';
  }

  private async upsertFeedHealth(
    feedId: string,
    payload: {
      status?: 'active' | 'paused' | 'error';
      importedInc?: number;
      errorMessage?: string | null;
      errored?: boolean;
    }
  ) {
    const feed = await this.getFeedById(feedId);
    const importedInc = payload.importedInc || 0;
    const currentTotal = Number(feed.totalIocs || 0);
    const currentErrors = Number(feed.errorCount || 0);

    await db
      .update(threatFeeds)
      .set({
        status: payload.status || 'active',
        iocsImported: importedInc,
        totalIocs: currentTotal + importedInc,
        lastFetch: new Date(),
        errorMessage: payload.errorMessage ?? null,
        errorCount: payload.errored ? currentErrors + 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(threatFeeds.id, feedId));
  }

  async syncFeedNow(id: string, timeoutMs?: number) {
    const feed = await this.getFeedById(id);
    const now = new Date();
    const requestTimeout = timeoutMs && timeoutMs > 0 ? timeoutMs : Number(process.env.FEED_SYNC_TIMEOUT_MS || 8000);

    try {
      const response = await axios.get(feed.url, {
        timeout: requestTimeout,
        headers: { 'User-Agent': 'CyForesight/1.0' },
      });

      const toInsert: Array<typeof iocs.$inferInsert> = [];

      if (feed.type === 'json') {
        const data = response.data;
        const indicators: any[] = Array.isArray(data)
          ? data
          : data?.results || data?.indicators || data?.data || [];

        for (const indicator of indicators) {
          const iocValue = String(indicator?.indicator || indicator?.value || '').trim();
          if (!iocValue) continue;
          const iocType = this.detectIOCType(iocValue);
          if (!iocType) continue;

          toInsert.push({
            value: iocValue,
            type: iocType,
            sources: [feed.name],
            confidence: Number(indicator?.confidence || 50),
            severity: this.normalizeSeverity(indicator?.threat_level || indicator?.severity),
            firstSeen: now,
            lastSeen: now,
            tags: Array.isArray(indicator?.tags) ? indicator.tags : [],
            description: indicator?.description || '',
          });
        }
      }

      if (feed.type === 'csv') {
        const parsed = Papa.parse(response.data, {
          header: false,
          skipEmptyLines: true,
        });

        for (const row of parsed.data as Array<string[]>) {
          if (typeof row[0] === 'string' && row[0].startsWith('#')) continue;
          const iocValue = row[0]?.toString().trim();
          if (!iocValue) continue;
          const iocType = this.detectIOCType(iocValue);
          if (!iocType) continue;

          toInsert.push({
            value: iocValue,
            type: iocType,
            sources: [feed.name],
            confidence: 70,
            severity: 'medium',
            firstSeen: now,
            lastSeen: now,
            tags: ['imported'],
            description: row[1]?.toString().trim() || '',
          });
        }
      }

      let inserted = 0;
      if (toInsert.length > 0) {
        const result = await db.insert(iocs).values(toInsert).onConflictDoNothing().returning({ id: iocs.id });
        inserted = result.length;
      }

      await this.upsertFeedHealth(feed.id, {
        status: 'active',
        importedInc: inserted,
        errorMessage: null,
      });

      logger.info(`Feed sync completed immediately: ${id} (${inserted} new IOCs)`);
      return {
        mode: 'immediate',
        feedId: id,
        feedName: feed.name,
        parsed: toInsert.length,
        inserted,
      };
    } catch (error: any) {
      await this.upsertFeedHealth(feed.id, {
        status: 'error',
        importedInc: 0,
        errorMessage: error?.message || 'Feed sync failed',
        errored: true,
      });
      throw error;
    }
  }

  async syncAllActiveFeedsNow(timeoutMs?: number) {
    const activeFeeds = await db.query.threatFeeds.findMany({
      where: and(eq(threatFeeds.enabled, true), eq(threatFeeds.status, 'active')),
      orderBy: (tf, { desc }) => [desc(tf.healthScore)],
    });

    const settled = await Promise.allSettled(
      activeFeeds.map((feed) => this.syncFeedNow(feed.id, timeoutMs))
    );

    const results: Array<{ feedId: string; feedName: string; inserted: number; parsed: number; mode: string; error?: string }> = settled.map((entry, idx) => {
      if (entry.status === 'fulfilled') return entry.value;
      return {
        mode: 'immediate',
        feedId: activeFeeds[idx].id,
        feedName: activeFeeds[idx].name,
        inserted: 0,
        parsed: 0,
        error: (entry.reason as any)?.message || 'Sync failed',
      };
    });

    const insertedTotal = results.reduce((sum, r) => sum + (r.inserted || 0), 0);
    let diversifiedInserted = 0;

    // If external feeds are stale/unreachable, ensure IOC coverage across multiple indicator types.
    if (insertedTotal < 10) {
      const diversify = await iocService.bootstrapDiverseIOCs(80);
      diversifiedInserted = diversify.inserted;
    }

    return {
      totalFeeds: activeFeeds.length,
      successfulFeeds: results.filter((r) => !r.error).length,
      failedFeeds: results.filter((r) => !!r.error).length,
      insertedTotal,
      diversifiedInserted,
      results,
    };
  }

  async getFeeds() {
    const feeds = await db.query.threatFeeds.findMany({
      orderBy: (threatFeeds, { desc }) => [desc(threatFeeds.healthScore)],
    });

    return feeds;
  }

  async getFeedById(id: string) {
    const feed = await db.query.threatFeeds.findFirst({
      where: eq(threatFeeds.id, id),
    });

    if (!feed) {
      throw new Error('Feed not found');
    }

    return feed;
  }

  async createFeed(input: any) {
    const [newFeed] = await db.insert(threatFeeds).values({
      name: input.name,
      url: input.url,
      type: input.type,
      frequency: input.frequency || 'hourly',
      apiKey: input.apiKey,
      headers: input.headers || {},
      parserConfig: input.parserConfig || {},
      enabled: true,
    }).returning();

    logger.info(`Feed created: ${input.name}`);

    return newFeed;
  }

  async updateFeed(id: string, input: any) {
    await this.getFeedById(id);

    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.url !== undefined) updatePayload.url = input.url;
    if (input.type !== undefined) updatePayload.type = input.type;
    if (input.frequency !== undefined) updatePayload.frequency = input.frequency;
    if (input.apiKey !== undefined) updatePayload.apiKey = input.apiKey;
    if (input.headers !== undefined) updatePayload.headers = input.headers;
    if (input.parserConfig !== undefined) updatePayload.parserConfig = input.parserConfig;
    if (input.status !== undefined) updatePayload.status = input.status;
    if (input.enabled !== undefined) updatePayload.enabled = Boolean(input.enabled);
    if (input.isActive !== undefined) updatePayload.enabled = Boolean(input.isActive);

    const [updated] = await db.update(threatFeeds)
      .set(updatePayload)
      .where(eq(threatFeeds.id, id))
      .returning();

    logger.info(`Feed updated: ${id}`);

    return updated;
  }

  async deleteFeed(id: string) {
    await db.delete(threatFeeds).where(eq(threatFeeds.id, id));
    logger.info(`Feed deleted: ${id}`);
  }

  async pauseFeed(id: string) {
    await db.update(threatFeeds)
      .set({ status: 'paused', enabled: false, updatedAt: new Date() })
      .where(eq(threatFeeds.id, id));
    
    logger.info(`Feed paused: ${id}`);
  }

  async resumeFeed(id: string) {
    await db.update(threatFeeds)
      .set({ status: 'active', enabled: true, updatedAt: new Date() })
      .where(eq(threatFeeds.id, id));
    
    logger.info(`Feed resumed: ${id}`);
  }

  async syncFeed(id: string) {
    const feed = await this.getFeedById(id);
    await feedFetchQueue.add('fetch-feed', {
      feedId: feed.id,
      feedName: feed.name,
      feedUrl: feed.url,
      feedType: feed.type,
    });
    logger.info(`Feed sync queued: ${id}`);
  }
}

export default new FeedService();
