import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { listPayments } from '@/server/finance/payments';
import { paymentListQuerySchema } from '@/server/finance/schemas';

export const metadata: Metadata = { title: 'Payments' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaymentsPage({ searchParams }: PageProps) {
  const context = await requirePermission('finance.read');
  const params = await searchParams;

  const parsed = paymentListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    status: typeof params.status === 'string' ? params.status : undefined,
    method: typeof params.method === 'string' ? params.method : undefined,
  });

  const query = parsed.success ? parsed.data : paymentListQuerySchema.parse({});
  const result = await listPayments(context, query);

  const statusTone = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'success' as const;
      case 'PENDING': return 'warning' as const;
      case 'FAILED': return 'danger' as const;
      case 'REFUNDED': return 'accent' as const;
      default: return 'neutral' as const;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description={`${formatNumber(result.total)} payment${result.total === 1 ? '' : 's'}.`}
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">Search payments</label>
            <input
              id="search"
              name="search"
              type="search"
              defaultValue={query.search ?? ''}
              placeholder="Search by payment number, reference, or student"
              className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
            />
          </div>
          <select
            name="method"
            defaultValue={query.method ?? ''}
            className="h-10 rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
          >
            <option value="">All methods</option>
            <option value="CASH">Cash</option>
            <option value="MPESA">M-Pesa</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CARD">Card</option>
            <option value="CHEQUE">Cheque</option>
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
              title="No payments"
              description="Record payments to see them here."
            />
          </div>
        ) : (
          <DataTable caption="Payments">
            <thead>
              <tr>
                <Th>Payment #</Th>
                <Th>Student</Th>
                <Th className="hidden md:table-cell">Method</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">Reference</Th>
                <Th className="hidden lg:table-cell">Date</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((payment) => (
                <tr key={payment.id}>
                  <Td className="font-medium">{payment.paymentNumber}</Td>
                  <Td>
                    <div>
                      <div className="font-medium">{payment.studentName}</div>
                      <div className="text-xs text-[var(--color-muted-foreground)]">{payment.studentNumber}</div>
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <Badge tone="neutral">{payment.method.toLowerCase().replace('_', ' ')}</Badge>
                  </Td>
                  <Td className="text-sm font-medium">{formatCurrency(payment.amount, payment.currency)}</Td>
                  <Td>
                    <Badge tone={statusTone(payment.status)}>
                      {payment.status.toLowerCase()}
                    </Badge>
                  </Td>
                  <Td className="hidden lg:table-cell text-sm text-[var(--color-muted-foreground)]">
                    {payment.reference ?? '—'}
                  </Td>
                  <Td className="hidden lg:table-cell text-sm text-[var(--color-muted-foreground)]">
                    {formatDate(payment.receivedAt)}
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
