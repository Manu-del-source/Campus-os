import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import type { ApplicationStatus, Prisma } from '@/generated/prisma/client';
import {
  applicationListQuerySchema,
  type ApplicationListQuery,
} from '@/server/admissions/schemas';

export interface ApplicationListRow {
  id: string;
  reference: string;
  fullName: string;
  email: string;
  status: ApplicationStatus;
  programmeName: string;
  intakeCode: string;
  submittedAt: Date | null;
  createdAt: Date;
}

export interface ApplicationListResult {
  rows: ApplicationListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listApplications(
  context: AuthContext,
  query: ApplicationListQuery,
): Promise<ApplicationListResult> {
  requirePermission(context, 'admissions.read');
  const parsed = applicationListQuerySchema.parse(query);

  const where: Prisma.ApplicationWhereInput = {
    ...tenantWhere(context),
    ...(parsed.status ? { status: parsed.status } : {}),
    ...(parsed.programmeId ? { programmeId: parsed.programmeId } : {}),
    ...(parsed.intakeId ? { intakeId: parsed.intakeId } : {}),
    ...(parsed.search
      ? {
          OR: [
            { firstName: { contains: parsed.search, mode: 'insensitive' } },
            { lastName: { contains: parsed.search, mode: 'insensitive' } },
            { email: { contains: parsed.search, mode: 'insensitive' } },
            { reference: { contains: parsed.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, applications] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        reference: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        status: true,
        submittedAt: true,
        createdAt: true,
        programme: { select: { name: true } },
        intake: { select: { code: true } },
      },
    }),
  ]);

  return {
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    rows: applications.map((application) => ({
      id: application.id,
      reference: application.reference,
      fullName: [application.firstName, application.middleName, application.lastName]
        .filter(Boolean)
        .join(' '),
      email: application.email,
      status: application.status,
      programmeName: application.programme.name,
      intakeCode: application.intake.code,
      submittedAt: application.submittedAt,
      createdAt: application.createdAt,
    })),
  };
}

/**
 * Staff lookup. The tenant filter is part of the query, so a foreign id
 * does not resolve (no IDOR / no tenant existence leak).
 */
export async function getApplicationById(context: AuthContext, id: string) {
  requirePermission(context, 'admissions.read');

  const application = await prisma.application.findFirst({
    where: { id, ...tenantWhere(context) },
    include: {
      programme: { select: { id: true, code: true, name: true, levelId: true } },
      intake: { select: { id: true, code: true, name: true, status: true } },
      campus: { select: { id: true, code: true, name: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      admission: {
        include: {
          student: { select: { id: true, studentNumber: true, status: true } },
          cohort: { select: { id: true, code: true, name: true } },
          group: { select: { id: true, code: true, name: true } },
        },
      },
      documents: {
        select: {
          id: true,
          kind: true,
          fileName: true,
          mimeType: true,
          byteSize: true,
          visibility: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!application) throw new TenantAccessError();
  return application;
}

export async function listAssignableCohorts(context: AuthContext, programmeId: string, intakeId: string) {
  requirePermission(context, 'admissions.read');
  return prisma.cohort.findMany({
    where: { ...tenantWhere(context), programmeId, intakeId, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      groups: {
        where: { isActive: true, deletedAt: null },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      },
    },
    orderBy: { code: 'asc' },
  });
}
