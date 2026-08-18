import { describe, expect, it } from 'vitest';

import { DomainError } from '@/lib/auth/errors';
import {
  accessTokenMatches,
  generateAccessToken,
  generateApplicationReference,
  generateStudentNumber,
  hashAccessToken,
} from '@/server/admissions/references';
import {
  APPLICATION_TRANSITIONS,
  assertTransition,
  canTransition,
  isTerminalStatus,
} from '@/server/admissions/workflow';
import { signDocumentAccess, verifyDocumentAccess } from '@/server/documents/storage';

describe('application status transitions', () => {
  it('allows the happy path from draft to accepted', () => {
    expect(canTransition('DRAFT', 'SUBMITTED')).toBe(true);
    expect(canTransition('SUBMITTED', 'UNDER_REVIEW')).toBe(true);
    expect(canTransition('UNDER_REVIEW', 'OFFERED')).toBe(true);
    expect(canTransition('OFFERED', 'ACCEPTED')).toBe(true);
  });

  it('allows rejection from review or offer', () => {
    expect(canTransition('UNDER_REVIEW', 'REJECTED')).toBe(true);
    expect(canTransition('OFFERED', 'REJECTED')).toBe(true);
    expect(canTransition('SUBMITTED', 'REJECTED')).toBe(false);
    expect(canTransition('DRAFT', 'REJECTED')).toBe(false);
  });

  it('allows withdrawal until a terminal decision', () => {
    expect(canTransition('DRAFT', 'WITHDRAWN')).toBe(true);
    expect(canTransition('SUBMITTED', 'WITHDRAWN')).toBe(true);
    expect(canTransition('UNDER_REVIEW', 'WITHDRAWN')).toBe(true);
    expect(canTransition('OFFERED', 'WITHDRAWN')).toBe(true);
    expect(canTransition('ACCEPTED', 'WITHDRAWN')).toBe(false);
  });

  it('forbids skipping review or offering from draft', () => {
    expect(canTransition('DRAFT', 'UNDER_REVIEW')).toBe(false);
    expect(canTransition('DRAFT', 'OFFERED')).toBe(false);
    expect(canTransition('SUBMITTED', 'OFFERED')).toBe(false);
    expect(canTransition('SUBMITTED', 'ACCEPTED')).toBe(false);
  });

  it('treats accepted, rejected and withdrawn as terminal', () => {
    expect(isTerminalStatus('ACCEPTED')).toBe(true);
    expect(isTerminalStatus('REJECTED')).toBe(true);
    expect(isTerminalStatus('WITHDRAWN')).toBe(true);
    expect(isTerminalStatus('OFFERED')).toBe(false);
    expect(APPLICATION_TRANSITIONS.ACCEPTED).toEqual([]);
    expect(APPLICATION_TRANSITIONS.REJECTED).toEqual([]);
    expect(APPLICATION_TRANSITIONS.WITHDRAWN).toEqual([]);
  });

  it('throws a domain error for an illegal transition', () => {
    expect(() => assertTransition('DRAFT', 'OFFERED')).toThrow(DomainError);
    expect(() => assertTransition('UNDER_REVIEW', 'OFFERED')).not.toThrow();
  });
});

describe('application references and tokens', () => {
  it('generates a non-sequential APP-YEAR- suffix reference', () => {
    const reference = generateApplicationReference(new Date('2026-08-18T00:00:00Z'));
    expect(reference).toMatch(/^APP-2026-[A-Z2-9]{6}$/);
  });

  it('does not emit sequential references', () => {
    const first = generateApplicationReference();
    const second = generateApplicationReference();
    expect(first).not.toBe(second);
  });

  it('hashes access tokens and compares them in constant time', () => {
    const token = generateAccessToken();
    const hash = hashAccessToken(token);
    expect(hash).toHaveLength(64);
    expect(accessTokenMatches(token, hash)).toBe(true);
    expect(accessTokenMatches('0'.repeat(token.length), hash)).toBe(false);
  });

  it('rejects a token whose hash length does not match', () => {
    expect(accessTokenMatches('abc', 'deadbeef')).toBe(false);
  });

  it('builds a tenant-prefixed student number', () => {
    const number = generateStudentNumber('Demo College', new Date('2026-09-01T00:00:00Z'));
    expect(number).toMatch(/^DEMO\/2026\/\d{4}$/);
  });

  it('falls back to STU when the prefix has no letters', () => {
    const number = generateStudentNumber('---', new Date('2026-09-01T00:00:00Z'));
    expect(number).toMatch(/^STU\/2026\/\d{4}$/);
  });

  it('emits distinct access tokens', () => {
    expect(generateAccessToken()).not.toBe(generateAccessToken());
  });
});

describe('signed document URLs', () => {
  it('round-trips a valid token', () => {
    const token = signDocumentAccess('11111111-1111-4111-8111-111111111111', 60);
    const verified = verifyDocumentAccess(token);
    expect(verified?.documentId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('rejects a tampered token', () => {
    const token = signDocumentAccess('11111111-1111-4111-8111-111111111111', 60);
    expect(verifyDocumentAccess(`${token}x`)).toBeNull();
    expect(verifyDocumentAccess('not-a-token')).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = signDocumentAccess('11111111-1111-4111-8111-111111111111', -10);
    expect(verifyDocumentAccess(token)).toBeNull();
  });
});
