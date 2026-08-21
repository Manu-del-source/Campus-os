import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { tenantWhere } from '@/lib/auth/authorization';
import { formatDate, formatNumber } from '@/lib/utils';
import { listAssessments } from '@/server/assessment/assessments';
import { assessmentListQuerySchema } from '@/server/assessment/schemas';
import { CreateAssessmentForm } from './create-form';

export const metadata: Metadata = { title: 'Assessments' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AssessmentPage({ searchParams }: PageProps) {
  const context = await requirePermission('marks.read');
  const params = await searchParams;

  const parsed = assessmentListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    unitId: typeof params.unitId === 'string' ? params.unitId : undefined,
    semesterId: typeof params.semesterId === 'string' ? params.semesterId : undefined,
  });

  const query = parsed.success ? parsed.data : assessmentListQuerySchema.parse({});
  const result = await listAssessments(context, query);

  const statusTone = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
      case 'PUBLISHED_RESULTS':
        return 'success' as const;
      case 'DRAFT':
        return 'neutral' as const;
      case 'SUBMISSION_OPEN':
        return 'warning' as const;
      default:
        return 'accent' as const;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        description={`${formatNumber(result.total)} assessment${result.total === 1 ? '' : 's'}.`}
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">Search assessments</label>
            <input
              id="search"
              name="search"
              type="search"
              defaultValue={query.search ?? ''}
              placeholder="Search by code or name"
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

        <div className="p-4">
          <CreateAssessmentWithData />
        </div>

        {result.rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No assessments"
              description="Create assessments to start grading students."
            />
          </div>
        ) : (
          <DataTable caption="Assessments">
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th className="hidden md:table-cell">Type</Th>
                <Th>Max Score</Th>
                <Th className="hidden md:table-cell">Weight</Th>
                <Th className="hidden lg:table-cell">Unit</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((assessment) => (
                <tr key={assessment.id}>
                  <Td className="font-medium">{assessment.code}</Td>
                  <Td>{assessment.name}</Td>
                  <Td className="hidden md:table-cell">
                    <Badge tone="neutral">{assessment.type.toLowerCase()}</Badge>
                  </Td>
                  <Td className="text-sm">{assessment.maxScore}</Td>
                  <Td className="hidden md:table-cell text-sm">{assessment.weight}%</Td>
                  <Td className="hidden lg:table-cell text-sm">{assessment.unitCode}</Td>
                  <Td>
                    <Badge tone={statusTone(assessment.status)}>
                      {assessment.status.toLowerCase().replace('_', ' ')}
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

async function CreateAssessmentWithData() {
  const context = await requirePermission('marks.enter');
  const where = tenantWhere(context);

  const [units, semesters] = await Promise.all([
    prisma.unit.findMany({ where: { ...where, deletedAt: null }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
    prisma.semester.findMany({ where, orderBy: { sequence: 'asc' }, select: { id: true, code: true, name: true } }),
  ]);

  return <CreateAssessmentForm units={units} semesters={semesters} />;
}
