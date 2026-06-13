import { eq, desc, sql } from 'drizzle-orm';
import db from '../config/database';
import { assets, iocs, mitreTactics, mitreTechniques } from '../models/schema';
import { inferMitreTechniquesFromIOC } from '../utils/threat-intel';
import { cacheDelByPrefixes } from '../utils/cache';

export class MitreService {
  private mappingStatus: {
    running: boolean;
    startedAt?: string;
    finishedAt?: string;
    lastResult?: { processed: number; mapped: number };
    error?: string;
  } = { running: false };

  async getTactics() {
    const tactics = await db.select().from(mitreTactics);
    const techniques = await db.select().from(mitreTechniques);

    const tacticMap = new Map<string, any>();
    for (const tactic of tactics) {
      tacticMap.set(tactic.id, {
        ...tactic,
        techniques: [],
      });
    }

    for (const technique of techniques) {
      if (!technique.tacticId) continue;
      const target = tacticMap.get(technique.tacticId);
      if (!target) continue;
      target.techniques.push({
        id: technique.techniqueId,
        name: technique.name,
        detections: technique.detections || 0,
        affectedAssets: technique.affectedAssets || 0,
      });
    }

    return Array.from(tacticMap.values()).map((t) => ({
      ...t,
      techniqueCount: t.techniques.length,
    }));
  }

  async getTechniques(filters?: any) {
    let techniques = await db.select().from(mitreTechniques);
    if (filters?.tactic) {
      techniques = techniques.filter((t) => t.tacticId === filters.tactic);
    }
    if (filters?.platform) {
      const p = String(filters.platform).toLowerCase();
      techniques = techniques.filter((t) => (t.platforms || []).some((plat) => String(plat).toLowerCase().includes(p)));
    }
    if (String(filters?.hasDetections || '').toLowerCase() === 'true') {
      techniques = techniques.filter((t) => Number(t.detections || 0) > 0);
    }
    if (filters?.search) {
      const q = String(filters.search).toLowerCase();
      techniques = techniques.filter((t) => t.name.toLowerCase().includes(q) || t.techniqueId.toLowerCase().includes(q));
    }
    const limit = Math.min(Math.max(Number(filters?.limit || techniques.length), 1), 5000);
    techniques = techniques.slice(0, limit);

    return techniques.map((t) => ({
      ...t,
      id: t.techniqueId,
      platform: (t.platforms || []).join(', ') || 'N/A',
    }));
  }

  async getTechniqueById(id: string) {
    const technique = await db.select()
      .from(mitreTechniques)
      .where(eq(mitreTechniques.id, id))
      .limit(1);

    if (!technique || technique.length === 0) {
      throw new Error('Technique not found');
    }

    return technique[0];
  }

  async getCoverage() {
    const [totalResult, detectedResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(mitreTechniques),
      db.select({ count: sql<number>`count(*)` }).from(mitreTechniques).where(sql`${mitreTechniques.detections} > 0`),
    ]);

    const total = Number(totalResult?.[0]?.count || 0);
    const detected = Number(detectedResult?.[0]?.count || 0);
    const percentage = total > 0 ? Number(((detected / total) * 100).toFixed(2)) : 0;

    return {
      detected,
      total,
      percentage,
      trending: detected,
    };
  }

  async getAssetCorrelation(options?: { limitTechniques?: number; assetsPerTechnique?: number }) {
    const limitTechniques = Math.min(Math.max(Number(options?.limitTechniques || 100), 10), 500);
    const assetsPerTechnique = Math.min(Math.max(Number(options?.assetsPerTechnique || 8), 3), 20);

    const [assetRows, iocRows, techniqueRows] = await Promise.all([
      db.select({
        id: assets.id,
        name: assets.name,
        type: assets.type,
        criticality: assets.criticality,
        riskScore: assets.riskScore,
        department: assets.department,
        status: assets.status,
      }).from(assets),
      db.select({
        id: iocs.id,
        type: iocs.type,
        severity: iocs.severity,
        confidence: iocs.confidence,
        mitreTechniques: iocs.mitreTechniques,
      })
      .from(iocs)
      .orderBy(desc(iocs.lastSeen))
      .limit(15000),
      db.select({
        techniqueId: mitreTechniques.techniqueId,
        name: mitreTechniques.name,
        tacticId: mitreTechniques.tacticId,
      }).from(mitreTechniques),
    ]);

    const tacticNameById = new Map<string, string>();
    const tacticRows = await db.select({
      id: mitreTactics.id,
      name: mitreTactics.name,
    }).from(mitreTactics);
    for (const t of tacticRows) tacticNameById.set(t.id, t.name);

    const techniqueMeta = new Map<string, { name: string; tactic: string }>();
    for (const row of techniqueRows) {
      techniqueMeta.set(row.techniqueId, {
        name: row.name,
        tactic: row.tacticId ? tacticNameById.get(row.tacticId) || 'Unknown' : 'Unknown',
      });
    }

    const compatibility: Record<string, Array<typeof assets.$inferSelect['type']>> = {
      ip: ['network_device', 'server', 'cloud_resource'],
      domain: ['server', 'cloud_resource', 'application'],
      url: ['workstation', 'application', 'server'],
      hash: ['workstation', 'server'],
      email: ['workstation', 'application'],
      registry: ['workstation', 'server'],
      mutex: ['workstation', 'server'],
      'user-agent': ['application', 'server', 'workstation'],
    };

    const severityWeight: Record<string, number> = {
      critical: 1,
      high: 0.8,
      medium: 0.55,
      low: 0.35,
      info: 0.2,
    };

    const bucket = new Map<string, {
      techniqueId: string;
      techniqueName: string;
      tactic: string;
      iocCount: number;
      affectedAssets: Set<string>;
      scoreByAsset: Map<string, number>;
    }>();

    for (const ioc of iocRows) {
      const techniques = Array.isArray(ioc.mitreTechniques) ? ioc.mitreTechniques : [];
      if (techniques.length === 0) continue;
      const allowedTypes = compatibility[ioc.type] || ['server', 'workstation', 'application'];
      const baseWeight = (severityWeight[ioc.severity] || 0.4) * Math.max(0.2, (ioc.confidence || 50) / 100);

      for (const tId of techniques) {
        if (!techniqueMeta.has(tId)) continue;
        if (!bucket.has(tId)) {
          const meta = techniqueMeta.get(tId)!;
          bucket.set(tId, {
            techniqueId: tId,
            techniqueName: meta.name,
            tactic: meta.tactic,
            iocCount: 0,
            affectedAssets: new Set<string>(),
            scoreByAsset: new Map<string, number>(),
          });
        }

        const current = bucket.get(tId)!;
        current.iocCount += 1;

        for (const asset of assetRows) {
          if (!allowedTypes.includes(asset.type)) continue;
          const riskComponent = Math.max(0.1, Number(asset.riskScore || 0) / 100);
          const critComponent = Math.max(0.2, Number(asset.criticality || 1) / 5);
          const score = Number((baseWeight * (riskComponent + critComponent)).toFixed(4));
          if (score < 0.2) continue;

          current.affectedAssets.add(asset.id);
          current.scoreByAsset.set(asset.id, (current.scoreByAsset.get(asset.id) || 0) + score);
        }
      }
    }

    const topTechniques = Array.from(bucket.values())
      .sort((a, b) => b.iocCount - a.iocCount)
      .slice(0, limitTechniques)
      .map((entry) => {
        const topAssets = Array.from(entry.scoreByAsset.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, assetsPerTechnique)
          .map(([assetId, score]) => {
            const asset = assetRows.find((a) => a.id === assetId)!;
            return {
              assetId: asset.id,
              assetName: asset.name,
              assetType: asset.type,
              department: asset.department,
              status: asset.status,
              score: Number(score.toFixed(2)),
            };
          });

        return {
          techniqueId: entry.techniqueId,
          techniqueName: entry.techniqueName,
          tactic: entry.tactic,
          iocCount: entry.iocCount,
          affectedAssetCount: entry.affectedAssets.size,
          topAssets,
        };
      });

    const tacticSummaryMap = new Map<string, { tactic: string; techniques: number; iocCount: number; affectedAssets: number }>();
    for (const item of topTechniques) {
      const current = tacticSummaryMap.get(item.tactic) || {
        tactic: item.tactic,
        techniques: 0,
        iocCount: 0,
        affectedAssets: 0,
      };
      current.techniques += 1;
      current.iocCount += item.iocCount;
      current.affectedAssets += item.affectedAssetCount;
      tacticSummaryMap.set(item.tactic, current);
    }

    return {
      generatedAt: new Date().toISOString(),
      techniques: topTechniques,
      tacticSummary: Array.from(tacticSummaryMap.values()).sort((a, b) => b.iocCount - a.iocCount),
    };
  }

  async getTopTechniques(limit: number = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const techniques = await db.select()
      .from(mitreTechniques)
      .orderBy(desc(mitreTechniques.detections))
      .limit(safeLimit);

    return techniques.map(t => ({
      id: t.techniqueId,
      techniqueId: t.techniqueId,
      name: t.name,
      detections: t.detections || 0,
      affectedAssets: t.affectedAssets || 0,
      severity: t.severity || 'medium',
      trend: 'stable',
    }));
  }

  async mapIOCsToTechniques(batchSize: number = 2000, maxBatches: number = 10) {
    if (this.mappingStatus.running) {
      throw new Error('MITRE mapping job is already running');
    }

    this.mappingStatus = {
      running: true,
      startedAt: new Date().toISOString(),
    };

    try {
      const safeBatchSize = Math.min(Math.max(batchSize, 100), 5000);
      const safeMaxBatches = Math.min(Math.max(maxBatches, 1), 100);

      const existingTechniques = await db.select({
        id: mitreTechniques.techniqueId,
      }).from(mitreTechniques);
      const validTechniqueIds = new Set(existingTechniques.map((t) => t.id.toUpperCase()));

      let processed = 0;
      let mapped = 0;
      const touchedTechniques = new Set<string>();
      const techniqueDetectionAdds = new Map<string, number>();

      for (let batch = 0; batch < safeMaxBatches; batch++) {
        const rows = await db
          .select()
          .from(iocs)
          .orderBy(desc(iocs.lastSeen))
          .offset(batch * safeBatchSize)
          .limit(safeBatchSize);

        if (rows.length === 0) break;

        for (const row of rows) {
          if ((row.mitreTechniques || []).length > 0) continue;
          processed++;
          const inferred = inferMitreTechniquesFromIOC({
            value: row.value,
            type: row.type,
            tags: row.tags,
            sources: row.sources,
            description: row.description,
          }).filter((id) => validTechniqueIds.has(id.toUpperCase()));

          if (inferred.length === 0) continue;
          for (const t of inferred) {
            touchedTechniques.add(t);
            techniqueDetectionAdds.set(t, (techniqueDetectionAdds.get(t) || 0) + 1);
          }

          await db
            .update(iocs)
            .set({
              mitreTechniques: inferred,
              updatedAt: new Date(),
            })
            .where(eq(iocs.id, row.id));

          mapped++;
        }
      }

      for (const [tId, added] of techniqueDetectionAdds.entries()) {
        await db
          .update(mitreTechniques)
          .set({
            detections: sql`coalesce(${mitreTechniques.detections}, 0) + ${added}`,
            updatedAt: new Date(),
          })
          .where(eq(mitreTechniques.techniqueId, tId));
      }
      await cacheDelByPrefixes(['dashboard:', 'iocs:', 'mitre:']);

      const result = { processed, mapped };
      this.mappingStatus = {
        running: false,
        startedAt: this.mappingStatus.startedAt,
        finishedAt: new Date().toISOString(),
        lastResult: result,
      };
      return result;
    } catch (error: any) {
      this.mappingStatus = {
        running: false,
        startedAt: this.mappingStatus.startedAt,
        finishedAt: new Date().toISOString(),
        error: error.message,
      };
      throw error;
    }
  }

  async refreshTechniqueDetections(techniqueIds?: string[]) {
    const scoped = Array.isArray(techniqueIds) ? techniqueIds.filter(Boolean) : [];
    if (scoped.length === 0) return;

    for (const tId of scoped) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(iocs)
        .where(sql`${tId} = ANY(${iocs.mitreTechniques})`);

      await db
        .update(mitreTechniques)
        .set({
          detections: Number(countResult?.count || 0),
          updatedAt: new Date(),
        })
        .where(eq(mitreTechniques.techniqueId, tId));
    }
  }

  getMappingStatus() {
    return this.mappingStatus;
  }
}

export default new MitreService();
