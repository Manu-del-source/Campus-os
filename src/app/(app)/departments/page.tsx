import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatNumber } from '@/lib/utils';
import { listDepartments } from '@/server/academics/departments';
import { academicListQuerySchema } from '@/server/academics/schemas';
import { CreateDepartmentForm } from './create-form';

export const metadata: Metadata = { title: 'Departments' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DepartmentsPage({ searchParams }: PageProps) {
  const context = await requirePermission('departments.read');
  const params = await searchParams;

  const parsed = academicListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
  });

  const query = parsed.success ? parsed.data : academicListQuerySchema.parse({});
  const result = await listDepartments(context, query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description={`${formatNumber(result.total)} department${result.total === 1 ? '' : 's'} in this institution.`}
        actions={
          <ButtonLink href="/departments/new" size="sm">
            Add department
          </ButtonLink>
        }
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">
              Search departments
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
              title="No departments yet"
              description="Create departments to organise your academic structure."
            />
          </div>
        ) : (
          <DataTable caption="Departments">
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th className="hidden md:table-cell">Campus</Th>
                <Th className="hidden md:table-cell">Programmes</Th>
                <Th className="hidden md:table-cell">Staff</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((dept) => (
                <tr key={dept.id}>
                  <Td className="font-mono text-xs">{dept.code}</Td>
                  <Td>
                    <span className="font-medium">{dept.name}</span>
                    {dept.description ? (
                      <span className="block text-xs text-[var(--color-muted-foreground)]">
                        {dept.description}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="hidden md:table-cell">{dept.campusName ?? '—'}</Td>
                  <Td className="hidden md:table-cell">{formatNumber(dept.programmeCount)}</Td>
                  <Td className="hidden md:table-cell">{formatNumber(dept.staffCount)}</Td>
                  <Td>
                    <Badge tone={dept.isActive ? 'success' : 'neutral'}>
                      {dept.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <CreateDepartmentForm />
    </div>
  );
}
