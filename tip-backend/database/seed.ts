import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db from '../src/config/database';
import { 
  users, 
  mitreTactics, 
  mitreTechniques,
  threatFeeds,
  iocs,
  assets,
  cves,
  threatDetections,
} from '../src/models/schema';
import { eq, sql } from 'drizzle-orm';
import logger from '../src/config/logger';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // 1. Create users
    const passwordHash = await bcrypt.hash('admin123', 12);
    await db.insert(users).values({
      username: 'admin',
      email: 'admin@tip.local',
      passwordHash,
      role: 'admin',
      permissions: ['all'],
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
    }).onConflictDoNothing();

    const analystHash = await bcrypt.hash('analyst123', 12);
    await db.insert(users).values({
      username: 'analyst',
      email: 'analyst@tip.local',
      passwordHash: analystHash,
      role: 'analyst',
      permissions: ['read', 'write', 'hunt'],
      firstName: 'Security',
      lastName: 'Analyst',
      isActive: true,
    }).onConflictDoNothing();
    console.log('✅ Users created');

    const [adminUser] = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);

    // 2. Auto-import MITRE data if not present
    const existingTactics = await db.select().from(mitreTactics).limit(1);
    
    if (existingTactics.length === 0) {
      console.log('🔄 Auto-importing MITRE ATT&CK data from official API...');
      try {
        const { importAllMITREData } = await import('../src/services/external/mitre.service');
        const result = await importAllMITREData();
        console.log(`✅ MITRE import complete: ${result.tactics} tactics, ${result.techniques} techniques`);
      } catch (error: any) {
        logger.error('MITRE import failed:', error.message);
        console.log('⚠️  Falling back to manual MITRE seeding...');
        
        // Fallback to basic seeding if API import fails
        const tacticsData = [
          { tacticId: 'TA0043', name: 'Reconnaissance', description: 'Gather information' },
          { tacticId: 'TA0001', name: 'Initial Access', description: 'Get into network' },
          { tacticId: 'TA0002', name: 'Execution', description: 'Run malicious code' },
        ];
        for (const tactic of tacticsData) {
          await db.insert(mitreTactics).values(tactic).onConflictDoNothing();
        }
        console.log('✅ Basic MITRE tactics seeded (fallback)');
      }
    } else {
      console.log('⏭️  MITRE data already exists, skipping...');
    }

    // 3. Seed threat feeds only if none exist
    const [{ count: feedCountRaw }] = await db.select({ count: sql<number>`count(*)` }).from(threatFeeds);
    if (Number(feedCountRaw) === 0) {
      await db.insert(threatFeeds).values([
        {
          name: 'Abuse.ch URLhaus',
          url: 'https://urlhaus.abuse.ch/downloads/csv_recent/',
          type: 'csv',
          status: 'active',
          frequency: 'hourly',
          lastFetch: new Date(),
          iocsImported: 24,
          totalIocs: 24,
          healthScore: 92,
          enabled: true,
        },
        {
          name: 'Abuse.ch MalwareBazaar',
          url: 'https://bazaar.abuse.ch/export/csv/recent/',
          type: 'csv',
          status: 'active',
          frequency: 'hourly',
          lastFetch: new Date(),
          iocsImported: 18,
          totalIocs: 18,
          healthScore: 88,
          enabled: true,
        },
        {
          name: 'Feodo Tracker',
          url: 'https://feodotracker.abuse.ch/downloads/ipblocklist.csv',
          type: 'csv',
          status: 'active',
          frequency: 'hourly',
          lastFetch: new Date(),
          iocsImported: 31,
          totalIocs: 31,
          healthScore: 90,
          enabled: true,
        },
        {
          name: 'Blocklist.de All IPs',
          url: 'https://lists.blocklist.de/lists/all.txt',
          type: 'csv',
          status: 'active',
          frequency: 'hourly',
          lastFetch: new Date(),
          iocsImported: 0,
          totalIocs: 0,
          healthScore: 100,
          enabled: true,
        },
      ]);
      console.log('✅ Threat feeds seeded');
    }

    // 4. Seed IOCs only if empty
    const [{ count: iocCountRaw }] = await db.select({ count: sql<number>`count(*)` }).from(iocs);
    if (Number(iocCountRaw) === 0) {
      await db.insert(iocs).values([
        {
          value: '185.234.247.121',
          type: 'ip',
          severity: 'critical',
          confidence: 96,
          status: 'active',
          tags: ['c2', 'botnet'],
          sources: ['Feodo Tracker'],
          description: 'Known botnet controller',
          firstSeen: new Date('2026-03-01T03:21:00Z'),
          lastSeen: new Date(),
          affectedAssets: 6,
          createdBy: adminUser?.id,
        },
        {
          value: 'login-update-security[.]com',
          type: 'domain',
          severity: 'high',
          confidence: 89,
          status: 'blocked',
          tags: ['phishing'],
          sources: ['URLhaus'],
          description: 'Credential phishing landing domain',
          firstSeen: new Date('2026-03-02T12:10:00Z'),
          lastSeen: new Date(),
          affectedAssets: 2,
          createdBy: adminUser?.id,
        },
        {
          value: 'https://cdn-secure-checker.example/payload',
          type: 'url',
          severity: 'high',
          confidence: 84,
          status: 'active',
          tags: ['malware', 'loader'],
          sources: ['MalwareBazaar'],
          description: 'Payload delivery URL',
          firstSeen: new Date('2026-03-02T21:50:00Z'),
          lastSeen: new Date(),
          affectedAssets: 4,
          createdBy: adminUser?.id,
        },
        {
          value: '44d88612fea8a8f36de82e1278abb02f',
          type: 'hash',
          severity: 'medium',
          confidence: 73,
          status: 'active',
          tags: ['sample', 'worm'],
          sources: ['Internal SOC'],
          description: 'Malicious file hash seen in sandbox',
          firstSeen: new Date('2026-03-03T09:00:00Z'),
          lastSeen: new Date(),
          affectedAssets: 1,
          createdBy: adminUser?.id,
        },
      ]);
      console.log('✅ IOCs seeded');
    }

    // 5. Seed assets only if empty
    const [{ count: assetCountRaw }] = await db.select({ count: sql<number>`count(*)` }).from(assets);
    if (Number(assetCountRaw) === 0) {
      await db.insert(assets).values([
        {
          name: 'Web Server 01',
          ip: '10.0.10.15',
          hostname: 'web01.prod.local',
          type: 'server',
          department: 'IT',
          criticality: 4,
          riskScore: 78,
          activeThreats: 3,
          unpatchedCves: 5,
          status: 'online',
          lastScan: new Date(),
        },
        {
          name: 'Database Core 01',
          ip: '10.0.20.12',
          hostname: 'db01.prod.local',
          type: 'server',
          department: 'Data',
          criticality: 5,
          riskScore: 86,
          activeThreats: 4,
          unpatchedCves: 8,
          status: 'online',
          lastScan: new Date(),
        },
        {
          name: 'Finance Workstation 17',
          ip: '10.0.30.77',
          hostname: 'fin-ws-17.local',
          type: 'workstation',
          department: 'Finance',
          criticality: 3,
          riskScore: 62,
          activeThreats: 1,
          unpatchedCves: 2,
          status: 'online',
          lastScan: new Date(),
        },
      ]);
      console.log('✅ Assets seeded');
    }

    // 6. Seed CVEs only if empty
    const [{ count: cveCountRaw }] = await db.select({ count: sql<number>`count(*)` }).from(cves);
    if (Number(cveCountRaw) === 0) {
      await db.insert(cves).values([
        {
          cveId: 'CVE-2025-1234',
          description: 'Critical RCE vulnerability in widely used web middleware.',
          cvssScore: '9.8',
          severity: 'critical',
          publishedDate: new Date('2025-11-15'),
          patchStatus: 'available',
          exploitAvailable: true,
          affectedAssets: 5,
          vendor: 'Acme',
          product: 'Gateway',
        },
        {
          cveId: 'CVE-2025-4421',
          description: 'Authentication bypass under specific reverse proxy conditions.',
          cvssScore: '8.1',
          severity: 'high',
          publishedDate: new Date('2025-12-03'),
          patchStatus: 'pending',
          exploitAvailable: false,
          affectedAssets: 3,
          vendor: 'Contoso',
          product: 'Identity Portal',
        },
      ]);
      console.log('✅ CVEs seeded');
    }

    // 7. Seed threat detections for dashboard widgets/trends
    const [{ count: detectionCountRaw }] = await db.select({ count: sql<number>`count(*)` }).from(threatDetections);
    if (Number(detectionCountRaw) === 0) {
      const topTechniques = await db.select().from(mitreTechniques).limit(3);
      const techniqueIds = topTechniques.map((t) => t.techniqueId);

      await db.insert(threatDetections).values([
        {
          name: 'Outbound C2 Beacon Detected',
          type: 'network',
          severity: 'critical',
          confidence: 94,
          affectedAssets: ['Web Server 01', 'Database Core 01'],
          iocIds: [],
          techniqueIds,
          source: 'SIEM',
          description: 'Beaconing pattern to known malicious infrastructure.',
          status: 'new',
          timestamp: new Date(),
        },
        {
          name: 'Credential Phishing Campaign',
          type: 'email',
          severity: 'high',
          confidence: 88,
          affectedAssets: ['Finance Workstation 17'],
          iocIds: [],
          techniqueIds,
          source: 'Email Gateway',
          description: 'Multiple users received spoofed SSO reset emails.',
          status: 'new',
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
        },
        {
          name: 'Suspicious Script Execution',
          type: 'endpoint',
          severity: 'medium',
          confidence: 72,
          affectedAssets: ['Web Server 01'],
          iocIds: [],
          techniqueIds,
          source: 'EDR',
          description: 'Encoded command line invocation detected.',
          status: 'new',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      ]);

      console.log('✅ Threat detections seeded');
    }

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('🎉 Seeding complete!');
    console.log('═══════════════════════════════════════');
    console.log('📝 Login: admin / admin123');
    console.log('');

  } catch (error) {
    logger.error('Seed error:', error);
    throw error;
  }

  process.exit(0);
}

seed();
