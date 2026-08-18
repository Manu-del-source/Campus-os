import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DomainError, ForbiddenError, TenantAccessError } from '@/lib/auth/errors';
import { ALL_PERMISSIONS, permissionModule } from '@/lib/auth/permissions';
import {
  issueOffer,
  registerApplicant,
  rejectApplication,
  startApplicationReview,
} from '@/server/admissions/actions';
import {
  acceptPublicOffer,
  createPublicApplication,
  getPublicApplication,
  submitPublicApplication,
  withdrawPublicApplication,
} from '@/server/admissions/public';
import { getApplicationById, listApplications } from '@/server/admissions/queries';
import { applicationListQuerySchema } from '@/server/admissions/schemas';
import { getStudentForViewer } from '@/server/students/queries';
import {
  authContext,
  disconnectTestPrisma,
  hasTestDatabase,
  resetDatabase,
  seedTenant,
  seedUser,
  testPrisma,
  type SeededTenant,
} from '../helpers/db';

describe.skipIf(!hasTestDatabase)('admissions workflow', () => {
  let tenant: SeededTenant;
  let other: SeededTenant;
  let registrarUserId: string;

  beforeAll(async () => {
    await resetDatabase();
    const prisma = testPrisma();
    for (const key of ALL_PERMISSIONS) {
      await prisma.permission.upsert({
        where: { key },
        create: { key, module: permissionModule(key) },
        update: {},
      });
    }
    tenant = await seedTenant('admit-alpha', ['Amina']);
    other = await seedTenant('admit-beta', ['Dennis']);

    await prisma.institution.update({
      where: { id: tenant.institutionId },
      data: { slug: 'admit-alpha', status: 'ACTIVE' },
    });

    await prisma.role.create({
      data: { institutionId: tenant.institutionId, key: 'STUDENT', name: 'Student', isSystem: true },
    });
    registrarUserId = await seedUser(tenant.institutionId, 'registrar@admit-alpha.test');
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  async function startDraft() {
    return createPublicApplication({
      institutionSlug: 'admit-alpha',
      programmeId: tenant.programmeId,
      intakeId: tenant.intakeId as string,
      firstName: 'Wanjiku',
      lastName: 'Mwangi',
      email: `wanjiku.${Date.now()}@example.test`,
    });
  }

  it('creates a draft with a unique reference and opaque access token', async () => {
    const created = await startDraft();
    expect(created.application.status).toBe('DRAFT');
    expect(created.application.reference).toMatch(/^APP-\d{4}-[A-Z2-9]{6}$/);
    expect(created.accessToken).toHaveLength(64);
    expect(created.application).not.toHaveProperty('accessTokenHash');
  });

  it('refuses to create an application against another tenant programme', async () => {
    await expect(
      createPublicApplication({
        institutionSlug: 'admit-alpha',
        programmeId: other.programmeId,
        intakeId: tenant.intakeId as string,
        firstName: 'Intruder',
        lastName: 'Person',
        email: 'intruder@example.test',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('hides an application from a caller with the wrong token', async () => {
    const created = await startDraft();
    await expect(
      getPublicApplication({
        institutionSlug: 'admit-alpha',
        reference: created.application.reference,
        token: '0'.repeat(64),
      }),
    ).rejects.toBeInstanceOf(TenantAccessError);
  });

  it('submits, reviews, offers, accepts and registers an applicant', async () => {
    const created = await startDraft();
    const lookup = {
      institutionSlug: 'admit-alpha',
      reference: created.application.reference,
      token: created.accessToken,
    };

    const submitted = await submitPublicApplication(lookup);
    expect(submitted.status).toBe('SUBMITTED');

    const registrar = authContext({ userId: registrarUserId, institutionId: tenant.institutionId, roleKeys: ['REGISTRAR'] });
    const reviewed = await startApplicationReview(registrar, { applicationId: submitted.id });
    expect(reviewed.status).toBe('UNDER_REVIEW');

    const offered = await issueOffer(registrar, {
      applicationId: submitted.id,
      cohortId: tenant.cohortId,
      groupId: tenant.groupId,
      conditions: 'Bring original certificates.',
    });
    expect(offered.application.status).toBe('OFFERED');
    expect(offered.admission.cohortId).toBe(tenant.cohortId);

    const accepted = await acceptPublicOffer(lookup);
    expect(accepted.status).toBe('ACCEPTED');

    const registered = await registerApplicant(registrar, { applicationId: submitted.id });
    expect(registered.student.status).toBe('ADMITTED');
    expect(registered.student.applicationReference).toBe(created.application.reference);
    expect(registered.student.userId).toBe(registered.user.id);

    const detail = await getApplicationById(registrar, submitted.id);
    expect(detail.admission?.studentId).toBe(registered.student.id);
  });

  it('rejects an illegal skip from submitted to offered', async () => {
    const created = await startDraft();
    const submitted = await submitPublicApplication({
      institutionSlug: 'admit-alpha',
      reference: created.application.reference,
      token: created.accessToken,
    });
    const registrar = authContext({ userId: registrarUserId, institutionId: tenant.institutionId, roleKeys: ['REGISTRAR'] });
    await expect(issueOffer(registrar, { applicationId: submitted.id })).rejects.toBeInstanceOf(DomainError);
  });

  it('lets staff reject a reviewed application', async () => {
    const created = await startDraft();
    const lookup = {
      institutionSlug: 'admit-alpha',
      reference: created.application.reference,
      token: created.accessToken,
    };
    const submitted = await submitPublicApplication(lookup);
    const registrar = authContext({ userId: registrarUserId, institutionId: tenant.institutionId, roleKeys: ['REGISTRAR'] });
    await startApplicationReview(registrar, { applicationId: submitted.id });
    const rejected = await rejectApplication(registrar, {
      applicationId: submitted.id,
      note: 'Incomplete documentation.',
    });
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.decisionNote).toBe('Incomplete documentation.');
  });

  it('lets the applicant withdraw a draft', async () => {
    const created = await startDraft();
    const withdrawn = await withdrawPublicApplication({
      institutionSlug: 'admit-alpha',
      reference: created.application.reference,
      token: created.accessToken,
    });
    expect(withdrawn.status).toBe('WITHDRAWN');
  });

  it('refuses review without admissions.review', async () => {
    const created = await startDraft();
    const submitted = await submitPublicApplication({
      institutionSlug: 'admit-alpha',
      reference: created.application.reference,
      token: created.accessToken,
    });
    const lecturer = authContext({ institutionId: tenant.institutionId, roleKeys: ['LECTURER'] });
    await expect(startApplicationReview(lecturer, { applicationId: submitted.id })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('refuses staff listing without admissions.read', async () => {
    const lecturer = authContext({ institutionId: tenant.institutionId, roleKeys: ['LECTURER'] });
    await expect(listApplications(lecturer, applicationListQuerySchema.parse({}))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('cannot register before the offer is accepted', async () => {
    const created = await startDraft();
    const lookup = {
      institutionSlug: 'admit-alpha',
      reference: created.application.reference,
      token: created.accessToken,
    };
    const submitted = await submitPublicApplication(lookup);
    const registrar = authContext({ userId: registrarUserId, institutionId: tenant.institutionId, roleKeys: ['REGISTRAR'] });
    await startApplicationReview(registrar, { applicationId: submitted.id });
    await issueOffer(registrar, { applicationId: submitted.id });
    await expect(registerApplicant(registrar, { applicationId: submitted.id })).rejects.toBeInstanceOf(DomainError);
  });

  it('lets the registered learner view their own student record', async () => {
    const created = await startDraft();
    const lookup = {
      institutionSlug: 'admit-alpha',
      reference: created.application.reference,
      token: created.accessToken,
    };
    const submitted = await submitPublicApplication(lookup);
    const registrar = authContext({ userId: registrarUserId, institutionId: tenant.institutionId, roleKeys: ['REGISTRAR'] });
    await startApplicationReview(registrar, { applicationId: submitted.id });
    await issueOffer(registrar, { applicationId: submitted.id });
    await acceptPublicOffer(lookup);
    const registered = await registerApplicant(registrar, { applicationId: submitted.id });

    const learner = authContext({
      userId: registered.user.id,
      institutionId: tenant.institutionId,
      roleKeys: ['STUDENT'],
    });
    const viewed = await getStudentForViewer(learner, registered.student.id);
    expect(viewed.studentNumber).toBe(registered.student.studentNumber);
  });
});
