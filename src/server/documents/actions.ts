import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import type { DocumentKind } from '@/generated/prisma/client';
import { putDocumentObject } from '@/server/documents/storage';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
]);

const MAX_BYTES = 8 * 1024 * 1024;

export async function attachApplicationDocument(
  context: AuthContext,
  input: {
    applicationId: string;
    kind: DocumentKind;
    fileName: string;
    mimeType: string;
    bytes: Buffer;
  },
) {
  requirePermission(context, 'documents.manage');
  requirePermission(context, 'students.read');

  if (!ALLOWED_MIME.has(input.mimeType)) {
    throw new DomainError('That file type is not accepted.');
  }
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_BYTES) {
    throw new DomainError('The file is empty or larger than 8 MB.');
  }

  const application = await prisma.application.findFirst({
    where: { id: input.applicationId, ...tenantWhere(context) },
    select: { id: true, institutionId: true, admission: { select: { studentId: true } } },
  });
  if (!application) throw new TenantAccessError();

  const stored = await putDocumentObject(application.institutionId, input.bytes);
  const document = await prisma.document.create({
    data: {
      institutionId: application.institutionId,
      applicationId: application.id,
      studentId: application.admission?.studentId ?? null,
      uploadedById: context.userId,
      kind: input.kind,
      fileName: input.fileName.slice(0, 180),
      mimeType: input.mimeType,
      byteSize: stored.byteSize,
      storageKey: stored.storageKey,
      checksum: stored.checksum,
      visibility: 'PRIVATE',
    },
  });

  await recordAudit(context, {
    action: 'document.uploaded',
    entityType: 'Document',
    entityId: document.id,
    summary: `Uploaded ${document.fileName} to application`,
    metadata: { applicationId: application.id, kind: input.kind },
  });

  return document;
}
