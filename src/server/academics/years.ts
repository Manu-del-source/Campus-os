import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import {
  academicListQuerySchema,
  academicPeriodStatusSchema,
  createAcademicYearSchema,
  createSemesterSchema,
  updateAcademicYearSchema,
  updateSemesterSchema,
  type AcademicListQuery,
} from '@/server/academics/schemas';

// ---------------------------------------------------------------------------
// Academic Year — Types
// ---------------------------------------------------------------------------

export interface AcademicYearListRow {
  id: string;
  code: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  status: string;
  semesterCount: number;
}

export interface AcademicYearListResult {
  rows: AcademicYearListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Academic Year — Queries
// ---------------------------------------------------------------------------

export async function listAcademicYears(
  context: AuthContext,
  raw: AcademicListQuery,
): Promise<AcademicYearListResult> {
  requirePermission(context, 'academics.read');
  const query = academicListQuerySchema.parse(raw);

  const where: Prisma.AcademicYearWhereInput = {
    ...tenantWhere(context),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, years] = await Promise.all([
    prisma.academicYear.count({ where }),
    prisma.academicYear.findMany({
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
        isCurrent: true,
        status: true,
        _count: { select: { semesters: true } },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: years.map((y) => ({
      id: y.id,
      code: y.code,
      name: y.name,
      startDate: y.startDate,
      endDate: y.endDate,
      isCurrent: y.isCurrent,
      status: y.status,
      semesterCount: y._count.semesters,
    })),
  };
}

export async function getAcademicYearById(context: AuthContext, id: string) {
  requirePermission(context, 'academics.read');

  const year = await prisma.academicYear.findFirst({
    where: { id, ...tenantWhere(context) },
    include: {
      semesters: {
        orderBy: { sequence: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          sequence: true,
          startDate: true,
          endDate: true,
          isCurrent: true,
          status: true,
        },
      },
      intakes: {
        orderBy: { startDate: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          startDate: true,
          status: true,
        },
      },
    },
  });

  if (!year) throw new TenantAccessError();
  return year;
}

// ---------------------------------------------------------------------------
// Academic Year — Mutations
// ---------------------------------------------------------------------------

export async function createAcademicYear(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = createAcademicYearSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  if (input.endDate <= input.startDate) {
    throw new DomainError('End date must be after start date.');
  }

  const existing = await prisma.academicYear.findFirst({
    where: { institutionId, code: input.code },
    select: { id: true },
  });
  if (existing) throw new Error('An academic year with this code already exists.');

  if (input.isCurrent) {
    await prisma.academicYear.updateMany({
      where: { institutionId, isCurrent: true },
      data: { isCurrent: false },
    });
  }

  const year = await prisma.academicYear.create({
    data: {
      institutionId,
      code: input.code,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: input.isCurrent,
      status: input.status,
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'AcademicYear',
    entityId: year.id,
    summary: `Academic year ${input.code} created`,
  });

  return year;
}

export async function updateAcademicYear(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = updateAcademicYearSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.academicYear.findFirst({
    where: { id: input.id, ...tenantWhere(context) },
  });
  if (!existing) throw new TenantAccessError();

  if (input.endDate <= input.startDate) {
    throw new DomainError('End date must be after start date.');
  }

  if (input.code !== existing.code) {
    const codeClash = await prisma.academicYear.findFirst({
      where: { institutionId, code: input.code, id: { not: input.id } },
      select: { id: true },
    });
    if (codeClash) throw new Error('An academic year with this code already exists.');
  }

  if (input.isCurrent && !existing.isCurrent) {
    await prisma.academicYear.updateMany({
      where: { institutionId, isCurrent: true },
      data: { isCurrent: false },
    });
  }

  const year = await prisma.academicYear.update({
    where: { id: input.id },
    data: {
      code: input.code,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: input.isCurrent,
      status: input.status,
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'AcademicYear',
    entityId: year.id,
    summary: `Academic year ${input.code} updated`,
  });

  return year;
}

// ---------------------------------------------------------------------------
// Semester — Types
// ---------------------------------------------------------------------------

export interface SemesterListRow {
  id: string;
  code: string;
  name: string;
  sequence: number;
  academicYearCode: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  status: string;
}

export interface SemesterListResult {
  rows: SemesterListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Semester — Queries
// ---------------------------------------------------------------------------

export async function listSemesters(
  context: AuthContext,
  raw: AcademicListQuery & { academicYearId?: string },
): Promise<SemesterListResult> {
  requirePermission(context, 'academics.read');
  const query = academicListQuerySchema.parse(raw);

  const where: Prisma.SemesterWhereInput = {
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

  const [total, semesters] = await Promise.all([
    prisma.semester.count({ where }),
    prisma.semester.findMany({
      where,
      orderBy: [{ academicYear: { startDate: 'desc' } }, { sequence: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        sequence: true,
        startDate: true,
        endDate: true,
        isCurrent: true,
        status: true,
        academicYear: { select: { code: true } },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: semesters.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      sequence: s.sequence,
      academicYearCode: s.academicYear.code,
      startDate: s.startDate,
      endDate: s.endDate,
      isCurrent: s.isCurrent,
      status: s.status,
    })),
  };
}

// ---------------------------------------------------------------------------
// Semester — Mutations
// ---------------------------------------------------------------------------

export async function createSemester(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = createSemesterSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  if (input.endDate <= input.startDate) {
    throw new DomainError('End date must be after start date.');
  }

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: input.academicYearId, ...tenantWhere(context) },
  });
  if (!academicYear) throw new TenantAccessError();

  const existing = await prisma.semester.findFirst({
    where: { institutionId, code: input.code },
    select: { id: true },
  });
  if (existing) throw new Error('A semester with this code already exists.');

  const seqClash = await prisma.semester.findFirst({
    where: { academicYearId: input.academicYearId, sequence: input.sequence },
    select: { id: true, code: true },
  });
  if (seqClash) throw new Error(`Sequence ${input.sequence} is already used by semester ${seqClash.code} in this academic year.`);

  if (input.isCurrent) {
    await prisma.semester.updateMany({
      where: { institutionId, isCurrent: true },
      data: { isCurrent: false },
    });
  }

  const semester = await prisma.semester.create({
    data: {
      institutionId,
      academicYearId: input.academicYearId,
      code: input.code,
      name: input.name,
      sequence: input.sequence,
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: input.isCurrent,
      status: input.status,
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Semester',
    entityId: semester.id,
    summary: `Semester ${input.code} created in ${academicYear.code}`,
  });

  return semester;
}

export async function updateSemester(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = updateSemesterSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.semester.findFirst({
    where: { id: input.id, ...tenantWhere(context) },
  });
  if (!existing) throw new TenantAccessError();

  if (input.endDate <= input.startDate) {
    throw new DomainError('End date must be after start date.');
  }

  if (input.code !== existing.code) {
    const codeClash = await prisma.semester.findFirst({
      where: { institutionId, code: input.code, id: { not: input.id } },
      select: { id: true },
    });
    if (codeClash) throw new Error('A semester with this code already exists.');
  }

  if (input.isCurrent && !existing.isCurrent) {
    await prisma.semester.updateMany({
      where: { institutionId, isCurrent: true },
      data: { isCurrent: false },
    });
  }

  const semester = await prisma.semester.update({
    where: { id: input.id },
    data: {
      academicYearId: input.academicYearId,
      code: input.code,
      name: input.name,
      sequence: input.sequence,
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: input.isCurrent,
      status: input.status,
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Semester',
    entityId: semester.id,
    summary: `Semester ${input.code} updated`,
  });

  return semester;
}
