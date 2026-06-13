import { eq, desc, sql, and, like } from 'drizzle-orm';
import db from '../config/database';
import { cves } from '../models/schema';

export class CVEService {
  async getCVEs(filters: any, offset: number, limit: number) {
    const conditions = [];

    if (filters.severity) {
      conditions.push(eq(cves.severity, filters.severity));
    }

    if (filters.exploitAvailable !== undefined) {
      conditions.push(eq(cves.exploitAvailable, filters.exploitAvailable === 'true'));
    }

    if (filters.patchStatus) {
      conditions.push(eq(cves.patchStatus, filters.patchStatus));
    }

    if (filters.search) {
      conditions.push(like(cves.cveId, `%${filters.search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      db.select()
        .from(cves)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(cves.publishedDate)),
      db.select({ count: sql<number>`count(*)` })
        .from(cves)
        .where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return {
      items,
      total,
      hasMore: offset + limit < total,
    };
  }

  async getCVEById(id: string) {
    const cve = await db.select()
      .from(cves)
      .where(eq(cves.id, id))
      .limit(1);

    if (!cve || cve.length === 0) {
      throw new Error('CVE not found');
    }

    return cve[0];
  }

  async getStats() {
    const [
      criticalResult,
      highResult,
      withExploitResult,
      patchAvailableResult,
      totalResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(cves).where(eq(cves.severity, 'critical')),
      db.select({ count: sql<number>`count(*)` }).from(cves).where(eq(cves.severity, 'high')),
      db.select({ count: sql<number>`count(*)` }).from(cves).where(eq(cves.exploitAvailable, true)),
      db.select({ count: sql<number>`count(*)` }).from(cves).where(eq(cves.patchStatus, 'available')),
      db.select({ count: sql<number>`count(*)` }).from(cves),
    ]);

    return {
      critical: Number(criticalResult[0]?.count || 0),
      high: Number(highResult[0]?.count || 0),
      withExploit: Number(withExploitResult[0]?.count || 0),
      patchAvailable: Number(patchAvailableResult[0]?.count || 0),
      total: Number(totalResult[0]?.count || 0),
    };
  }

  async getCriticalCVEs(limit: number) {
    const cvesList = await db.select()
      .from(cves)
      .where(eq(cves.severity, 'critical'))
      .orderBy(desc(cves.publishedDate))
      .limit(limit);

    return cvesList;
  }

  async getWithExploits(limit: number) {
    const cvesList = await db.select()
      .from(cves)
      .where(eq(cves.exploitAvailable, true))
      .orderBy(desc(cves.publishedDate))
      .limit(limit);

    return cvesList;
  }

  async scanAssets() {
    // Placeholder for asset vulnerability scanning
    // This would match CVEs to your asset inventory
    return {
      scanned: 0,
      vulnerable: 0,
      critical: 0,
    };
  }
}

export default new CVEService();

