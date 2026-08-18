import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Non-sequential, collision-resistant public reference: APP-2026-K7M2QX. */
export function generateApplicationReference(now = new Date()): string {
  const year = now.getUTCFullYear();
  const bytes = randomBytes(6);
  let suffix = '';
  for (const byte of bytes) {
    suffix += ALPHABET[byte % ALPHABET.length];
  }
  return `APP-${year}-${suffix}`;
}

export function generateAccessToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function accessTokenMatches(token: string, hash: string): boolean {
  const digest = hashAccessToken(token);
  if (digest.length !== hash.length) return false;
  return timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(hash, 'hex'));
}

/** Sequential-looking student numbers are still tenant-scoped; the suffix is random. */
export function generateStudentNumber(prefix: string, now = new Date()): string {
  const year = now.getUTCFullYear();
  const bytes = randomBytes(3);
  let suffix = '';
  for (const byte of bytes) {
    suffix += String(byte % 10);
  }
  const cleanPrefix = prefix.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase() || 'STU';
  return `${cleanPrefix}/${year}/${suffix.padStart(4, '0')}`;
}
