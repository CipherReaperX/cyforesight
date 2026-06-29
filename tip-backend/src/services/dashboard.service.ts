import { eq, and, gte, lte, sql, inArray, desc } from 'drizzle-orm';
import db from '../config/database';
import { iocs, threatDetections, assets, threatFeeds, mitreTechniques } from '../models/schema';
import { cacheGet, cacheSet, cacheDelPattern } from '../utils/cache';
import { subDays } from 'date-fns';
import { extractThreatActorsFromIOC } from '../utils/threat-intel';
import * as geoip from 'geoip-lite';
import { emit } from './socket.service';

const COUNTRY_NAMES: Record<string, string> = {
  US:'United States',CN:'China',RU:'Russia',DE:'Germany',NL:'Netherlands',
  GB:'United Kingdom',FR:'France',JP:'Japan',KR:'South Korea',BR:'Brazil',
  IN:'India',CA:'Canada',AU:'Australia',SG:'Singapore',HK:'Hong Kong',
  UA:'Ukraine',PL:'Poland',SE:'Sweden',IT:'Italy',ES:'Spain',
  TR:'Turkey',IR:'Iran',KP:'North Korea',RO:'Romania',BG:'Bulgaria',
  CZ:'Czech Republic',HU:'Hungary',AT:'Austria',CH:'Switzerland',BE:'Belgium',
  PT:'Portugal',GR:'Greece',FI:'Finland',NO:'Norway',DK:'Denmark',
  ID:'Indonesia',MY:'Malaysia',TH:'Thailand',VN:'Vietnam',PH:'Philippines',
  ZA:'South Africa',EG:'Egypt',NG:'Nigeria',AR:'Argentina',MX:'Mexico',
  CL:'Chile',CO:'Colombia',PK:'Pakistan',BD:'Bangladesh',LT:'Lithuania',
  LV:'Latvia',EE:'Estonia',BY:'Belarus',MD:'Moldova',RS:'Serbia',
  BA:'Bosnia','ME':'Montenegro',MK:'North Macedonia',AL:'Albania',
  XK:'Kosovo',HR:'Croatia',SI:'Slovenia',SK:'Slovakia',
};

export class DashboardService {
  // Bust all dashboard cache keys and notify connected clients
  async invalidateCache() {
    await cacheDelPattern('dashboard:*');
    emit('dashboard:refresh', { ts: new Date().toISOString() });
  }

  async getStats(refresh = false) {
    const cacheKey = 'dashboard:stats';
    if (!refresh) {
      const cached = await cacheGet(cacheKey);
      if (cached) return cached;
    }

    const now = new Date();
    const weekAgo = subDays(now, 7);
    const twoWeeksAgo = subDays(now, 14);

    const [
      criticalThreatsResult,
      criticalLastWeekResult,
      criticalPrevWeekResult,
      totalIOCsResult,
      blockedThreatsResult,
      assetsAtRiskResult,
      iocBreakdownResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(iocs).where(eq(iocs.severity, 'critical')),
      db.select({ count: sql<number>`count(*)` }).from(iocs)
        .where(and(eq(iocs.severity, 'critical'), gte(iocs.firstSeen, weekAgo))),
      db.select({ count: sql<number>`count(*)` }).from(iocs)
        .where(and(eq(iocs.severity, 'critical'), gte(iocs.firstSeen, twoWeeksAgo), lte(iocs.firstSeen, weekAgo))),
      db.select({ count: sql<number>`count(*)` }).from(iocs),
      db.select({ count: sql<number>`count(*)` }).from(iocs).where(eq(iocs.status, 'blocked')),
      db.select({ count: sql<number>`count(*)` }).from(assets).where(sql`${assets.activeThreats} > 0`),
      db.select({ type: iocs.type, count: sql<number>`count(*)` }).from(iocs).groupBy(iocs.type),
    ]);

    const thisWeek = Number(criticalLastWeekResult[0]?.count || 0);
    const prevWeek = Number(criticalPrevWeekResult[0]?.count || 1);
    const criticalChange = Math.round(((thisWeek - prevWeek) / prevWeek) * 100);

    const iocBreakdown = iocBreakdownResult.reduce((acc, item) => {
      acc[item.type] = Number(item.count);
      return acc;
    }, {} as Record<string, number>);

    const stats = {
      criticalThreats: Number(criticalThreatsResult[0]?.count || 0),
      criticalChange,
      totalIOCs: Number(totalIOCsResult[0]?.count || 0),
      blockedThreats: Number(blockedThreatsResult[0]?.count || 0),
      assetsAtRisk: Number(assetsAtRiskResult[0]?.count || 0),
      iocBreakdown: {
        ip: iocBreakdown.ip || 0,
        domain: iocBreakdown.domain || 0,
        hash: iocBreakdown.hash || 0,
        url: iocBreakdown.url || 0,
        email: iocBreakdown.email || 0,
      },
      timestamp: new Date().toISOString(),
    };

    await cacheSet(cacheKey, stats, 300);
    return stats;
  }

  // Trend from IOCs by firstSeen date (not threatDetections which may be stale)
  async getThreatTrend(days: number = 30, refresh = false) {
    const safeDays = Math.min(Math.max(days, 1), 90);
    const cacheKey = `dashboard:trend:${safeDays}`;
    if (!refresh) {
      const cached = await cacheGet(cacheKey);
      if (cached) return cached;
    }

    const startDate = subDays(new Date(), safeDays);

    const result = await db
      .select({
        date: sql<string>`TO_CHAR(DATE(${iocs.firstSeen}), 'YYYY-MM-DD')`,
        severity: iocs.severity,
        count: sql<number>`count(*)`,
      })
      .from(iocs)
      .where(gte(iocs.firstSeen, startDate))
      .groupBy(sql`DATE(${iocs.firstSeen})`, iocs.severity)
      .orderBy(sql`DATE(${iocs.firstSeen}) ASC`);

    // Fill all days so chart has no gaps
    const grouped: Record<string, any> = {};
    for (let i = safeDays; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = d.toISOString().slice(0, 10);
      grouped[key] = { date: key, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    }

    for (const item of result) {
      const key = item.date;
      if (grouped[key]) {
        grouped[key][item.severity] = Number(item.count);
      }
    }

    const timeline = Object.values(grouped);
    // Only keep days that have at least one IOC OR are in the last 7 days
    const today = new Date().toISOString().slice(0, 10);
    const week7ago = subDays(new Date(), 7).toISOString().slice(0, 10);
    const pruned = timeline.filter(
      (d: any) => d.critical + d.high + d.medium + d.low + d.info > 0 || d.date >= week7ago
    );

    await cacheSet(cacheKey, pruned, 180);
    return pruned;
  }

  async getRecentThreats(limit: number = 10, refresh = false) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const cacheKey = `dashboard:recent-threats:${safeLimit}`;
    if (!refresh) {
      const cached = await cacheGet(cacheKey);
      if (cached) return cached;
    }

    // Only use threatDetections if at least one record is from the last 7 days —
    // otherwise the table holds stale seed data that shows as "months ago" in the UI.
    const recentCutoff = subDays(new Date(), 7);
    const detections = await db.query.threatDetections.findMany({
      limit: safeLimit,
      orderBy: (td, { desc }) => [desc(td.timestamp)],
    });
    const freshDetections = detections.filter(d => new Date(d.timestamp) >= recentCutoff);

    if (freshDetections.length >= 1) {
      const mapped = detections.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type || 'detection',
        severity: t.severity,
        affectedAssets: t.affectedAssets?.length || 0,
        iocCount: t.iocIds?.length || 0,
        techniques: t.techniqueIds || [],
        confidence: t.confidence || 75,
        source: t.source || 'detection-engine',
        timestamp: t.timestamp,
      }));
      await cacheSet(cacheKey, mapped, 120);
      return mapped;
    }

    // Fall back to most-recent IOCs of any severity — all feed-synced IOCs are
    // 'medium', so filtering to critical/high would return nothing.
    const recentIOCs = await db.query.iocs.findMany({
      limit: safeLimit,
      orderBy: (ioc, { desc }) => [desc(ioc.lastSeen)],
    });

    const mapped = recentIOCs.map(ioc => ({
      id: ioc.id,
      name: `${ioc.type.toUpperCase()}: ${ioc.value.slice(0, 50)}`,
      type: ioc.type,
      severity: ioc.severity,
      affectedAssets: ioc.affectedAssets || 0,
      iocCount: 1,
      techniques: ioc.mitreTechniques || [],
      confidence: ioc.confidence || 70,
      source: (ioc.sources || ['unknown'])[0],
      timestamp: ioc.lastSeen,
    }));
    await cacheSet(cacheKey, mapped, 120);
    return mapped;
  }

  async getFeedHealth(refresh = false) {
    const cacheKey = 'dashboard:feed-health';
    if (!refresh) {
      const cached = await cacheGet(cacheKey);
      if (cached) return cached;
    }

    const feeds = await db.query.threatFeeds.findMany({
      where: eq(threatFeeds.enabled, true),
    });

    // Count IOCs imported today per feed via sources array
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const mapped = await Promise.all(feeds.map(async (f) => {
      const todayCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(iocs)
        .where(
          and(
            sql`${iocs.sources} @> ARRAY[${f.name}]::text[]`,
            gte(iocs.createdAt, today)
          )
        );

      return {
        id: f.id,
        name: f.name,
        status: f.status,
        lastFetch: f.lastFetch,
        iocsToday: Number(todayCount[0]?.count || 0),
        totalIOCs: f.totalIocs || 0,
        frequency: f.frequency,
        healthScore: f.healthScore || 100,
        errorMessage: f.errorMessage,
      };
    }));

    await cacheSet(cacheKey, mapped, 120);
    return mapped;
  }

  async getOverview(days: number = 30, limit: number = 10, refresh = false) {
    const safeDays = Math.min(Math.max(days, 1), 90);
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const cacheKey = `dashboard:overview:${safeDays}:${safeLimit}`;
    if (!refresh) {
      const cached = await cacheGet(cacheKey);
      if (cached) return cached;
    }

    const [stats, threatTrend, iocDistribution, recentThreats, feedHealth, topTechniques, actorRows] = await Promise.all([
      this.getStats(refresh),
      this.getThreatTrend(safeDays, refresh),
      db.select({ type: iocs.type, count: sql<number>`count(*)` })
        .from(iocs)
        .where(eq(iocs.status, 'active'))
        .groupBy(iocs.type),
      this.getRecentThreats(safeLimit, refresh),
      this.getFeedHealth(refresh),
      db.select().from(mitreTechniques).limit(5),
      // Limit actor scan to 500 most recent for performance
      db.select({
        value: iocs.value, type: iocs.type, tags: iocs.tags,
        sources: iocs.sources, description: iocs.description, lastSeen: iocs.lastSeen,
      }).from(iocs).orderBy(desc(iocs.lastSeen)).limit(500),
    ]);

    const actorMap = new Map<string, { actor: string; iocCount: number; latestSeen: string }>();
    for (const row of actorRows) {
      const actors = extractThreatActorsFromIOC(row);
      for (const actor of actors) {
        const existing = actorMap.get(actor) || { actor, iocCount: 0, latestSeen: row.lastSeen.toISOString() };
        existing.iocCount += 1;
        if (new Date(row.lastSeen) > new Date(existing.latestSeen)) existing.latestSeen = row.lastSeen.toISOString();
        actorMap.set(actor, existing);
      }
    }

    const colors: Record<string, string> = {
      ip: '#3b82f6', domain: '#10b981', hash: '#f59e0b', url: '#ef4444',
      email: '#8b5cf6', registry: '#06b6d4', mutex: '#f43f5e', 'user-agent': '#84cc16',
    };

    const threatActors = Array.from(actorMap.values()).sort((a, b) => b.iocCount - a.iocCount).slice(0, 10);
    if (threatActors.length === 0 && actorRows.length > 0) {
      const infraCount = actorRows.filter(r => r.type === 'ip' || r.type === 'domain' || r.type === 'url').length;
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
      iocDistribution: iocDistribution.map(r => ({
        type: r.type,
        count: Number(r.count),
        color: colors[r.type] || '#6b7280',
      })),
      topTechniques: topTechniques.map(t => ({
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
    return [];
  }

  async getGeoThreats(refresh = false) {
    const cacheKey = 'dashboard:geo-threats';
    if (!refresh) {
      const cached = await cacheGet(cacheKey);
      if (cached) return cached;
    }

    // Prefer persisted geo columns (populated at insert time) so the map reads
    // straight from the DB and survives restarts without recomputation.
    const storedRows = await db
      .select({
        countryCode: iocs.geoCountry,
        lat: sql<number>`AVG(${iocs.geoLat})`,
        lng: sql<number>`AVG(${iocs.geoLng})`,
        count: sql<number>`count(*)`,
        critical: sql<number>`count(*) FILTER (WHERE ${iocs.severity} = 'critical')`,
        high: sql<number>`count(*) FILTER (WHERE ${iocs.severity} = 'high')`,
        medium: sql<number>`count(*) FILTER (WHERE ${iocs.severity} = 'medium')`,
        low: sql<number>`count(*) FILTER (WHERE ${iocs.severity} = 'low')`,
        latestSeen: sql<string>`MAX(${iocs.lastSeen})`,
      })
      .from(iocs)
      .where(and(eq(iocs.type, 'ip'), sql`${iocs.geoLat} IS NOT NULL`, sql`${iocs.geoCountry} IS NOT NULL`))
      .groupBy(iocs.geoCountry);

    if (storedRows.length > 0) {
      const stored = storedRows
        .filter((r) => r.countryCode)
        .map((r) => ({
          country: COUNTRY_NAMES[r.countryCode as string] || (r.countryCode as string),
          countryCode: r.countryCode as string,
          lat: Number(r.lat),
          lng: Number(r.lng),
          count: Number(r.count),
          critical: Number(r.critical),
          high: Number(r.high),
          medium: Number(r.medium),
          low: Number(r.low),
          latestSeen: new Date(r.latestSeen).toISOString(),
          sampleIPs: [] as string[],
        }))
        .sort((a, b) => b.count - a.count);
      await cacheSet(cacheKey, stored, 300);
      return stored;
    }

    // Fallback: compute geo on-the-fly for rows not yet backfilled.
    // Pull up to 2000 most-recent IP IOCs
    const ipIOCs = await db
      .select({ value: iocs.value, severity: iocs.severity, lastSeen: iocs.lastSeen })
      .from(iocs)
      .where(eq(iocs.type, 'ip'))
      .orderBy(desc(iocs.lastSeen))
      .limit(2000);

    type Entry = {
      country: string; countryCode: string; lat: number; lng: number;
      count: number; critical: number; high: number; medium: number; low: number;
      latestSeen: string; sampleIPs: string[];
    };
    const map = new Map<string, Entry>();

    for (const ioc of ipIOCs) {
      const geo = geoip.lookup(ioc.value);
      if (!geo || !geo.country || !geo.ll || geo.ll[0] === 0) continue;
      const cc = geo.country;
      const entry = map.get(cc) ?? {
        country: COUNTRY_NAMES[cc] || cc,
        countryCode: cc,
        lat: geo.ll[0],
        lng: geo.ll[1],
        count: 0, critical: 0, high: 0, medium: 0, low: 0,
        latestSeen: ioc.lastSeen.toISOString(),
        sampleIPs: [],
      };
      entry.count++;
      const sev = ioc.severity as keyof Pick<Entry, 'critical'|'high'|'medium'|'low'>;
      if (sev in { critical:1, high:1, medium:1, low:1 }) entry[sev]++;
      if (new Date(ioc.lastSeen) > new Date(entry.latestSeen)) entry.latestSeen = ioc.lastSeen.toISOString();
      if (entry.sampleIPs.length < 5) entry.sampleIPs.push(ioc.value);
      map.set(cc, entry);
    }

    const result = Array.from(map.values()).sort((a, b) => b.count - a.count);
    await cacheSet(cacheKey, result, 300);
    return result;
  }

  async getRealtimePulse() {
    const [iocCount, newThreats, assetsAtRisk, incidentsOpen] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(iocs),
      db.select({ count: sql<number>`count(*)` }).from(iocs)
        .where(gte(iocs.firstSeen, subDays(new Date(), 1))),
      db.select({ count: sql<number>`count(*)` }).from(assets).where(sql`${assets.activeThreats} > 0`),
      db.select({ count: sql<number>`count(*)` }).from(threatDetections)
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
