import 'server-only';

import { prisma } from '@/lib/db';

/**
 * Platform-wide aggregates.
 *
 * This is the only place in the product that reads across tenants, and every
 * caller must have passed `requirePlatformAdmin()` first.
 */
export interface PlatformOverview {
  institutionCount: number;
  activeInstitutionCount: number;
  userCount: number;
  studentCount: number;
  institutions: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
    createdAt: Date;
    studentCount: number;
  }[];
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const [institutionCount, activeInstitutionCount, userCount, studentCount, institutions] =
    await Promise.all([
      prisma.institution.count({ where: { deletedAt: null } }),
      prisma.institution.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.student.count({ where: { deletedAt: null } }),
      prisma.institution.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          status: true,
          createdAt: true,
          _count: { select: { students: true } },
        },
      }),
    ]);

  return {
    institutionCount,
    activeInstitutionCount,
    userCount,
    studentCount,
    institutions: institutions.map((institution) => ({
      id: institution.id,
      name: institution.name,
      slug: institution.slug,
      type: institution.type,
      status: institution.status,
      createdAt: institution.createdAt,
      studentCount: institution._count.students,
    })),
  };
}
