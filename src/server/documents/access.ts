import 'server-only';

import { hasAllPermissions, requireAuthenticated, tenantWhere } from '@/lib/auth/authorization';
import { ForbiddenError, TenantAccessError, UnauthenticatedError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { getDocumentObject, signDocumentAccess, verifyDocumentAccess } from '@/server/documents/storage';
import { accessTokenMatches } from '@/server/admissions/references';

/**
 * Document access rules:
 *
 * - Staff may read a document only when they hold BOTH `documents.read` and
 *   `students.read`. `documents.read` alone is not enough.
 * - The STUDENT role does not carry `documents.read`. Learners reach their own
 *   files through ownership (the linked student record or the public token on
 *   the parent application), never through the staff permission.
 * - A learner probing another student's document receives 404, not 403.
 * - Foreign-tenant ids never resolve.
 */
export function canStaffReadDocuments(context: AuthContext | null): boolean {
  return hasAllPermissions(context, ['documents.read', 'students.read']);
}

async function isDocumentOwner(context: AuthContext, document: {
  studentId: string | null;
  applicationId: string | null;
}): Promise<boolean> {
  if (document.studentId) {
    const own = await prisma.student.findFirst({
      where: { id: document.studentId, userId: context.userId, deletedAt: null },
      select: { id: true },
    });
    if (own) return true;
  }

  if (document.applicationId) {
    const application = await prisma.application.findFirst({
      where: { id: document.applicationId },
      select: { email: true },
    });
    if (application && application.email.toLowerCase() === context.email.toLowerCase()) return true;
  }

  return false;
}

export async function getDocumentForViewer(context: AuthContext, documentId: string) {
  requireAuthenticated(context);

  const document = await prisma.document.findFirst({
    where: { id: documentId, ...tenantWhere(context) },
  });

  if (!document) throw new TenantAccessError();

  if (await isDocumentOwner(context, document)) return document;

  if (canStaffReadDocuments(context)) {
    if (document.visibility === 'STAFF' || document.visibility === 'PRIVATE') return document;
  }

  if (hasAllPermissions(context, ['documents.read']) && !hasAllPermissions(context, ['students.read'])) {
    throw new ForbiddenError();
  }

  throw new TenantAccessError();
}

export async function issueDocumentDownloadUrl(context: AuthContext, documentId: string): Promise<string> {
  const document = await getDocumentForViewer(context, documentId);
  const token = signDocumentAccess(document.id);
  await recordAudit(context, {
    action: 'document.accessed',
    entityType: 'Document',
    entityId: document.id,
    summary: `Issued download for ${document.fileName}`,
  });
  return `/api/documents/${document.id}?token=${token}`;
}

export async function readDocumentBytes(options: {
  documentId: string;
  context?: AuthContext | null;
  token?: string | null;
  publicToken?: { applicationReference: string; accessToken: string } | null;
}): Promise<{ fileName: string; mimeType: string; bytes: Buffer }> {
  if (options.token) {
    const signed = verifyDocumentAccess(options.token);
    if (!signed || signed.documentId !== options.documentId) throw new TenantAccessError();
    const document = await prisma.document.findFirst({ where: { id: options.documentId } });
    if (!document) throw new TenantAccessError();
    return {
      fileName: document.fileName,
      mimeType: document.mimeType,
      bytes: await getDocumentObject(document.storageKey),
    };
  }

  if (options.publicToken) {
    const document = await prisma.document.findFirst({
      where: { id: options.documentId },
      include: { application: { select: { reference: true, accessTokenHash: true } } },
    });
    if (!document?.application) throw new TenantAccessError();
    if (document.application.reference !== options.publicToken.applicationReference) {
      throw new TenantAccessError();
    }
    if (!accessTokenMatches(options.publicToken.accessToken, document.application.accessTokenHash)) {
      throw new TenantAccessError();
    }
    return {
      fileName: document.fileName,
      mimeType: document.mimeType,
      bytes: await getDocumentObject(document.storageKey),
    };
  }

  if (!options.context) throw new UnauthenticatedError();
  const document = await getDocumentForViewer(options.context, options.documentId);
  return {
    fileName: document.fileName,
    mimeType: document.mimeType,
    bytes: await getDocumentObject(document.storageKey),
  };
}

export async function listStudentDocuments(context: AuthContext, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, ...tenantWhere(context), deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!student) throw new TenantAccessError();

  const isOwner = student.userId === context.userId;
  if (!isOwner && !canStaffReadDocuments(context)) {
    if (hasAllPermissions(context, ['documents.read'])) throw new ForbiddenError();
    throw new TenantAccessError();
  }

  return prisma.document.findMany({
    where: { studentId, ...tenantWhere(context) },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      kind: true,
      fileName: true,
      mimeType: true,
      byteSize: true,
      visibility: true,
      createdAt: true,
    },
  });
}
