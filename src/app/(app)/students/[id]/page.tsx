import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { TenantAccessError } from '@/lib/auth/errors';
import { requireUser } from '@/lib/auth/session';
import { formatDate } from '@/lib/utils';
import { canStaffReadDocuments, issueDocumentDownloadUrl, listStudentDocuments } from '@/server/documents/access';
import { getStudentForViewer } from '@/server/students/queries';

export const metadata: Metadata = { title: 'Student' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const context = await requireUser();

  try {
    const student = await getStudentForViewer(context, id);
    const canReadDocs = canStaffReadDocuments(context) || student.userId === context.userId;
    const documents = canReadDocs ? await listStudentDocuments(context, student.id) : [];

    return (
      <div className="space-y-6">
        <PageHeader
          title={`${student.firstName} ${student.lastName}`}
          description={student.studentNumber}
          actions={
            <Badge tone={student.status === 'ACTIVE' ? 'accent' : 'neutral'}>
              {student.status.toLowerCase()}
            </Badge>
          }
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Profile" description={student.email ?? undefined} />
            <CardBody>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Programme</dt>
                  <dd className="text-sm">{student.programme?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Level</dt>
                  <dd className="text-sm">{student.level?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Intake</dt>
                  <dd className="text-sm">{student.intake?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Cohort</dt>
                  <dd className="text-sm">{student.cohort?.code ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Group</dt>
                  <dd className="text-sm">{student.group?.code ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Campus</dt>
                  <dd className="text-sm">{student.campus?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Admitted</dt>
                  <dd className="text-sm">{formatDate(student.admissionDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Phone</dt>
                  <dd className="text-sm">{student.phone ?? '—'}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Admission" />
            <CardBody className="space-y-3 text-sm">
              {student.admission?.application ? (
                <p>
                  Application{' '}
                  <Link
                    href={`/admissions/${student.admission.application.id}`}
                    className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
                  >
                    {student.admission.application.reference}
                  </Link>
                </p>
              ) : (
                <p className="text-[var(--color-muted-foreground)]">No linked application.</p>
              )}
              <p>Registered {formatDate(student.admission?.registeredAt)}</p>
            </CardBody>
          </Card>
        </div>

        {canReadDocs ? (
          <Card>
            <CardHeader title="Documents" description="Private files. Access is checked on every download." />
            <CardBody>
              {documents.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">No documents on this record.</p>
              ) : (
                <ul className="space-y-2">
                  {await Promise.all(
                    documents.map(async (document) => {
                      const href = await issueDocumentDownloadUrl(context, document.id);
                      return (
                        <li key={document.id} className="flex items-center justify-between text-sm">
                          <span>{document.fileName}</span>
                          <a href={href} className="text-[var(--color-accent)] underline-offset-4 hover:underline">
                            Download
                          </a>
                        </li>
                      );
                    }),
                  )}
                </ul>
              )}
            </CardBody>
          </Card>
        ) : null}
      </div>
    );
  } catch (error) {
    if (error instanceof TenantAccessError) notFound();
    throw error;
  }
}
