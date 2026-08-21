import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatDate, formatNumber } from '@/lib/utils';
import { listAcademicYears } from '@/server/academics/years';
import { listAcademicLevels } from '@/server/academics/levels';
import { listSemesters } from '@/server/academics/years';
import { listIntakes } from '@/server/academics/intakes';
import { academicListQuerySchema } from '@/server/academics/schemas';

export const metadata: Metadata = { title: 'Academic Structure' };

export default async function AcademicsPage() {
  const context = await requirePermission('academics.read');

  const [yearsResult, levelsResult, semestersResult, intakesResult] = await Promise.all([
    listAcademicYears(context, academicListQuerySchema.parse({})),
    listAcademicLevels(context, academicListQuerySchema.parse({})),
    listSemesters(context, academicListQuerySchema.parse({})),
    listIntakes(context, academicListQuerySchema.parse({})),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Structure"
        description="Manage academic years, semesters, levels, and intakes."
        actions={
          <div className="flex gap-2">
            <ButtonLink href="/academics/years" size="sm">
              Academic years
            </ButtonLink>
            <ButtonLink href="/academics/levels" variant="secondary" size="sm">
              Levels
            </ButtonLink>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Academic Years */}
        <Card>
          <CardHeader
            title="Academic years"
            description={`${formatNumber(yearsResult.total)} year${yearsResult.total === 1 ? '' : 's'}`}
            action={
              <Link
                href="/academics/years"
                className="text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
              >
                View all
              </Link>
            }
          />
          <CardBody>
            {yearsResult.rows.length === 0 ? (
              <EmptyState
                title="No academic years"
                description="Create an academic year to start structuring your calendar."
              />
            ) : (
              <ul className="space-y-2">
                {yearsResult.rows.slice(0, 5).map((year) => (
                  <li key={year.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{year.name}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {formatDate(year.startDate)} — {formatDate(year.endDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {year.isCurrent ? <Badge tone="accent">current</Badge> : null}
                      <Badge tone="neutral">{year.status.toLowerCase()}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Academic Levels */}
        <Card>
          <CardHeader
            title="Academic levels"
            description={`${formatNumber(levelsResult.total)} level${levelsResult.total === 1 ? '' : 's'}`}
            action={
              <Link
                href="/academics/levels"
                className="text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
              >
                View all
              </Link>
            }
          />
          <CardBody>
            {levelsResult.rows.length === 0 ? (
              <EmptyState
                title="No academic levels"
                description="Define qualification levels (e.g. certificate, diploma)."
              />
            ) : (
              <DataTable caption="Academic levels">
                <thead>
                  <tr>
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th>Rank</Th>
                    <Th>Programmes</Th>
                  </tr>
                </thead>
                <tbody>
                  {levelsResult.rows.slice(0, 5).map((level) => (
                    <tr key={level.id}>
                      <Td className="font-mono text-xs">{level.code}</Td>
                      <Td className="font-medium">{level.name}</Td>
                      <Td>{level.rank}</Td>
                      <Td>{formatNumber(level.programmeCount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </CardBody>
        </Card>

        {/* Semesters */}
        <Card>
          <CardHeader
            title="Semesters"
            description={`${formatNumber(semestersResult.total)} semester${semestersResult.total === 1 ? '' : 's'}`}
            action={
              <Link
                href="/academics/semesters"
                className="text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
              >
                View all
              </Link>
            }
          />
          <CardBody>
            {semestersResult.rows.length === 0 ? (
              <EmptyState
                title="No semesters"
                description="Create semesters within your academic years."
              />
            ) : (
              <ul className="space-y-2">
                {semestersResult.rows.slice(0, 5).map((semester) => (
                  <li key={semester.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{semester.name}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {semester.academicYearCode} · {formatDate(semester.startDate)} — {formatDate(semester.endDate)}
                      </p>
                    </div>
                    <Badge tone={semester.isCurrent ? 'accent' : 'neutral'}>
                      {semester.isCurrent ? 'current' : semester.status.toLowerCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Intakes */}
        <Card>
          <CardHeader
            title="Intakes"
            description={`${formatNumber(intakesResult.total)} intake${intakesResult.total === 1 ? '' : 's'}`}
            action={
              <Link
                href="/academics/intakes"
                className="text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
              >
                View all
              </Link>
            }
          />
          <CardBody>
            {intakesResult.rows.length === 0 ? (
              <EmptyState
                title="No intakes"
                description="Create an intake to start enrolling cohorts."
              />
            ) : (
              <ul className="space-y-2">
                {intakesResult.rows.slice(0, 5).map((intake) => (
                  <li key={intake.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{intake.name}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {intake.academicYearCode} · Starts {formatDate(intake.startDate)}
                      </p>
                    </div>
                    <Badge tone={intake.status === 'OPEN' ? 'success' : 'neutral'}>
                      {intake.status.toLowerCase()}
                    </Badge>
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
