import { ForbiddenError, TenantAccessError, UnauthenticatedError } from '@/lib/auth/errors';
import type { Permission, RoleKey } from '@/lib/auth/permissions';
import type { AuthContext, TenantOwned } from '@/lib/auth/types';

/**
 * Pure authorization primitives.
 *
 * Nothing here touches the database, the network or React — which makes every
 * rule directly unit-testable and keeps authorization decisions in exactly one
 * place instead of scattered across UI components.
 */

export function hasPermission(context: AuthContext | null, permission: Permission): boolean {
  if (!context) return false;
  return context.permissions.has(permission);
}

export function hasAnyPermission(
  context: AuthContext | null,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(context, permission));
}

export function hasAllPermissions(
  context: AuthContext | null,
  permissions: readonly Permission[],
): boolean {
  return permissions.every((permission) => hasPermission(context, permission));
}

export function hasRole(context: AuthContext | null, ...roles: readonly RoleKey[]): boolean {
  if (!context) return false;
  return roles.some((role) => context.roleKeys.includes(role));
}

export function isPlatformAdmin(context: AuthContext | null): boolean {
  return Boolean(context?.isPlatformAdmin);
}

/** Throws unless a session exists. */
export function requireAuthenticated(context: AuthContext | null): asserts context is AuthContext {
  if (!context) throw new UnauthenticatedError();
}

export function requirePermission(
  context: AuthContext | null,
  ...permissions: readonly Permission[]
): asserts context is AuthContext {
  requireAuthenticated(context);
  if (!hasAllPermissions(context, permissions)) {
    throw new ForbiddenError();
  }
}

export function requireAnyPermission(
  context: AuthContext | null,
  ...permissions: readonly Permission[]
): asserts context is AuthContext {
  requireAuthenticated(context);
  if (!hasAnyPermission(context, permissions)) {
    throw new ForbiddenError();
  }
}

export function requireRole(
  context: AuthContext | null,
  ...roles: readonly RoleKey[]
): asserts context is AuthContext {
  requireAuthenticated(context);
  if (!hasRole(context, ...roles)) {
    throw new ForbiddenError();
  }
}

export function requirePlatformAdmin(
  context: AuthContext | null,
): asserts context is AuthContext {
  requireAuthenticated(context);
  if (!context.isPlatformAdmin) {
    throw new ForbiddenError();
  }
}

/**
 * The active tenant, taken from the session — never from a client-supplied
 * value. Platform administrators have no implicit tenant.
 */
export function requireInstitutionId(context: AuthContext | null): string {
  requireAuthenticated(context);
  if (!context.institutionId) {
    throw new ForbiddenError('This action requires an institution context.');
  }
  return context.institutionId;
}

/**
 * Guards a record that has already been loaded.
 *
 * Loading tenant-scoped rows should always include `institutionId` in the
 * `where` clause; this assertion is the second line of defence for code paths
 * that look records up by primary key (the classic IDOR shape).
 */
export function assertTenantAccess<T extends TenantOwned>(
  context: AuthContext | null,
  record: T | null | undefined,
): asserts record is T {
  requireAuthenticated(context);
  if (!record) throw new TenantAccessError();

  if (context.isPlatformAdmin && !context.institutionId) {
    // Platform administrators operate above tenants but only through the
    // platform surface; institution data access still requires an explicit
    // impersonation/session tenant, which is intentionally not implicit here.
    throw new ForbiddenError('Platform administrators must not read tenant records directly.');
  }

  if (record.institutionId !== context.institutionId) {
    throw new TenantAccessError();
  }
}

/**
 * Builds the mandatory tenant filter for Prisma queries.
 *
 *   prisma.student.findMany({ where: { ...tenantWhere(context), status: 'ACTIVE' } })
 */
export function tenantWhere(context: AuthContext | null): { institutionId: string } {
  return { institutionId: requireInstitutionId(context) };
}
