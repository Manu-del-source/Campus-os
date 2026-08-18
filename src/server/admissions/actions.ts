import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import type { ApplicationStatus } from '@/generated/prisma/client';
import {
  issueOfferSchema,
  registerApplicantSchema,
  rejectApplicationSchema,
  reviewApplicationSchema,
  type IssueOfferInput,
  type RegisterApplicantInput,
} from '@/server/admissions/schemas';
import { assertTransition } from '@/server/admissions/workflow';
import { generateStudentNumber } from '@/server/admissions/references';
import { putDocumentObject } from '@/server/documents/storage';

async function loadOwnedApplication(context: AuthContext, id: string) {
  const application = await prisma.application.findFirst({
    where: { id, ...tenantWhere(context) },
    include: {
      programme: { select: { id: true, code: true, name: true, levelId: true } },
      intake: { select: { id: true, code: true } },
      institution: { select: { id: true, name: true, shortName: true, slug: true } },
      admission: true,
    },
  });
  if (!application) throw new TenantAccessError();
  return application;
}

async function moveStatus(
  context: AuthContext,
  applicationId: string,
  to: ApplicationStatus,
  extra: {
    permission: 'admissions.review' | 'admissions.approve' | 'admissions.offer' | 'admissions.register';
    note?: string;
  },
) {
  requirePermission(context, extra.permission);
  const application = await loadOwnedApplication(context, applicationId);
  assertTransition(application.status, to);

  return prisma.application.update({
    where: { id: application.id },
    data: {
      status: to,
      reviewedAt: new Date(),
      reviewedById: context.userId,
      decisionNote: extra.note ?? application.decisionNote,
      withdrawnAt: to === 'WITHDRAWN' ? new Date() : application.withdrawnAt,
    },
  });
}

export async function startApplicationReview(context: AuthContext, raw: { applicationId: string; note?: string }) {
  const input = reviewApplicationSchema.parse(raw);
  const updated = await moveStatus(context, input.applicationId, 'UNDER_REVIEW', {
    permission: 'admissions.review',
    note: input.note,
  });

  await recordAudit(context, {
    action: 'application.reviewed',
    entityType: 'Application',
    entityId: updated.id,
    summary: `Application ${updated.reference} moved to review`,
  });

  return updated;
}

export async function rejectApplication(context: AuthContext, raw: { applicationId: string; note: string }) {
  const input = rejectApplicationSchema.parse(raw);
  const updated = await moveStatus(context, input.applicationId, 'REJECTED', {
    permission: 'admissions.approve',
    note: input.note,
  });

  await recordAudit(context, {
    action: 'application.rejected',
    entityType: 'Application',
    entityId: updated.id,
    summary: `Application ${updated.reference} rejected`,
    metadata: { note: input.note },
  });

  return updated;
}

export async function withdrawApplicationAsStaff(
  context: AuthContext,
  raw: { applicationId: string; note?: string },
) {
  const input = reviewApplicationSchema.parse(raw);
  const updated = await moveStatus(context, input.applicationId, 'WITHDRAWN', {
    permission: 'admissions.review',
    note: input.note,
  });

  await recordAudit(context, {
    action: 'application.withdrawn',
    entityType: 'Application',
    entityId: updated.id,
    summary: `Application ${updated.reference} withdrawn by staff`,
  });

  return updated;
}

export async function issueOffer(context: AuthContext, raw: IssueOfferInput) {
  requirePermission(context, 'admissions.offer');
  const input = issueOfferSchema.parse(raw);
  const application = await loadOwnedApplication(context, input.applicationId);
  assertTransition(application.status, 'OFFERED');

  if (input.cohortId) {
    const cohort = await prisma.cohort.findFirst({
      where: { id: input.cohortId, ...tenantWhere(context), deletedAt: null },
    });
    if (!cohort) throw new TenantAccessError();
    if (cohort.programmeId !== application.programmeId || cohort.intakeId !== application.intakeId) {
      throw new DomainError('The selected cohort does not match this application.');
    }
  }

  if (input.groupId) {
    const group = await prisma.group.findFirst({
      where: { id: input.groupId, ...tenantWhere(context), deletedAt: null },
    });
    if (!group) throw new TenantAccessError();
    if (input.cohortId && group.cohortId !== input.cohortId) {
      throw new DomainError('The selected group does not belong to that cohort.');
    }
  }

  const offerBody = [
    `Offer of admission`,
    ``,
    `${application.institution.name ?? application.institution.slug}`,
    `Reference: ${application.reference}`,
    `Applicant: ${application.firstName} ${application.lastName}`,
    `Programme: ${application.programme.name}`,
    input.conditions ? `Conditions: ${input.conditions}` : null,
    input.expiresAt ? `Offer expires: ${input.expiresAt.toISOString()}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const stored = await putDocumentObject(application.institutionId, Buffer.from(offerBody, 'utf8'));

  const updated = await prisma.$transaction(async (tx) => {
    const admission = await tx.admission.upsert({
      where: { applicationId: application.id },
      create: {
        institutionId: application.institutionId,
        applicationId: application.id,
        cohortId: input.cohortId,
        groupId: input.groupId,
        offerIssuedAt: new Date(),
        offerExpiresAt: input.expiresAt,
        conditions: input.conditions,
      },
      update: {
        cohortId: input.cohortId,
        groupId: input.groupId,
        offerIssuedAt: new Date(),
        offerExpiresAt: input.expiresAt,
        conditions: input.conditions,
      },
    });

    await tx.document.create({
      data: {
        institutionId: application.institutionId,
        applicationId: application.id,
        uploadedById: context.userId,
        kind: 'OFFER_LETTER',
        fileName: `${application.reference}-offer.txt`,
        mimeType: 'text/plain',
        byteSize: stored.byteSize,
        storageKey: stored.storageKey,
        checksum: stored.checksum,
        visibility: 'PRIVATE',
      },
    });

    const next = await tx.application.update({
      where: { id: application.id },
      data: {
        status: 'OFFERED',
        reviewedAt: new Date(),
        reviewedById: context.userId,
      },
    });

    return { admission, application: next };
  });

  await recordAudit(context, {
    action: 'application.offered',
    entityType: 'Application',
    entityId: application.id,
    summary: `Offer issued for ${application.reference}`,
  });

  return updated;
}

export async function registerApplicant(context: AuthContext, raw: RegisterApplicantInput) {
  requirePermission(context, 'admissions.register');
  requirePermission(context, 'students.create');
  const input = registerApplicantSchema.parse(raw);
  const application = await loadOwnedApplication(context, input.applicationId);

  if (application.status !== 'ACCEPTED') {
    throw new DomainError('Only an accepted application can be registered.');
  }
  if (!application.admission) {
    throw new DomainError('An offer must exist before registration.');
  }
  if (application.admission.studentId) {
    throw new DomainError('This applicant has already been registered.');
  }

  const institutionId = application.institutionId;
  const prefix = application.institution.shortName ?? application.institution.slug;
  let studentNumber = generateStudentNumber(prefix);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const clash = await prisma.student.findFirst({
      where: { institutionId, studentNumber },
      select: { id: true },
    });
    if (!clash) break;
    studentNumber = generateStudentNumber(prefix);
  }

  const studentRole = await prisma.role.findFirst({
    where: { institutionId, key: 'STUDENT' },
    select: { id: true },
  });

  const registered = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        institutionId,
        email: application.email,
        firstName: application.firstName,
        lastName: application.lastName,
        phone: application.phone,
        status: 'INVITED',
      },
    });

    if (studentRole) {
      await tx.userRole.create({
        data: { userId: user.id, roleId: studentRole.id, institutionId },
      });
    }

    const student = await tx.student.create({
      data: {
        institutionId,
        userId: user.id,
        studentNumber,
        applicationReference: application.reference,
        firstName: application.firstName,
        middleName: application.middleName,
        lastName: application.lastName,
        dateOfBirth: application.dateOfBirth,
        gender: application.gender,
        nationalId: application.nationalId,
        nationality: application.nationality,
        email: application.email,
        phone: application.phone,
        addressLine1: application.addressLine1,
        city: application.city,
        county: application.county,
        postalCode: application.postalCode,
        guardianName: application.guardianName,
        guardianRelationship: application.guardianRelationship,
        guardianPhone: application.guardianPhone,
        guardianEmail: application.guardianEmail,
        programmeId: application.programmeId,
        levelId: application.programme.levelId,
        intakeId: application.intakeId,
        campusId: application.campusId,
        cohortId: input.cohortId ?? application.admission?.cohortId,
        groupId: input.groupId ?? application.admission?.groupId,
        status: 'ADMITTED',
        admissionDate: new Date(),
      },
    });

    await tx.document.updateMany({
      where: { applicationId: application.id, institutionId },
      data: { studentId: student.id },
    });

    await tx.admission.update({
      where: { id: application.admission!.id },
      data: {
        studentId: student.id,
        registeredAt: new Date(),
        cohortId: input.cohortId ?? application.admission?.cohortId,
        groupId: input.groupId ?? application.admission?.groupId,
      },
    });

    return { student, user };
  });

  await recordAudit(context, {
    action: 'admission.registered',
    entityType: 'Student',
    entityId: registered.student.id,
    summary: `Registered ${application.reference} as ${studentNumber}`,
    metadata: { applicationId: application.id, studentNumber },
  });

  await recordAudit(context, {
    action: 'student.created',
    entityType: 'Student',
    entityId: registered.student.id,
    summary: `Student ${studentNumber} created from application ${application.reference}`,
  });

  return registered;
}
