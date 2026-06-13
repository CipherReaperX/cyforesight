import { Worker } from 'bullmq';
import axios from 'axios';
import db from '../config/database';
import { iocs } from '../models/schema';
import { eq } from 'drizzle-orm';
import logger from '../config/logger';
import redis from '../config/redis';

export const enrichmentWorker = new Worker(
  'enrichment',
  async (job) => {
    const { iocId, iocValue, iocType } = job.data;

    if (!iocId || !iocValue || !iocType) {
      logger.warn('⚠️  Enrichment job missing data, skipping...');
      return { skipped: true };
    }

    logger.info(`Enriching IOC: ${iocValue} (${iocType})`);

    try {
      const enrichmentData: any = {};
      let enriched = false;

      // VirusTotal enrichment
      if (process.env.VIRUSTOTAL_API_KEY) {
        try {
          const vtResult = await enrichVirusTotal(iocValue, iocType);
          if (vtResult) {
            enrichmentData.vtDetections = vtResult.detections;
            enrichmentData.vtScore = vtResult.score;
            enriched = true;
            logger.info(`✅ VirusTotal enrichment for ${iocValue}`);
          }
        } catch (err: any) {
          logger.warn(`VT API error for ${iocValue}: ${err.message}`);
        }
      }

      // AbuseIPDB enrichment (IPs only)
      if (iocType === 'ip' && process.env.ABUSEIPDB_API_KEY) {
        try {
          const abuseResult = await enrichAbuseIPDB(iocValue);
          if (abuseResult) {
            enrichmentData.abuseScore = abuseResult.abuseScore;
            enrichmentData.reports = abuseResult.reports;
            enriched = true;
            logger.info(`✅ AbuseIPDB enrichment for ${iocValue}`);
          }
        } catch (err: any) {
          logger.warn(`AbuseIPDB API error for ${iocValue}: ${err.message}`);
        }
      }

      // Only update if we have enrichment data
      if (enriched && Object.keys(enrichmentData).length > 0) {
        const updatePayload: Partial<typeof iocs.$inferInsert> = {
          updatedAt: new Date(),
        };

        if (typeof enrichmentData.vtScore === 'number') {
          updatePayload.mlScore = enrichmentData.vtScore;
        }

        if (typeof enrichmentData.abuseScore === 'number') {
          updatePayload.confidence = Math.max(enrichmentData.abuseScore, 50);
        }

        await db.update(iocs).set(updatePayload).where(eq(iocs.id, iocId));

        logger.info(`✅ Enriched IOC ${iocValue}`);
      } else {
        logger.info(`⚠️  No enrichment data for ${iocValue}`);
      }

      return { success: true, enriched };

    } catch (error: any) {
      logger.error(`❌ Error enriching IOC ${iocValue}:`, error.message);
      throw error;
    }
  },
  { connection: redis }
);

// VirusTotal enrichment
async function enrichVirusTotal(value: string, type: string) {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) return null;

  try {
    let endpoint = '';
    if (type === 'ip') endpoint = `https://www.virustotal.com/api/v3/ip_addresses/${value}`;
    else if (type === 'domain') endpoint = `https://www.virustotal.com/api/v3/domains/${value}`;
    else if (type === 'url') {
      const urlId = Buffer.from(value).toString('base64').replace(/=/g, '');
      endpoint = `https://www.virustotal.com/api/v3/urls/${urlId}`;
    }
    else if (type === 'hash') endpoint = `https://www.virustotal.com/api/v3/files/${value}`;
    else return null;

    const response = await axios.get(endpoint, {
      headers: { 'x-apikey': apiKey },
      timeout: 10000,
    });

    const stats = response.data?.data?.attributes?.last_analysis_stats;
    if (stats) {
      return {
        detections: stats.malicious || 0,
        score: Math.round((stats.malicious / (stats.malicious + stats.undetected + stats.harmless)) * 100) || 0,
      };
    }

    return null;
  } catch (error: any) {
    if (error.response?.status === 404) return null;
    throw error;
  }
}

// AbuseIPDB enrichment
async function enrichAbuseIPDB(ip: string) {
  const apiKey = process.env.ABUSEIPDB_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await axios.get('https://api.abuseipdb.com/api/v2/check', {
      params: { ipAddress: ip, maxAgeInDays: 90 },
      headers: { Key: apiKey, Accept: 'application/json' },
      timeout: 10000,
    });

    const data = response.data?.data;
    if (data) {
      return {
        abuseScore: data.abuseConfidenceScore || 0,
        reports: data.totalReports || 0,
      };
    }

    return null;
  } catch (error: any) {
    if (error.response?.status === 404) return null;
    throw error;
  }
}
