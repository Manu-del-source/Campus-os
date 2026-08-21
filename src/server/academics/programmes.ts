import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import {
  academicListQuerySchema,
  createProgrammeSchema,
  updateProgrammeSchema,
  type AcademicListQuery,
} from '@/server/academics/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProgrammeListRow {
  id: string;
  code: string;
  name: string;
  departmentName: string;
  levelName: string | null;
  duration: number;
  durationUnit: string;
  stages: number;
  isActive: boolean;
}

export interface ProgrammeListResult {
  rows: ProgrammeListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listProgrammes(
  context: AuthContext,
  raw: AcademicListQuery,
): Promise<ProgrammeListResult> {
  requirePermission(context, 'programmes.read');
  const query = academicListQuerySchema.parse(raw);

  const where: Prisma.ProgrammeWhereInput = {
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

  const [total, programmes] = await Promise.all([
    prisma.programme.count({ where }),
    prisma.programme.findMany({
      where,
      orderBy: [{ code: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        duration: true,
        durationUnit: true,
        stages: true,
        isActive: true,
        department: { select: { name: true } },
        level: { select: { name: true } },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: programmes.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      departmentName: p.department.name,
      levelName: p.level?.name ?? null,
      duration: p.duration,
      durationUnit: p.durationUnit,
      stages: p.stages,
      isActive: p.isActive,
    })),
  };
}

export async function getProgrammeById(context: AuthContext, id: string) {
  requirePermission(context, 'programmes.read');

  const programme = await prisma.programme.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
    include: {
      department: { select: { id: true, code: true, name: true } },
      level: { select: { id: true, code: true, name: true } },
      units: {
        where: { deletedAt: null },
        select: { id: true, code: true, name: true, type: true, stage: true, isActive: true },
        orderBy: [{ stage: 'asc' }, { code: 'asc' }],
      },
      cohorts: {
        where: { deletedAt: null },
        select: { id: true, code: true, name: true, currentStage: true, status: true },
        orderBy: { code: 'asc' },
      },
    },
  });

  if (!programme) throw new TenantAccessError();
  return programme;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createProgramme(context: AuthContext, raw: unknown) {
  requirePermission(context, 'programmes.manage');
  const input = createProgrammeSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.programme.findFirst({
    where: { institutionId, code: input.code },
    select: { id: true },
  });
  if (existing) throw new Error('A programme with this code already exists.');

  const department = await prisma.department.findFirst({
    where: { id: input.departmentId, ...tenantWhere(context), deletedAt: null },
    select: { id: true },
  });
  if (!department) throw new TenantAccessError();

  if (input.levelId) {
    const level = await prisma.academicLevel.findFirst({
      where: { id: input.levelId, ...tenantWhere(context) },
      select: { id: true },
    });
    if (!level) throw new TenantAccessError();
  }

  const programme = await prisma.programme.create({
    data: {
      institutionId,
      code: input.code,
      name: input.name,
      description: input.description,
      departmentId: input.departmentId,
      levelId: input.levelId,
      duration: input.duration,
      durationUnit: input.durationUnit,
      stages: input.stages,
      examiningBody: input.examiningBody,
      accreditationNumber: input.accreditationNumber,
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Programme',
    entityId: programme.id,
    summary: `Programme ${input.code} created`,
  });

  return programme;
}

export async function updateProgramme(context: AuthContext, raw: unknown) {
  requirePermission(context, 'programmes.manage');
  const input = updateProgrammeSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.programme.findFirst({
    where: { id: input.id, ...tenantWhere(context), deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  if (input.code !== existing.code) {
    const codeClash = await prisma.programme.findFirst({
      where: { institutionId, code: input.code, id: { not: input.id } },
      select: { id: true },
    });
    if (codeClash) throw new Error('A programme with this code already exists.');
  }

  const department = await prisma.department.findFirst({
    where: { id: input.departmentId, ...tenantWhere(context), deletedAt: null },
    select: { id: true },
  });
  if (!department) throw new TenantAccessError();

  const programme = await prisma.programme.update({
    where: { id: input.id },
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      departmentId: input.departmentId,
      levelId: input.levelId,
      duration: input.duration,
      durationUnit: input.durationUnit,
      stages: input.stages,
      examiningBody: input.examiningBody,
      accreditationNumber: input.accreditationNumber,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Programme',
    entityId: programme.id,
    summary: `Programme ${input.code} updated`,
  });

  return programme;
}

export async function archiveProgramme(context: AuthContext, id: string) {
  requirePermission(context, 'programmes.manage');

  const existing = await prisma.programme.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  const unitCount = await prisma.unit.count({
    where: { programmeId: id, deletedAt: null },
  });
  if (unitCount > 0) {
    throw new Error('Cannot archive a programme that has active units. Archive or reassign them first.');
  }

  await prisma.programme.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Programme',
    entityId: id,
    summary: `Programme ${existing.code} archived`,
  });
}
