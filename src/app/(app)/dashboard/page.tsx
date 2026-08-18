import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requireUser } from '@/lib/auth/session';
import { getInstitutionOverview } from '@/server/institution/overview';
import { formatDate, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const context = await requireUser();
  const overview = await getInstitutionOverview(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good day, ${context.firstName}`}
        description={
          overview.currentAcademicYear
            ? `Current academic year: ${overview.currentAcademicYear.name}`
            : 'No academic year is marked as current yet.'
        }
      />

      <section aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students" value={formatNumber(overview.counts.students)} hint="All non-archived records" />
        <StatCard label="Active students" value={formatNumber(overview.counts.activeStudents)} />
        <StatCard label="Applicants" value={formatNumber(overview.counts.applicants)} />
        <StatCard label="Staff" value={formatNumber(overview.counts.staff)} hint="Active and on probation" />
        <StatCard label="Programmes" value={formatNumber(overview.counts.programmes)} />
        <StatCard label="Departments" value={formatNumber(overview.counts.departments)} />
        <StatCard label="Cohorts" value={formatNumber(overview.counts.cohorts)} />
        <StatCard label="Units" value={formatNumber(overview.counts.units)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recently added students"
            description="The latest learner records created in this institution."
            action={
              <Link
                href="/students"
                className="text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
              >
                View all
              </Link>
            }
          />
          {overview.recentStudents.length === 0 ? (
            <CardBody>
              <EmptyState
                title="No students yet"
                description="Student records will appear here once admissions or registry data is captured."
              />
            </CardBody>
          ) : (
            <DataTable caption="Recently added students">
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Number</Th>
                  <Th className="hidden sm:table-cell">Programme</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {overview.recentStudents.map((student) => (
                  <tr key={student.id}>
                    <Td>
                      <span className="font-medium">
                        {student.firstName} {student.lastName}
                      </span>
                    </Td>
                    <Td className="font-mono text-xs">{student.studentNumber}</Td>
                    <Td className="hidden sm:table-cell">{student.programmeName ?? '—'}</Td>
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

        <Card>
          <CardHeader title="Open intakes" description="Intakes currently accepting applications." />
          <CardBody>
            {overview.openIntakes.length === 0 ? (
              <EmptyState title="No open intakes" description="Open an intake to start receiving applications." />
            ) : (
              <ul className="space-y-3">
                {overview.openIntakes.map((intake) => (
                  <li key={intake.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{intake.name}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        Starts {formatDate(intake.startDate)}
                      </p>
                    </div>
                    <Badge tone="accent">{intake.code}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
