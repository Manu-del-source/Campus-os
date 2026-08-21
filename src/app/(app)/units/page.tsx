import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatNumber } from '@/lib/utils';
import { listUnits } from '@/server/academics/units';
import { listProgrammes } from '@/server/academics/programmes';
import { listAcademicLevels } from '@/server/academics/levels';
import { listSemesters } from '@/server/academics/years';
import { academicListQuerySchema } from '@/server/academics/schemas';
import { CreateUnitForm } from './create-form';

export const metadata: Metadata = { title: 'Units' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UnitsPage({ searchParams }: PageProps) {
  const context = await requirePermission('units.read');
  const params = await searchParams;

  const parsed = academicListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
  });

  const query = parsed.success ? parsed.data : academicListQuerySchema.parse({});
  const [result, progsResult, levelsResult, semsResult] = await Promise.all([
    listUnits(context, query),
    listProgrammes(context, academicListQuerySchema.parse({})),
    listAcademicLevels(context, academicListQuerySchema.parse({})),
    listSemesters(context, academicListQuerySchema.parse({})),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Units"
        description={`${formatNumber(result.total)} unit${result.total === 1 ? '' : 's'} in this institution.`}
        actions={
          <ButtonLink href="/units/new" size="sm">
            Add unit
          </ButtonLink>
        }
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">
              Search units
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
              title="No units yet"
              description="Create units to define the subjects your programmes cover."
            />
          </div>
        ) : (
          <DataTable caption="Units">
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th className="hidden md:table-cell">Programme</Th>
                <Th className="hidden md:table-cell">Type</Th>
                <Th className="hidden md:table-cell">Credits</Th>
                <Th className="hidden md:table-cell">Stage</Th>
                <Th className="hidden lg:table-cell">Semester</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((unit) => (
                <tr key={unit.id}>
                  <Td className="font-mono text-xs">{unit.code}</Td>
                  <Td className="font-medium">{unit.name}</Td>
                  <Td className="hidden md:table-cell">{unit.programmeName}</Td>
                  <Td className="hidden md:table-cell">
                    <Badge tone="neutral">{unit.type.toLowerCase().replace('_', ' ')}</Badge>
                  </Td>
                  <Td className="hidden md:table-cell">{unit.creditHours ?? '—'}</Td>
                  <Td className="hidden md:table-cell">{unit.stage}</Td>
                  <Td className="hidden lg:table-cell">{unit.semesterName ?? '—'}</Td>
                  <Td>
                    <Badge tone={unit.isActive ? 'success' : 'neutral'}>
                      {unit.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <CreateUnitForm
        programmes={progsResult.rows.map((p) => ({ id: p.id, code: p.code, name: p.name }))}
        levels={levelsResult.rows.map((l) => ({ id: l.id, code: l.code, name: l.name }))}
        semesters={semsResult.rows.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
      />
    </div>
  );
}
