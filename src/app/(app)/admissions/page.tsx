import type { Metadata } from 'next';
import Link from 'next/link';

import { ApplicationStatusBadge } from '@/components/admissions/status-badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatDate, formatNumber } from '@/lib/utils';
import { listApplications } from '@/server/admissions/queries';
import { applicationListQuerySchema } from '@/server/admissions/schemas';

export const metadata: Metadata = { title: 'Admissions' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdmissionsPage({ searchParams }: PageProps) {
  const context = await requirePermission('admissions.read');
  const params = await searchParams;

  const parsed = applicationListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    status: typeof params.status === 'string' ? params.status : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
  });

  const query = parsed.success ? parsed.data : applicationListQuerySchema.parse({});
  const result = await listApplications(context, query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admissions"
        description={`${formatNumber(result.total)} application${result.total === 1 ? '' : 's'} in this institution.`}
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">
              Search applications
            </label>
            <input
              id="search"
              name="search"
              type="search"
              defaultValue={query.search ?? ''}
              placeholder="Search by name, email or reference"
              className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="sr-only">
              Filter by status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={query.status ?? ''}
              className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm sm:w-52"
            >
              <option value="">All statuses</option>
              {['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'].map(
                (status) => (
                  <option key={status} value={status}>
                    {status.replaceAll('_', ' ')}
                  </option>
                ),
              )}
            </select>
          </div>
          <button
            type="submit"
            className="h-10 rounded-[var(--radius-base)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-accent-foreground)]"
          >
            Apply
          </button>
        </form>

        {result.rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No applications match this view"
              description="Public applicants appear here once they start an application for an open intake."
            />
          </div>
        ) : (
          <DataTable caption="Applications">
            <thead>
              <tr>
                <Th>Applicant</Th>
                <Th>Reference</Th>
                <Th className="hidden md:table-cell">Programme</Th>
                <Th className="hidden lg:table-cell">Intake</Th>
                <Th className="hidden lg:table-cell">Submitted</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((application) => (
                <tr key={application.id}>
                  <Td>
                    <Link
                      href={`/admissions/${application.id}`}
                      className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
                    >
                      {application.fullName}
                    </Link>
                    <span className="block text-xs text-[var(--color-muted-foreground)]">{application.email}</span>
                  </Td>
                  <Td className="font-mono text-xs">{application.reference}</Td>
                  <Td className="hidden md:table-cell">{application.programmeName}</Td>
                  <Td className="hidden lg:table-cell">{application.intakeCode}</Td>
                  <Td className="hidden lg:table-cell">{formatDate(application.submittedAt)}</Td>
                  <Td>
                    <ApplicationStatusBadge status={application.status} />
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
