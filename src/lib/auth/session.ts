import 'server-only';

import { cache } from 'react';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';

import { prisma } from '@/lib/db';
import {
  requireAuthenticated,
  requireInstitutionId,
  requirePermission as assertPermission,
  requirePlatformAdmin as assertPlatformAdmin,
  requireRole as assertRole,
} from '@/lib/auth/authorization';
import { isRoleKey, type Permission, type RoleKey } from '@/lib/auth/permissions';
import type { AuthContext, TenantSummary } from '@/lib/auth/types';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { serverEnv } from '@/lib/env';

/**
 * Native application session and authentication backed by PostgreSQL and Prisma.
 *
 * Session tokens are generated using cryptographically secure randomness.
 * Only the SHA-256 hash of the session token is persisted to the database.
 * The raw token is delivered exclusively via an HttpOnly, SameSite=Lax cookie.
 */

export const SESSION_COOKIE_NAME = 'campusos_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

// Dummy Argon2id hash for constant-time failure response when a user is not found.
const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQxMjM0NTY3OA$qR3JvH2M+9/lW8p5v0qW9vJ6y6Y4oX7r2k9q8p7t6u8';

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getSessionCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: expiresAt ?? new Date(Date.now() + SESSION_MAX_AGE_MS),
  };
}

export type UserWithRoles = Awaited<ReturnType<typeof loadUserById>>;

export async function loadUserById(id: string) {
  return prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      institution: true,
      userRoles: {
        include: {
          role: {
            include: { rolePermissions: { include: { permission: true } } },
          },
        },
      },
    },
  });
}

async function loadUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
    include: {
      institution: true,
      userRoles: {
        include: {
          role: {
            include: { rolePermissions: { include: { permission: true } } },
          },
        },
      },
    },
  });
}

function toTenantSummary(
  institution: NonNullable<NonNullable<UserWithRoles>['institution']>,
): TenantSummary {
  return {
    id: institution.id,
    slug: institution.slug,
    name: institution.name,
    shortName: institution.shortName,
    status: institution.status,
    currency: institution.currency,
    timezone: institution.timezone,
  };
}

export function toAuthContext(user: NonNullable<UserWithRoles>): AuthContext {
  const roleKeys: RoleKey[] = [];
  const permissions = new Set<Permission>();

  for (const assignment of user.userRoles) {
    // Institution-scoped role assignments must match the user's tenant.
    if (assignment.institutionId && assignment.institutionId !== user.institutionId) continue;
    if (isRoleKey(assignment.role.key)) roleKeys.push(assignment.role.key);
    for (const grant of assignment.role.rolePermissions) {
      permissions.add(grant.permission.key as Permission);
    }
  }

  return {
    userId: user.id,
    authUserId: user.authUserId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isPlatformAdmin: user.isPlatformAdmin,
    institutionId: user.institutionId,
    institution: user.institution ? toTenantSummary(user.institution) : null,
    roleKeys,
    permissions,
  };
}

/**
 * Verifies email and password against active database users.
 * Returns the matching User record if valid, or null otherwise.
 */
export async function authenticateUser(
  email: string,
  password: string,
): Promise<UserWithRoles | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    await verifyPassword(password || 'dummy', DUMMY_HASH);
    return null;
  }

  const users = await prisma.user.findMany({
    where: {
      email: { equals: normalizedEmail, mode: 'insensitive' },
      deletedAt: null,
    },
    include: {
      institution: true,
      userRoles: {
        include: {
          role: {
            include: { rolePermissions: { include: { permission: true } } },
          },
        },
      },
    },
  });

  if (users.length === 0) {
    await verifyPassword(password, DUMMY_HASH);
    return null;
  }

  for (const user of users) {
    if (!user.passwordHash) continue;
    const isValid = await verifyPassword(password, user.passwordHash);
    if (isValid) {
      if (user.status !== 'ACTIVE') {
        return null;
      }
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
        include: {
          institution: true,
          userRoles: {
            include: {
              role: {
                include: { rolePermissions: { include: { permission: true } } },
              },
            },
          },
        },
      });
      return updatedUser;
    }
  }

  return null;
}

export interface SessionWithUser {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user: NonNullable<UserWithRoles>;
}

/**
 * Creates a database session record and sets the HttpOnly session cookie.
 */
export async function createSession(
  userId: string,
): Promise<{ session: { id: string; userId: string; tokenHash: string; expiresAt: Date }; token: string }> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expiresAt));
  } catch {
    // Cannot set cookie in contexts without response headers (e.g. some Server Components).
  }

  return { session, token };
}

/**
 * Retrieves the active session from request cookies and validates it against the database.
 * If expired, revokes the session and returns null.
 */
export async function getCurrentSession(): Promise<SessionWithUser | null> {
  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return null;
  }

  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          institution: true,
          userRoles: {
            include: {
              role: {
                include: { rolePermissions: { include: { permission: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!session) return null;

  // Revoke expired sessions
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Reject inactive / deleted users
  if (!session.user || session.user.deletedAt !== null || session.user.status !== 'ACTIVE') {
    return null;
  }

  return session as SessionWithUser;
}

/**
 * Development-only impersonation used when CAMPUSOS_DEV_LOGIN_EMAIL is set.
 * It is hard-disabled in production builds.
 */
async function devFallbackUser(): Promise<UserWithRoles | null> {
  const email = process.env.CAMPUSOS_DEV_LOGIN_EMAIL;
  if (!email) return null;
  if (serverEnv().NODE_ENV === 'production') return null;
  return loadUserByEmail(email);
}

async function resolveAuthContext(): Promise<AuthContext | null> {
  const session = await getCurrentSession();
  if (session) {
    return toAuthContext(session.user);
  }

  const fallback = await devFallbackUser();
  return fallback && fallback.status === 'ACTIVE' ? toAuthContext(fallback) : null;
}

/** Memoised for the lifetime of a single server request. */
export const getCurrentUser = cache(async (): Promise<AuthContext | null> => resolveAuthContext());

/** The tenant the session belongs to, or null for platform administrators. */
export async function getCurrentInstitution(): Promise<TenantSummary | null> {
  const context = await getCurrentUser();
  return context?.institution ?? null;
}

export async function requireUser(): Promise<AuthContext> {
  const context = await getCurrentUser();
  requireAuthenticated(context);
  return context;
}

export async function requirePermission(...permissions: readonly Permission[]): Promise<AuthContext> {
  const context = await getCurrentUser();
  assertPermission(context, ...permissions);
  return context;
}

export async function requireRole(...roles: readonly RoleKey[]): Promise<AuthContext> {
  const context = await getCurrentUser();
  assertRole(context, ...roles);
  return context;
}

export async function requirePlatformAdmin(): Promise<AuthContext> {
  const context = await getCurrentUser();
  assertPlatformAdmin(context);
  return context;
}

/** Convenience for tenant-scoped queries: `where: { institutionId: await requireInstitution() }`. */
export async function requireInstitution(): Promise<string> {
  const context = await getCurrentUser();
  return requireInstitutionId(context);
}

/**
 * Logs out the current session by revoking the database session record and clearing the cookie.
 */
export async function logout(): Promise<void> {
  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // Ignore cookie store errors if outside request context
  }

  if (token) {
    const tokenHash = hashSessionToken(token);
    await prisma.session.deleteMany({ where: { tokenHash } }).catch(() => {});
  }
}

/**
 * Revokes all active sessions for the specified user.
 */
export async function logoutAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } }).catch(() => {});
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // Ignore outside request context
  }
}

/**
 * Changes password for an authenticated user after verifying their current password.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt !== null) {
    return false;
  }

  if (user.passwordHash) {
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return false;
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  return true;
}
