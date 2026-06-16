import { eq, and, ilike, sql, desc, or, inArray } from 'drizzle-orm';
import db from '../config/database';
import { assets, cves, iocs } from '../models/schema';
import { AssetCreateInput } from '../types';
import { calculateRiskLevel } from '../utils/helpers';
import logger from '../config/logger';
import virusTotalService from './external/virustotal.service';
import reconService from './recon.service';

export class AssetService {
  private getIOCTypeCompatibility(assetType: string): Array<string> {
    const map: Record<string, string[]> = {
      server: ['ip', 'domain', 'url', 'hash', 'registry', 'mutex', 'user-agent'],
      workstation: ['ip', 'domain', 'url', 'hash', 'email', 'registry', 'mutex', 'user-agent'],
      network_device: ['ip', 'domain', 'url', 'user-agent'],
      cloud_resource: ['ip', 'domain', 'url', 'hash'],
      application: ['domain', 'url', 'hash', 'email', 'user-agent'],
    };
    return map[assetType] || ['ip', 'domain', 'url', 'hash'];
  }

  private buildAssetKeywords(asset: typeof assets.$inferSelect): string[] {
    return [
      asset.name,
      asset.hostname || '',
      asset.ip || '',
      asset.os || '',
      asset.department || '',
      ...(asset.tags || []),
    ]
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9.-]+/g)
      .filter((v) => v.length > 2);
  }

  async getAssets(filters: any, skip: number = 0, take: number = 25) {
    const conditions = [];
    
    if (filters.type) {
      conditions.push(eq(assets.type, filters.type));
    }
    if (filters.status) {
      conditions.push(eq(assets.status, filters.status));
    }
    if (filters.search) {
      conditions.push(
        or(
          ilike(assets.name, `%${filters.search}%`),
          ilike(assets.ip, `%${filters.search}%`),
          ilike(assets.hostname, `%${filters.search}%`),
          ilike(assets.department, `%${filters.search}%`),
          ilike(assets.owner, `%${filters.search}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      db.query.assets.findMany({
        where: whereClause,
        limit: take,
        offset: skip,
        orderBy: [desc(assets.riskScore)],
      }),
      db.select({ count: sql<number>`count(*)` })
        .from(assets)
        .where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return {
      items,
      total,
      hasMore: skip + take < total,
    };
  }

  async getAssetById(id: string) {
    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, id),
    });

    if (!asset) {
      throw new Error('Asset not found');
    }

    return asset;
  }

  async createAsset(input: AssetCreateInput) {
    const [newAsset] = await db.insert(assets).values({
      name: input.name,
      type: input.type,
      ip: input.ip,
      hostname: input.hostname,
      os: input.os,
      department: input.department,
      owner: input.owner,
      criticality: input.criticality || 1,
      tags: input.tags || [],
    }).returning();

    logger.info(`Asset created: ${input.name}`);

    return newAsset;
  }

  async updateAsset(id: string, input: any) {
    const asset = await this.getAssetById(id);

    const [updated] = await db.update(assets)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(assets.id, id))
      .returning();

    logger.info(`Asset updated: ${id}`);

    return updated;
  }

  async deleteAsset(id: string) {
    await db.delete(assets).where(eq(assets.id, id));
    logger.info(`Asset deleted: ${id}`);
  }

  async getRiskDistribution() {
    const result = await db
      .select({
        riskScore: assets.riskScore,
      })
      .from(assets);

    const distribution = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0,
    };

    result.forEach(r => {
      const level = calculateRiskLevel(r.riskScore || 0);
      distribution[level as keyof typeof distribution]++;
    });

    return distribution;
  }

  async bootstrapSmallEnterprise() {
    const blueprint: Array<typeof assets.$inferInsert> = [
      { name: 'AD-DC01', type: 'server', ip: '10.10.1.10', hostname: 'ad-dc01.corp.local', os: 'Windows Server 2022', department: 'IT', owner: 'Infra Team', riskScore: 88, criticality: 5, activeThreats: 2, unpatchedCves: 6, status: 'online', tags: ['identity', 'domain-controller'] },
      { name: 'AD-DC02', type: 'server', ip: '10.10.1.11', hostname: 'ad-dc02.corp.local', os: 'Windows Server 2022', department: 'IT', owner: 'Infra Team', riskScore: 72, criticality: 5, activeThreats: 1, unpatchedCves: 4, status: 'online', tags: ['identity', 'domain-controller'] },
      { name: 'FILE-SRV01', type: 'server', ip: '10.10.2.20', hostname: 'file-srv01.corp.local', os: 'Windows Server 2019', department: 'IT', owner: 'Ops Team', riskScore: 67, criticality: 4, activeThreats: 1, unpatchedCves: 3, status: 'online', tags: ['fileshare', 'smb'] },
      { name: 'SQL-APP01', type: 'server', ip: '10.10.3.30', hostname: 'sql-app01.corp.local', os: 'Ubuntu 22.04', department: 'Engineering', owner: 'App Team', riskScore: 64, criticality: 4, activeThreats: 1, unpatchedCves: 5, status: 'online', tags: ['database', 'critical-app'] },
      { name: 'FW-EDGE01', type: 'network_device', ip: '10.10.0.1', hostname: 'fw-edge01.corp.local', os: 'PAN-OS', department: 'Network', owner: 'Network Team', riskScore: 58, criticality: 5, activeThreats: 0, unpatchedCves: 1, status: 'online', tags: ['firewall', 'edge'] },
      { name: 'SW-CORE01', type: 'network_device', ip: '10.10.0.10', hostname: 'sw-core01.corp.local', os: 'Cisco IOS-XE', department: 'Network', owner: 'Network Team', riskScore: 39, criticality: 4, activeThreats: 0, unpatchedCves: 0, status: 'online', tags: ['switch', 'core'] },
      { name: 'VPN-GW01', type: 'network_device', ip: '10.10.0.20', hostname: 'vpn-gw01.corp.local', os: 'FortiOS', department: 'Network', owner: 'Network Team', riskScore: 61, criticality: 4, activeThreats: 1, unpatchedCves: 2, status: 'online', tags: ['vpn', 'remote-access'] },
      { name: 'APP-WEB-PROD', type: 'application', ip: '10.10.4.40', hostname: 'app-web-prod.corp.local', os: 'Kubernetes', department: 'Engineering', owner: 'Platform Team', riskScore: 55, criticality: 4, activeThreats: 1, unpatchedCves: 2, status: 'online', tags: ['web', 'production'] },
      { name: 'CRM-SaaS', type: 'application', ip: null, hostname: 'crm.company-saas.com', os: 'SaaS', department: 'Sales', owner: 'BizApps Team', riskScore: 42, criticality: 3, activeThreats: 0, unpatchedCves: 0, status: 'online', tags: ['crm', 'external'] },
      { name: 'M365-Tenant', type: 'cloud_resource', ip: null, hostname: 'tenant.onmicrosoft.com', os: 'Cloud', department: 'IT', owner: 'Identity Team', riskScore: 49, criticality: 5, activeThreats: 1, unpatchedCves: 0, status: 'online', tags: ['identity', 'cloud'] },
      { name: 'AWS-VPC-PROD', type: 'cloud_resource', ip: '172.31.0.0', hostname: 'vpc-prod.aws.local', os: 'AWS', department: 'Engineering', owner: 'CloudOps', riskScore: 51, criticality: 4, activeThreats: 1, unpatchedCves: 1, status: 'online', tags: ['aws', 'production'] },
      { name: 'LAPTOP-EXEC-01', type: 'workstation', ip: '10.10.20.14', hostname: 'laptop-exec-01.corp.local', os: 'Windows 11', department: 'Executive', owner: 'VIP Support', riskScore: 73, criticality: 5, activeThreats: 2, unpatchedCves: 4, status: 'online', tags: ['vip', 'endpoint'] },
      { name: 'LAPTOP-SALES-22', type: 'workstation', ip: '10.10.25.33', hostname: 'laptop-sales-22.corp.local', os: 'Windows 11', department: 'Sales', owner: 'Endpoint Team', riskScore: 44, criticality: 2, activeThreats: 0, unpatchedCves: 2, status: 'online', tags: ['endpoint'] },
      { name: 'MAC-DESIGN-07', type: 'workstation', ip: '10.10.30.27', hostname: 'mac-design-07.corp.local', os: 'macOS 14', department: 'Design', owner: 'Endpoint Team', riskScore: 37, criticality: 2, activeThreats: 0, unpatchedCves: 1, status: 'online', tags: ['endpoint', 'macos'] },
    ];

    let inserted = 0;
    for (const row of blueprint) {
      const existing = await db
        .select({ count: sql<number>`count(*)` })
        .from(assets)
        .where(eq(assets.name, row.name));
      if (Number(existing[0]?.count || 0) > 0) continue;
      await db.insert(assets).values(row);
      inserted += 1;
    }

    logger.info(`Small enterprise asset blueprint loaded: ${inserted} inserted`);
    return { inserted, totalBlueprint: blueprint.length };
  }

  async getAssetVulnerabilities(assetId: string, limit: number = 25) {
    const asset = await this.getAssetById(assetId);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const keywords = this.buildAssetKeywords(asset).slice(0, 20);

    const rows = await db
      .select()
      .from(cves)
      .orderBy(desc(cves.cvssScore))
      .limit(600);

    const matched = rows.filter((cve) => {
      const text = `${cve.description || ''} ${cve.vendor || ''} ${cve.product || ''}`.toLowerCase();
      const byKeyword = keywords.some((kw) => text.includes(kw));
      const byOS =
        !!asset.os &&
        (text.includes(asset.os.toLowerCase().split(' ')[0]) ||
          text.includes((asset.os || '').toLowerCase()));
      return byKeyword || byOS;
    });

    const selected = (matched.length > 0 ? matched : rows.slice(0, safeLimit))
      .slice(0, safeLimit)
      .map((cve) => ({
        id: cve.id,
        cveId: cve.cveId,
        description: cve.description,
        severity: cve.severity,
        cvssScore: Number(cve.cvssScore || 0),
        patchStatus: cve.patchStatus,
        exploitAvailable: !!cve.exploitAvailable,
        publishedDate: cve.publishedDate,
      }));

    return {
      assetId: asset.id,
      assetName: asset.name,
      total: selected.length,
      items: selected,
    };
  }

  async getAssetThreats(assetId: string, limit: number = 25) {
    const asset = await this.getAssetById(assetId);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const compatibleIOCType = this.getIOCTypeCompatibility(asset.type);
    const keywords = this.buildAssetKeywords(asset);

    const rows = await db
      .select({
        id: iocs.id,
        value: iocs.value,
        type: iocs.type,
        severity: iocs.severity,
        confidence: iocs.confidence,
        mitreTechniques: iocs.mitreTechniques,
        lastSeen: iocs.lastSeen,
        sources: iocs.sources,
      })
      .from(iocs)
      .where(inArray(iocs.type, compatibleIOCType as any))
      .orderBy(desc(iocs.lastSeen))
      .limit(2000);

    const severityWeight: Record<string, number> = {
      critical: 1,
      high: 0.8,
      medium: 0.55,
      low: 0.35,
      info: 0.2,
    };

    const scored = rows
      .map((ioc) => {
        const text = `${ioc.value} ${(ioc.sources || []).join(' ')}`.toLowerCase();
        const relevanceBoost = keywords.some((kw) => text.includes(kw)) ? 0.2 : 0;
        const confidence = Math.max(0.1, Number(ioc.confidence || 50) / 100);
        const base = severityWeight[ioc.severity] || 0.4;
        const criticality = Math.max(0.2, Number(asset.criticality || 1) / 5);
        const score = Number(((base + relevanceBoost) * confidence * (0.6 + criticality)).toFixed(4));
        return { ...ioc, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, safeLimit);

    return {
      assetId: asset.id,
      assetName: asset.name,
      total: scored.length,
      items: scored,
    };
  }

  async mapIOCsToAssets(limitPerAsset: number = 40) {
    const allAssets = await db.select().from(assets);
    const safeLimit = Math.min(Math.max(limitPerAsset, 5), 200);
    const results: Array<{ assetId: string; assetName: string; mappedIOCs: number; mappedCVEs: number; riskScore: number }> = [];

    for (const asset of allAssets) {
      const [threats, vulns] = await Promise.all([
        this.getAssetThreats(asset.id, safeLimit),
        this.getAssetVulnerabilities(asset.id, 25),
      ]);

      const mappedIOCs = threats.total;
      const mappedCVEs = vulns.total;
      const maxSeverity = threats.items.reduce((acc, ioc) => {
        const order = { critical: 5, high: 4, medium: 3, low: 2, info: 1 } as Record<string, number>;
        return Math.max(acc, order[ioc.severity] || 1);
      }, 1);
      const derivedRisk = Math.min(
        100,
        Math.round(
          20 +
            mappedIOCs * 0.8 +
            mappedCVEs * 1.2 +
            Number(asset.criticality || 1) * 6 +
            maxSeverity * 4
        )
      );

      await db
        .update(assets)
        .set({
          activeThreats: mappedIOCs,
          unpatchedCves: mappedCVEs,
          riskScore: derivedRisk,
          updatedAt: new Date(),
        })
        .where(eq(assets.id, asset.id));

      results.push({
        assetId: asset.id,
        assetName: asset.name,
        mappedIOCs,
        mappedCVEs,
        riskScore: derivedRisk,
      });
    }

    return {
      assetsProcessed: allAssets.length,
      results,
    };
  }

  async getStats() {
    const [row] = await db.select({
      total: sql<number>`count(*)`,
      highRisk: sql<number>`count(*) filter (where risk_score >= 80)`,
      totalThreats: sql<number>`coalesce(sum(active_threats), 0)`,
      totalCVEs: sql<number>`coalesce(sum(unpatched_cves), 0)`,
      avgRisk: sql<number>`coalesce(round(avg(risk_score)), 0)`,
    }).from(assets);
    return {
      total: Number(row.total),
      highRisk: Number(row.highRisk),
      totalThreats: Number(row.totalThreats),
      totalCVEs: Number(row.totalCVEs),
      avgRisk: Number(row.avgRisk),
    };
  }

  async exportAssets(filters: { type?: string; status?: string; search?: string }) {
    const conditions: any[] = [];
    if (filters.type) conditions.push(eq(assets.type, filters.type as any));
    if (filters.status) conditions.push(eq(assets.status, filters.status as any));
    if (filters.search) {
      conditions.push(or(
        ilike(assets.name, `%${filters.search}%`),
        ilike(assets.ip, `%${filters.search}%`),
        ilike(assets.hostname, `%${filters.search}%`),
      )!);
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    return db.query.assets.findMany({
      where: whereClause,
      orderBy: [desc(assets.riskScore)],
      limit: 10000,
    });
  }

  async scanAsset(id: string) {
    const asset = await this.getAssetById(id);
    const startedAt = new Date();
    const findings: Record<string, any> = {};
    const errors: Record<string, string> = {};

    // DNS on hostname
    const dnsTarget = asset.hostname || asset.ip;
    if (dnsTarget) {
      try {
        const dns = await reconService.dnsLookup(dnsTarget);
        findings.dns = dns.result;
      } catch (e: any) {
        errors.dns = e.message;
      }
    }

    // GeoIP on IP
    if (asset.ip) {
      try {
        const geo = await reconService.geoipLookup(asset.ip);
        findings.geoip = geo.result;
      } catch (e: any) {
        errors.geoip = e.message;
      }
    }

    // SSL on external hostname only (skip .local / internal)
    const hostname = asset.hostname || '';
    const isExternal = hostname && !hostname.endsWith('.local') && !hostname.endsWith('.corp.local') && hostname.includes('.');
    if (isExternal) {
      try {
        const ssl = await reconService.sslLookup(hostname);
        findings.ssl = ssl.result;
      } catch (e: any) {
        errors.ssl = e.message;
      }
    }

    const durationMs = Date.now() - startedAt.getTime();

    await db.update(assets)
      .set({ lastScan: startedAt, updatedAt: new Date() })
      .where(eq(assets.id, id));

    logger.info(`Asset scanned: ${asset.name} (${durationMs}ms)`);

    return {
      assetId: id,
      assetName: asset.name,
      scannedAt: startedAt.toISOString(),
      durationMs,
      findings,
      errors,
      checksRun: Object.keys(findings).length + Object.keys(errors).length,
    };
  }

  async getExposurePriorities(limit: number = 25) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const rows = await db.select().from(assets).orderBy(desc(assets.riskScore)).limit(500);

    const prioritized = rows
      .map((asset) => {
        const risk = Number(asset.riskScore || 0);
        const threats = Number(asset.activeThreats || 0);
        const cvesCount = Number(asset.unpatchedCves || 0);
        const criticality = Number(asset.criticality || 1);
        const score = Math.min(
          100,
          Math.round(risk * 0.4 + threats * 1.2 + cvesCount * 1.6 + criticality * 8)
        );

        const reasons = [
          threats > 0 ? `${threats} active IOC correlations` : '',
          cvesCount > 0 ? `${cvesCount} unpatched CVEs` : '',
          criticality >= 4 ? `criticality ${criticality}/5` : '',
        ].filter(Boolean);

        return {
          assetId: asset.id,
          name: asset.name,
          type: asset.type,
          department: asset.department,
          status: asset.status,
          riskScore: risk,
          activeThreats: threats,
          unpatchedCves: cvesCount,
          criticality,
          priorityScore: score,
          reasons,
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, safeLimit);

    return prioritized;
  }

  async recheckAssetIOCsWithVT(assetId: string, limit: number = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const threats = await this.getAssetThreats(assetId, safeLimit);
    const targetIOCs = threats.items.filter((ioc: any) =>
      ['ip', 'domain', 'url', 'hash'].includes(ioc.type)
    );

    const results: Array<{
      iocId: string;
      value: string;
      type: string;
      vt?: any;
      updated: boolean;
      error?: string;
    }> = [];

    for (const ioc of targetIOCs) {
      try {
        let vt: any = null;
        if (ioc.type === 'ip') vt = await virusTotalService.lookupIP(ioc.value);
        else if (ioc.type === 'domain') vt = await virusTotalService.lookupDomain(ioc.value);
        else if (ioc.type === 'url') vt = await virusTotalService.lookupURL(ioc.value);
        else if (ioc.type === 'hash') vt = await virusTotalService.lookupHash(ioc.value);

        if (!vt) {
          results.push({
            iocId: ioc.id,
            value: ioc.value,
            type: ioc.type,
            updated: false,
            error: 'No VT data',
          });
          continue;
        }

        const malicious = Number(vt.malicious || 0);
        const suspicious = Number(vt.suspicious || 0);
        const harmless = Number(vt.harmless || 0);
        const undetected = Number(vt.undetected || 0);
        const total = Math.max(1, malicious + suspicious + harmless + undetected);
        const vtScore = Math.min(100, Math.round(((malicious * 1.0 + suspicious * 0.6) / total) * 100));
        const newConfidence = Math.min(100, Math.max(Number(ioc.confidence || 50), 40 + vtScore));

        await db
          .update(iocs)
          .set({
            mlScore: vtScore,
            confidence: newConfidence,
            updatedAt: new Date(),
          })
          .where(eq(iocs.id, ioc.id));

        results.push({
          iocId: ioc.id,
          value: ioc.value,
          type: ioc.type,
          vt: {
            malicious,
            suspicious,
            harmless,
            undetected,
            vtScore,
          },
          updated: true,
        });
      } catch (error: any) {
        results.push({
          iocId: ioc.id,
          value: ioc.value,
          type: ioc.type,
          updated: false,
          error: error?.message || 'VT lookup failed',
        });
      }
    }

    const updatedCount = results.filter((r) => r.updated).length;
    return {
      assetId,
      checked: results.length,
      updated: updatedCount,
      failed: results.length - updatedCount,
      results,
    };
  }
}

export default new AssetService();
