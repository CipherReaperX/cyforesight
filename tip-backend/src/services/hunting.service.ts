import { and, desc, eq, gte, ilike, sql } from 'drizzle-orm';
import db from '../config/database';
import { assets, cves, iocs, threatDetections, threatHuntQueries } from '../models/schema';

type HuntRun = {
  runId: string;
  queryId?: string;
  queryName?: string;
  query: string;
  startedAt: string;
  finishedAt: string;
  totalMatches: number;
  findings: any[];
  summary: {
    iocMatches: number;
    assetMatches: number;
    cveMatches: number;
    criticalFindings: number;
  };
};

type ParsedCondition = { field: string; value: string };

function parseMinutesFromCron(cron?: string | null): number {
  if (!cron) return 60;
  const m = cron.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (m) return Math.max(1, Number(m[1]));
  return 60;
}

function parseQuery(query: string): ParsedCondition[] {
  const tokens = query
    .split(/\s+AND\s+/i)
    .map((t) => t.trim())
    .filter(Boolean);

  const conditions: ParsedCondition[] = [];
  for (const token of tokens) {
    const idx = token.indexOf(':');
    if (idx <= 0) continue;
    const field = token.slice(0, idx).trim().toLowerCase();
    const raw = token.slice(idx + 1).trim().replace(/^"|"$/g, '');
    if (!raw) continue;
    conditions.push({ field, value: raw });
  }
  return conditions;
}

export class HuntingService {
  private runStore = new Map<string, HuntRun>();
  private lastAutoRunByQuery = new Map<string, number>();

  private mapIOCWhere(conditions: ParsedCondition[], since: Date) {
    const clauses: any[] = [gte(iocs.lastSeen, since)];

    for (const c of conditions) {
      const v = c.value;
      if (c.field === 'ioc.type' || c.field === 'type') clauses.push(eq(iocs.type, v as any));
      else if (c.field === 'ioc.severity' || c.field === 'severity') clauses.push(eq(iocs.severity, v as any));
      else if (c.field === 'ioc.status' || c.field === 'status') clauses.push(eq(iocs.status, v as any));
      else if (c.field === 'ioc.value' || c.field === 'value') clauses.push(ilike(iocs.value, `%${v}%`));
      else if (c.field === 'ioc.source' || c.field === 'source') clauses.push(sql`${iocs.sources}::text ilike ${'%' + v + '%'}`);
      else if (c.field === 'ioc.tag' || c.field === 'tag') clauses.push(sql`${iocs.tags}::text ilike ${'%' + v + '%'}`);
      else if (c.field === 'mitre.technique' || c.field === 'technique') clauses.push(sql`${iocs.mitreTechniques}::text ilike ${'%' + v + '%'}`);
      else if (c.field === 'text') {
        clauses.push(
          sql`(
            ${iocs.value} ilike ${'%' + v + '%'} OR
            ${iocs.tags}::text ilike ${'%' + v + '%'} OR
            ${iocs.sources}::text ilike ${'%' + v + '%'} OR
            coalesce(${iocs.description}, '') ilike ${'%' + v + '%'}
          )`
        );
      }
    }

    return and(...clauses);
  }

  async runQuery(input: {
    query: string;
    queryId?: string;
    queryName?: string;
    dataSource?: 'all' | 'iocs' | 'assets' | 'cves';
    hours?: number;
    limit?: number;
    autoCreateDetection?: boolean;
  }) {
    const startedAt = new Date();
    const safeLimit = Math.min(Math.max(Number(input.limit || 200), 10), 1000);
    const safeHours = Math.min(Math.max(Number(input.hours || 24), 1), 24 * 90);
    const since = new Date(Date.now() - safeHours * 60 * 60 * 1000);
    const source = input.dataSource || 'all';
    const conditions = parseQuery(input.query || '');

    const findings: any[] = [];

    if (source === 'all' || source === 'iocs') {
      const iocRows = await db.query.iocs.findMany({
        where: this.mapIOCWhere(conditions, since),
        orderBy: [desc(iocs.lastSeen)],
        limit: safeLimit,
      });

      findings.push(
        ...iocRows.map((r) => ({
          dataset: 'ioc',
          id: r.id,
          title: r.value,
          subtitle: `${r.type} • ${r.severity} • conf ${r.confidence}`,
          severity: r.severity,
          timestamp: r.lastSeen,
          raw: r,
        }))
      );
    }

    if (source === 'all' || source === 'assets') {
      const allAssets = await db.query.assets.findMany({
        orderBy: [desc(assets.riskScore)],
        limit: safeLimit,
      });

      const matchedAssets = allAssets.filter((a) => {
        if (conditions.length === 0) return true;
        const text = `${a.name} ${a.hostname || ''} ${a.ip || ''} ${a.department || ''} ${a.os || ''}`.toLowerCase();
        return conditions.some((c) => {
          if (c.field === 'asset.type') return a.type === (c.value as any);
          if (c.field === 'asset.status') return a.status === (c.value as any);
          if (c.field === 'asset.name') return a.name.toLowerCase().includes(c.value.toLowerCase());
          if (c.field === 'text') return text.includes(c.value.toLowerCase());
          return false;
        });
      });

      findings.push(
        ...matchedAssets.map((a) => ({
          dataset: 'asset',
          id: a.id,
          title: a.name,
          subtitle: `${a.type} • risk ${a.riskScore || 0} • threats ${a.activeThreats || 0}`,
          severity: a.riskScore && a.riskScore >= 80 ? 'critical' : a.riskScore && a.riskScore >= 60 ? 'high' : 'medium',
          timestamp: a.updatedAt,
          raw: a,
        }))
      );
    }

    if (source === 'all' || source === 'cves') {
      const cveRows = await db.query.cves.findMany({
        orderBy: [desc(cves.cvssScore)],
        limit: safeLimit,
      });
      const filtered = cveRows.filter((cve) => {
        if (conditions.length === 0) return true;
        return conditions.some((c) => {
          if (c.field === 'cve.id') return cve.cveId.toLowerCase().includes(c.value.toLowerCase());
          if (c.field === 'cve.severity') return cve.severity === (c.value as any);
          if (c.field === 'text') return `${cve.cveId} ${cve.description}`.toLowerCase().includes(c.value.toLowerCase());
          return false;
        });
      });

      findings.push(
        ...filtered.map((cve) => ({
          dataset: 'cve',
          id: cve.id,
          title: cve.cveId,
          subtitle: `${cve.severity} • CVSS ${cve.cvssScore}`,
          severity: cve.severity,
          timestamp: cve.publishedDate,
          raw: cve,
        }))
      );
    }

    const sorted = findings
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, safeLimit);

    const summary = {
      iocMatches: sorted.filter((f) => f.dataset === 'ioc').length,
      assetMatches: sorted.filter((f) => f.dataset === 'asset').length,
      cveMatches: sorted.filter((f) => f.dataset === 'cve').length,
      criticalFindings: sorted.filter((f) => f.severity === 'critical').length,
    };

    if (input.autoCreateDetection !== false && (summary.criticalFindings > 0 || summary.iocMatches >= 25)) {
      await db.insert(threatDetections).values({
        name: `Threat Hunt Hit: ${input.queryName || 'Ad-hoc Query'}`,
        type: 'hunt-result',
        severity: summary.criticalFindings > 0 ? 'high' : 'medium',
        confidence: Math.min(99, 55 + summary.criticalFindings * 4),
        iocIds: sorted.filter((s) => s.dataset === 'ioc').slice(0, 50).map((s) => s.id),
        source: 'threat-hunting',
        description: `Threat hunting query matched ${sorted.length} records`,
        status: 'new',
      });
    }

    const finishedAt = new Date();
    const run: HuntRun = {
      runId: `hunt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      queryId: input.queryId,
      queryName: input.queryName,
      query: input.query,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      totalMatches: sorted.length,
      findings: sorted,
      summary,
    };

    this.runStore.set(run.runId, run);
    return run;
  }

  async listSavedQueries(limit: number = 100) {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    return db.query.threatHuntQueries.findMany({
      orderBy: [desc(threatHuntQueries.createdAt)],
      limit: safeLimit,
    });
  }

  async createSavedQuery(input: {
    name: string;
    query: string;
    description?: string;
    tags?: string[];
    isScheduled?: boolean;
    scheduleCron?: string | null;
    createdBy?: string | null;
  }) {
    const [created] = await db
      .insert(threatHuntQueries)
      .values({
        name: input.name,
        query: input.query,
        description: input.description || null,
        tags: input.tags || [],
        isScheduled: !!input.isScheduled,
        scheduleCron: input.scheduleCron || null,
        createdBy: input.createdBy || null,
      })
      .returning();
    return created;
  }

  async updateSavedQuery(
    id: string,
    input: Partial<{
      name: string;
      query: string;
      description: string | null;
      tags: string[];
      isScheduled: boolean;
      scheduleCron: string | null;
    }>
  ) {
    const [updated] = await db
      .update(threatHuntQueries)
      .set({
        ...input,
      })
      .where(eq(threatHuntQueries.id, id))
      .returning();
    if (!updated) throw new Error('Saved query not found');
    return updated;
  }

  async runSavedQuery(id: string) {
    const query = await db.query.threatHuntQueries.findFirst({
      where: eq(threatHuntQueries.id, id),
    });
    if (!query) throw new Error('Saved query not found');

    const run = await this.runQuery({
      query: query.query,
      queryId: query.id,
      queryName: query.name,
      autoCreateDetection: true,
    });

    await db
      .update(threatHuntQueries)
      .set({
        lastRun: new Date(),
        runCount: sql`coalesce(${threatHuntQueries.runCount}, 0) + 1`,
      })
      .where(eq(threatHuntQueries.id, id));

    return run;
  }

  getRunById(runId: string) {
    const run = this.runStore.get(runId);
    if (!run) throw new Error('Run not found');
    return run;
  }

  listRecentRuns(limit: number = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    return Array.from(this.runStore.values())
      .sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime())
      .slice(0, safeLimit);
  }

  async runScheduledAutomation(force: boolean = false) {
    const scheduled = await db
      .select()
      .from(threatHuntQueries)
      .where(eq(threatHuntQueries.isScheduled, true));

    let triggered = 0;
    const runs: HuntRun[] = [];

    for (const q of scheduled) {
      const cadenceMin = parseMinutesFromCron(q.scheduleCron);
      const now = Date.now();
      const last = this.lastAutoRunByQuery.get(q.id) || 0;
      const due = force || now - last >= cadenceMin * 60 * 1000;
      if (!due) continue;

      const run = await this.runQuery({
        query: q.query,
        queryId: q.id,
        queryName: q.name,
        autoCreateDetection: true,
      });
      runs.push(run);
      triggered++;
      this.lastAutoRunByQuery.set(q.id, now);

      await db
        .update(threatHuntQueries)
        .set({
          lastRun: new Date(),
          runCount: sql`coalesce(${threatHuntQueries.runCount}, 0) + 1`,
        })
        .where(eq(threatHuntQueries.id, q.id));
    }

    return { scheduled: scheduled.length, triggered, runs };
  }
}

export default new HuntingService();

