import 'server-only';

import { z } from 'zod';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { hashPassword } from '@/lib/auth/password';
import { academicListQuerySchema, type AcademicListQuery } from '@/server/academics/schemas';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const inviteUserSchema = z.object({
  email: z.string().trim().email().max(160),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  roleKey: z.string().trim().min(1).max(60),
  password: z.string().min(8).max(128).optional(),
});

export const updateUserSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserListRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: string[];
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface UserListResult {
  rows: UserListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listUsers(
  context: AuthContext,
  raw: AcademicListQuery,
): Promise<UserListResult> {
  requirePermission(context, 'users.read');
  const query = academicListQuerySchema.parse(raw);

  const where: Prisma.UserWhereInput = {
    ...tenantWhere(context),
    deletedAt: null,
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          select: { role: { select: { key: true, name: true } } },
        },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      status: u.status,
      roles: u.userRoles.map((ur) => ur.role.name),
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
  };
}

export async function getUserById(context: AuthContext, id: string) {
  requirePermission(context, 'users.read');

  const user = await prisma.user.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
    include: {
      userRoles: {
        select: {
          id: true,
          role: { select: { id: true, key: true, name: true } },
          createdAt: true,
        },
      },
    },
  });

  if (!user) throw new TenantAccessError();
  return user;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function inviteUser(context: AuthContext, raw: unknown) {
  requirePermission(context, 'users.invite');
  const input = inviteUserSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.user.findFirst({
    where: { institutionId, email: { equals: input.email, mode: 'insensitive' }, deletedAt: null },
    select: { id: true },
  });
  if (existing) throw new DomainError('A user with this email already exists in this institution.');

  const role = await prisma.role.findFirst({
    where: { institutionId, key: input.roleKey },
    select: { id: true, key: true, name: true },
  });
  if (!role) throw new DomainError('The specified role does not exist.');

  const passwordHash = input.password ? await hashPassword(input.password) : null;

  const user = await prisma.user.create({
    data: {
      institutionId,
      email: input.email.toLowerCase(),
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash,
      status: input.password ? 'ACTIVE' : 'INVITED',
    },
  });

  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: role.id,
      institutionId,
      grantedById: context.userId,
    },
  });

  await recordAudit(context, {
    action: 'user.invited',
    entityType: 'User',
    entityId: user.id,
    summary: `User ${input.email} invited with role ${role.name}`,
    metadata: { email: input.email, roleKey: role.key },
  });

  return user;
}

export async function updateUser(context: AuthContext, raw: unknown) {
  requirePermission(context, 'users.update');
  const input = updateUserSchema.parse(raw);

  const existing = await prisma.user.findFirst({
    where: { id: input.id, ...tenantWhere(context), deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  const user = await prisma.user.update({
    where: { id: input.id },
    data: {
      ...(input.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName ? { lastName: input.lastName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
  });

  await recordAudit(context, {
    action: 'user.updated',
    entityType: 'User',
    entityId: user.id,
    summary: `User ${user.email} updated`,
  });

  return user;
}

export async function deactivateUser(context: AuthContext, id: string) {
  requirePermission(context, 'users.deactivate');

  const existing = await prisma.user.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  if (existing.id === context.userId) {
    throw new DomainError('You cannot deactivate your own account.');
  }

  await prisma.user.update({
    where: { id },
    data: { status: 'DEACTIVATED' },
  });

  await recordAudit(context, {
    action: 'user.updated',
    entityType: 'User',
    entityId: id,
    summary: `User ${existing.email} deactivated`,
  });
}
