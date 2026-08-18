import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';
import type { AuthContext } from '@/lib/auth/types';
import { DEFAULT_ROLE_PERMISSIONS, type Permission, type RoleKey } from '@/lib/auth/permissions';

/** Integration tests only run when a disposable PostgreSQL database is provided. */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL;
export const hasTestDatabase = Boolean(testDatabaseUrl);

let client: PrismaClient | null = null;

export function testPrisma(): PrismaClient {
  if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is not configured.');
  if (!client) {
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) });
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
      "audit_logs", "students", "staff", "units", "groups", "cohorts", "semesters",
      "intakes", "academic_years", "programmes", "academic_levels", "departments",
      "user_roles", "role_permissions", "roles", "permissions", "users", "campuses",
      "institutions"
    RESTART IDENTITY CASCADE;
  `);
}

/**
 * Builds an auth context directly. Tests exercise server code the same way a
 * request would, but without needing a live Supabase session.
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

  return { institutionId: institution.id, programmeId: programme.id, studentIds };
}
