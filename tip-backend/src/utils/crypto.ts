import crypto from 'crypto';

// AES-256-CBC encryption for API keys. Key derived from JWT_SECRET hashed to 32 bytes.
function getKey(): Buffer {
  const secret = process.env.JWT_SECRET || 'cyforesight-default-secret';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  // store as iv:ciphertext (hex)
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(stored: string): string | null {
  try {
    const [ivHex, dataHex] = stored.split(':');
    if (!ivHex || !dataHex) return null;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export function maskKey(raw: string): string {
  if (!raw) return '';
  if (raw.length <= 8) return '****';
  return `${raw.slice(0, 4)}****${raw.slice(-4)}`;
}
