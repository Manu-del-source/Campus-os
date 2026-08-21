import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/utils';

export default async function StudentFinancePage() {
  const user = await requireUser();

  const student = await prisma.student.findFirst({
    where: { userId: user.userId, deletedAt: null },
  });

  if (!student) {
    return <div className="p-4">Student profile not found.</div>;
  }

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { studentId: student.id, deletedAt: null },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        amountPaid: true,
        balance: true,
        currency: true,
        status: true,
        dueDate: true,
        issuedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.findMany({
      where: { studentId: student.id, deletedAt: null },
      select: {
        id: true,
        paymentNumber: true,
        method: true,
        amount: true,
        currency: true,
        status: true,
        receivedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const totalOwed = invoices.reduce((sum, inv) => sum + inv.balance, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);

  const statusTone = (status: string) => {
    switch (status) {
      case 'PAID': return 'success' as const;
      case 'SENT': return 'accent' as const;
      case 'PARTIALLY_PAID': return 'warning' as const;
      case 'OVERDUE': return 'danger' as const;
      default: return 'neutral' as const;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Finance"
        description={`Total paid: ${formatCurrency(totalPaid)} • Outstanding: ${formatCurrency(totalOwed)}`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Total paid</p>
            <p className="text-2xl font-semibold text-[var(--color-success)]">{formatCurrency(totalPaid)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Outstanding</p>
            <p className="text-2xl font-semibold text-[var(--color-warning)]">{formatCurrency(totalOwed)}</p>
          </CardBody>
        </Card>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader title="Invoices" />
        {invoices.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No invoices"
              description="Your invoices will appear here."
            />
          </div>
        ) : (
          <DataTable caption="Invoices">
            <thead>
              <tr>
                <Th>Invoice #</Th>
                <Th>Total</Th>
                <Th>Paid</Th>
                <Th>Balance</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">Due</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <Td className="font-medium">{inv.invoiceNumber}</Td>
                  <Td className="text-sm">{formatCurrency(inv.total, inv.currency)}</Td>
                  <Td className="text-sm">{formatCurrency(inv.amountPaid, inv.currency)}</Td>
                  <Td className="text-sm font-medium">{formatCurrency(inv.balance, inv.currency)}</Td>
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

      {/* Recent payments */}
      <Card>
        <CardHeader title="Recent Payments" />
        {payments.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No payments"
              description="Your payment history will appear here."
            />
          </div>
        ) : (
          <DataTable caption="Payments">
            <thead>
              <tr>
                <Th>Payment #</Th>
                <Th>Method</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">Date</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium">{p.paymentNumber}</Td>
                  <Td>
                    <Badge tone="neutral">{p.method.toLowerCase().replace('_', ' ')}</Badge>
                  </Td>
                  <Td className="text-sm">{formatCurrency(p.amount, p.currency)}</Td>
                  <Td>
                    <Badge tone={p.status === 'COMPLETED' ? 'success' : 'warning'}>
                      {p.status.toLowerCase()}
                    </Badge>
                  </Td>
                  <Td className="hidden lg:table-cell text-sm text-[var(--color-muted-foreground)]">
                    {formatDate(p.receivedAt)}
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
