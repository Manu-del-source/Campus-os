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
import { isRoleKey, type Permission, type RoleKey } from '@/lib/auth/permissions';
import type { AuthContext, TenantSummary } from '@/lib/auth/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { serverEnv } from '@/lib/env';

/**
 * Session and tenant resolution.
 *
 * The authenticated identity comes from Supabase Auth; roles, permissions and
 * — critically — the active institution are then loaded from PostgreSQL.
 * A tenant id supplied by the client is never trusted or even read.
 */

type UserWithRoles = Awaited<ReturnType<typeof loadUser>>;

async function loadUser(where: { authUserId: string } | { email: string }) {
  return prisma.user.findFirst({
    where: { ...where, deletedAt: null },
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

function toAuthContext(user: NonNullable<UserWithRoles>): AuthContext {
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
 * Development-only impersonation used while Supabase credentials are not yet
 * provisioned. It is hard-disabled in production builds.
 */
async function devFallbackUser(): Promise<UserWithRoles | null> {
  const email = process.env.CAMPUSOS_DEV_LOGIN_EMAIL;
  if (!email) return null;
  if (serverEnv().NODE_ENV === 'production') return null;
  return loadUser({ email });
}

async function resolveAuthContext(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const user = await loadUser({ authUserId: data.user.id });
    return user && user.status === 'ACTIVE' ? toAuthContext(user) : null;
  }

  const fallback = await devFallbackUser();
  return fallback ? toAuthContext(fallback) : null;
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
