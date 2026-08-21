import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export default async function StudentResultsPage() {
  const user = await requireUser();

  const student = await prisma.student.findFirst({
    where: { userId: user.userId, deletedAt: null },
  });

  if (!student) {
    return <div className="p-4">Student profile not found.</div>;
  }

  const results = await prisma.result.findMany({
    where: { studentId: student.id },
    select: {
      id: true,
      totalScore: true,
      percentage: true,
      grade: true,
      gpa: true,
      status: true,
      publishedAt: true,
      unit: { select: { code: true, name: true, creditHours: true } },
      semester: { select: { code: true, name: true } },
    },
    orderBy: [{ semester: { startDate: 'desc' } }, { unit: { code: 'asc' } }],
  });

  const publishedResults = results.filter((r) => r.status === 'PUBLISHED');

  // Calculate CGPA
  const totalCredits = publishedResults.reduce((sum, r) => sum + (r.unit.creditHours ?? 0), 0);
  const weightedGpa = publishedResults.reduce((sum, r) => sum + (r.gpa ?? 0) * (r.unit.creditHours ?? 0), 0);
  const cgpa = totalCredits > 0 ? weightedGpa / totalCredits : 0;

  const gradeTone = (grade: string | null) => {
    if (!grade) return 'neutral' as const;
    if (grade === 'A' || grade === 'B') return 'success' as const;
    if (grade === 'C') return 'accent' as const;
    return 'warning' as const;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Results"
        description={`CGPA: ${cgpa.toFixed(2)} • ${publishedResults.length} result${publishedResults.length === 1 ? '' : 's'} published`}
      />

      {/* CGPA Card */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">CGPA</p>
            <p className="text-3xl font-bold">{cgpa.toFixed(2)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Total credits</p>
            <p className="text-3xl font-bold">{totalCredits}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Units completed</p>
            <p className="text-3xl font-bold">{publishedResults.length}</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        {results.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No results yet"
              description="Your results will appear here once published."
            />
          </div>
        ) : (
          <DataTable caption="Results">
            <thead>
              <tr>
                <Th>Unit</Th>
                <Th className="hidden md:table-cell">Semester</Th>
                <Th>Score</Th>
                <Th>Grade</Th>
                <Th className="hidden md:table-cell">GPA</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.id}>
                  <Td>
                    <div>
                      <div className="font-medium">{result.unit.code}</div>
                      <div className="text-xs text-[var(--color-muted-foreground)]">{result.unit.name}</div>
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell text-sm">{result.semester.code}</Td>
                  <Td className="text-sm">{result.percentage?.toFixed(1) ?? '—'}%</Td>
                  <Td>
                    <Badge tone={gradeTone(result.grade)}>{result.grade ?? '—'}</Badge>
                  </Td>
                  <Td className="hidden md:table-cell text-sm">{result.gpa?.toFixed(1) ?? '—'}</Td>
                  <Td>
                    <Badge tone={result.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                      {result.status.toLowerCase()}
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
