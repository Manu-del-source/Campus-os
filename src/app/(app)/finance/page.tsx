import type { Metadata } from 'next';

import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { tenantWhere } from '@/lib/auth/authorization';
import { formatCurrency, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Finance' };

export default async function FinancePage() {
  const context = await requirePermission('finance.read');
  const where = tenantWhere(context);

  const [totalInvoices, paidInvoices, pendingInvoices, overdueInvoices, totalPayments, pendingPayments] = await Promise.all([
    prisma.invoice.count({ where: { ...where, deletedAt: null } }),
    prisma.invoice.count({ where: { ...where, deletedAt: null, status: 'PAID' } }),
    prisma.invoice.count({ where: { ...where, deletedAt: null, status: 'SENT' } }),
    prisma.invoice.count({ where: { ...where, deletedAt: null, status: 'OVERDUE' } }),
    prisma.payment.count({ where: { ...where, deletedAt: null, status: 'COMPLETED' } }),
    prisma.payment.count({ where: { ...where, deletedAt: null, status: 'PENDING' } }),
  ]);

  // Aggregate amounts
  const [invoiceTotals, paymentTotals] = await Promise.all([
    prisma.invoice.aggregate({
      where: { ...where, deletedAt: null },
      _sum: { total: true, amountPaid: true, balance: true },
    }),
    prisma.payment.aggregate({
      where: { ...where, deletedAt: null, status: 'COMPLETED' },
      _sum: { amount: true },
    }),
  ]);

  const stats = [
    { label: 'Total invoiced', value: formatCurrency(invoiceTotals._sum.total ?? 0) },
    { label: 'Total collected', value: formatCurrency(invoiceTotals._sum.amountPaid ?? 0) },
    { label: 'Outstanding', value: formatCurrency(invoiceTotals._sum.balance ?? 0) },
    { label: 'Payments received', value: formatNumber(paymentTotals._sum.amount ?? 0) },
    { label: 'Invoices', value: formatNumber(totalInvoices) },
    { label: 'Paid invoices', value: formatNumber(paidInvoices) },
    { label: 'Pending invoices', value: formatNumber(pendingInvoices) },
    { label: 'Overdue invoices', value: formatNumber(overdueInvoices) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Overview of invoicing, payments, and collections."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <p className="text-sm text-[var(--color-muted-foreground)]">{stat.label}</p>
              <p className="text-2xl font-semibold">{stat.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader title="Quick links" />
          <CardBody>
            <nav className="space-y-2">
              <a href="/finance/invoices" className="block text-sm text-[var(--color-accent)] hover:underline">View invoices</a>
              <a href="/finance/payments" className="block text-sm text-[var(--color-accent)] hover:underline">View payments</a>
              <a href="/finance/fee-structures" className="block text-sm text-[var(--color-accent)] hover:underline">Manage fee structures</a>
            </nav>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
