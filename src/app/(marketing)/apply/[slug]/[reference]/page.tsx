import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ApplicationStatusBadge } from '@/components/admissions/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { TenantAccessError } from '@/lib/auth/errors';
import { formatDate } from '@/lib/utils';
import {
  acceptOfferAction,
  submitApplicationAction,
  withdrawApplicationAction,
} from '@/server/admissions/form-actions';
import { getPublicApplication } from '@/server/admissions/public';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string; reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = { title: 'Application status' };

export default async function PublicApplicationPage({ params, searchParams }: PageProps) {
  const { slug, reference } = await params;
  const query = await searchParams;
  const token = typeof query.token === 'string' ? query.token : '';

  if (!token) notFound();

  try {
    const application = await getPublicApplication({
      institutionSlug: slug,
      reference,
      token,
    });

    const hidden = (
      <>
        <input type="hidden" name="institutionSlug" value={slug} />
        <input type="hidden" name="reference" value={reference} />
        <input type="hidden" name="token" value={token} />
      </>
    );

    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm text-[var(--color-muted-foreground)]">{application.institution.name}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Application {application.reference}</h1>
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
          Keep this page URL private. Anyone with the token can act on this application.
        </p>

        <Card className="mt-8">
          <CardHeader
            title={`${application.firstName} ${application.lastName}`}
            description={application.email}
            action={<ApplicationStatusBadge status={application.status} />}
          />
          <CardBody className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Programme</dt>
                <dd className="text-sm">{application.programme.name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Intake</dt>
                <dd className="text-sm">{application.intake.name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Submitted</dt>
                <dd className="text-sm">{formatDate(application.submittedAt)}</dd>
              </div>
              {application.admission ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">Offer expires</dt>
                  <dd className="text-sm">{formatDate(application.admission.offerExpiresAt)}</dd>
                </div>
              ) : null}
            </dl>

            {application.admission?.conditions ? (
              <p className="text-sm">
                <span className="font-medium">Conditions: </span>
                {application.admission.conditions}
              </p>
            ) : null}

            {application.decisionNote && application.status === 'REJECTED' ? (
              <p className="text-sm text-[var(--color-danger)]">{application.decisionNote}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {application.status === 'DRAFT' ? (
                <form action={submitApplicationAction}>
                  {hidden}
                  <Button type="submit">Submit application</Button>
                </form>
              ) : null}

              {application.status === 'OFFERED' ? (
                <form action={acceptOfferAction}>
                  {hidden}
                  <Button type="submit">Accept offer</Button>
                </form>
              ) : null}

              {application.status !== 'ACCEPTED' &&
              application.status !== 'REJECTED' &&
              application.status !== 'WITHDRAWN' ? (
                <form action={withdrawApplicationAction}>
                  {hidden}
                  <Button type="submit" variant="secondary">
                    Withdraw
                  </Button>
                </form>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  } catch (error) {
    if (error instanceof TenantAccessError) notFound();
    throw error;
  }
}
