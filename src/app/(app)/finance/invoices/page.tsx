import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { listInvoices } from '@/server/finance/invoices';
import { invoiceListQuerySchema } from '@/server/finance/schemas';

export const metadata: Metadata = { title: 'Invoices' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const context = await requirePermission('finance.read');
  const params = await searchParams;

  const parsed = invoiceListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    status: typeof params.status === 'string' ? params.status : undefined,
  });

  const query = parsed.success ? parsed.data : invoiceListQuerySchema.parse({});
  const result = await listInvoices(context, query);

  const statusTone = (status: string) => {
    switch (status) {
      case 'PAID': return 'success' as const;
      case 'SENT': return 'accent' as const;
      case 'PARTIALLY_PAID': return 'warning' as const;
      case 'OVERDUE': return 'danger' as const;
      case 'CANCELLED':
      case 'VOID': return 'neutral' as const;
      default: return 'neutral' as const;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description={`${formatNumber(result.total)} invoice${result.total === 1 ? '' : 's'}.`}
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">Search invoices</label>
            <input
              id="search"
              name="search"
              type="search"
              defaultValue={query.search ?? ''}
              placeholder="Search by invoice number, student name, or number"
              className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
            />
          </div>
          <select
            name="status"
            defaultValue={query.status ?? ''}
            className="h-10 rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_PAID">Partially paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CANCELLED">Cancelled</option>
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
              title="No invoices"
              description="Create invoices to start tracking payments."
            />
          </div>
        ) : (
          <DataTable caption="Invoices">
            <thead>
              <tr>
                <Th>Invoice #</Th>
                <Th>Student</Th>
                <Th className="hidden md:table-cell">Total</Th>
                <Th className="hidden md:table-cell">Paid</Th>
                <Th>Balance</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">Due</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((inv) => (
                <tr key={inv.id}>
                  <Td className="font-medium">{inv.invoiceNumber}</Td>
                  <Td>
                    <div>
                      <div className="font-medium">{inv.studentName}</div>
                      <div className="text-xs text-[var(--color-muted-foreground)]">{inv.studentNumber}</div>
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell text-sm">{formatCurrency(inv.total)}</Td>
                  <Td className="hidden md:table-cell text-sm">{formatCurrency(inv.amountPaid)}</Td>
                  <Td className="text-sm font-medium">{formatCurrency(inv.balance)}</Td>
                  <Td>
                    <Badge tone={statusTone(inv.status)}>
                      {inv.status.toLowerCase().replace('_', ' ')}
                    </Badge>
                  </Td>
                  <Td className="hidden lg:table-cell text-sm text-[var(--color-muted-foreground)]">
                    {formatDate(inv.dueDate)}
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
