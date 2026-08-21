import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import {
  academicListQuerySchema,
  createIntakeSchema,
  updateIntakeSchema,
  type AcademicListQuery,
} from '@/server/academics/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntakeListRow {
  id: string;
  code: string;
  name: string;
  academicYearCode: string;
  startDate: Date;
  endDate: Date | null;
  status: string;
  cohortCount: number;
}

export interface IntakeListResult {
  rows: IntakeListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listIntakes(
  context: AuthContext,
  raw: AcademicListQuery & { academicYearId?: string },
): Promise<IntakeListResult> {
  requirePermission(context, 'academics.read');
  const query = academicListQuerySchema.parse(raw);

  const where: Prisma.IntakeWhereInput = {
    ...tenantWhere(context),
    ...(raw.academicYearId ? { academicYearId: raw.academicYearId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, intakes] = await Promise.all([
    prisma.intake.count({ where }),
    prisma.intake.findMany({
      where,
      orderBy: [{ startDate: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
        academicYear: { select: { code: true } },
        _count: { select: { cohorts: true } },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: intakes.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      academicYearCode: i.academicYear.code,
      startDate: i.startDate,
      endDate: i.endDate,
      status: i.status,
      cohortCount: i._count.cohorts,
    })),
  };
}

export async function getIntakeById(context: AuthContext, id: string) {
  requirePermission(context, 'academics.read');

  const intake = await prisma.intake.findFirst({
    where: { id, ...tenantWhere(context) },
    include: {
      academicYear: { select: { id: true, code: true, name: true } },
      cohorts: {
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          currentStage: true,
          status: true,
          programme: { select: { code: true, name: true } },
        },
      },
    },
  });

  if (!intake) throw new TenantAccessError();
  return intake;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createIntake(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = createIntakeSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  if (input.endDate && input.endDate <= input.startDate) {
    throw new DomainError('End date must be after start date.');
  }

  if (input.applicationOpen && input.applicationClose && input.applicationClose <= input.applicationOpen) {
    throw new DomainError('Application close date must be after application open date.');
  }

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: input.academicYearId, ...tenantWhere(context) },
  });
  if (!academicYear) throw new TenantAccessError();

  const existing = await prisma.intake.findFirst({
    where: { institutionId, code: input.code },
    select: { id: true },
  });
  if (existing) throw new Error('An intake with this code already exists.');

  const intake = await prisma.intake.create({
    data: {
      institutionId,
      academicYearId: input.academicYearId,
      code: input.code,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      applicationOpen: input.applicationOpen,
      applicationClose: input.applicationClose,
      status: input.status,
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Intake',
    entityId: intake.id,
    summary: `Intake ${input.code} created in ${academicYear.code}`,
  });

  return intake;
}

export async function updateIntake(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = updateIntakeSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.intake.findFirst({
    where: { id: input.id, ...tenantWhere(context) },
  });
  if (!existing) throw new TenantAccessError();

  if (input.endDate && input.endDate <= input.startDate) {
    throw new DomainError('End date must be after start date.');
  }

  if (input.code !== existing.code) {
    const codeClash = await prisma.intake.findFirst({
      where: { institutionId, code: input.code, id: { not: input.id } },
      select: { id: true },
    });
    if (codeClash) throw new Error('An intake with this code already exists.');
  }

  const intake = await prisma.intake.update({
    where: { id: input.id },
    data: {
      academicYearId: input.academicYearId,
      code: input.code,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      applicationOpen: input.applicationOpen,
      applicationClose: input.applicationClose,
      status: input.status,
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Intake',
    entityId: intake.id,
    summary: `Intake ${input.code} updated`,
  });

  return intake;
}
