import axios from 'axios';
import logger from '../../config/logger';

export class VirusTotalService {
  private apiKey: string;
  private baseUrl = 'https://www.virustotal.com/api/v3';

  constructor() {
    this.apiKey = process.env.VIRUSTOTAL_API_KEY || '';
  }

  async lookupIP(ip: string) {
    if (!this.apiKey) {
      logger.warn('VirusTotal API key not configured');
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/ip_addresses/${ip}`, {
        headers: { 'x-apikey': this.apiKey },
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
    if (!this.apiKey) return null;

    try {
      const response = await axios.get(`${this.baseUrl}/domains/${domain}`, {
        headers: { 'x-apikey': this.apiKey },
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
    if (!this.apiKey) return null;

    try {
      const response = await axios.get(`${this.baseUrl}/files/${hash}`, {
        headers: { 'x-apikey': this.apiKey },
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
    if (!this.apiKey) return null;

    try {
      const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');
      const response = await axios.get(`${this.baseUrl}/urls/${urlId}`, {
        headers: { 'x-apikey': this.apiKey },
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
