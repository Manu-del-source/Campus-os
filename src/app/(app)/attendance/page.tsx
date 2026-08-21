import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatDate, formatNumber } from '@/lib/utils';
import { listAttendanceSessions } from '@/server/attendance/sessions';
import { attendanceSessionListQuerySchema } from '@/server/attendance/schemas';

export const metadata: Metadata = { title: 'Attendance' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AttendancePage({ searchParams }: PageProps) {
  const context = await requirePermission('attendance.read');
  const params = await searchParams;

  const parsed = attendanceSessionListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
  });

  const query = parsed.success ? parsed.data : attendanceSessionListQuerySchema.parse({});
  const result = await listAttendanceSessions(context, query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description={`${formatNumber(result.total)} session${result.total === 1 ? '' : 's'}.`}
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">Search attendance</label>
            <input
              id="search"
              name="search"
              type="search"
              defaultValue={query.search ?? ''}
              placeholder="Search by unit, group, or lecturer"
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
              title="No attendance sessions"
              description="Create attendance sessions to start tracking attendance."
            />
          </div>
        ) : (
          <DataTable caption="Attendance sessions">
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Time</Th>
                <Th>Unit</Th>
                <Th className="hidden md:table-cell">Group</Th>
                <Th className="hidden md:table-cell">Lecturer</Th>
                <Th>Records</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((session) => (
                <tr key={session.id}>
                  <Td className="text-sm">{formatDate(session.sessionDate)}</Td>
                  <Td className="text-sm">
                    {formatTime(session.startTime)} – {formatTime(session.endTime)}
                  </Td>
                  <Td className="font-medium">{session.unitCode}</Td>
                  <Td className="hidden md:table-cell text-sm">{session.groupName}</Td>
                  <Td className="hidden md:table-cell text-sm">{session.staffName}</Td>
                  <Td className="text-sm">{session.recordCount}</Td>
                  <Td>
                    <Badge tone={session.isCancelled ? 'danger' : 'success'}>
                      {session.isCancelled ? 'cancelled' : 'active'}
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}
