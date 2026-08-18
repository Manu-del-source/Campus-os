import 'server-only';

import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/audit';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { randomToken, sha256Hex } from '@/lib/auth/crypto';
import { SESSION_TTL_MS } from '@/lib/auth/constants';

const GENERIC_AUTH_FAILURE = 'Those credentials did not match an active account.';
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export class AuthenticationFailedError extends Error {
  constructor() {
    super(GENERIC_AUTH_FAILURE);
    this.name = 'AuthenticationFailedError';
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  institutionId: string | null;
  isPlatformAdmin: boolean;
  status: string;
}

/**
 * Resolve a login identity. Institution id is never taken from the browser —
 * it comes from the user row. An optional institution slug disambiguates the
 * rare case of the same email existing in two tenants.
 */
export async function findLoginUser(
  email: string,
  institutionSlug?: string | null,
): Promise<AuthenticatedUser | null> {
  const normalised = email.trim().toLowerCase();

  const users = await prisma.user.findMany({
    where: {
      email: { equals: normalised, mode: 'insensitive' },
      deletedAt: null,
      ...(institutionSlug
        ? { institution: { slug: institutionSlug } }
        : {}),
    },
    select: {
      id: true,
      email: true,
      institutionId: true,
      isPlatformAdmin: true,
      status: true,
    },
    take: 3,
  });

  if (users.length !== 1) return null;
  return users[0];
}

export async function authenticateWithPassword(
  email: string,
  password: string,
  institutionSlug?: string | null,
): Promise<AuthenticatedUser> {
  const user = await findLoginUser(email, institutionSlug);
  const record = user
    ? await prisma.user.findFirst({
        where: { id: user.id, deletedAt: null },
        select: { id: true, email: true, institutionId: true, isPlatformAdmin: true, status: true, passwordHash: true },
      })
    : null;

  // Dummy verify when the account is missing so timing does not leak existence.
  const hash = record?.passwordHash ?? 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const matches = await verifyPassword(password, hash);

  if (!record || !record.passwordHash || !matches || record.status !== 'ACTIVE') {
    await recordAudit(null, {
      action: 'auth.login_failed',
      entityType: 'User',
      entityId: record?.id ?? null,
      institutionId: record?.institutionId ?? null,
      summary: 'Failed sign-in attempt',
      metadata: { email: email.trim().toLowerCase() },
    });
    throw new AuthenticationFailedError();
  }

  return {
    id: record.id,
    email: record.email,
    institutionId: record.institutionId,
    isPlatformAdmin: record.isPlatformAdmin,
    status: record.status,
  };
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256Hex(token),
      expiresAt,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  return { token, expiresAt };
}

export async function revokeSessionByToken(token: string | null): Promise<void> {
  if (!token) return;
  await prisma.session.updateMany({
    where: { tokenHash: sha256Hex(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function issuePasswordResetToken(userId: string): Promise<string> {
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomToken(32);
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  return token;
}

export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256Hex(token) },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  await prisma.passwordResetToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return row.userId;
}

export const AUTH_GENERIC_FAILURE = GENERIC_AUTH_FAILURE;
export const PASSWORD_RESET_TTL_MS = RESET_TOKEN_TTL_MS;
