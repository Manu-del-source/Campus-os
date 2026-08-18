import 'server-only';

import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import {
  accessTokenMatches,
  generateAccessToken,
  generateApplicationReference,
  hashAccessToken,
} from '@/server/admissions/references';
import {
  createApplicationSchema,
  publicApplicationLookupSchema,
  type CreateApplicationInput,
  type PublicApplicationLookup,
} from '@/server/admissions/schemas';
import { assertTransition } from '@/server/admissions/workflow';

const publicSelect = {
  id: true,
  reference: true,
  status: true,
  firstName: true,
  lastName: true,
  email: true,
  submittedAt: true,
  decisionNote: true,
  createdAt: true,
  institution: { select: { slug: true, name: true, shortName: true } },
  programme: { select: { code: true, name: true } },
  intake: { select: { code: true, name: true, status: true, startDate: true } },
  admission: {
    select: {
      offerIssuedAt: true,
      offerExpiresAt: true,
      offerAcceptedAt: true,
      registeredAt: true,
      conditions: true,
    },
  },
} satisfies Prisma.ApplicationSelect;

export type PublicApplicationView = Prisma.ApplicationGetPayload<{ select: typeof publicSelect }>;

export interface CreatedApplication {
  application: PublicApplicationView;
  accessToken: string;
}

async function loadOpenCatalogue(slug: string) {
  const institution = await prisma.institution.findFirst({
    where: { slug, status: 'ACTIVE', deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      shortName: true,
      programmes: {
        where: { isActive: true, deletedAt: null },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      },
      intakes: {
        where: { status: 'OPEN' },
        select: { id: true, code: true, name: true, startDate: true },
        orderBy: { startDate: 'asc' },
      },
      campuses: {
        where: { isActive: true, deletedAt: null },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!institution) throw new TenantAccessError();
  return institution;
}

export async function listPublicInstitutions() {
  return prisma.institution.findMany({
    where: { status: 'ACTIVE', deletedAt: null, intakes: { some: { status: 'OPEN' } } },
    select: { slug: true, name: true, shortName: true, city: true, type: true },
    orderBy: { name: 'asc' },
  });
}

export async function getPublicApplyCatalogue(slug: string) {
  return loadOpenCatalogue(slug);
}

async function allocateReference(institutionId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const reference = generateApplicationReference();
    const existing = await prisma.application.findFirst({
      where: { institutionId, reference },
      select: { id: true },
    });
    if (!existing) return reference;
  }
  throw new DomainError('Could not allocate a unique application reference.');
}

export async function createPublicApplication(raw: CreateApplicationInput): Promise<CreatedApplication> {
  const input = createApplicationSchema.parse(raw);
  const institution = await loadOpenCatalogue(input.institutionSlug);

  const programme = institution.programmes.find((item) => item.id === input.programmeId);
  const intake = institution.intakes.find((item) => item.id === input.intakeId);
  if (!programme || !intake) {
    throw new DomainError('The selected programme or intake is not open for applications.');
  }

  if (input.campusId && !institution.campuses.some((campus) => campus.id === input.campusId)) {
    throw new DomainError('The selected campus does not belong to this institution.');
  }

  const accessToken = generateAccessToken();
  const reference = await allocateReference(institution.id);

  const application = await prisma.application.create({
    data: {
      institutionId: institution.id,
      programmeId: programme.id,
      intakeId: intake.id,
      campusId: input.campusId,
      reference,
      status: 'DRAFT',
      firstName: input.firstName,
      middleName: input.middleName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      nationalId: input.nationalId,
      nationality: input.nationality ?? 'KE',
      addressLine1: input.addressLine1,
      city: input.city,
      county: input.county,
      postalCode: input.postalCode,
      guardianName: input.guardianName,
      guardianRelationship: input.guardianRelationship,
      guardianPhone: input.guardianPhone,
      guardianEmail: input.guardianEmail || undefined,
      accessTokenHash: hashAccessToken(accessToken),
    },
    select: publicSelect,
  });

  await recordAudit(null, {
    action: 'application.created',
    entityType: 'Application',
    entityId: application.id,
    institutionId: institution.id,
    summary: `Draft application ${reference} created`,
    metadata: { reference, email: input.email },
  });

  return { application, accessToken };
}

async function loadPublicApplication(lookup: PublicApplicationLookup) {
  const parsed = publicApplicationLookupSchema.parse(lookup);
  const application = await prisma.application.findFirst({
    where: {
      reference: parsed.reference,
      institution: { slug: parsed.institutionSlug, deletedAt: null },
    },
    select: { ...publicSelect, accessTokenHash: true, institutionId: true },
  });

  if (!application || !accessTokenMatches(parsed.token, application.accessTokenHash)) {
    throw new TenantAccessError();
  }

  const view: PublicApplicationView = {
    id: application.id,
    reference: application.reference,
    status: application.status,
    firstName: application.firstName,
    lastName: application.lastName,
    email: application.email,
    submittedAt: application.submittedAt,
    decisionNote: application.decisionNote,
    createdAt: application.createdAt,
    institution: application.institution,
    programme: application.programme,
    intake: application.intake,
    admission: application.admission,
  };
  return { view, institutionId: application.institutionId, applicationId: application.id, status: application.status };
}

export async function getPublicApplication(lookup: PublicApplicationLookup): Promise<PublicApplicationView> {
  const loaded = await loadPublicApplication(lookup);
  return loaded.view;
}

export async function submitPublicApplication(lookup: PublicApplicationLookup): Promise<PublicApplicationView> {
  const loaded = await loadPublicApplication(lookup);
  assertTransition(loaded.status, 'SUBMITTED');

  const updated = await prisma.application.update({
    where: { id: loaded.applicationId },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
    select: publicSelect,
  });

  await recordAudit(null, {
    action: 'application.submitted',
    entityType: 'Application',
    entityId: updated.id,
    institutionId: loaded.institutionId,
    summary: `Application ${updated.reference} submitted`,
  });

  return updated;
}

export async function withdrawPublicApplication(lookup: PublicApplicationLookup): Promise<PublicApplicationView> {
  const loaded = await loadPublicApplication(lookup);
  assertTransition(loaded.status, 'WITHDRAWN');

  const updated = await prisma.application.update({
    where: { id: loaded.applicationId },
    data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
    select: publicSelect,
  });

  await recordAudit(null, {
    action: 'application.withdrawn',
    entityType: 'Application',
    entityId: updated.id,
    institutionId: loaded.institutionId,
    summary: `Application ${updated.reference} withdrawn by applicant`,
  });

  return updated;
}

export async function acceptPublicOffer(lookup: PublicApplicationLookup): Promise<PublicApplicationView> {
  const loaded = await loadPublicApplication(lookup);
  assertTransition(loaded.status, 'ACCEPTED');

  const admission = await prisma.admission.findUnique({ where: { applicationId: loaded.applicationId } });
  if (!admission) throw new DomainError('No offer has been issued for this application.');
  if (admission.offerExpiresAt && admission.offerExpiresAt.getTime() < Date.now()) {
    throw new DomainError('This offer has expired.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.admission.update({
      where: { id: admission.id },
      data: { offerAcceptedAt: new Date() },
    });
    return tx.application.update({
      where: { id: loaded.applicationId },
      data: { status: 'ACCEPTED' },
      select: publicSelect,
    });
  });

  await recordAudit(null, {
    action: 'application.accepted',
    entityType: 'Application',
    entityId: updated.id,
    institutionId: loaded.institutionId,
    summary: `Offer accepted for ${updated.reference}`,
  });

  return updated;
}
