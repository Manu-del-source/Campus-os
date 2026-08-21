import 'server-only';

import { z } from 'zod';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { isPermission, ALL_PERMISSIONS, type Permission } from '@/lib/auth/permissions';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const updateRolePermissionsSchema = z.object({
  roleId: z.string().uuid(),
  permissionKeys: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listRoles(context: AuthContext) {
  requirePermission(context, 'roles.read');
  const institutionId = tenantWhere(context).institutionId;

  const roles = await prisma.role.findMany({
    where: { institutionId },
    orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    include: {
      rolePermissions: {
        select: { permission: { select: { key: true, module: true, description: true } } },
      },
      _count: { select: { userRoles: true } },
    },
  });

  return roles.map((role) => ({
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    scope: role.scope,
    isSystem: role.isSystem,
    permissionCount: role.rolePermissions.length,
    userCount: role._count.userRoles,
    permissions: role.rolePermissions.map((rp) => ({
      key: rp.permission.key as Permission,
      module: rp.permission.module,
      description: rp.permission.description,
    })),
  }));
}

export async function getRoleById(context: AuthContext, id: string) {
  requirePermission(context, 'roles.read');

  const role = await prisma.role.findFirst({
    where: { id, ...tenantWhere(context) },
    include: {
      rolePermissions: {
        select: { permission: { select: { id: true, key: true, module: true, description: true } } },
      },
      userRoles: {
        select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
    },
  });

  if (!role) throw new TenantAccessError();
  return role;
}

export async function listAllPermissions() {
  return ALL_PERMISSIONS.map((key) => ({
    key,
    module: key.split('.')[0],
  }));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function updateRolePermissions(context: AuthContext, raw: unknown) {
  requirePermission(context, 'roles.manage');
  const input = updateRolePermissionsSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const role = await prisma.role.findFirst({
    where: { id: input.roleId, ...tenantWhere(context) },
  });
  if (!role) throw new TenantAccessError();

  if (role.isSystem) {
    throw new DomainError('System roles cannot be modified. Clone a system role to customise it.');
  }

  const validPermissions = input.permissionKeys.filter(isPermission);

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (validPermissions.length > 0) {
      const permissions = await tx.permission.findMany({
        where: { key: { in: validPermissions } },
        select: { id: true },
      });
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }
  });

  await recordAudit(context, {
    action: 'role.permissions_changed',
    entityType: 'Role',
    entityId: role.id,
    summary: `Role ${role.name} permissions updated (${validPermissions.length} granted)`,
    metadata: { permissionCount: validPermissions.length },
  });

  return { id: role.id, permissionCount: validPermissions.length };
}
