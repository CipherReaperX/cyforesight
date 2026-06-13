import 'dotenv/config';
import axios from 'axios';
import db from '../src/config/database';
import { cves } from '../src/models/schema';

async function importNvdCves() {
  const baseUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
  let startIndex = 0;
  const pageSize = 500;
  let totalImported = 0;
  // Only these severities are allowed by your enum!
  const validSeverities = ['critical', 'high', 'medium', 'low', 'unknown'];

  while (true) {
    const resp = await axios.get(baseUrl, {
      params: {
        startIndex,
        resultsPerPage: pageSize,
      }
    });
    const items = resp.data.vulnerabilities || [];
    if (!items.length) break;

    for (const v of items) {
      const cve = v.cve;
      if (!cve?.id) continue;

      // Extract severity safely
      let rawSeverity = (
        cve.metrics?.cvssMetricV3?.[0]?.cvssData?.baseSeverity ||
        cve.metrics?.cvssMetricV2?.[0]?.baseSeverity
      );
      rawSeverity = rawSeverity?.toLowerCase() ?? 'unknown';
      const severity = validSeverities.includes(rawSeverity) ? rawSeverity : 'unknown';

      // cvss_score: set to null if missing, do not use undefined!
      let cvssScore = null;
      if (cve.metrics?.cvssMetricV3?.[0]?.cvssData?.baseScore !== undefined) {
        cvssScore = cve.metrics.cvssMetricV3[0].cvssData.baseScore;
      } else if (cve.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore !== undefined) {
        cvssScore = cve.metrics.cvssMetricV2[0].cvssData.baseScore;
      }

      try {
        await db.insert(cves).values({
          cveId: cve.id,
          description: cve.descriptions?.find((desc: any) => desc.lang === 'en')?.value || '',
          cvssScore,
          severity,
          patchStatus: null,
          exploitAvailable: false,
          affectedAssets: 0,
          publishedDate: cve.published ? new Date(cve.published) : null,
        }).onConflictDoNothing();
        totalImported++;
      } catch (e: any) {
        // Log and skip any row errors, don't stop the whole script
        console.error(`Failed to insert ${cve.id}: ${e.message}`);
      }
    }
    console.log(`Imported ${totalImported} CVEs so far...`);
    startIndex += pageSize;
  }
  console.log('NVD CVE import complete!');
}

importNvdCves().then(() => process.exit(0));

