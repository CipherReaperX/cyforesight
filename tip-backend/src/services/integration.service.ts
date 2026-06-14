import axios from 'axios';
import nodemailer from 'nodemailer';
import { eq, and } from 'drizzle-orm';
import db from '../config/database';
import { integrations } from '../models/schema';
import { emit } from './socket.service';
import logger from '../config/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IntegrationType = 'slack' | 'teams' | 'discord' | 'webhook' | 'email' | 'virustotal';

export interface IntegrationConfig {
  // Slack / Teams / Discord
  webhookUrl?: string;
  // Email
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  smtpTo?: string;
  // VirusTotal
  apiKey?: string;
  // Generic Webhook
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  // Shared
  triggers?: string[]; // feed_sync | feed_error | critical_ioc | high_ioc
}

export interface TestResult {
  success: boolean;
  message: string;
  detail?: unknown;
  durationMs: number;
}

export interface EventPayload {
  type: 'feed_sync' | 'feed_error' | 'critical_ioc' | 'high_ioc' | 'incident' | 'test';
  severity?: string;
  title: string;
  body: string;
  meta?: Record<string, unknown>;
}

// ─── Default definitions ──────────────────────────────────────────────────────

export const INTEGRATION_DEFAULTS: Array<{ type: IntegrationType; name: string; config: IntegrationConfig }> = [
  { type: 'slack',      name: 'Slack',                    config: { triggers: ['feed_error', 'critical_ioc'] } },
  { type: 'teams',      name: 'Microsoft Teams',          config: { triggers: ['feed_error', 'critical_ioc'] } },
  { type: 'discord',    name: 'Discord',                  config: { triggers: ['feed_sync', 'feed_error'] } },
  { type: 'webhook',    name: 'Generic Webhook',          config: { triggers: ['feed_sync', 'feed_error'] } },
  { type: 'email',      name: 'Email Alerts (SMTP)',      config: { triggers: ['critical_ioc', 'feed_error'] } },
  { type: 'virustotal', name: 'VirusTotal Enrichment',   config: { triggers: [] } },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityColor(severity?: string): number {
  if (severity === 'critical') return 0xff0000;
  if (severity === 'high')     return 0xff6600;
  if (severity === 'medium')   return 0xffcc00;
  return 0x3b82f6;
}

function severityHex(severity?: string): string {
  if (severity === 'critical') return 'FF0000';
  if (severity === 'high')     return 'FF6600';
  return '3B82F6';
}

function slackBlocks(payload: EventPayload) {
  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*CyForesight Alert* — ${payload.title}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: payload.body },
    },
    {
      type: 'context',
      elements: [{ type: 'plain_text', text: `Event: ${payload.type} · ${new Date().toISOString()}` }],
    },
  ];
}

function teamsCard(payload: EventPayload) {
  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: severityHex(payload.severity),
    summary: `CyForesight: ${payload.title}`,
    sections: [
      {
        activityTitle: `**CyForesight Alert** — ${payload.title}`,
        activitySubtitle: payload.body,
        facts: [
          { name: 'Event type', value: payload.type },
          { name: 'Time', value: new Date().toISOString() },
          ...(payload.severity ? [{ name: 'Severity', value: payload.severity }] : []),
        ],
      },
    ],
  };
}

function discordEmbed(payload: EventPayload) {
  return {
    embeds: [
      {
        title: `CyForesight: ${payload.title}`,
        description: payload.body,
        color: severityColor(payload.severity),
        timestamp: new Date().toISOString(),
        footer: { text: `CyForesight TIP · ${payload.type}` },
        fields: payload.severity ? [{ name: 'Severity', value: payload.severity, inline: true }] : [],
      },
    ],
  };
}

// ─── Runners per type ─────────────────────────────────────────────────────────

async function runSlack(config: IntegrationConfig, payload: EventPayload): Promise<void> {
  if (!config.webhookUrl) throw new Error('Slack webhook URL not configured');
  await axios.post(config.webhookUrl, { text: `CyForesight: ${payload.title}`, blocks: slackBlocks(payload) }, { timeout: 8000 });
}

async function testSlack(config: IntegrationConfig): Promise<TestResult> {
  const t0 = Date.now();
  if (!config.webhookUrl) return { success: false, message: 'Webhook URL not configured', durationMs: 0 };
  try {
    await runSlack(config, {
      type: 'test', title: 'Test alert', body: '✅ CyForesight Slack integration is working correctly.',
    });
    return { success: true, message: 'Slack message delivered successfully', durationMs: Date.now() - t0 };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Slack delivery failed', durationMs: Date.now() - t0 };
  }
}

async function runTeams(config: IntegrationConfig, payload: EventPayload): Promise<void> {
  if (!config.webhookUrl) throw new Error('Teams webhook URL not configured');
  await axios.post(config.webhookUrl, teamsCard(payload), { timeout: 8000 });
}

async function testTeams(config: IntegrationConfig): Promise<TestResult> {
  const t0 = Date.now();
  if (!config.webhookUrl) return { success: false, message: 'Webhook URL not configured', durationMs: 0 };
  try {
    await runTeams(config, { type: 'test', title: 'Test alert', body: '✅ CyForesight Teams integration is working correctly.' });
    return { success: true, message: 'Teams card delivered successfully', durationMs: Date.now() - t0 };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Teams delivery failed', durationMs: Date.now() - t0 };
  }
}

async function runDiscord(config: IntegrationConfig, payload: EventPayload): Promise<void> {
  if (!config.webhookUrl) throw new Error('Discord webhook URL not configured');
  await axios.post(config.webhookUrl, discordEmbed(payload), { timeout: 8000 });
}

async function testDiscord(config: IntegrationConfig): Promise<TestResult> {
  const t0 = Date.now();
  if (!config.webhookUrl) return { success: false, message: 'Webhook URL not configured', durationMs: 0 };
  try {
    await runDiscord(config, { type: 'test', title: 'Test alert', body: '✅ CyForesight Discord integration is working correctly.' });
    return { success: true, message: 'Discord embed delivered successfully', durationMs: Date.now() - t0 };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Discord delivery failed', durationMs: Date.now() - t0 };
  }
}

async function runWebhook(config: IntegrationConfig, payload: EventPayload): Promise<void> {
  if (!config.url) throw new Error('Webhook URL not configured');
  const method = (config.method || 'POST').toUpperCase();
  await axios.request({
    url: config.url,
    method,
    headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
    data: { source: 'cyforesight', event: payload, ts: new Date().toISOString() },
    timeout: 8000,
  });
}

async function testWebhook(config: IntegrationConfig): Promise<TestResult> {
  const t0 = Date.now();
  if (!config.url) return { success: false, message: 'Webhook URL not configured', durationMs: 0 };
  try {
    const res = await axios.request({
      url: config.url,
      method: config.method || 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
      data: { source: 'cyforesight', event: { type: 'test', title: 'Test', body: 'CyForesight webhook test' }, ts: new Date().toISOString() },
      timeout: 8000,
      validateStatus: () => true,
    });
    const ok = res.status >= 200 && res.status < 300;
    return {
      success: ok,
      message: ok ? `HTTP ${res.status} — webhook delivered` : `HTTP ${res.status} — server returned error`,
      detail: { status: res.status },
      durationMs: Date.now() - t0,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Webhook failed', durationMs: Date.now() - t0 };
  }
}

async function runEmail(config: IntegrationConfig, payload: EventPayload): Promise<void> {
  if (!config.smtpHost || !config.smtpTo) throw new Error('SMTP host and recipient not configured');
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: Number(config.smtpPort || 587),
    secure: Boolean(config.smtpSecure ?? false),
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass || '' } : undefined,
  });
  await transporter.sendMail({
    from: config.smtpFrom || 'alerts@cyforesight.local',
    to: config.smtpTo,
    subject: `[CyForesight] ${payload.title}`,
    text: `${payload.title}\n\n${payload.body}\n\nEvent: ${payload.type}\nTime: ${new Date().toISOString()}`,
    html: `<div style="font-family:sans-serif;max-width:600px">
      <h2 style="color:#ef4444">🛡️ CyForesight Alert</h2>
      <h3>${payload.title}</h3>
      <p>${payload.body}</p>
      <hr/>
      <small>Event: ${payload.type} · ${new Date().toISOString()}</small>
    </div>`,
  });
}

async function testEmail(config: IntegrationConfig): Promise<TestResult> {
  const t0 = Date.now();
  if (!config.smtpHost || !config.smtpTo) return { success: false, message: 'SMTP host and recipient required', durationMs: 0 };
  try {
    await runEmail(config, { type: 'test', title: 'CyForesight test email', body: 'SMTP integration is working correctly.' });
    return { success: true, message: `Test email sent to ${config.smtpTo}`, durationMs: Date.now() - t0 };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Email delivery failed', durationMs: Date.now() - t0 };
  }
}

async function testVirusTotal(config: IntegrationConfig): Promise<TestResult> {
  const t0 = Date.now();
  const key = config.apiKey || process.env.VIRUSTOTAL_API_KEY || '';
  if (!key) return { success: false, message: 'VirusTotal API key not configured', durationMs: 0 };
  try {
    // Test with EICAR hash — always present in VT, safe to look up
    const res = await axios.get(
      'https://www.virustotal.com/api/v3/files/275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f',
      { headers: { 'x-apikey': key }, timeout: 10000 }
    );
    const stats = res.data?.data?.attributes?.last_analysis_stats;
    return {
      success: true,
      message: `API key valid — EICAR: ${stats?.malicious ?? '?'} engines detect as malicious`,
      detail: stats,
      durationMs: Date.now() - t0,
    };
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 403) return { success: false, message: 'Invalid or expired API key (HTTP 403)', durationMs: Date.now() - t0 };
    if (status === 429) return { success: false, message: 'Rate limit exceeded — try again later', durationMs: Date.now() - t0 };
    return { success: false, message: e?.message || 'VirusTotal API error', durationMs: Date.now() - t0 };
  }
}

export async function lookupVirusTotal(iocValue: string, iocType: string, apiKey?: string): Promise<unknown> {
  const key = apiKey || process.env.VIRUSTOTAL_API_KEY || '';
  if (!key) throw new Error('VirusTotal API key not configured');
  const endpoint =
    iocType === 'ip' ? `https://www.virustotal.com/api/v3/ip_addresses/${encodeURIComponent(iocValue)}`
    : iocType === 'domain' ? `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(iocValue)}`
    : iocType === 'url' ? `https://www.virustotal.com/api/v3/urls/${Buffer.from(iocValue).toString('base64url')}`
    : `https://www.virustotal.com/api/v3/files/${encodeURIComponent(iocValue)}`;
  const res = await axios.get(endpoint, { headers: { 'x-apikey': key }, timeout: 12000 });
  return res.data?.data?.attributes ?? res.data;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function ensureDefaults(): Promise<void> {
  const existing = await db.select({ name: integrations.name }).from(integrations);
  const existingNames = new Set(existing.map(r => r.name));
  const missing = INTEGRATION_DEFAULTS.filter(d => !existingNames.has(d.name));
  if (missing.length > 0) {
    await db.insert(integrations).values(
      missing.map(d => ({ type: d.type, name: d.name, config: d.config, enabled: false, status: 'not_configured' }))
    );
  }
}

export async function list() {
  await ensureDefaults();
  return db.select().from(integrations).orderBy(integrations.createdAt);
}

export async function getById(id: string) {
  const [row] = await db.select().from(integrations).where(eq(integrations.id, id));
  if (!row) throw new Error('Integration not found');
  return row;
}

export async function updateConfig(id: string, config: IntegrationConfig) {
  const row = await getById(id);
  const merged = { ...(row.config as object), ...config };
  const isConfigured = isIntegrationConfigured(row.type as IntegrationType, merged as IntegrationConfig);
  const [updated] = await db.update(integrations)
    .set({ config: merged, status: isConfigured ? 'configured' : 'not_configured', updatedAt: new Date() })
    .where(eq(integrations.id, id))
    .returning();
  emit('integration:update', updated);
  return updated;
}

export async function setEnabled(id: string, enabled: boolean) {
  const [updated] = await db.update(integrations)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(integrations.id, id))
    .returning();
  emit('integration:update', updated);
  return updated;
}

export async function testIntegration(id: string): Promise<TestResult & { integration: unknown }> {
  const row = await getById(id);
  const config = row.config as IntegrationConfig;
  let result: TestResult;

  try {
    switch (row.type) {
      case 'slack':      result = await testSlack(config);       break;
      case 'teams':      result = await testTeams(config);       break;
      case 'discord':    result = await testDiscord(config);     break;
      case 'webhook':    result = await testWebhook(config);     break;
      case 'email':      result = await testEmail(config);       break;
      case 'virustotal': result = await testVirusTotal(config);  break;
      default: result = { success: false, message: `Unknown type: ${row.type}`, durationMs: 0 };
    }
  } catch (e: any) {
    result = { success: false, message: e?.message || 'Test failed', durationMs: 0 };
  }

  const newStatus = result.success ? 'connected' : 'error';
  const [updated] = await db.update(integrations)
    .set({
      status: newStatus,
      lastUsed: new Date(),
      lastResult: result as any,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, id))
    .returning();
  emit('integration:update', updated);
  return { ...result, integration: updated };
}

export async function dispatchEvent(eventType: EventPayload['type'], payload: EventPayload): Promise<void> {
  const enabled = await db.select().from(integrations).where(eq(integrations.enabled, true));
  await Promise.allSettled(
    enabled.map(async (row) => {
      const config = row.config as IntegrationConfig;
      const triggers = config.triggers ?? [];
      if (!triggers.includes(eventType)) return;
      try {
        switch (row.type) {
          case 'slack':   await runSlack(row.type === 'slack' ? config : config, payload);   break;
          case 'teams':   await runTeams(config, payload);   break;
          case 'discord': await runDiscord(config, payload); break;
          case 'webhook': await runWebhook(config, payload); break;
          case 'email':   await runEmail(config, payload);   break;
          // virustotal is pull-based, skip event dispatch
        }
        await db.update(integrations)
          .set({ lastUsed: new Date(), status: 'connected', lastResult: { success: true, sentAt: new Date().toISOString() } as any, updatedAt: new Date() })
          .where(eq(integrations.id, row.id));
        emit('integration:update', { ...row, lastUsed: new Date(), status: 'connected' });
      } catch (e: any) {
        logger.warn(`Integration dispatch failed [${row.name}]: ${e?.message}`);
        await db.update(integrations)
          .set({ status: 'error', lastResult: { success: false, error: e?.message } as any, updatedAt: new Date() })
          .where(eq(integrations.id, row.id));
        emit('integration:update', { ...row, status: 'error' });
      }
    })
  );
}

function isIntegrationConfigured(type: IntegrationType, config: IntegrationConfig): boolean {
  switch (type) {
    case 'slack':
    case 'teams':
    case 'discord':    return !!config.webhookUrl;
    case 'webhook':    return !!config.url;
    case 'email':      return !!(config.smtpHost && config.smtpTo);
    case 'virustotal': return !!(config.apiKey || process.env.VIRUSTOTAL_API_KEY);
    default: return false;
  }
}
