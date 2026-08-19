import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';
import type { AuthContext } from '@/lib/auth/types';
import { DEFAULT_ROLE_PERMISSIONS, type Permission, type RoleKey } from '@/lib/auth/permissions';

/**
 * Integration tests run against the single configured database, `DATABASE_URL`
 * — the same one used for development. There is no separate test database URL.
 *
 * WARNING: `resetDatabase()` below truncates application tables in that
 * database. Every integration suite calls it independently, so those files
 * must not run concurrently (see `fileParallelism` / `maxWorkers` in
 * vitest.config.ts). A second suite truncating while this one is mid-seed
 * produces foreign-key failures on institution-owned rows.
 */
export const databaseUrl = process.env.DATABASE_URL;
/** @deprecated Kept for compatibility; always derives from `DATABASE_URL`. */
export const testDatabaseUrl = databaseUrl;
export const hasTestDatabase = Boolean(databaseUrl);

let client: PrismaClient | null = null;

export function testPrisma(): PrismaClient {
  if (!databaseUrl) throw new Error('DATABASE_URL is not configured.');
  if (!client) {
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  }
  return client;
}

export async function disconnectTestPrisma(): Promise<void> {
  await client?.$disconnect();
  client = null;
}

/** Wipes every table so each suite starts from a known state. */
export async function resetDatabase(): Promise<void> {
  const prisma = testPrisma();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "audit_logs", "documents", "admissions", "applications", "students", "staff",
      "units", "groups", "cohorts", "semesters", "intakes", "academic_years",
      "programmes", "academic_levels", "departments", "sessions", "user_roles", "role_permissions",
      "roles", "permissions", "users", "campuses", "institutions"
    RESTART IDENTITY CASCADE;
  `);
}

/**
 * Builds an auth context directly. Tests exercise server code the same way a
 * request would.
 */
export function authContext(overrides: {
  userId?: string;
  institutionId: string | null;
  roleKeys?: RoleKey[];
  permissions?: Permission[];
  isPlatformAdmin?: boolean;
}): AuthContext {
  const roleKeys = overrides.roleKeys ?? [];
  const permissions = new Set<Permission>(
    overrides.permissions ?? roleKeys.flatMap((role) => [...DEFAULT_ROLE_PERMISSIONS[role]]),
  );

  return {
    userId: overrides.userId ?? '00000000-0000-4000-8000-000000000001',
    authUserId: null,
    email: 'tester@example.test',
    firstName: 'Test',
    lastName: 'User',
    isPlatformAdmin: overrides.isPlatformAdmin ?? false,
    institutionId: overrides.institutionId,
    institution: null,
    roleKeys,
    permissions,
  };
}

export interface SeededTenant {
  institutionId: string;
  programmeId: string;
  studentIds: string[];
  intakeId: string;
  campusId: string;
  academicYearId: string;
  cohortId: string;
  groupId: string;
}

/** Creates a minimal, self-contained tenant for isolation tests. */
export async function seedTenant(slug: string, studentNames: string[]): Promise<SeededTenant> {
  const prisma = testPrisma();

  const institution = await prisma.institution.create({
    data: { slug, name: `${slug} College`, status: 'ACTIVE' },
  });

  const department = await prisma.department.create({
    data: { institutionId: institution.id, code: 'GEN', name: 'General Studies' },
  });

  const programme = await prisma.programme.create({
    data: {
      institutionId: institution.id,
      departmentId: department.id,
      code: 'GEN-DIP',
      name: 'Diploma in General Studies',
      duration: 3,
      stages: 3,
    },
  });

  const academicYear = await prisma.academicYear.create({
    data: {
      institutionId: institution.id,
      code: '2026',
      name: 'Academic Year 2026',
      startDate: new Date('2026-01-05'),
      endDate: new Date('2026-12-11'),
      isCurrent: true,
      status: 'ACTIVE',
    },
  });

  const intake = await prisma.intake.create({
    data: {
      institutionId: institution.id,
      academicYearId: academicYear.id,
      code: 'SEP2026',
      name: 'September 2026',
      startDate: new Date('2026-09-07'),
      status: 'OPEN',
    },
  });

  const campus = await prisma.campus.create({
    data: { institutionId: institution.id, code: 'MAIN', name: 'Main Campus', isMain: true },
  });

  const cohort = await prisma.cohort.create({
    data: {
      institutionId: institution.id,
      programmeId: programme.id,
      intakeId: intake.id,
      academicYearId: academicYear.id,
      code: `${slug.toUpperCase()}-SEP26`,
      name: 'September 2026 cohort',
    },
  });

  const group = await prisma.group.create({
    data: {
      institutionId: institution.id,
      cohortId: cohort.id,
      campusId: campus.id,
      code: `${slug.toUpperCase()}-SEP26-A`,
      name: 'Group A',
    },
  });

  const studentIds: string[] = [];
  for (const [index, name] of studentNames.entries()) {
    const student = await prisma.student.create({
      data: {
        institutionId: institution.id,
        studentNumber: `${slug.toUpperCase()}/${String(index + 1).padStart(3, '0')}`,
        firstName: name,
        lastName: 'Learner',
        programmeId: programme.id,
        status: 'ACTIVE',
      },
    });
    studentIds.push(student.id);
  }

  return {
    institutionId: institution.id,
    programmeId: programme.id,
    studentIds,
    intakeId: intake.id,
    campusId: campus.id,
    academicYearId: academicYear.id,
    cohortId: cohort.id,
    groupId: group.id,
  };
}

export async function seedUser(institutionId: string, email: string): Promise<string> {
  const user = await testPrisma().user.create({
    data: {
      institutionId,
      email,
      firstName: 'Staff',
      lastName: 'Member',
      status: 'ACTIVE',
    },
  });
  return user.id;
}
