import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatNumber } from '@/lib/utils';
import { listAcademicLevels } from '@/server/academics/levels';
import { academicListQuerySchema } from '@/server/academics/schemas';
import { CreateAcademicLevelForm } from './create-form';

export const metadata: Metadata = { title: 'Academic Levels' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AcademicLevelsPage({ searchParams }: PageProps) {
  const context = await requirePermission('academics.read');
  const params = await searchParams;

  const parsed = academicListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
  });

  const query = parsed.success ? parsed.data : academicListQuerySchema.parse({});
  const result = await listAcademicLevels(context, query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Levels"
        description={`${formatNumber(result.total)} qualification level${result.total === 1 ? '' : 's'}.`}
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">
              Search levels
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
              title="No academic levels yet"
              description="Define qualification levels (e.g. certificate, diploma)."
            />
          </div>
        ) : (
          <DataTable caption="Academic levels">
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th className="hidden md:table-cell">Rank</Th>
                <Th className="hidden md:table-cell">Programmes</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((level) => (
                <tr key={level.id}>
                  <Td className="font-mono text-xs">{level.code}</Td>
                  <Td className="font-medium">{level.name}</Td>
                  <Td className="hidden md:table-cell">{level.rank}</Td>
                  <Td className="hidden md:table-cell">{formatNumber(level.programmeCount)}</Td>
                  <Td>
                    <Badge tone={level.isActive ? 'success' : 'neutral'}>
                      {level.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <CreateAcademicLevelForm />
    </div>
  );
}
