import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import {
  academicListQuerySchema,
  createUnitSchema,
  updateUnitSchema,
  type AcademicListQuery,
} from '@/server/academics/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnitListRow {
  id: string;
  code: string;
  name: string;
  programmeName: string;
  type: string;
  creditHours: number | null;
  stage: number;
  semesterName: string | null;
  isActive: boolean;
}

export interface UnitListResult {
  rows: UnitListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listUnits(
  context: AuthContext,
  raw: AcademicListQuery & { programmeId?: string; semesterId?: string },
): Promise<UnitListResult> {
  requirePermission(context, 'units.read');
  const query = academicListQuerySchema.parse(raw);

  const where: Prisma.UnitWhereInput = {
    ...tenantWhere(context),
    deletedAt: null,
    ...(raw.programmeId ? { programmeId: raw.programmeId } : {}),
    ...(raw.semesterId ? { semesterId: raw.semesterId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, units] = await Promise.all([
    prisma.unit.count({ where }),
    prisma.unit.findMany({
      where,
      orderBy: [{ stage: 'asc' }, { code: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        creditHours: true,
        stage: true,
        isActive: true,
        programme: { select: { name: true } },
        semester: { select: { name: true } },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: units.map((u) => ({
      id: u.id,
      code: u.code,
      name: u.name,
      programmeName: u.programme.name,
      type: u.type,
      creditHours: u.creditHours,
      stage: u.stage,
      semesterName: u.semester?.name ?? null,
      isActive: u.isActive,
    })),
  };
}

export async function getUnitById(context: AuthContext, id: string) {
  requirePermission(context, 'units.read');

  const unit = await prisma.unit.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
    include: {
      programme: { select: { id: true, code: true, name: true } },
      level: { select: { id: true, code: true, name: true } },
      semester: { select: { id: true, code: true, name: true } },
    },
  });

  if (!unit) throw new TenantAccessError();
  return unit;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createUnit(context: AuthContext, raw: unknown) {
  requirePermission(context, 'units.manage');
  const input = createUnitSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.unit.findFirst({
    where: { institutionId, code: input.code },
    select: { id: true },
  });
  if (existing) throw new Error('A unit with this code already exists.');

  const programme = await prisma.programme.findFirst({
    where: { id: input.programmeId, ...tenantWhere(context), deletedAt: null },
    select: { id: true },
  });
  if (!programme) throw new TenantAccessError();

  if (input.levelId) {
    const level = await prisma.academicLevel.findFirst({
      where: { id: input.levelId, ...tenantWhere(context) },
      select: { id: true },
    });
    if (!level) throw new TenantAccessError();
  }

  if (input.semesterId) {
    const semester = await prisma.semester.findFirst({
      where: { id: input.semesterId, ...tenantWhere(context) },
      select: { id: true },
    });
    if (!semester) throw new TenantAccessError();
  }

  const unit = await prisma.unit.create({
    data: {
      institutionId,
      code: input.code,
      name: input.name,
      description: input.description,
      programmeId: input.programmeId,
      levelId: input.levelId,
      semesterId: input.semesterId,
      type: input.type,
      creditHours: input.creditHours,
      contactHours: input.contactHours,
      stage: input.stage,
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Unit',
    entityId: unit.id,
    summary: `Unit ${input.code} created`,
  });

  return unit;
}

export async function updateUnit(context: AuthContext, raw: unknown) {
  requirePermission(context, 'units.manage');
  const input = updateUnitSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.unit.findFirst({
    where: { id: input.id, ...tenantWhere(context), deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  if (input.code !== existing.code) {
    const codeClash = await prisma.unit.findFirst({
      where: { institutionId, code: input.code, id: { not: input.id } },
      select: { id: true },
    });
    if (codeClash) throw new Error('A unit with this code already exists.');
  }

  const unit = await prisma.unit.update({
    where: { id: input.id },
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      programmeId: input.programmeId,
      levelId: input.levelId,
      semesterId: input.semesterId,
      type: input.type,
      creditHours: input.creditHours,
      contactHours: input.contactHours,
      stage: input.stage,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Unit',
    entityId: unit.id,
    summary: `Unit ${input.code} updated`,
  });

  return unit;
}

export async function archiveUnit(context: AuthContext, id: string) {
  requirePermission(context, 'units.manage');

  const existing = await prisma.unit.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  await prisma.unit.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Unit',
    entityId: id,
    summary: `Unit ${existing.code} archived`,
  });
}
