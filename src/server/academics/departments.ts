import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import {
  academicListQuerySchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  type AcademicListQuery,
} from '@/server/academics/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DepartmentListRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  campusName: string | null;
  isActive: boolean;
  programmeCount: number;
  staffCount: number;
}

export interface DepartmentListResult {
  rows: DepartmentListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listDepartments(
  context: AuthContext,
  raw: AcademicListQuery,
): Promise<DepartmentListResult> {
  requirePermission(context, 'departments.read');
  const query = academicListQuerySchema.parse(raw);

  const where: Prisma.DepartmentWhereInput = {
    ...tenantWhere(context),
    deletedAt: null,
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, departments] = await Promise.all([
    prisma.department.count({ where }),
    prisma.department.findMany({
      where,
      orderBy: [{ code: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        campus: { select: { name: true } },
        _count: { select: { programmes: { where: { deletedAt: null } }, staff: { where: { deletedAt: null } } } },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: departments.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      description: d.description,
      campusName: d.campus?.name ?? null,
      isActive: d.isActive,
      programmeCount: d._count.programmes,
      staffCount: d._count.staff,
    })),
  };
}

export async function getDepartmentById(context: AuthContext, id: string) {
  requirePermission(context, 'departments.read');

  const department = await prisma.department.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
    include: {
      campus: { select: { id: true, code: true, name: true } },
      programmes: {
        where: { deletedAt: null },
        select: { id: true, code: true, name: true, isActive: true },
        orderBy: { code: 'asc' },
      },
      staff: {
        where: { deletedAt: null },
        select: { id: true, staffNumber: true, firstName: true, lastName: true, jobTitle: true },
        orderBy: { lastName: 'asc' },
      },
    },
  });

  if (!department) throw new TenantAccessError();
  return department;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createDepartment(context: AuthContext, raw: unknown) {
  requirePermission(context, 'departments.manage');
  const input = createDepartmentSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.department.findFirst({
    where: { institutionId, code: input.code },
    select: { id: true },
  });
  if (existing) {
    throw new Error('A department with this code already exists.');
  }

  if (input.campusId) {
    const campus = await prisma.campus.findFirst({
      where: { id: input.campusId, ...tenantWhere(context), deletedAt: null },
      select: { id: true },
    });
    if (!campus) throw new TenantAccessError();
  }

  const department = await prisma.department.create({
    data: {
      institutionId,
      code: input.code,
      name: input.name,
      description: input.description,
      campusId: input.campusId,
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Department',
    entityId: department.id,
    summary: `Department ${input.code} created`,
  });

  return department;
}

export async function updateDepartment(context: AuthContext, raw: unknown) {
  requirePermission(context, 'departments.manage');
  const input = updateDepartmentSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.department.findFirst({
    where: { id: input.id, ...tenantWhere(context), deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  if (input.code !== existing.code) {
    const codeClash = await prisma.department.findFirst({
      where: { institutionId, code: input.code, id: { not: input.id } },
      select: { id: true },
    });
    if (codeClash) throw new Error('A department with this code already exists.');
  }

  const department = await prisma.department.update({
    where: { id: input.id },
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      campusId: input.campusId,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Department',
    entityId: department.id,
    summary: `Department ${input.code} updated`,
  });

  return department;
}

export async function archiveDepartment(context: AuthContext, id: string) {
  requirePermission(context, 'departments.manage');

  const existing = await prisma.department.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  const programmeCount = await prisma.programme.count({
    where: { departmentId: id, deletedAt: null },
  });
  if (programmeCount > 0) {
    throw new Error('Cannot archive a department that has active programmes. Archive or reassign them first.');
  }

  await prisma.department.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Department',
    entityId: id,
    summary: `Department ${existing.code} archived`,
  });
}
