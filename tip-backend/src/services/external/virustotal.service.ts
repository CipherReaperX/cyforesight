import axios from 'axios';
import logger from '../../config/logger';
import settingsService from '../settings.service';

export class VirusTotalService {
  private baseUrl = 'https://www.virustotal.com/api/v3';

  // Reads the key from the api_keys table (decrypted), falling back to env.
  private async getKey(): Promise<string> {
    return (await settingsService.getApiKey('virustotal')) || '';
  }

  async lookupIP(ip: string) {
    const apiKey = await this.getKey();
    if (!apiKey) {
      logger.warn('VirusTotal API key not configured');
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/ip_addresses/${ip}`, {
        headers: { 'x-apikey': apiKey },
        timeout: 10000,
      });

      return {
        malicious: response.data.data.attributes.last_analysis_stats.malicious,
        suspicious: response.data.data.attributes.last_analysis_stats.suspicious,
        harmless: response.data.data.attributes.last_analysis_stats.harmless,
        reputation: response.data.data.attributes.reputation,
      };
    } catch (error: any) {
      logger.error('VirusTotal lookup error:', error.message);
      return null;
    }
  }

  async lookupDomain(domain: string) {
    const apiKey = await this.getKey();
    if (!apiKey) return null;

    try {
      const response = await axios.get(`${this.baseUrl}/domains/${domain}`, {
        headers: { 'x-apikey': apiKey },
        timeout: 10000,
      });

      return {
        malicious: response.data.data.attributes.last_analysis_stats.malicious,
        suspicious: response.data.data.attributes.last_analysis_stats.suspicious,
        categories: response.data.data.attributes.categories,
      };
    } catch (error: any) {
      logger.error('VirusTotal domain lookup error:', error.message);
      return null;
    }
  }

  async lookupHash(hash: string) {
    const apiKey = await this.getKey();
    if (!apiKey) return null;

    try {
      const response = await axios.get(`${this.baseUrl}/files/${hash}`, {
        headers: { 'x-apikey': apiKey },
        timeout: 10000,
      });

      const stats = response.data?.data?.attributes?.last_analysis_stats || {};
      return {
        malicious: stats.malicious || 0,
        suspicious: stats.suspicious || 0,
        harmless: stats.harmless || 0,
        undetected: stats.undetected || 0,
      };
    } catch (error: any) {
      logger.error('VirusTotal hash lookup error:', error.message);
      return null;
    }
  }

  async lookupURL(url: string) {
    const apiKey = await this.getKey();
    if (!apiKey) return null;

    try {
      const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');
      const response = await axios.get(`${this.baseUrl}/urls/${urlId}`, {
        headers: { 'x-apikey': apiKey },
        timeout: 10000,
      });

      const stats = response.data?.data?.attributes?.last_analysis_stats || {};
      return {
        malicious: stats.malicious || 0,
        suspicious: stats.suspicious || 0,
        harmless: stats.harmless || 0,
        undetected: stats.undetected || 0,
      };
    } catch (error: any) {
      logger.error('VirusTotal URL lookup error:', error.message);
      return null;
    }
  }
}

export default new VirusTotalService();
