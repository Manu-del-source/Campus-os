import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('password hashing and verification (Argon2id)', () => {
  it('hashes a plaintext password into a valid Argon2id hash', async () => {
    const password = 'CorrectHorseBatteryStaple123!';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(hash).not.toContain(password);
  });

  it('generates distinct hashes with unique salts for identical passwords', async () => {
    const password = 'SamePassword456!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });

  it('successfully verifies the correct password', async () => {
    const password = 'DemoPrincipal123!';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const password = 'DemoPrincipal123!';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword('WrongPassword123!', hash);
    expect(isValid).toBe(false);
  });

  it('safely handles empty, null, or undefined password inputs without throwing', async () => {
    const hash = await hashPassword('ValidPass123!');

    expect(await verifyPassword('', hash)).toBe(false);
    expect(await verifyPassword(null as unknown as string, hash)).toBe(false);
    expect(await verifyPassword(undefined as unknown as string, hash)).toBe(false);
  });

  it('safely handles malformed, null, or undefined hash inputs without throwing', async () => {
    expect(await verifyPassword('ValidPass123!', '')).toBe(false);
    expect(await verifyPassword('ValidPass123!', 'invalid-hash')).toBe(false);
    expect(await verifyPassword('ValidPass123!', null)).toBe(false);
    expect(await verifyPassword('ValidPass123!', undefined)).toBe(false);
    expect(await verifyPassword('ValidPass123!', '$argon2id$v=19$m=0,t=0,p=0$bad$bad')).toBe(false);
  });

  it('throws when attempting to hash an empty password', async () => {
    await expect(hashPassword('')).rejects.toThrow();
  });
});
