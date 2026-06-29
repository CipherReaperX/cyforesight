import axios from 'axios';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import db from '../config/database';
import { platformSettings, apiKeys, notificationPrefs } from '../models/schema';
import { encryptSecret, decryptSecret, maskKey } from '../utils/crypto';
import logger from '../config/logger';

const KNOWN_SERVICES = ['virustotal', 'abuseipdb', 'shodan', 'otx'] as const;
type KnownService = (typeof KNOWN_SERVICES)[number];

const ENV_MAP: Record<string, string> = {
  virustotal: 'VIRUSTOTAL_API_KEY',
  abuseipdb: 'ABUSEIPDB_API_KEY',
  shodan: 'SHODAN_API_KEY',
  otx: 'OTX_API_KEY',
};

// Default platform settings — used to seed the General/Security tabs
const DEFAULT_SETTINGS: Record<string, string> = {
  platform_name: 'CyForesight',
  default_theme: 'dark',
  timezone: 'UTC',
  data_refresh_interval: '30',
  session_timeout_hours: '24',
  max_iocs_per_page: '25',
  data_retention_days: '90',
};

export class SettingsService {
  private settingsCache: { data: Record<string, string>; at: number } | null = null;
  private apiKeyCache = new Map<string, { value: string; at: number }>();
  private readonly CACHE_MS = 60_000;

  // ---------- Platform settings ----------
  async bulkGetSettings(): Promise<Record<string, string>> {
    if (this.settingsCache && Date.now() - this.settingsCache.at < this.CACHE_MS) {
      return this.settingsCache.data;
    }
    const rows = await db.select().from(platformSettings);
    const merged: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      if (row.value !== null && row.value !== undefined) merged[row.key] = row.value;
    }
    this.settingsCache = { data: merged, at: Date.now() };
    return merged;
  }

  async getSetting(key: string): Promise<string | undefined> {
    const all = await this.bulkGetSettings();
    return all[key];
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db
      .insert(platformSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: new Date() } });
    this.settingsCache = null;
  }

  async bulkSetSettings(settings: Record<string, string>): Promise<Record<string, string>> {
    for (const [key, value] of Object.entries(settings)) {
      await db
        .insert(platformSettings)
        .values({ key, value: String(value ?? ''), updatedAt: new Date() })
        .onConflictDoUpdate({ target: platformSettings.key, set: { value: String(value ?? ''), updatedAt: new Date() } });
    }
    this.settingsCache = null;
    return this.bulkGetSettings();
  }

  // ---------- API keys ----------
  async getApiKeys() {
    const rows = await db.select().from(apiKeys);
    const byService = new Map(rows.map((r) => [r.service, r]));
    // Always present all known services so the UI can render each row
    return KNOWN_SERVICES.map((service) => {
      const row = byService.get(service);
      if (row) {
        return {
          service,
          configured: true,
          keyMasked: row.keyMasked,
          isActive: row.isActive,
          lastTestedAt: row.lastTestedAt,
          lastTestStatus: row.lastTestStatus,
          updatedAt: row.updatedAt,
        };
      }
      const envKey = process.env[ENV_MAP[service]] || '';
      return {
        service,
        configured: Boolean(envKey),
        keyMasked: envKey ? maskKey(envKey) : null,
        isActive: Boolean(envKey),
        lastTestedAt: null,
        lastTestStatus: null,
        updatedAt: null,
        source: envKey ? 'env' : undefined,
      };
    });
  }

  async saveApiKey(service: string, rawKey: string) {
    const keyEncrypted = encryptSecret(rawKey);
    const keyHash = await bcrypt.hash(rawKey, 10);
    const keyMasked = maskKey(rawKey);
    await db
      .insert(apiKeys)
      .values({ service, keyEncrypted, keyHash, keyMasked, isActive: true, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: apiKeys.service,
        set: { keyEncrypted, keyHash, keyMasked, isActive: true, updatedAt: new Date() },
      });
    this.apiKeyCache.delete(service);
    logger.info(`API key saved for service: ${service}`);
    return { service, keyMasked, isActive: true };
  }

  async deleteApiKey(service: string) {
    await db.delete(apiKeys).where(eq(apiKeys.service, service));
    this.apiKeyCache.delete(service);
    logger.info(`API key removed for service: ${service}`);
  }

  // Returns the raw key for actual enrichment use. DB first, env fallback.
  async getApiKey(service: KnownService | string): Promise<string | null> {
    const cached = this.apiKeyCache.get(service);
    if (cached && Date.now() - cached.at < this.CACHE_MS) return cached.value || null;

    const row = await db.query.apiKeys.findFirst({ where: eq(apiKeys.service, service) });
    let value = '';
    if (row?.keyEncrypted && row.isActive) {
      value = decryptSecret(row.keyEncrypted) || '';
    }
    if (!value) {
      value = process.env[ENV_MAP[service]] || '';
    }
    this.apiKeyCache.set(service, { value, at: Date.now() });
    return value || null;
  }

  async testApiKey(service: string, rawKey?: string): Promise<{ status: 'ok' | 'fail'; latencyMs: number; message?: string }> {
    const key = rawKey || (await this.getApiKey(service)) || '';
    if (!key) {
      return { status: 'fail', latencyMs: 0, message: 'No key configured' };
    }

    const start = Date.now();
    let ok = false;
    let message: string | undefined;
    try {
      switch (service) {
        case 'virustotal': {
          const r = await axios.get('https://www.virustotal.com/api/v3/ip_addresses/8.8.8.8', {
            headers: { 'x-apikey': key },
            timeout: 10000,
            validateStatus: () => true,
          });
          ok = r.status === 200;
          if (!ok) message = `HTTP ${r.status}`;
          break;
        }
        case 'abuseipdb': {
          const r = await axios.get('https://api.abuseipdb.com/api/v2/check', {
            params: { ipAddress: '8.8.8.8' },
            headers: { Key: key, Accept: 'application/json' },
            timeout: 10000,
            validateStatus: () => true,
          });
          ok = r.status === 200;
          if (!ok) message = `HTTP ${r.status}`;
          break;
        }
        case 'shodan': {
          const r = await axios.get(`https://api.shodan.io/api-info?key=${encodeURIComponent(key)}`, {
            timeout: 10000,
            validateStatus: () => true,
          });
          ok = r.status === 200;
          if (!ok) message = `HTTP ${r.status}`;
          break;
        }
        case 'otx': {
          const r = await axios.get('https://otx.alienvault.com/api/v1/user/me', {
            headers: { 'X-OTX-API-KEY': key },
            timeout: 10000,
            validateStatus: () => true,
          });
          ok = r.status === 200;
          if (!ok) message = `HTTP ${r.status}`;
          break;
        }
        default:
          return { status: 'fail', latencyMs: 0, message: 'Unknown service' };
      }
    } catch (error: any) {
      ok = false;
      message = error?.message || 'Request failed';
    }

    const latencyMs = Date.now() - start;
    const status = ok ? 'ok' : 'fail';

    // Persist last test result if a record exists
    await db
      .update(apiKeys)
      .set({ lastTestedAt: new Date(), lastTestStatus: status })
      .where(eq(apiKeys.service, service));

    return { status, latencyMs, message };
  }

  // ---------- Notification preferences ----------
  async getNotificationPrefs(userId: string) {
    const rows = await db.select().from(notificationPrefs).where(eq(notificationPrefs.userId, userId));
    return rows.map((r) => ({ eventType: r.eventType, inApp: r.inApp, email: r.email }));
  }

  async setNotificationPrefs(
    userId: string,
    prefs: Array<{ eventType: string; inApp: boolean; email: boolean }>
  ) {
    // Replace-all strategy for this user
    await db.delete(notificationPrefs).where(eq(notificationPrefs.userId, userId));
    if (prefs.length) {
      await db.insert(notificationPrefs).values(
        prefs.map((p) => ({
          userId,
          eventType: p.eventType,
          inApp: Boolean(p.inApp),
          email: Boolean(p.email),
          updatedAt: new Date(),
        }))
      );
    }
    return this.getNotificationPrefs(userId);
  }
}

export default new SettingsService();
