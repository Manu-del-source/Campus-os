import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import {
  academicListQuerySchema,
  createCohortSchema,
  createGroupSchema,
  updateCohortSchema,
  updateGroupSchema,
  type AcademicListQuery,
} from '@/server/academics/schemas';

// ---------------------------------------------------------------------------
// Cohort — Types
// ---------------------------------------------------------------------------

export interface CohortListRow {
  id: string;
  code: string;
  name: string;
  programmeName: string;
  intakeCode: string;
  currentStage: number;
  status: string;
  groupCount: number;
}

export interface CohortListResult {
  rows: CohortListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Cohort — Queries
// ---------------------------------------------------------------------------

export async function listCohorts(
  context: AuthContext,
  raw: AcademicListQuery,
): Promise<CohortListResult> {
  requirePermission(context, 'academics.read');
  const query = academicListQuerySchema.parse(raw);

  const where: Prisma.CohortWhereInput = {
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

  const [total, cohorts] = await Promise.all([
    prisma.cohort.count({ where }),
    prisma.cohort.findMany({
      where,
      orderBy: [{ code: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        currentStage: true,
        status: true,
        programme: { select: { name: true } },
        intake: { select: { code: true } },
        _count: { select: { groups: { where: { deletedAt: null } } } },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: cohorts.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      programmeName: c.programme.name,
      intakeCode: c.intake.code,
      currentStage: c.currentStage,
      status: c.status,
      groupCount: c._count.groups,
    })),
  };
}

export async function getCohortById(context: AuthContext, id: string) {
  requirePermission(context, 'academics.read');

  const cohort = await prisma.cohort.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
    include: {
      programme: { select: { id: true, code: true, name: true } },
      intake: { select: { id: true, code: true, name: true } },
      academicYear: { select: { id: true, code: true, name: true } },
      groups: {
        where: { deletedAt: null },
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          capacity: true,
          isActive: true,
          _count: { select: { students: { where: { deletedAt: null } } } },
        },
      },
    },
  });

  if (!cohort) throw new TenantAccessError();
  return cohort;
}

// ---------------------------------------------------------------------------
// Cohort — Mutations
// ---------------------------------------------------------------------------

export async function createCohort(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = createCohortSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.cohort.findFirst({
    where: { institutionId, code: input.code },
    select: { id: true },
  });
  if (existing) throw new Error('A cohort with this code already exists.');

  const programme = await prisma.programme.findFirst({
    where: { id: input.programmeId, ...tenantWhere(context), deletedAt: null },
    select: { id: true },
  });
  if (!programme) throw new TenantAccessError();

  const intake = await prisma.intake.findFirst({
    where: { id: input.intakeId, ...tenantWhere(context) },
    select: { id: true },
  });
  if (!intake) throw new TenantAccessError();

  const cohort = await prisma.cohort.create({
    data: {
      institutionId,
      code: input.code,
      name: input.name,
      programmeId: input.programmeId,
      intakeId: input.intakeId,
      academicYearId: input.academicYearId,
      currentStage: input.currentStage,
      startDate: input.startDate,
      expectedEndDate: input.expectedEndDate,
      status: input.status,
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Cohort',
    entityId: cohort.id,
    summary: `Cohort ${input.code} created`,
  });

  return cohort;
}

export async function updateCohort(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = updateCohortSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.cohort.findFirst({
    where: { id: input.id, ...tenantWhere(context), deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  if (input.code !== existing.code) {
    const codeClash = await prisma.cohort.findFirst({
      where: { institutionId, code: input.code, id: { not: input.id } },
      select: { id: true },
    });
    if (codeClash) throw new Error('A cohort with this code already exists.');
  }

  const cohort = await prisma.cohort.update({
    where: { id: input.id },
    data: {
      code: input.code,
      name: input.name,
      programmeId: input.programmeId,
      intakeId: input.intakeId,
      academicYearId: input.academicYearId,
      currentStage: input.currentStage,
      startDate: input.startDate,
      expectedEndDate: input.expectedEndDate,
      status: input.status,
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Cohort',
    entityId: cohort.id,
    summary: `Cohort ${input.code} updated`,
  });

  return cohort;
}

// ---------------------------------------------------------------------------
// Group — Types
// ---------------------------------------------------------------------------

export interface GroupListRow {
  id: string;
  code: string;
  name: string;
  cohortCode: string;
  campusName: string | null;
  capacity: number | null;
  studentCount: number;
  isActive: boolean;
}

export interface GroupListResult {
  rows: GroupListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Group — Queries
// ---------------------------------------------------------------------------

export async function listGroups(
  context: AuthContext,
  raw: AcademicListQuery & { cohortId?: string },
): Promise<GroupListResult> {
  requirePermission(context, 'academics.read');
  const query = academicListQuerySchema.parse(raw);

  const where: Prisma.GroupWhereInput = {
    ...tenantWhere(context),
    deletedAt: null,
    ...(raw.cohortId ? { cohortId: raw.cohortId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, groups] = await Promise.all([
    prisma.group.count({ where }),
    prisma.group.findMany({
      where,
      orderBy: [{ code: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        capacity: true,
        isActive: true,
        cohort: { select: { code: true } },
        campus: { select: { name: true } },
        _count: { select: { students: { where: { deletedAt: null } } } },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: groups.map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      cohortCode: g.cohort.code,
      campusName: g.campus?.name ?? null,
      capacity: g.capacity,
      studentCount: g._count.students,
      isActive: g.isActive,
    })),
  };
}

// ---------------------------------------------------------------------------
// Group — Mutations
// ---------------------------------------------------------------------------

export async function createGroup(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = createGroupSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.group.findFirst({
    where: { institutionId, code: input.code },
    select: { id: true },
  });
  if (existing) throw new Error('A group with this code already exists.');

  const cohort = await prisma.cohort.findFirst({
    where: { id: input.cohortId, ...tenantWhere(context), deletedAt: null },
    select: { id: true },
  });
  if (!cohort) throw new TenantAccessError();

  const group = await prisma.group.create({
    data: {
      institutionId,
      code: input.code,
      name: input.name,
      cohortId: input.cohortId,
      campusId: input.campusId,
      capacity: input.capacity,
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Group',
    entityId: group.id,
    summary: `Group ${input.code} created`,
  });

  return group;
}

export async function updateGroup(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = updateGroupSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.group.findFirst({
    where: { id: input.id, ...tenantWhere(context), deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  if (input.code !== existing.code) {
    const codeClash = await prisma.group.findFirst({
      where: { institutionId, code: input.code, id: { not: input.id } },
      select: { id: true },
    });
    if (codeClash) throw new Error('A group with this code already exists.');
  }

  const group = await prisma.group.update({
    where: { id: input.id },
    data: {
      code: input.code,
      name: input.name,
      cohortId: input.cohortId,
      campusId: input.campusId,
      capacity: input.capacity,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Group',
    entityId: group.id,
    summary: `Group ${input.code} updated`,
  });

  return group;
}
