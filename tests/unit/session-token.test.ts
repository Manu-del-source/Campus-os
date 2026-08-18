import { describe, expect, it } from 'vitest';
import {
  generateSessionToken,
  hashSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth/session';

describe('session token generation and hashing', () => {
  it('generates a 64-character hex cryptographically random token', () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).toMatch(/^[a-f0-9]{64}$/);
    expect(token1).not.toBe(token2);
  });

  it('produces a deterministic SHA-256 hash for a given token', () => {
    const token = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    const hash1 = hashSessionToken(token);
    const hash2 = hashSessionToken(token);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).not.toBe(token);
  });

  it('provides secure cookie options with HttpOnly, SameSite=Lax', () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const options = getSessionCookieOptions(expiresAt);

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/');
    expect(options.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
    expect(options.expires).toEqual(expiresAt);
    expect(SESSION_COOKIE_NAME).toBe('campusos_session');
  });
});
