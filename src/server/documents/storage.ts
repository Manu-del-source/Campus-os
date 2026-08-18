import 'server-only';

import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Local-disk object storage adapter.
 *
 * Production deployments point this at a bucket via `DOCUMENT_STORAGE_DIR`
 * (or swap the adapter). Bytes never enter PostgreSQL; only `storageKey`,
 * checksum and metadata do. Downloads are issued as short-lived HMAC URLs
 * after a server-side permission check.
 */
const DEFAULT_DIR = path.join(process.cwd(), '.data', 'documents');

function storageRoot(): string {
  return process.env.DOCUMENT_STORAGE_DIR || DEFAULT_DIR;
}

function signingSecret(): string {
  return process.env.DOCUMENT_SIGNING_SECRET || process.env.DATABASE_URL || 'campusos-dev-document-secret';
}

export function checksumBuffer(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function putDocumentObject(institutionId: string, bytes: Buffer): Promise<{
  storageKey: string;
  checksum: string;
  byteSize: number;
}> {
  const key = `${institutionId}/${randomBytes(16).toString('hex')}`;
  const fullPath = path.join(storageRoot(), key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, bytes);
  return { storageKey: key, checksum: checksumBuffer(bytes), byteSize: bytes.byteLength };
}

export async function getDocumentObject(storageKey: string): Promise<Buffer> {
  return readFile(path.join(storageRoot(), storageKey));
}

export interface SignedDocumentToken {
  documentId: string;
  expiresAt: number;
}

export function signDocumentAccess(documentId: string, ttlSeconds = 300): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${documentId}.${expiresAt}`;
  const signature = createHmac('sha256', signingSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

export function verifyDocumentAccess(token: string): SignedDocumentToken | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [documentId, expiresRaw, signature] = decoded.split('.');
    if (!documentId || !expiresRaw || !signature) return null;

    const expiresAt = Number(expiresRaw);
    if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null;

    const expected = createHmac('sha256', signingSecret()).update(`${documentId}.${expiresAt}`).digest('hex');
    if (expected.length !== signature.length) return null;
    if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))) return null;

    return { documentId, expiresAt };
  } catch {
    return null;
  }
}
