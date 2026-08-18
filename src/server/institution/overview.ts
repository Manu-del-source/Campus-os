import 'server-only';

import { tenantWhere } from '@/lib/auth/authorization';
import type { AuthContext } from '@/lib/auth/types';
import { prisma } from '@/lib/db';

/**
 * Institution dashboard data.
 *
 * Every figure is a real, tenant-scoped database query — the product never
 * renders invented statistics. Modules that do not exist yet are simply absent
 * from the response rather than mocked.
 */
export interface InstitutionOverview {
  counts: {
    students: number;
    activeStudents: number;
    applicants: number;
    staff: number;
    programmes: number;
    departments: number;
    cohorts: number;
    units: number;
  };
  currentAcademicYear: { code: string; name: string; startDate: Date; endDate: Date } | null;
  openIntakes: { id: string; code: string; name: string; startDate: Date }[];
  recentStudents: {
    id: string;
    studentNumber: string;
    firstName: string;
    lastName: string;
    status: string;
    programmeName: string | null;
    createdAt: Date;
  }[];
}

export async function getInstitutionOverview(context: AuthContext): Promise<InstitutionOverview> {
  const scope = tenantWhere(context);
  const notDeleted = { ...scope, deletedAt: null };

  const [
    students,
    activeStudents,
    applicants,
    staff,
    programmes,
    departments,
    cohorts,
    units,
    currentAcademicYear,
    openIntakes,
    recentStudents,
  ] = await Promise.all([
    prisma.student.count({ where: notDeleted }),
    prisma.student.count({ where: { ...notDeleted, status: 'ACTIVE' } }),
    prisma.student.count({ where: { ...notDeleted, status: 'APPLICANT' } }),
    prisma.staff.count({ where: { ...notDeleted, employmentStatus: { in: ['ACTIVE', 'PROBATION'] } } }),
    prisma.programme.count({ where: { ...notDeleted, isActive: true } }),
    prisma.department.count({ where: { ...notDeleted, isActive: true } }),
    prisma.cohort.count({ where: notDeleted }),
    prisma.unit.count({ where: { ...notDeleted, isActive: true } }),
    prisma.academicYear.findFirst({
      where: { ...scope, isCurrent: true },
      select: { code: true, name: true, startDate: true, endDate: true },
    }),
    prisma.intake.findMany({
      where: { ...scope, status: 'OPEN' },
      select: { id: true, code: true, name: true, startDate: true },
      orderBy: { startDate: 'asc' },
      take: 5,
    }),
    prisma.student.findMany({
      where: notDeleted,
      select: {
        id: true,
        studentNumber: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        programme: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
  ]);

  return {
    counts: { students, activeStudents, applicants, staff, programmes, departments, cohorts, units },
    currentAcademicYear,
    openIntakes,
    recentStudents: recentStudents.map((student) => ({
      id: student.id,
      studentNumber: student.studentNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      status: student.status,
      programmeName: student.programme?.name ?? null,
      createdAt: student.createdAt,
    })),
  };
}
