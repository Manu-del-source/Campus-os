import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatDate, formatNumber } from '@/lib/utils';
import { listAuditLogs } from '@/server/institution/audit';
import { academicListQuerySchema } from '@/server/academics/schemas';

export const metadata: Metadata = { title: 'Audit Log' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AuditPage({ searchParams }: PageProps) {
  const context = await requirePermission('audit.read');
  const params = await searchParams;

  const parsed = academicListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
  });

  const query = parsed.success ? parsed.data : academicListQuerySchema.parse({});
  const result = await listAuditLogs(context, query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description={`${formatNumber(result.total)} event${result.total === 1 ? '' : 's'} recorded.`}
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">
              Search audit logs
            </label>
            <input
              id="search"
              name="search"
              type="search"
              defaultValue={query.search ?? ''}
              placeholder="Search by actor, action or summary"
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
              title="No audit events"
              description="Actions performed in this institution will appear here."
            />
          </div>
        ) : (
          <DataTable caption="Audit log">
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th className="hidden md:table-cell">Entity</Th>
                <Th className="hidden lg:table-cell">Summary</Th>
                <Th className="hidden lg:table-cell">IP</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((log) => (
                <tr key={log.id}>
                  <Td className="whitespace-nowrap text-xs text-[var(--color-muted-foreground)]">
                    {formatDate(log.createdAt)}
                  </Td>
                  <Td className="text-sm">{log.actorLabel ?? '—'}</Td>
                  <Td>
                    <Badge tone="neutral">{log.action}</Badge>
                  </Td>
                  <Td className="hidden md:table-cell text-sm">
                    {log.entityType}
                    {log.entityId ? (
                      <span className="ml-1 text-xs text-[var(--color-muted-foreground)]">
                        ({log.entityId.slice(0, 8)}…)
                      </span>
                    ) : null}
                  </Td>
                  <Td className="hidden lg:table-cell text-sm text-[var(--color-muted-foreground)]">
                    {log.summary ?? '—'}
                  </Td>
                  <Td className="hidden lg:table-cell font-mono text-xs text-[var(--color-muted-foreground)]">
                    {log.ipAddress ?? '—'}
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
