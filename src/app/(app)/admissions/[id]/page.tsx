import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ReviewPanel } from '@/app/(app)/admissions/[id]/review-panel';
import { ApplicationStatusBadge } from '@/components/admissions/status-badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { TenantAccessError } from '@/lib/auth/errors';
import { hasPermission } from '@/lib/auth/authorization';
import { requirePermission } from '@/lib/auth/session';
import { formatDate } from '@/lib/utils';
import { getApplicationById, listAssignableCohorts } from '@/server/admissions/queries';
import { canStaffReadDocuments, issueDocumentDownloadUrl } from '@/server/documents/access';

export const metadata: Metadata = { title: 'Application' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const context = await requirePermission('admissions.read');

  try {
    const application = await getApplicationById(context, id);
    const cohorts = await listAssignableCohorts(context, application.programmeId, application.intakeId);
    const showDocuments = canStaffReadDocuments(context) || hasPermission(context, 'admissions.read');

    return (
      <div className="space-y-6">
        <PageHeader
          title={`${application.firstName} ${application.lastName}`}
          description={`${application.reference} · ${application.email}`}
          actions={<ApplicationStatusBadge status={application.status} />}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Application" description={application.programme.name} />
            <CardBody>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Intake</dt>
                  <dd className="text-sm">{application.intake.name}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Campus</dt>
                  <dd className="text-sm">{application.campus?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Phone</dt>
                  <dd className="text-sm">{application.phone ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">National ID</dt>
                  <dd className="text-sm">{application.nationalId ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Submitted</dt>
                  <dd className="text-sm">{formatDate(application.submittedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Reviewed</dt>
                  <dd className="text-sm">{formatDate(application.reviewedAt)}</dd>
                </div>
              </dl>

              {application.admission ? (
                <div className="mt-6 rounded-[var(--radius-base)] bg-[var(--color-surface-muted)] p-4 text-sm">
                  <p className="font-medium">Offer</p>
                  <p className="mt-1 text-[var(--color-muted-foreground)]">
                    Issued {formatDate(application.admission.offerIssuedAt)}
                    {application.admission.offerExpiresAt
                      ? ` · expires ${formatDate(application.admission.offerExpiresAt)}`
                      : ''}
                  </p>
                  {application.admission.student ? (
                    <p className="mt-2">
                      Registered as{' '}
                      <Link
                        href={`/students/${application.admission.student.id}`}
                        className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
                      >
                        {application.admission.student.studentNumber}
                      </Link>
                    </p>
                  ) : null}
                </div>
              ) : null}

              {showDocuments && application.documents.length > 0 ? (
                <ul className="mt-6 space-y-2">
                  {await Promise.all(
                    application.documents.map(async (document) => {
                      const href = canStaffReadDocuments(context)
                        ? await issueDocumentDownloadUrl(context, document.id)
                        : null;
                      return (
                        <li key={document.id} className="flex items-center justify-between text-sm">
                          <span>
                            {document.fileName}{' '}
                            <span className="text-xs text-[var(--color-muted-foreground)]">
                              {document.kind.toLowerCase().replaceAll('_', ' ')}
                            </span>
                          </span>
                          {href ? (
                            <a
                              href={href}
                              className="text-[var(--color-accent)] underline-offset-4 hover:underline"
                            >
                              Download
                            </a>
                          ) : null}
                        </li>
                      );
                    }),
                  )}
                </ul>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Actions" description="Permission-gated workflow steps." />
            <CardBody>
              <ReviewPanel
                context={context}
                applicationId={application.id}
                status={application.status}
                cohorts={cohorts}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof TenantAccessError) notFound();
    throw error;
  }
}
