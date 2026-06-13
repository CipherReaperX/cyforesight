import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import db from '../config/database';
import { iocs, threatDetections } from '../models/schema';

export class IncidentService {
  async listIncidents(status?: string, limit: number = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const rows = await db.query.threatDetections.findMany({
      where: status ? eq(threatDetections.status, status) : undefined,
      orderBy: (td, { desc: d }) => [d(td.timestamp)],
      limit: safeLimit,
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      severity: r.severity,
      status: r.status,
      confidence: r.confidence || 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      iocCount: Array.isArray(r.iocIds) ? r.iocIds.length : 0,
      affectedAssets: Array.isArray(r.affectedAssets) ? r.affectedAssets.length : 0,
      techniqueCount: Array.isArray(r.techniqueIds) ? r.techniqueIds.length : 0,
      assignedTo: r.assignedTo,
      source: r.source,
    }));
  }

  async bootstrapFromHighRiskIOCs(limit: number = 100) {
    const safeLimit = Math.min(Math.max(limit, 20), 1000);
    const rows = await db
      .select({
        id: iocs.id,
        value: iocs.value,
        type: iocs.type,
        severity: iocs.severity,
        confidence: iocs.confidence,
        mitreTechniques: iocs.mitreTechniques,
      })
      .from(iocs)
      .where(inArray(iocs.severity, ['critical', 'high'] as any))
      .orderBy(desc(iocs.lastSeen))
      .limit(safeLimit);

    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = `${row.severity}:${row.type}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    const created: Array<{ id: string; name: string; severity: string; iocCount: number }> = [];
    for (const [key, bucket] of grouped.entries()) {
      if (bucket.length < 3) continue;

      const severity = bucket[0].severity;
      const type = bucket[0].type;
      const iocIds = bucket.slice(0, 25).map((r) => r.id);
      const techniques = Array.from(
        new Set(
          bucket
            .slice(0, 25)
            .flatMap((r) => (Array.isArray(r.mitreTechniques) ? r.mitreTechniques : []))
        )
      ).slice(0, 20);

      const [inserted] = await db
        .insert(threatDetections)
        .values({
          name: `Incident Cluster: ${severity.toUpperCase()} ${type.toUpperCase()} Intelligence`,
          type: 'incident-cluster',
          severity,
          confidence: Math.round(
            bucket.slice(0, 25).reduce((sum, r) => sum + Number(r.confidence || 50), 0) /
              Math.max(1, bucket.slice(0, 25).length)
          ),
          iocIds,
          techniqueIds: techniques,
          source: 'incident-workbench',
          description: `Auto-clustered incident from ${iocIds.length} high-risk IOCs`,
          status: 'new',
        })
        .returning();

      created.push({
        id: inserted.id,
        name: inserted.name,
        severity: inserted.severity,
        iocCount: iocIds.length,
      });
    }

    return { createdCount: created.length, incidents: created };
  }

  async getIncidentById(id: string) {
    const incident = await db.query.threatDetections.findFirst({
      where: eq(threatDetections.id, id),
    });
    if (!incident) throw new Error('Incident not found');

    const iocIds = Array.isArray(incident.iocIds) ? incident.iocIds : [];
    const relatedIOCs =
      iocIds.length > 0
        ? await db
            .select({
              id: iocs.id,
              value: iocs.value,
              type: iocs.type,
              severity: iocs.severity,
              confidence: iocs.confidence,
              lastSeen: iocs.lastSeen,
            })
            .from(iocs)
            .where(inArray(iocs.id, iocIds as any))
            .limit(100)
        : [];

    return {
      incident,
      relatedIOCs,
    };
  }

  async updateIncident(id: string, input: { status?: string; assignedTo?: string | null; note?: string }) {
    const existing = await db.query.threatDetections.findFirst({
      where: eq(threatDetections.id, id),
    });
    if (!existing) throw new Error('Incident not found');

    const descriptionParts = [existing.description || ''];
    if (input.note) descriptionParts.push(`[NOTE ${new Date().toISOString()}] ${input.note}`);

    const [updated] = await db
      .update(threatDetections)
      .set({
        status: (input.status as any) || existing.status,
        assignedTo: input.assignedTo === undefined ? existing.assignedTo : input.assignedTo,
        description: descriptionParts.filter(Boolean).join('\n'),
        updatedAt: new Date(),
      })
      .where(eq(threatDetections.id, id))
      .returning();

    return updated;
  }

  async getWorkbenchStats() {
    const [newCount, inProgressCount, resolvedCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(threatDetections).where(eq(threatDetections.status, 'new')),
      db.select({ count: sql<number>`count(*)` }).from(threatDetections).where(eq(threatDetections.status, 'in_progress')),
      db.select({ count: sql<number>`count(*)` }).from(threatDetections).where(eq(threatDetections.status, 'resolved')),
    ]);

    return {
      new: Number(newCount[0]?.count || 0),
      inProgress: Number(inProgressCount[0]?.count || 0),
      resolved: Number(resolvedCount[0]?.count || 0),
    };
  }
}

export default new IncidentService();

