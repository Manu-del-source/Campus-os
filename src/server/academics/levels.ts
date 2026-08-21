import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import {
  academicListQuerySchema,
  createAcademicLevelSchema,
  updateAcademicLevelSchema,
  type AcademicListQuery,
} from '@/server/academics/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AcademicLevelListRow {
  id: string;
  code: string;
  name: string;
  rank: number;
  description: string | null;
  isActive: boolean;
  programmeCount: number;
}

export interface AcademicLevelListResult {
  rows: AcademicLevelListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listAcademicLevels(
  context: AuthContext,
  raw: AcademicListQuery,
): Promise<AcademicLevelListResult> {
  requirePermission(context, 'academics.read');
  const query = academicListQuerySchema.parse(raw);

  const where: Prisma.AcademicLevelWhereInput = {
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

  const [total, levels] = await Promise.all([
    prisma.academicLevel.count({ where }),
    prisma.academicLevel.findMany({
      where,
      orderBy: [{ rank: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        rank: true,
        description: true,
        isActive: true,
        _count: { select: { programmes: { where: { deletedAt: null } } } },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: levels.map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      rank: l.rank,
      description: l.description,
      isActive: l.isActive,
      programmeCount: l._count.programmes,
    })),
  };
}

export async function getAcademicLevelById(context: AuthContext, id: string) {
  requirePermission(context, 'academics.read');

  const level = await prisma.academicLevel.findFirst({
    where: { id, ...tenantWhere(context) },
    include: {
      programmes: {
        where: { deletedAt: null },
        select: { id: true, code: true, name: true, isActive: true },
        orderBy: { code: 'asc' },
      },
    },
  });

  if (!level) throw new TenantAccessError();
  return level;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createAcademicLevel(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = createAcademicLevelSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.academicLevel.findFirst({
    where: { institutionId, code: input.code },
    select: { id: true },
  });
  if (existing) throw new Error('An academic level with this code already exists.');

  const rankClash = await prisma.academicLevel.findFirst({
    where: { institutionId, rank: input.rank },
    select: { id: true, code: true },
  });
  if (rankClash) throw new Error(`Rank ${input.rank} is already used by level ${rankClash.code}.`);

  const level = await prisma.academicLevel.create({
    data: {
      institutionId,
      code: input.code,
      name: input.name,
      rank: input.rank,
      description: input.description,
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'AcademicLevel',
    entityId: level.id,
    summary: `Academic level ${input.code} created`,
  });

  return level;
}

export async function updateAcademicLevel(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = updateAcademicLevelSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.academicLevel.findFirst({
    where: { id: input.id, ...tenantWhere(context) },
  });
  if (!existing) throw new TenantAccessError();

  if (input.code !== existing.code) {
    const codeClash = await prisma.academicLevel.findFirst({
      where: { institutionId, code: input.code, id: { not: input.id } },
      select: { id: true },
    });
    if (codeClash) throw new Error('An academic level with this code already exists.');
  }

  if (input.rank !== existing.rank) {
    const rankClash = await prisma.academicLevel.findFirst({
      where: { institutionId, rank: input.rank, id: { not: input.id } },
      select: { id: true, code: true },
    });
    if (rankClash) throw new Error(`Rank ${input.rank} is already used by level ${rankClash.code}.`);
  }

  const level = await prisma.academicLevel.update({
    where: { id: input.id },
    data: {
      code: input.code,
      name: input.name,
      rank: input.rank,
      description: input.description,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'AcademicLevel',
    entityId: level.id,
    summary: `Academic level ${input.code} updated`,
  });

  return level;
}
