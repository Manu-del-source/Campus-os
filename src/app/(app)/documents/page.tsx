import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatNumber } from '@/lib/utils';
import { prisma } from '@/lib/db';
import { tenantWhere } from '@/lib/auth/authorization';

export const metadata: Metadata = { title: 'Documents' };

export default async function DocumentsPage() {
  const context = await requirePermission('documents.read');
  const where = tenantWhere(context);

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      kind: true,
      fileName: true,
      mimeType: true,
      byteSize: true,
      visibility: true,
      createdAt: true,
      uploadedBy: { select: { firstName: true, lastName: true } },
    },
    take: 100,
  });

  const kindTone = (kind: string) => {
    switch (kind) {
      case 'IDENTITY': return 'accent' as const;
      case 'ACADEMIC_CERTIFICATE': return 'success' as const;
      case 'TRANSCRIPT': return 'success' as const;
      case 'OFFER_LETTER': return 'warning' as const;
      default: return 'neutral' as const;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description={`${formatNumber(documents.length)} document${documents.length === 1 ? '' : 's'}.`}
      />

      <Card>
        {documents.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No documents"
              description="Documents uploaded through admissions or student profiles will appear here."
            />
          </div>
        ) : (
          <DataTable caption="Documents">
            <thead>
              <tr>
                <Th>File name</Th>
                <Th>Kind</Th>
                <Th className="hidden md:table-cell">Size</Th>
                <Th className="hidden md:table-cell">Uploaded by</Th>
                <Th>Visibility</Th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <Td className="font-medium">{doc.fileName}</Td>
                  <Td>
                    <Badge tone={kindTone(doc.kind)}>
                      {doc.kind.toLowerCase().replace('_', ' ')}
                    </Badge>
                  </Td>
                  <Td className="hidden md:table-cell text-sm">{formatBytes(doc.byteSize)}</Td>
                  <Td className="hidden md:table-cell text-sm text-[var(--color-muted-foreground)]">
                    {doc.uploadedBy ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}` : '—'}
                  </Td>
                  <Td>
                    <Badge tone="neutral">{doc.visibility.toLowerCase()}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </div>
  );
}
