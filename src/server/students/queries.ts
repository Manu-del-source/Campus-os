import 'server-only';

import { z } from 'zod';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import type { AuthContext } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import type { Prisma, StudentStatus } from '@/generated/prisma/client';

/** Query input arrives from the URL, so it is validated before it reaches Prisma. */
export const studentListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z
    .enum([
      'APPLICANT',
      'ADMITTED',
      'ACTIVE',
      'SUSPENDED',
      'DEFERRED',
      'COMPLETED',
      'GRADUATED',
      'WITHDRAWN',
      'DISCONTINUED',
    ])
    .optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type StudentListQuery = z.infer<typeof studentListQuerySchema>;

export interface StudentListRow {
  id: string;
  studentNumber: string;
  fullName: string;
  status: StudentStatus;
  programmeName: string | null;
  cohortCode: string | null;
  groupCode: string | null;
  email: string | null;
}

export interface StudentListResult {
  rows: StudentListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listStudents(
  context: AuthContext,
  query: StudentListQuery,
): Promise<StudentListResult> {
  requirePermission(context, 'students.read');

  const where: Prisma.StudentWhereInput = {
    ...tenantWhere(context),
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { studentNumber: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        studentNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        status: true,
        email: true,
        programme: { select: { name: true } },
        cohort: { select: { code: true } },
        group: { select: { code: true } },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: students.map((student) => ({
      id: student.id,
      studentNumber: student.studentNumber,
      fullName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' '),
      status: student.status,
      programmeName: student.programme?.name ?? null,
      cohortCode: student.cohort?.code ?? null,
      groupCode: student.group?.code ?? null,
      email: student.email,
    })),
  };
}

/**
 * Single student lookup. The tenant filter is part of the query itself, so an
 * id belonging to another institution simply does not resolve (no IDOR).
 */
export async function getStudentById(context: AuthContext, id: string) {
  requirePermission(context, 'students.read');

  return prisma.student.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
    include: {
      programme: { select: { code: true, name: true } },
      cohort: { select: { code: true, name: true } },
      group: { select: { code: true, name: true } },
      intake: { select: { code: true, name: true } },
      level: { select: { code: true, name: true } },
    },
  });
}
