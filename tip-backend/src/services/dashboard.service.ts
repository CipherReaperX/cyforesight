import { eq, and, gte, sql, inArray } from 'drizzle-orm';
import db from '../config/database';
import { iocs, threatDetections, assets, threatFeeds, mitreTechniques } from '../models/schema';
import { cacheGet, cacheSet } from '../utils/cache';
import { subDays } from 'date-fns';
import { extractThreatActorsFromIOC } from '../utils/threat-intel';

export class DashboardService {
  async getStats() {
    const cacheKey = 'dashboard:stats';
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const [
      criticalThreatsResult,
      totalIOCsResult,
      blockedThreatsResult,
      assetsAtRiskResult,
      iocBreakdownResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(threatDetections)
        .where(and(
          eq(threatDetections.severity, 'critical'),
          eq(threatDetections.status, 'new')
        )),
      db.select({ count: sql<number>`count(*)` }).from(iocs),
      db.select({ count: sql<number>`count(*)` })
        .from(iocs)
        .where(eq(iocs.status, 'blocked')),
      db.select({ count: sql<number>`count(*)` })
        .from(assets)
        .where(sql`${assets.activeThreats} > 0`),
      db.select({
        type: iocs.type,
        count: sql<number>`count(*)`,
      })
        .from(iocs)
        .groupBy(iocs.type),
    ]);

    const iocBreakdown = iocBreakdownResult.reduce((acc, item) => {
      acc[item.type] = Number(item.count);
      return acc;
    }, {} as Record<string, number>);

    const stats = {
      criticalThreats: Number(criticalThreatsResult[0]?.count || 0),
      totalIOCs: Number(totalIOCsResult[0]?.count || 0),
      blockedThreats: Number(blockedThreatsResult[0]?.count || 0),
      assetsAtRisk: Number(assetsAtRiskResult[0]?.count || 0),
      iocBreakdown: {
        ip: iocBreakdown.ip || 0,
        domain: iocBreakdown.domain || 0,
        hash: iocBreakdown.hash || 0,
        url: iocBreakdown.url || 0,
      },
      timestamp: new Date().toISOString(),
    };

    await cacheSet(cacheKey, stats, 300); // 5 min cache
    return stats;
  }

  async getThreatTrend(days: number = 30) {
    const safeDays = Math.min(Math.max(days, 1), 90);
    const cacheKey = `dashboard:trend:${safeDays}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const startDate = subDays(new Date(), safeDays);

    const result = await db
      .select({
        date: sql<string>`DATE(${threatDetections.timestamp})`,
        severity: threatDetections.severity,
        count: sql<number>`count(*)`,
      })
      .from(threatDetections)
      .where(gte(threatDetections.timestamp, startDate))
      .groupBy(sql`DATE(${threatDetections.timestamp})`, threatDetections.severity)
      .orderBy(sql`DATE(${threatDetections.timestamp}) DESC`);

    const grouped = result.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = { date: item.date, critical: 0, high: 0, medium: 0, low: 0 };
      }
      acc[item.date][item.severity] = Number(item.count);
      return acc;
    }, {} as Record<string, any>);

    const timeline = Object.values(grouped);
    await cacheSet(cacheKey, timeline, 180);
    return timeline;
  }

  async getRecentThreats(limit: number = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const cacheKey = `dashboard:recent-threats:${safeLimit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const threats = await db.query.threatDetections.findMany({
      limit: safeLimit,
      orderBy: (threatDetections, { desc }) => [desc(threatDetections.timestamp)],
    });

    const mapped = threats.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      severity: t.severity,
      affectedAssets: t.affectedAssets?.length || 0,
      iocCount: t.iocIds?.length || 0,
      techniques: t.techniqueIds || [],
      confidence: t.confidence,
      source: t.source,
      timestamp: t.timestamp,
    }));
    await cacheSet(cacheKey, mapped, 120);
    return mapped;
  }

  async getFeedHealth() {
    const cacheKey = 'dashboard:feed-health';
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const feeds = await db.query.threatFeeds.findMany({
      where: eq(threatFeeds.enabled, true),
    });

    const mapped = feeds.map(f => ({
      id: f.id,
      name: f.name,
      status: f.status,
      lastFetch: f.lastFetch,
      iocsToday: f.iocsImported,
      totalIOCs: f.totalIocs,
      frequency: f.frequency,
      healthScore: f.healthScore,
    }));
    await cacheSet(cacheKey, mapped, 300);
    return mapped;
  }

  async getOverview(days: number = 30, limit: number = 10) {
    const safeDays = Math.min(Math.max(days, 1), 90);
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const cacheKey = `dashboard:overview:${safeDays}:${safeLimit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const [stats, threatTrend, iocDistribution, recentThreats, feedHealth, topTechniques, actorRows] = await Promise.all([
      this.getStats(),
      this.getThreatTrend(safeDays),
      db
        .select({
          type: iocs.type,
          count: sql<number>`count(*)`,
        })
        .from(iocs)
        .where(eq(iocs.status, 'active'))
        .groupBy(iocs.type),
      this.getRecentThreats(safeLimit),
      this.getFeedHealth(),
      db.select().from(mitreTechniques).limit(5),
      db.select({
        value: iocs.value,
        type: iocs.type,
        tags: iocs.tags,
        sources: iocs.sources,
        description: iocs.description,
        lastSeen: iocs.lastSeen,
      }).from(iocs).orderBy(sql`${iocs.lastSeen} DESC`).limit(5000),
    ]);

    const actorMap = new Map<string, { actor: string; iocCount: number; latestSeen: string }>();
    for (const row of actorRows) {
      const actors = extractThreatActorsFromIOC(row);
      for (const actor of actors) {
        const existing = actorMap.get(actor) || { actor, iocCount: 0, latestSeen: row.lastSeen.toISOString() };
        existing.iocCount += 1;
        if (new Date(row.lastSeen) > new Date(existing.latestSeen)) {
          existing.latestSeen = row.lastSeen.toISOString();
        }
        actorMap.set(actor, existing);
      }
    }

    const colors: Record<string, string> = {
      ip: '#3b82f6',
      domain: '#10b981',
      hash: '#f59e0b',
      url: '#ef4444',
    };

    const threatActors = Array.from(actorMap.values()).sort((a, b) => b.iocCount - a.iocCount).slice(0, 10);
    if (threatActors.length === 0 && actorRows.length > 0) {
      const infraCount = actorRows.filter((r) => r.type === 'ip' || r.type === 'domain' || r.type === 'url').length;
      if (infraCount > 0) {
        threatActors.push({
          actor: 'Unattributed Infrastructure Cluster',
          iocCount: infraCount,
          latestSeen: actorRows[0].lastSeen.toISOString(),
        });
      }
    }

    const overview = {
      stats,
      threatTrend,
      iocDistribution: iocDistribution.map((r) => ({
        type: r.type,
        count: Number(r.count),
        color: colors[r.type] || '#6b7280',
      })),
      topTechniques: topTechniques.map((t) => ({
        id: t.techniqueId || t.id,
        techniqueId: t.techniqueId,
        name: t.name,
        detections: t.detections || 0,
        affectedAssets: t.affectedAssets || 0,
        severity: t.severity || 'medium',
        trend: 'stable',
      })),
      threatActors,
      recentThreats,
      feedHealth,
    };

    await cacheSet(cacheKey, overview, 120);
    return overview;
  }

  async getActivityTimeline(hours: number = 24) {
    // This would be implemented with proper audit logging
    return [];
  }

  async getRealtimePulse() {
    const [iocCount, newThreats, assetsAtRisk, incidentsOpen] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(iocs),
      db
        .select({ count: sql<number>`count(*)` })
        .from(threatDetections)
        .where(eq(threatDetections.status, 'new')),
      db
        .select({ count: sql<number>`count(*)` })
        .from(assets)
        .where(sql`${assets.activeThreats} > 0`),
      db
        .select({ count: sql<number>`count(*)` })
        .from(threatDetections)
        .where(inArray(threatDetections.status as any, ['new', 'in_progress'] as any)),
    ]);

    return {
      ts: new Date().toISOString(),
      totalIocs: Number(iocCount[0]?.count || 0),
      newThreats: Number(newThreats[0]?.count || 0),
      assetsAtRisk: Number(assetsAtRisk[0]?.count || 0),
      incidentsOpen: Number(incidentsOpen[0]?.count || 0),
    };
  }
}

export default new DashboardService();
