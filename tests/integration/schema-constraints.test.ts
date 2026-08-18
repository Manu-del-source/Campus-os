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
});
