import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  disconnectTestPrisma,
  hasTestDatabase,
  resetDatabase,
  seedTenant,
  testPrisma,
} from '../helpers/db';

/**
 * Schema-level guarantees. Business keys are unique *per institution*, so two
 * tenants may legitimately use the same student number or programme code.
 */
describe.skipIf(!hasTestDatabase)('tenant-scoped constraints', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  it('allows the same student number in two different institutions', async () => {
    const prisma = testPrisma();
    const alpha = await seedTenant('constraint-alpha', []);
    const beta = await seedTenant('constraint-beta', []);

    const sharedNumber = 'ADM/2026/0001';

    await prisma.student.create({
      data: {
        institutionId: alpha.institutionId,
        studentNumber: sharedNumber,
        firstName: 'Amina',
        lastName: 'Learner',
      },
    });

    await expect(
      prisma.student.create({
        data: {
          institutionId: beta.institutionId,
          studentNumber: sharedNumber,
          firstName: 'Dennis',
          lastName: 'Learner',
        },
      }),
    ).resolves.toBeTruthy();
  });

  it('rejects a duplicate student number inside one institution', async () => {
    const prisma = testPrisma();
    const tenant = await seedTenant('constraint-gamma', []);

    await prisma.student.create({
      data: {
        institutionId: tenant.institutionId,
        studentNumber: 'DUP/0001',
        firstName: 'First',
        lastName: 'Learner',
      },
    });

    await expect(
      prisma.student.create({
        data: {
          institutionId: tenant.institutionId,
          studentNumber: 'DUP/0001',
          firstName: 'Second',
          lastName: 'Learner',
        },
      }),
    ).rejects.toThrow();
  });

  it('removes tenant data when the institution is deleted', async () => {
    const prisma = testPrisma();
    const tenant = await seedTenant('constraint-delta', ['Solo']);

    await prisma.institution.delete({ where: { id: tenant.institutionId } });

    const remaining = await prisma.student.count({ where: { institutionId: tenant.institutionId } });
    expect(remaining).toBe(0);
  });

  it('allows the same application reference in two institutions', async () => {
    const prisma = testPrisma();
    const alpha = await seedTenant('app-alpha', []);
    const beta = await seedTenant('app-beta', []);
    const shared = 'APP-2026-SHARED';

    await prisma.application.create({
      data: {
        institutionId: alpha.institutionId,
        programmeId: alpha.programmeId,
        intakeId: alpha.intakeId as string,
        reference: shared,
        firstName: 'Amina',
        lastName: 'Applicant',
        email: 'amina@alpha.test',
        accessTokenHash: 'aa'.repeat(32),
      },
    });

    await expect(
      prisma.application.create({
        data: {
          institutionId: beta.institutionId,
          programmeId: beta.programmeId,
          intakeId: beta.intakeId as string,
          reference: shared,
          firstName: 'Dennis',
          lastName: 'Applicant',
          email: 'dennis@beta.test',
          accessTokenHash: 'bb'.repeat(32),
        },
      }),
    ).resolves.toBeTruthy();
  });

  it('rejects a duplicate application reference inside one institution', async () => {
    const prisma = testPrisma();
    const tenant = await seedTenant('app-gamma', []);

    await prisma.application.create({
      data: {
        institutionId: tenant.institutionId,
        programmeId: tenant.programmeId,
        intakeId: tenant.intakeId as string,
        reference: 'APP-2026-DUP001',
        firstName: 'First',
        lastName: 'Applicant',
        email: 'first@gamma.test',
        accessTokenHash: 'cc'.repeat(32),
      },
    });

    await expect(
      prisma.application.create({
        data: {
          institutionId: tenant.institutionId,
          programmeId: tenant.programmeId,
          intakeId: tenant.intakeId as string,
          reference: 'APP-2026-DUP001',
          firstName: 'Second',
          lastName: 'Applicant',
          email: 'second@gamma.test',
          accessTokenHash: 'dd'.repeat(32),
        },
      }),
    ).rejects.toThrow();
  });

  it('cascades applications when the institution is deleted', async () => {
    const prisma = testPrisma();
    const tenant = await seedTenant('app-delta', []);

    await prisma.application.create({
      data: {
        institutionId: tenant.institutionId,
        programmeId: tenant.programmeId,
        intakeId: tenant.intakeId as string,
        reference: 'APP-2026-GONE',
        firstName: 'Gone',
        lastName: 'Applicant',
        email: 'gone@delta.test',
        accessTokenHash: 'ee'.repeat(32),
      },
    });

    await prisma.institution.delete({ where: { id: tenant.institutionId } });
    const remaining = await prisma.application.count({ where: { institutionId: tenant.institutionId } });
    expect(remaining).toBe(0);
  });
});
