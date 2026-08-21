import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatNumber } from '@/lib/utils';
import { listProgrammes } from '@/server/academics/programmes';
import { listAcademicLevels } from '@/server/academics/levels';
import { listDepartments } from '@/server/academics/departments';
import { academicListQuerySchema } from '@/server/academics/schemas';
import { CreateProgrammeForm } from './create-form';

export const metadata: Metadata = { title: 'Programmes' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProgrammesPage({ searchParams }: PageProps) {
  const context = await requirePermission('programmes.read');
  const params = await searchParams;

  const parsed = academicListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
  });

  const query = parsed.success ? parsed.data : academicListQuerySchema.parse({});
  const [result, deptsResult, levelsResult] = await Promise.all([
    listProgrammes(context, query),
    listDepartments(context, academicListQuerySchema.parse({})),
    listAcademicLevels(context, academicListQuerySchema.parse({})),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programmes"
        description={`${formatNumber(result.total)} programme${result.total === 1 ? '' : 's'} in this institution.`}
        actions={
          <ButtonLink href="/programmes/new" size="sm">
            Add programme
          </ButtonLink>
        }
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">
              Search programmes
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
              title="No programmes yet"
              description="Create programmes to define the courses your institution offers."
            />
          </div>
        ) : (
          <DataTable caption="Programmes">
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th className="hidden md:table-cell">Department</Th>
                <Th className="hidden md:table-cell">Level</Th>
                <Th className="hidden lg:table-cell">Duration</Th>
                <Th className="hidden lg:table-cell">Stages</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((prog) => (
                <tr key={prog.id}>
                  <Td className="font-mono text-xs">{prog.code}</Td>
                  <Td className="font-medium">{prog.name}</Td>
                  <Td className="hidden md:table-cell">{prog.departmentName}</Td>
                  <Td className="hidden md:table-cell">{prog.levelName ?? '—'}</Td>
                  <Td className="hidden lg:table-cell">
                    {prog.duration} {prog.durationUnit.toLowerCase()}(s)
                  </Td>
                  <Td className="hidden lg:table-cell">{prog.stages}</Td>
                  <Td>
                    <Badge tone={prog.isActive ? 'success' : 'neutral'}>
                      {prog.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <CreateProgrammeForm
        departments={deptsResult.rows.map((d) => ({ id: d.id, code: d.code, name: d.name }))}
        levels={levelsResult.rows.map((l) => ({ id: l.id, code: l.code, name: l.name }))}
      />
    </div>
  );
}
