import { eq, and, ilike, sql, desc, gte } from 'drizzle-orm';
import db from '../config/database';
import { iocs } from '../models/schema';
import { IOCCreateInput, IOCUpdateInput } from '../types';
import { validateIOCFormat } from '../utils/helpers';
import { cacheGet, cacheSet, cacheDelByPrefixes, generateCacheKey } from '../utils/cache';
import logger from '../config/logger';
import { extractThreatActorsFromIOC } from '../utils/threat-intel';

export class IOCService {
  private buildSyntheticIOCPool() {
    return {
      ip: ['185.220.101.44', '45.95.147.12', '103.77.192.9', '91.214.124.211', '198.18.0.77'],
      domain: ['cdn-login-security.net', 'mail-update-center.org', 'vpn-auth-service.com', 'sync-gateway-cloud.io', 'intranet-verifier.co'],
      hash: [
        '44d88612fea8a8f36de82e1278abb02f',
        '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        '5f4dcc3b5aa765d61d8327deb882cf99',
        'b2e98ad6f6eb8508dd6a14cfa704bad7f05f6fb1',
      ],
      url: [
        'http://cdn-login-security.net/auth/update',
        'https://vpn-auth-service.com/owa/login.php',
        'http://sync-gateway-cloud.io/api/v2/token',
        'https://mail-update-center.org/secure/reset',
        'http://intranet-verifier.co/files/update.bin',
      ],
      email: ['helpdesk@security-alert-center.net', 'support@mail-update-center.org', 'hr.portal@company-verify.co', 'billing@invoice-checker.io', 'alerts@it-servicedesk-center.com'],
      registry: ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\UpdaterService', 'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\SystemUpdateTask'],
      mutex: ['Global\\msrpc_update_mutex_01', 'Global\\chrome_sync_singleton_lock', 'Global\\svc_host_update_lock'],
      'user-agent': ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) CobaltStrike Beacon', 'curl/7.74.0 zgrab/0.x', 'python-requests/2.31 malware-client'],
    } as const;
  }

  async getIOCs(filters: any, skip: number = 0, take: number = 25) {
    const cacheKey = generateCacheKey('iocs', 'list', JSON.stringify(filters), skip, take);
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const conditions = [];
    
    if (filters.type) {
      conditions.push(eq(iocs.type, filters.type));
    }
    if (filters.severity) {
      conditions.push(eq(iocs.severity, filters.severity));
    }
    if (filters.status) {
      conditions.push(eq(iocs.status, filters.status));
    }
    if (filters.search) {
      conditions.push(ilike(iocs.value, `%${filters.search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.query.iocs.findMany({
      where: whereClause,
      limit: take + 1,
      offset: skip,
      orderBy: [desc(iocs.createdAt)],
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    // Exact count on multi-million IOC tables is expensive; use lower-bound total for responsive UX.
    const total = skip + items.length + (hasMore ? 1 : 0);

    const result = {
      items,
      total,
      hasMore,
    };

    await cacheSet(cacheKey, result, 300); // 5 min cache
    return result;
  }

  async exportIOCs(filters: { type?: string; severity?: string; status?: string }): Promise<any[]> {
    const conditions = [];
    if (filters.type) conditions.push(eq(iocs.type, filters.type as any));
    if (filters.severity) conditions.push(eq(iocs.severity, filters.severity as any));
    if (filters.status) conditions.push(eq(iocs.status, filters.status as any));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    return db.query.iocs.findMany({
      where: whereClause,
      limit: 10000,
      orderBy: [desc(iocs.createdAt)],
    });
  }

  async getIOCById(id: string) {
    const ioc = await db.query.iocs.findFirst({
      where: eq(iocs.id, id),
    });

    if (!ioc) {
      throw new Error('IOC not found');
    }

    return ioc;
  }

  async createIOC(input: IOCCreateInput, userId: string) {
    // Validate format
    if (!validateIOCFormat(input.value, input.type)) {
      throw new Error(`Invalid ${input.type} format`);
    }

    // Check for duplicates
    const existing = await db.query.iocs.findFirst({
      where: and(
        eq(iocs.value, input.value),
        eq(iocs.type, input.type)
      ),
    });

    if (existing) {
      throw new Error('IOC already exists');
    }

    const [newIOC] = await db.insert(iocs).values({
      value: input.value,
      type: input.type,
      severity: input.severity,
      confidence: input.confidence || 50,
      tags: input.tags || [],
      sources: input.sources || [],
      description: input.description,
      createdBy: userId,
    }).returning();

    // Clear cache
    await cacheDelByPrefixes(['iocs:list:', 'iocs:distribution', 'dashboard:']);

    logger.info(`IOC created: ${input.value} by user ${userId}`);

    // TODO: Queue ML scoring job
    // TODO: Queue enrichment job

    return newIOC;
  }

  async updateIOC(id: string, input: IOCUpdateInput) {
    const ioc = await this.getIOCById(id);

    const [updated] = await db.update(iocs)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(iocs.id, id))
      .returning();

    await cacheDelByPrefixes(['iocs:list:', 'iocs:distribution', 'dashboard:']);
    
    logger.info(`IOC updated: ${id}`);

    return updated;
  }

  async deleteIOC(id: string, hard: boolean = false) {
    if (hard) {
      await db.delete(iocs).where(eq(iocs.id, id));
      logger.info(`IOC hard deleted: ${id}`);
    } else {
      await db.update(iocs)
        .set({ status: 'archived' })
        .where(eq(iocs.id, id));
      logger.info(`IOC archived: ${id}`);
    }

    await cacheDelByPrefixes(['iocs:list:', 'iocs:distribution', 'dashboard:']);
  }

  async getIOCDistribution() {
    const cacheKey = 'iocs:distribution';
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const result = await db
      .select({
        type: iocs.type,
        count: sql<number>`count(*)`,
      })
      .from(iocs)
      .where(eq(iocs.status, 'active'))
      .groupBy(iocs.type);

    const colors: Record<string, string> = {
      ip: '#3b82f6',
      domain: '#10b981',
      hash: '#f59e0b',
      url: '#ef4444',
    };

    const distribution = result.map(r => ({
      type: r.type,
      count: Number(r.count),
      color: colors[r.type] || '#6b7280',
    }));

    await cacheSet(cacheKey, distribution, 300);
    return distribution;
  }

  async getThreatActors(limit: number = 5000) {
    const safeLimit = Math.min(Math.max(limit, 100), 50000);
    const cacheKey = `iocs:threat-actors:${safeLimit}`;
    const cached = await cacheGet(cacheKey);
    if (cached && !(Array.isArray(cached) && cached.length === 0)) return cached;

    const rows = await db
      .select({
        id: iocs.id,
        value: iocs.value,
        type: iocs.type,
        tags: iocs.tags,
        sources: iocs.sources,
        description: iocs.description,
        firstSeen: iocs.firstSeen,
        lastSeen: iocs.lastSeen,
      })
      .from(iocs)
      .orderBy(desc(iocs.lastSeen))
      .limit(safeLimit);

    const actors = new Map<string, { actor: string; iocCount: number; latestSeen: string; samples: string[] }>();

    for (const row of rows) {
      const mappedActors = extractThreatActorsFromIOC(row);
      const rowLastSeen = row.lastSeen ? new Date(row.lastSeen).toISOString() : new Date(0).toISOString();
      for (const actor of mappedActors) {
        const existing = actors.get(actor) || {
          actor,
          iocCount: 0,
          latestSeen: rowLastSeen,
          samples: [],
        };
        existing.iocCount += 1;
        if (row.lastSeen && new Date(row.lastSeen) > new Date(existing.latestSeen)) {
          existing.latestSeen = new Date(row.lastSeen).toISOString();
        }
        if (existing.samples.length < 5) {
          existing.samples.push(row.value);
        }
        actors.set(actor, existing);
      }
    }

    const result = Array.from(actors.values()).sort((a, b) => b.iocCount - a.iocCount);

    if (result.length === 0 && rows.length > 0) {
      const infraCount = rows.filter((r) => r.type === 'ip' || r.type === 'domain' || r.type === 'url').length;
      if (infraCount > 0) {
        result.push({
          actor: 'Unattributed Infrastructure Cluster',
          iocCount: infraCount,
          latestSeen: rows[0].lastSeen ? new Date(rows[0].lastSeen).toISOString() : new Date(0).toISOString(),
          samples: rows.slice(0, 5).map((r) => r.value),
        });
      }
    }

    await cacheSet(cacheKey, result, 300);
    return result;
  }

  async getFreshIOCs(hours: number = 24, limit: number = 100) {
    const safeHours = Math.min(Math.max(hours, 1), 24 * 14);
    const safeLimit = Math.min(Math.max(limit, 1), 1000);
    const since = new Date(Date.now() - safeHours * 60 * 60 * 1000);

    const [items, todayResult] = await Promise.all([
      db.query.iocs.findMany({
        where: gte(iocs.lastSeen, since),
        orderBy: [desc(iocs.lastSeen)],
        limit: safeLimit,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(iocs)
        .where(sql`${iocs.lastSeen} >= date_trunc('day', now())`),
    ]);

    return {
      since: since.toISOString(),
      hours: safeHours,
      totalFreshToday: Number(todayResult[0]?.count || 0),
      items,
    };
  }

  async bootstrapDiverseIOCs(total: number = 120) {
    const target = Math.min(Math.max(total, 10), 2000);
    const pool = this.buildSyntheticIOCPool();
    const perType = Math.max(2, Math.ceil(target / Object.keys(pool).length));
    const now = new Date();

    const seeded: Array<typeof iocs.$inferInsert> = [];
    const types = Object.keys(pool) as Array<keyof typeof pool>;

    for (const type of types) {
      for (let i = 0; i < perType; i++) {
        const base = pool[type][i % pool[type].length];
        const value =
          type === 'domain'
            ? base.replace('.', `-${(i + 1).toString(36)}.`)
            : type === 'email'
              ? base.replace('@', `+${(i + 1).toString(36)}@`)
              : type === 'url'
                ? `${base}?trk=${i + 1}`
                : type === 'ip'
                  ? `${base.split('.').slice(0, 3).join('.')}.${(20 + i) % 254}`
                  : type === 'registry'
                    ? `${base}${i + 1}`
                    : type === 'mutex'
                      ? `${base}_${i + 1}`
                      : type === 'user-agent'
                        ? `${base} #${i + 1}`
                        : base.length > 64
                          ? base.slice(0, 64)
                          : base;

        seeded.push({
          value,
          type: type as (typeof iocs.$inferInsert)['type'],
          severity: i % 7 === 0 ? 'critical' : i % 3 === 0 ? 'high' : 'medium',
          confidence: 55 + (i % 45),
          tags: ['synthetic', 'diversified', type],
          sources: ['synthetic-diversifier'],
          description: `Synthetic diversified IOC (${type})`,
          firstSeen: now,
          lastSeen: now,
        });
      }
    }

    const rows = seeded.slice(0, target);
    await db.insert(iocs).values(rows);

    await cacheDelByPrefixes(['iocs:list:', 'iocs:distribution', 'iocs:threat-actors:', 'dashboard:']);

    return {
      requested: target,
      inserted: rows.length,
      generatedAt: now.toISOString(),
    };
  }
}

export default new IOCService();
