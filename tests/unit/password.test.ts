import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { consumeRateLimit, resetRateLimitStore } from '@/lib/auth/rate-limit';
import { sha256Hex } from '@/lib/auth/crypto';

describe('password hashing', () => {
  it('hashes and verifies a password without storing plaintext', async () => {
    const password = 'CampusOS-Dev-Only-2026!';
    const hash = await hashPassword(password);
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('wrong-password-xx', hash)).toBe(false);
  });

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('anything-long', 'not-a-hash')).toBe(false);
  });
});

describe('rate limiting', () => {
  it('blocks after the configured number of attempts', () => {
    resetRateLimitStore();
    const now = 1_700_000_000_000;
    for (let i = 0; i < 3; i += 1) {
      expect(consumeRateLimit('login:test', 3, 60_000, now + i).allowed).toBe(true);
    }
    expect(consumeRateLimit('login:test', 3, 60_000, now + 4).allowed).toBe(false);
  });
});

describe('token hashing', () => {
  it('is deterministic and not reversible to the raw token', () => {
    const token = 'raw-session-token';
    expect(sha256Hex(token)).toHaveLength(64);
    expect(sha256Hex(token)).toBe(sha256Hex(token));
    expect(sha256Hex(token)).not.toBe(token);
  });
});
