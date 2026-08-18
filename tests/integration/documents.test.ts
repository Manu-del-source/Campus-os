import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ForbiddenError, TenantAccessError } from '@/lib/auth/errors';
import { generateAccessToken, hashAccessToken } from '@/server/admissions/references';
import { attachApplicationDocument } from '@/server/documents/actions';
import { getDocumentForViewer, listStudentDocuments, readDocumentBytes } from '@/server/documents/access';
import { putDocumentObject } from '@/server/documents/storage';
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

describe.skipIf(!hasTestDatabase)('private document access', () => {
  let tenant: SeededTenant;
  let applicationId: string;
  let studentId: string;
  let ownerUserId: string;
  let staffUserId: string;
  let documentId: string;

  beforeAll(async () => {
    await resetDatabase();
    tenant = await seedTenant('docs-alpha', ['Amina', 'Brian']);
    const prisma = testPrisma();

    const owner = await prisma.user.create({
      data: {
        institutionId: tenant.institutionId,
        email: 'owner@docs.test',
        firstName: 'Amina',
        lastName: 'Learner',
        status: 'ACTIVE',
      },
    });
    ownerUserId = owner.id;
    studentId = tenant.studentIds[0];
    await prisma.student.update({ where: { id: studentId }, data: { userId: owner.id } });

    const application = await prisma.application.create({
      data: {
        institutionId: tenant.institutionId,
        programmeId: tenant.programmeId,
        intakeId: tenant.intakeId as string,
        reference: 'APP-2026-DOCS01',
        firstName: 'Amina',
        lastName: 'Learner',
        email: 'owner@docs.test',
        accessTokenHash: hashAccessToken(generateAccessToken()),
        status: 'SUBMITTED',
      },
    });
    applicationId = application.id;

    const stored = await putDocumentObject(tenant.institutionId, Buffer.from('identity-scan'));
    const document = await prisma.document.create({
      data: {
        institutionId: tenant.institutionId,
        applicationId: application.id,
        studentId,
        kind: 'IDENTITY',
        fileName: 'identity.txt',
        mimeType: 'text/plain',
        byteSize: stored.byteSize,
        storageKey: stored.storageKey,
        checksum: stored.checksum,
        visibility: 'PRIVATE',
      },
    });
    documentId = document.id;
    staffUserId = await seedUser(tenant.institutionId, 'registrar@docs.test');
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  it('lets staff with documents.read and students.read read the file', async () => {
    const registrar = authContext({ userId: staffUserId, institutionId: tenant.institutionId, roleKeys: ['REGISTRAR'] });
    const document = await getDocumentForViewer(registrar, documentId);
    expect(document.fileName).toBe('identity.txt');
  });

  it('forbids staff who hold documents.read without students.read', async () => {
    const documentsOnly = authContext({
      institutionId: tenant.institutionId,
      permissions: ['documents.read'],
    });
    await expect(getDocumentForViewer(documentsOnly, documentId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('returns 404 when a learner probes another student document', async () => {
    const prisma = testPrisma();
    const other = await prisma.user.create({
      data: {
        institutionId: tenant.institutionId,
        email: 'other@docs.test',
        firstName: 'Brian',
        lastName: 'Learner',
        status: 'ACTIVE',
      },
    });
    await prisma.student.update({ where: { id: tenant.studentIds[1] }, data: { userId: other.id } });

    const otherLearner = authContext({
      userId: other.id,
      institutionId: tenant.institutionId,
      roleKeys: ['STUDENT'],
    });
    await expect(getDocumentForViewer(otherLearner, documentId)).rejects.toBeInstanceOf(TenantAccessError);
  });

  it('lets the owning learner read their own document without documents.read', async () => {
    const owner = authContext({
      userId: ownerUserId,
      institutionId: tenant.institutionId,
      roleKeys: ['STUDENT'],
    });
    const document = await getDocumentForViewer(owner, documentId);
    expect(document.id).toBe(documentId);
    const listed = await listStudentDocuments(owner, studentId);
    expect(listed.map((item) => item.id)).toContain(documentId);
  });

  it('does not let a student list another student\'s documents', async () => {
    const owner = authContext({
      userId: ownerUserId,
      institutionId: tenant.institutionId,
      roleKeys: ['STUDENT'],
    });
    await expect(listStudentDocuments(owner, tenant.studentIds[1])).rejects.toBeInstanceOf(TenantAccessError);
  });

  it('serves bytes after a signed token is issued', async () => {
    const registrar = authContext({ userId: staffUserId, institutionId: tenant.institutionId, roleKeys: ['REGISTRAR'] });
    const payload = await readDocumentBytes({ documentId, context: registrar });
    expect(payload.bytes.toString('utf8')).toBe('identity-scan');
    expect(payload.fileName).toBe('identity.txt');
  });

  it('requires documents.manage and students.read to attach a file', async () => {
    const officer = authContext({
      institutionId: tenant.institutionId,
      permissions: ['documents.manage'],
    });
    await expect(
      attachApplicationDocument(officer, {
        applicationId,
        kind: 'SUPPORTING',
        fileName: 'note.txt',
        mimeType: 'text/plain',
        bytes: Buffer.from('note'),
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('attaches a supporting document for authorised staff', async () => {
    const registrar = authContext({ userId: staffUserId, institutionId: tenant.institutionId, roleKeys: ['REGISTRAR'] });
    const created = await attachApplicationDocument(registrar, {
      applicationId,
      kind: 'SUPPORTING',
      fileName: 'note.txt',
      mimeType: 'text/plain',
      bytes: Buffer.from('note'),
    });
    expect(created.kind).toBe('SUPPORTING');
    expect(created.applicationId).toBe(applicationId);
  });

  it('rejects an unknown document id as not found', async () => {
    const registrar = authContext({ userId: staffUserId, institutionId: tenant.institutionId, roleKeys: ['REGISTRAR'] });
    await expect(
      getDocumentForViewer(registrar, '00000000-0000-4000-8000-000000000099'),
    ).rejects.toBeInstanceOf(TenantAccessError);
  });
});
