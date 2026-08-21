import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatDate, formatNumber } from '@/lib/utils';
import { listRegistrations } from '@/server/registration/registrations';
import { registrationListQuerySchema } from '@/server/registration/schemas';

export const metadata: Metadata = { title: 'Unit Registration' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RegistrationPage({ searchParams }: PageProps) {
  const context = await requirePermission('units.read');
  const params = await searchParams;

  const parsed = registrationListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
    status: typeof params.status === 'string' ? params.status : undefined,
  });

  const query = parsed.success ? parsed.data : registrationListQuerySchema.parse({});
  const result = await listRegistrations(context, query);

  const statusTone = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'success' as const;
      case 'PENDING': return 'warning' as const;
      case 'DROPPED': return 'danger' as const;
      case 'WITHDRAWN': return 'neutral' as const;
      default: return 'neutral' as const;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unit Registration"
        description={`${formatNumber(result.total)} registration${result.total === 1 ? '' : 's'}.`}
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">
              Search registrations
            </label>
            <input
              id="search"
              name="search"
              type="search"
              defaultValue={query.search ?? ''}
              placeholder="Search by student name, number, or unit code"
              className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
            />
          </div>
          <select
            name="status"
            defaultValue={query.status ?? ''}
            className="h-10 rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="DROPPED">Dropped</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </select>
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
              title="No registrations"
              description="Register students for units to see them here."
            />
          </div>
        ) : (
          <DataTable caption="Unit registrations">
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Unit</Th>
                <Th className="hidden md:table-cell">Semester</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">Registered</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((reg) => (
                <tr key={reg.id}>
                  <Td>
                    <div>
                      <div className="font-medium">{reg.studentName}</div>
                      <div className="text-xs text-[var(--color-muted-foreground)]">{reg.studentNumber}</div>
                    </div>
                  </Td>
                  <Td>
                    <div>
                      <div className="font-medium">{reg.unitCode}</div>
                      <div className="text-xs text-[var(--color-muted-foreground)]">{reg.unitName}</div>
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell text-sm">{reg.semesterCode}</Td>
                  <Td>
                    <Badge tone={statusTone(reg.status)}>{reg.status.toLowerCase()}</Badge>
                  </Td>
                  <Td className="hidden lg:table-cell text-sm text-[var(--color-muted-foreground)]">
                    {formatDate(reg.registeredAt)}
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
