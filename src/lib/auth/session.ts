import 'server-only';

import { cache } from 'react';

import { prisma } from '@/lib/db';
import {
  requireAuthenticated,
  requireInstitutionId,
  requirePermission as assertPermission,
  requirePlatformAdmin as assertPlatformAdmin,
  requireRole as assertRole,
} from '@/lib/auth/authorization';
import { readSessionToken } from '@/lib/auth/cookies';
import { sha256Hex } from '@/lib/auth/crypto';
import { isRoleKey, type Permission, type RoleKey } from '@/lib/auth/permissions';
import type { AuthContext, TenantSummary } from '@/lib/auth/types';

/**
 * Session and tenant resolution.
 *
 * The authenticated identity comes from a first-party session cookie whose
 * hash is looked up in PostgreSQL. Roles, permissions and the active
 * institution are loaded from the same database. A tenant id supplied by the
 * client is never trusted or even read.
 */

type UserWithRoles = Awaited<ReturnType<typeof loadUserById>>;

async function loadUserById(id: string) {
  return prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isPlatformAdmin: true,
      institutionId: true,
      status: true,
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

function toAuthContext(user: NonNullable<UserWithRoles>): AuthContext {
  const roleKeys: RoleKey[] = [];
  const permissions = new Set<Permission>();

  for (const assignment of user.userRoles) {
    if (assignment.institutionId && assignment.institutionId !== user.institutionId) continue;
    if (isRoleKey(assignment.role.key)) roleKeys.push(assignment.role.key);
    for (const grant of assignment.role.rolePermissions) {
      permissions.add(grant.permission.key as Permission);
    }
  }

  return {
    userId: user.id,
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

async function resolveAuthContext(): Promise<AuthContext | null> {
  const token = await readSessionToken();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256Hex(token) },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  const user = await loadUserById(session.userId);
  if (!user || user.status !== 'ACTIVE') return null;

  await prisma.session.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  return toAuthContext(user);
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
