import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TenantAccessError } from '@/lib/auth/errors';
import { ForbiddenError } from '@/lib/auth/errors';
import { assertTenantAccess } from '@/lib/auth/authorization';
import { getStudentById, getStudentForViewer, listStudents, studentListQuerySchema } from '@/server/students/queries';
import { getInstitutionOverview } from '@/server/institution/overview';
import { getApplicationById, listApplications } from '@/server/admissions/queries';
import { applicationListQuerySchema } from '@/server/admissions/schemas';
import { generateAccessToken, hashAccessToken } from '@/server/admissions/references';
import { getDocumentForViewer } from '@/server/documents/access';
import {
  authContext,
  disconnectTestPrisma,
  hasTestDatabase,
  resetDatabase,
  seedTenant,
  testPrisma,
  type SeededTenant,
} from '../helpers/db';

/**
 * MANDATORY SECURITY TEST
 *
 * A session belonging to Institution A must never be able to read, count or
 * resolve data owned by Institution B — not through list queries, not through
 * a direct id lookup, and not through aggregate figures.
 */
describe.skipIf(!hasTestDatabase)('tenant isolation', () => {
  let tenantA: SeededTenant;
  let tenantB: SeededTenant;

  beforeAll(async () => {
    await resetDatabase();
    tenantA = await seedTenant('alpha-institute', ['Amina', 'Brian', 'Cynthia']);
    tenantB = await seedTenant('beta-college', ['Dennis', 'Esther']);
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  const query = studentListQuerySchema.parse({});

  it('lists only students belonging to the caller institution', async () => {
    const contextA = authContext({ institutionId: tenantA.institutionId, roleKeys: ['REGISTRAR'] });
    const contextB = authContext({ institutionId: tenantB.institutionId, roleKeys: ['REGISTRAR'] });

    const resultA = await listStudents(contextA, query);
    const resultB = await listStudents(contextB, query);

    expect(resultA.total).toBe(3);
    expect(resultB.total).toBe(2);

    const namesA = resultA.rows.map((row) => row.fullName);
    expect(namesA).not.toContain('Dennis Learner');
    expect(namesA).not.toContain('Esther Learner');

    const idsA = new Set(resultA.rows.map((row) => row.id));
    for (const id of tenantB.studentIds) {
      expect(idsA.has(id)).toBe(false);
    }
  });

  it('never resolves a student id from another institution', async () => {
    const contextA = authContext({ institutionId: tenantA.institutionId, roleKeys: ['REGISTRAR'] });

    for (const foreignId of tenantB.studentIds) {
      const record = await getStudentById(contextA, foreignId);
      expect(record).toBeNull();
    }

    const ownRecord = await getStudentById(contextA, tenantA.studentIds[0]);
    expect(ownRecord?.id).toBe(tenantA.studentIds[0]);
  });

  it('rejects a foreign record even when it was loaded by primary key', async () => {
    const prisma = testPrisma();
    const contextA = authContext({ institutionId: tenantA.institutionId, roleKeys: ['REGISTRAR'] });

    // Simulates a careless lookup that forgot the tenant filter: the guard
    // still refuses the record.
    const foreign = await prisma.student.findUnique({ where: { id: tenantB.studentIds[0] } });
    expect(foreign).not.toBeNull();
    expect(() => assertTenantAccess(contextA, foreign)).toThrow(TenantAccessError);
  });

  it('keeps dashboard aggregates within the tenant', async () => {
    const contextA = authContext({ institutionId: tenantA.institutionId, roleKeys: ['INSTITUTION_ADMIN'] });
    const contextB = authContext({ institutionId: tenantB.institutionId, roleKeys: ['INSTITUTION_ADMIN'] });

    const overviewA = await getInstitutionOverview(contextA);
    const overviewB = await getInstitutionOverview(contextB);

    expect(overviewA.counts.students).toBe(3);
    expect(overviewB.counts.students).toBe(2);
    expect(overviewA.counts.programmes).toBe(1);
    expect(overviewA.recentStudents.every((student) => student.studentNumber.startsWith('ALPHA'))).toBe(true);
  });

  it('refuses tenant queries from a session without an institution', async () => {
    const platform = authContext({ institutionId: null, isPlatformAdmin: true, roleKeys: ['PLATFORM_ADMIN'] });
    await expect(listStudents(platform, query)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuses student queries without the students.read permission', async () => {
    const lecturerWithoutRead = authContext({
      institutionId: tenantA.institutionId,
      permissions: ['timetable.read'],
    });
    await expect(listStudents(lecturerWithoutRead, query)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lists only applications belonging to the caller institution', async () => {
    const prisma = testPrisma();
    await prisma.application.create({
      data: {
        institutionId: tenantA.institutionId,
        programmeId: tenantA.programmeId,
        intakeId: tenantA.intakeId,
        reference: 'APP-2026-ALPHA1',
        firstName: 'Asha',
        lastName: 'Applicant',
        email: 'asha@alpha.test',
        accessTokenHash: hashAccessToken(generateAccessToken()),
        status: 'SUBMITTED',
      },
    });
    await prisma.application.create({
      data: {
        institutionId: tenantB.institutionId,
        programmeId: tenantB.programmeId,
        intakeId: tenantB.intakeId,
        reference: 'APP-2026-BETA1',
        firstName: 'Beryl',
        lastName: 'Applicant',
        email: 'beryl@beta.test',
        accessTokenHash: hashAccessToken(generateAccessToken()),
        status: 'SUBMITTED',
      },
    });

    const contextA = authContext({ institutionId: tenantA.institutionId, roleKeys: ['REGISTRAR'] });
    const result = await listApplications(contextA, applicationListQuerySchema.parse({}));
    expect(result.total).toBe(1);
    expect(result.rows[0]?.email).toBe('asha@alpha.test');
    expect(result.rows.map((row) => row.email)).not.toContain('beryl@beta.test');
  });

  it('never resolves an application id from another institution', async () => {
    const prisma = testPrisma();
    const foreign = await prisma.application.create({
      data: {
        institutionId: tenantB.institutionId,
        programmeId: tenantB.programmeId,
        intakeId: tenantB.intakeId,
        reference: 'APP-2026-BETA2',
        firstName: 'Cora',
        lastName: 'Applicant',
        email: 'cora@beta.test',
        accessTokenHash: hashAccessToken(generateAccessToken()),
      },
    });

    const contextA = authContext({ institutionId: tenantA.institutionId, roleKeys: ['REGISTRAR'] });
    await expect(getApplicationById(contextA, foreign.id)).rejects.toBeInstanceOf(TenantAccessError);
  });

  it('returns 404 when a learner probes another student id', async () => {
    const prisma = testPrisma();
    const user = await prisma.user.create({
      data: {
        institutionId: tenantA.institutionId,
        email: 'learner@alpha.test',
        firstName: 'Own',
        lastName: 'Learner',
        status: 'ACTIVE',
      },
    });
    await prisma.student.update({
      where: { id: tenantA.studentIds[0] },
      data: { userId: user.id },
    });

    const learner = authContext({
      userId: user.id,
      institutionId: tenantA.institutionId,
      roleKeys: ['STUDENT'],
    });

    const own = await getStudentForViewer(learner, tenantA.studentIds[0]);
    expect(own.id).toBe(tenantA.studentIds[0]);

    await expect(getStudentForViewer(learner, tenantA.studentIds[1])).rejects.toBeInstanceOf(TenantAccessError);
    await expect(getStudentForViewer(learner, tenantB.studentIds[0])).rejects.toBeInstanceOf(TenantAccessError);
  });

  it('does not leak another tenant document to staff', async () => {
    const prisma = testPrisma();
    const document = await prisma.document.create({
      data: {
        institutionId: tenantB.institutionId,
        kind: 'IDENTITY',
        fileName: 'id.pdf',
        mimeType: 'application/pdf',
        byteSize: 12,
        storageKey: 'missing',
      },
    });

    const contextA = authContext({ institutionId: tenantA.institutionId, roleKeys: ['REGISTRAR'] });
    await expect(getDocumentForViewer(contextA, document.id)).rejects.toBeInstanceOf(TenantAccessError);
  });
});
