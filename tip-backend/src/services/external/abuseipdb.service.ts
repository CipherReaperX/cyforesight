import axios from 'axios';
import logger from '../../config/logger';

export class AbuseIPDBService {
  private apiKey: string;
  private baseUrl = 'https://api.abuseipdb.com/api/v2';

  constructor() {
    this.apiKey = process.env.ABUSEIPDB_API_KEY || '';
  }

  async check(ip: string) {
    if (!this.apiKey) {
      logger.warn('AbuseIPDB API key not configured');
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/check`, {
        params: { ipAddress: ip, maxAgeInDays: 90 },
        headers: { 'Key': this.apiKey },
        timeout: 10000,
      });

      const data = response.data.data;

      return {
        abuseConfidenceScore: data.abuseConfidenceScore,
        totalReports: data.totalReports,
        country: data.countryCode,
        isp: data.isp,
        domain: data.domain,
        usageType: data.usageType,
        isWhitelisted: data.isWhitelisted,
      };
    } catch (error: any) {
      logger.error('AbuseIPDB lookup error:', error.message);
      return null;
    }
  }
}

export default new AbuseIPDBService();
