import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { listStudents, studentListQuerySchema } from '@/server/students/queries';
import { formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Students' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StudentsPage({ searchParams }: PageProps) {
  const context = await requirePermission('students.read');
  const params = await searchParams;

  const parsed = studentListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    status: typeof params.status === 'string' ? params.status : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
  });

  const query = parsed.success ? parsed.data : studentListQuerySchema.parse({});
  const result = await listStudents(context, query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description={`${formatNumber(result.total)} learner record${result.total === 1 ? '' : 's'} in this institution.`}
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">
              Search students
            </label>
            <input
              id="search"
              name="search"
              type="search"
              defaultValue={query.search ?? ''}
              placeholder="Search by name, student number or email"
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
              className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm sm:w-48"
            >
              <option value="">All statuses</option>
              {['APPLICANT', 'ADMITTED', 'ACTIVE', 'SUSPENDED', 'DEFERRED', 'COMPLETED', 'GRADUATED', 'WITHDRAWN', 'DISCONTINUED'].map(
                (status) => (
                  <option key={status} value={status}>
                    {status.charAt(0) + status.slice(1).toLowerCase()}
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
              title="No students match this view"
              description="Adjust the filters, or register learners through admissions once the module is enabled."
            />
          </div>
        ) : (
          <DataTable caption="Students">
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Number</Th>
                <Th className="hidden md:table-cell">Programme</Th>
                <Th className="hidden lg:table-cell">Cohort</Th>
                <Th className="hidden lg:table-cell">Group</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((student) => (
                <tr key={student.id}>
                  <Td>
                    <span className="font-medium">{student.fullName}</span>
                    {student.email ? (
                      <span className="block text-xs text-[var(--color-muted-foreground)]">{student.email}</span>
                    ) : null}
                  </Td>
                  <Td className="font-mono text-xs">{student.studentNumber}</Td>
                  <Td className="hidden md:table-cell">{student.programmeName ?? '—'}</Td>
                  <Td className="hidden lg:table-cell">{student.cohortCode ?? '—'}</Td>
                  <Td className="hidden lg:table-cell">{student.groupCode ?? '—'}</Td>
                  <Td>
                    <Badge tone={student.status === 'ACTIVE' ? 'accent' : 'neutral'}>
                      {student.status.toLowerCase()}
                    </Badge>
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
