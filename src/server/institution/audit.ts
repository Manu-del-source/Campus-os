import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import type { AuthContext } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { academicListQuerySchema, type AcademicListQuery } from '@/server/academics/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditLogRow {
  id: string;
  actorLabel: string | null;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

export interface AuditLogResult {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listAuditLogs(
  context: AuthContext,
  raw: AcademicListQuery & { action?: string; entityType?: string },
): Promise<AuditLogResult> {
  requirePermission(context, 'audit.read');
  const query = academicListQuerySchema.parse(raw);

  const where: Prisma.AuditLogWhereInput = {
    ...tenantWhere(context),
    ...(raw.action ? { action: raw.action } : {}),
    ...(raw.entityType ? { entityType: raw.entityType } : {}),
    ...(query.search
      ? {
          OR: [
            { actorLabel: { contains: query.search, mode: 'insensitive' } },
            { summary: { contains: query.search, mode: 'insensitive' } },
            { action: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        actorLabel: true,
        actorType: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        ipAddress: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: logs.map((log) => ({
      id: log.id,
      actorLabel: log.actorLabel,
      actorType: log.actorType,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      summary: log.summary,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    })),
  };
}
