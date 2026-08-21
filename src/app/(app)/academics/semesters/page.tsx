import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatDate, formatNumber } from '@/lib/utils';
import { listSemesters, listAcademicYears } from '@/server/academics/years';
import { academicListQuerySchema } from '@/server/academics/schemas';
import { CreateSemesterForm } from './create-form';

export const metadata: Metadata = { title: 'Semesters' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SemestersPage({ searchParams }: PageProps) {
  const context = await requirePermission('academics.read');
  const params = await searchParams;

  const parsed = academicListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
  });

  const query = parsed.success ? parsed.data : academicListQuerySchema.parse({});
  const [result, yearsResult] = await Promise.all([
    listSemesters(context, query),
    listAcademicYears(context, academicListQuerySchema.parse({})),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Semesters"
        description={`${formatNumber(result.total)} semester${result.total === 1 ? '' : 's'}.`}
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">
              Search semesters
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
              title="No semesters yet"
              description="Create semesters within your academic years."
            />
          </div>
        ) : (
          <DataTable caption="Semesters">
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th className="hidden md:table-cell">Year</Th>
                <Th className="hidden md:table-cell">Sequence</Th>
                <Th className="hidden md:table-cell">Start</Th>
                <Th className="hidden md:table-cell">End</Th>
                <Th>Current</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((semester) => (
                <tr key={semester.id}>
                  <Td className="font-mono text-xs">{semester.code}</Td>
                  <Td className="font-medium">{semester.name}</Td>
                  <Td className="hidden md:table-cell">{semester.academicYearCode}</Td>
                  <Td className="hidden md:table-cell">{semester.sequence}</Td>
                  <Td className="hidden md:table-cell">{formatDate(semester.startDate)}</Td>
                  <Td className="hidden md:table-cell">{formatDate(semester.endDate)}</Td>
                  <Td>
                    {semester.isCurrent ? <Badge tone="accent">current</Badge> : <Badge>—</Badge>}
                  </Td>
                  <Td>
                    <Badge tone="neutral">{semester.status.toLowerCase()}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <CreateSemesterForm academicYears={yearsResult.rows.map((y) => ({ id: y.id, code: y.code, name: y.name }))} />
    </div>
  );
}
