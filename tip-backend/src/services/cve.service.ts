import { eq, desc, sql, and, or, ilike } from 'drizzle-orm';
import db from '../config/database';
import { cves } from '../models/schema';

export class CVEService {
  async getCVEs(filters: any, offset: number, limit: number) {
    const conditions = [];

    if (filters.severity) {
      conditions.push(eq(cves.severity, filters.severity));
    }

    if (filters.exploitAvailable !== undefined && filters.exploitAvailable !== '') {
      conditions.push(eq(cves.exploitAvailable, filters.exploitAvailable === 'true'));
    }

    if (filters.patchStatus && filters.patchStatus !== 'all') {
      conditions.push(eq(cves.patchStatus, filters.patchStatus));
    }

    if (filters.search) {
      const q = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(cves.cveId, q),
          ilike(cves.description, q),
          ilike(cves.vendor, q),
          ilike(cves.product, q),
        )!
      );
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
    // Try UUID first, then fall back to cveId string
    let rows = await db.select().from(cves).where(eq(cves.id, id)).limit(1);
    if (!rows.length) {
      rows = await db.select().from(cves).where(eq(cves.cveId, id)).limit(1);
    }
    if (!rows.length) throw new Error('CVE not found');
    return rows[0];
  }

  async updatePatchStatus(id: string, patchStatus: string) {
    const valid = ['available', 'pending', 'unavailable'];
    if (!valid.includes(patchStatus)) throw new Error(`Invalid patchStatus: ${patchStatus}`);

    const [updated] = await db
      .update(cves)
      .set({ patchStatus, updatedAt: new Date() })
      .where(eq(cves.id, id))
      .returning();

    if (!updated) throw new Error('CVE not found');
    return updated;
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
    return db.select().from(cves).where(eq(cves.severity, 'critical')).orderBy(desc(cves.publishedDate)).limit(limit);
  }

  async getWithExploits(limit: number) {
    return db.select().from(cves).where(eq(cves.exploitAvailable, true)).orderBy(desc(cves.publishedDate)).limit(limit);
  }

  async exportAll() {
    return db.select().from(cves).orderBy(desc(cves.publishedDate)).limit(5000);
  }

  async scanAssets() {
    const [all, withAssets, critWithAssets] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(cves),
      db.select({ count: sql<number>`count(*)` }).from(cves).where(sql`${cves.affectedAssets} > 0`),
      db.select({ count: sql<number>`count(*)` }).from(cves).where(
        and(sql`${cves.affectedAssets} > 0`, eq(cves.severity, 'critical'))
      ),
    ]);
    return {
      scanned: Number(all[0]?.count || 0),
      vulnerable: Number(withAssets[0]?.count || 0),
      critical: Number(critWithAssets[0]?.count || 0),
    };
  }
}

export default new CVEService();
