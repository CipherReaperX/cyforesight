import whois from 'whois';
import logger from '../../config/logger';

export class WhoisService {
  async lookup(domain: string): Promise<any> {
    return new Promise((resolve, reject) => {
      whois.lookup(domain, (err: any, data: string) => {
        if (err) {
          logger.error('WHOIS lookup error:', err);
          return reject(err);
        }

        try {
          const parsed = this.parseWhoisData(data);
          resolve(parsed);
        } catch (error) {
          logger.error('WHOIS parse error:', error);
          resolve({ raw: data });
        }
      });
    });
  }

  private parseWhoisData(raw: string): any {
    const lines = raw.split('\n');
    const result: any = { raw };

    for (const line of lines) {
      if (line.includes('Registrar:')) {
        result.registrar = line.split(':')[1]?.trim();
      }
      if (line.includes('Creation Date:') || line.includes('Created:')) {
        result.createdDate = line.split(':')[1]?.trim();
      }
      if (line.includes('Expiry Date:') || line.includes('Expires:')) {
        result.expiryDate = line.split(':')[1]?.trim();
      }
      if (line.includes('Name Server:')) {
        if (!result.nameServers) result.nameServers = [];
        result.nameServers.push(line.split(':')[1]?.trim());
      }
    }

    return result;
  }
}

export default new WhoisService();
