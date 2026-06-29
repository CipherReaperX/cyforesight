import axios from 'axios';
import logger from '../../config/logger';
import settingsService from '../settings.service';

export class AbuseIPDBService {
  private baseUrl = 'https://api.abuseipdb.com/api/v2';

  async check(ip: string) {
    const apiKey = (await settingsService.getApiKey('abuseipdb')) || '';
    if (!apiKey) {
      logger.warn('AbuseIPDB API key not configured');
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/check`, {
        params: { ipAddress: ip, maxAgeInDays: 90 },
        headers: { 'Key': apiKey },
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
