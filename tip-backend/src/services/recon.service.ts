import dns from 'dns/promises';
import tls from 'tls';
import whoisService from '../engines/recon/whois.service';
import geoipService from '../engines/recon/geoip.service';

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

const BLOCKED_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^0\./,
  /^::1$/,
  /^f[cd][0-9a-f]{2}:/i,
  /^fe80:/i,
  /^::ffff:127\./i,
  /^::ffff:10\./i,
  /^::ffff:192\.168\./i,
  /^::ffff:169\.254\./i,
];

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

function assertNotPrivate(target: string): void {
  const lower = target.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) throw new Error(`Blocked target: ${target}`);
  if (BLOCKED_IP_RANGES.some((re) => re.test(lower)))
    throw new Error(`Blocked private/reserved address: ${target}`);
}

function normalizeDomain(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase();
}

function normalizeIP(input: string): string {
  return input.trim();
}

function isIPAddress(input: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(input.trim());
}

// Resolves `host` and returns an IP address that has been checked against
// BLOCKED_IP_RANGES. Callers must connect to this resolved IP directly
// (not re-resolve `host` at connect time) so a DNS answer can't change
// between the check and the connection (DNS-rebinding SSRF).
async function resolvePinnedIP(host: string): Promise<string> {
  if (isIPAddress(host)) {
    assertNotPrivate(host);
    return host;
  }

  const v4 = await withTimeout(dns.resolve4(host), 5000, 'DNS resolution timed out').catch(() => [] as string[]);
  const v6 = v4.length ? [] : await withTimeout(dns.resolve6(host), 5000, 'DNS resolution timed out').catch(() => [] as string[]);
  const candidates = [...v4, ...v6];

  if (!candidates.length) throw new Error(`Could not resolve host: ${host}`);
  for (const ip of candidates) assertNotPrivate(ip);

  return candidates[0];
}

export class ReconService {
  async whoisLookup(query: string) {
    const domain = normalizeDomain(query);
    assertNotPrivate(domain);
    const result = await withTimeout(whoisService.lookup(domain), 12000, 'WHOIS lookup timed out');
    return { query: domain, result };
  }

  async dnsLookup(query: string) {
    const target = query.trim();
    if (!target) throw new Error('Query is required');

    const isIP = isIPAddress(target);
    const domain = normalizeDomain(target);
    assertNotPrivate(isIP ? target : domain);

    if (isIP) {
      const ptr = await withTimeout(dns.reverse(target), 10000, 'Reverse DNS lookup timed out').catch(() => [] as string[]);
      return {
        query: target,
        type: 'ip',
        result: {
          ptr,
        },
      };
    }

    const [a, aaaa, mx, ns, txt, cname] = await Promise.all([
      withTimeout(dns.resolve4(domain), 10000, 'A lookup timed out').catch(() => [] as string[]),
      withTimeout(dns.resolve6(domain), 10000, 'AAAA lookup timed out').catch(() => [] as string[]),
      withTimeout(dns.resolveMx(domain), 10000, 'MX lookup timed out').catch(() => [] as Array<{ exchange: string; priority: number }>),
      withTimeout(dns.resolveNs(domain), 10000, 'NS lookup timed out').catch(() => [] as string[]),
      withTimeout(dns.resolveTxt(domain), 10000, 'TXT lookup timed out').catch(() => [] as string[][]),
      withTimeout(dns.resolveCname(domain), 10000, 'CNAME lookup timed out').catch(() => [] as string[]),
    ]);

    return {
      query: domain,
      type: 'domain',
      result: {
        a,
        aaaa,
        mx,
        ns,
        txt: txt.map((entry) => entry.join('')),
        cname,
      },
    };
  }

  async geoipLookup(query: string) {
    const ip = normalizeIP(query);
    const normalized = isIPAddress(ip) ? ip : normalizeDomain(ip);
    assertNotPrivate(normalized);
    const result = geoipService.lookup(ip);
    return {
      query: ip,
      result,
    };
  }

  async sslLookup(query: string) {
    const host = normalizeDomain(query);
    if (!host) throw new Error('Domain is required for SSL lookup');
    assertNotPrivate(host);
    const pinnedIP = await resolvePinnedIP(host);

    const result = await withTimeout(
      new Promise<any>((resolve, reject) => {
        const socket = tls.connect(
          {
            host: pinnedIP,
            port: 443,
            servername: host,
            rejectUnauthorized: false,
          },
          () => {
            const cert = socket.getPeerCertificate(true);
            const protocol = socket.getProtocol();
            const cipher = socket.getCipher();
            socket.end();

            resolve({
              subject: cert.subject,
              issuer: cert.issuer,
              validFrom: cert.valid_from,
              validTo: cert.valid_to,
              serialNumber: cert.serialNumber,
              fingerprint256: cert.fingerprint256,
              subjectAltName: cert.subjectaltname,
              protocol,
              cipher,
            });
          }
        );

        socket.on('error', (err) => reject(err));
      }),
      12000,
      'SSL lookup timed out'
    );

    return {
      query: host,
      result,
    };
  }
}

export default new ReconService();
