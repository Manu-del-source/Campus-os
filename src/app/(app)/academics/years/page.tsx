import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatDate, formatNumber } from '@/lib/utils';
import { listAcademicYears } from '@/server/academics/years';
import { academicListQuerySchema } from '@/server/academics/schemas';
import { CreateAcademicYearForm } from './create-form';

export const metadata: Metadata = { title: 'Academic Years' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AcademicYearsPage({ searchParams }: PageProps) {
  const context = await requirePermission('academics.read');
  const params = await searchParams;

  const parsed = academicListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
  });

  const query = parsed.success ? parsed.data : academicListQuerySchema.parse({});
  const result = await listAcademicYears(context, query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Years"
        description={`${formatNumber(result.total)} academic year${result.total === 1 ? '' : 's'}.`}
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">
              Search academic years
            </label>
            <input
              id="search"
              name="search"
              type="search"
              defaultValue={query.search ?? ''}
              placeholder="Search by name or code"
              className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
            />
          </div>
          <button
            type="submit"
            className="h-10 rounded-[var(--radius-base)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-accent-foreground)]"
          >
            Search
          </button>
        </form>

        {result.rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No academic years yet"
              description="Create an academic year to structure your institution's calendar."
            />
          </div>
        ) : (
          <DataTable caption="Academic years">
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th className="hidden md:table-cell">Start</Th>
                <Th className="hidden md:table-cell">End</Th>
                <Th className="hidden md:table-cell">Semesters</Th>
                <Th>Current</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((year) => (
                <tr key={year.id}>
                  <Td className="font-mono text-xs">{year.code}</Td>
                  <Td className="font-medium">{year.name}</Td>
                  <Td className="hidden md:table-cell">{formatDate(year.startDate)}</Td>
                  <Td className="hidden md:table-cell">{formatDate(year.endDate)}</Td>
                  <Td className="hidden md:table-cell">{formatNumber(year.semesterCount)}</Td>
                  <Td>
                    {year.isCurrent ? <Badge tone="accent">current</Badge> : <Badge>—</Badge>}
                  </Td>
                  <Td>
                    <Badge tone="neutral">{year.status.toLowerCase()}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <CreateAcademicYearForm />
    </div>
  );
}
