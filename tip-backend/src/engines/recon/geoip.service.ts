import geoip from 'geoip-lite';
import logger from '../../config/logger';

export class GeoIPService {
  lookup(ip: string) {
    try {
      const geo = geoip.lookup(ip);

      if (!geo) {
        return null;
      }

      return {
        country: geo.country,
        region: geo.region,
        city: geo.city,
        ll: geo.ll,
        latitude: geo.ll[0],
        longitude: geo.ll[1],
        timezone: geo.timezone,
      };
    } catch (error: any) {
      logger.error('GeoIP lookup error:', error);
      return null;
    }
  }
}

export default new GeoIPService();
