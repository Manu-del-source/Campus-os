import type { Metadata } from 'next';

import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { tenantWhere } from '@/lib/auth/authorization';
import { formatCurrency, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const context = await requirePermission('reports.read');
  const where = tenantWhere(context);

  const [
    totalStudents,
    activeStudents,
    totalStaff,
    totalProgrammes,
    totalUnits,
    totalInvoices,
    totalPaid,
    totalOutstanding,
    totalApplications,
    acceptedApplications,
  ] = await Promise.all([
    prisma.student.count({ where: { ...where, deletedAt: null } }),
    prisma.student.count({ where: { ...where, deletedAt: null, status: 'ACTIVE' } }),
    prisma.staff.count({ where: { ...where, deletedAt: null } }),
    prisma.programme.count({ where: { ...where, deletedAt: null } }),
    prisma.unit.count({ where: { ...where, deletedAt: null } }),
    prisma.invoice.count({ where: { ...where, deletedAt: null } }),
    prisma.invoice.aggregate({ where: { ...where, deletedAt: null }, _sum: { amountPaid: true } }),
    prisma.invoice.aggregate({ where: { ...where, deletedAt: null }, _sum: { balance: true } }),
    prisma.application.count({ where: { ...where } }),
    prisma.application.count({ where: { ...where, status: 'ACCEPTED' } }),
  ]);

  const reports = [
    {
      title: 'Enrolment Summary',
      items: [
        { label: 'Total students', value: formatNumber(totalStudents) },
        { label: 'Active students', value: formatNumber(activeStudents) },
        { label: 'Total staff', value: formatNumber(totalStaff) },
        { label: 'Programmes', value: formatNumber(totalProgrammes) },
        { label: 'Units', value: formatNumber(totalUnits) },
      ],
    },
    {
      title: 'Finance Summary',
      items: [
        { label: 'Total invoices', value: formatNumber(totalInvoices) },
        { label: 'Total collected', value: formatCurrency(totalPaid._sum.amountPaid ?? 0) },
        { label: 'Outstanding', value: formatCurrency(totalOutstanding._sum.balance ?? 0) },
      ],
    },
    {
      title: 'Admissions Summary',
      items: [
        { label: 'Total applications', value: formatNumber(totalApplications) },
        { label: 'Accepted', value: formatNumber(acceptedApplications) },
        { label: 'Acceptance rate', value: totalApplications > 0 ? `${((acceptedApplications / totalApplications) * 100).toFixed(1)}%` : '—' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Read-only aggregates from live data."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.title}>
            <CardHeader title={report.title} />
            <CardBody>
              <dl className="space-y-3">
                {report.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <dt className="text-sm text-[var(--color-muted-foreground)]">{item.label}</dt>
                    <dd className="text-sm font-medium">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
