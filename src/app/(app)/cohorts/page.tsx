import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatNumber } from '@/lib/utils';
import { listCohorts } from '@/server/academics/cohorts';
import { listProgrammes } from '@/server/academics/programmes';
import { listIntakes } from '@/server/academics/intakes';
import { listAcademicYears } from '@/server/academics/years';
import { academicListQuerySchema } from '@/server/academics/schemas';
import { CreateCohortForm } from './create-form';

export const metadata: Metadata = { title: 'Cohorts & Groups' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CohortsPage({ searchParams }: PageProps) {
  const context = await requirePermission('academics.read');
  const params = await searchParams;

  const parsed = academicListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
  });

  const query = parsed.success ? parsed.data : academicListQuerySchema.parse({});
  const [result, progsResult, intakesResult, yearsResult] = await Promise.all([
    listCohorts(context, query),
    listProgrammes(context, academicListQuerySchema.parse({})),
    listIntakes(context, academicListQuerySchema.parse({})),
    listAcademicYears(context, academicListQuerySchema.parse({})),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cohorts & Groups"
        description={`${formatNumber(result.total)} cohort${result.total === 1 ? '' : 's'} in this institution.`}
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">
              Search cohorts
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
              title="No cohorts yet"
              description="Create cohorts to group learners admitted together."
            />
          </div>
        ) : (
          <DataTable caption="Cohorts">
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th className="hidden md:table-cell">Programme</Th>
                <Th className="hidden md:table-cell">Intake</Th>
                <Th className="hidden md:table-cell">Stage</Th>
                <Th className="hidden md:table-cell">Groups</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((cohort) => (
                <tr key={cohort.id}>
                  <Td className="font-mono text-xs">{cohort.code}</Td>
                  <Td className="font-medium">{cohort.name}</Td>
                  <Td className="hidden md:table-cell">{cohort.programmeName}</Td>
                  <Td className="hidden md:table-cell">{cohort.intakeCode}</Td>
                  <Td className="hidden md:table-cell">{cohort.currentStage}</Td>
                  <Td className="hidden md:table-cell">{formatNumber(cohort.groupCount)}</Td>
                  <Td>
                    <Badge tone="neutral">{cohort.status.toLowerCase()}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <CreateCohortForm
        programmes={progsResult.rows.map((p) => ({ id: p.id, code: p.code, name: p.name }))}
        intakes={intakesResult.rows.map((i) => ({ id: i.id, code: i.code, name: i.name }))}
        academicYears={yearsResult.rows.map((y) => ({ id: y.id, code: y.code, name: y.name }))}
      />
    </div>
  );
}
