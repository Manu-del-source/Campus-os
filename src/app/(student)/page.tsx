import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export default async function StudentDashboard() {
  const user = await requireUser();

  const student = await prisma.student.findFirst({
    where: { userId: user.userId, deletedAt: null },
    include: {
      programme: { select: { code: true, name: true } },
      level: { select: { code: true, name: true } },
      cohort: { select: { code: true, name: true } },
      campus: { select: { name: true } },
    },
  });

  if (!student) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Welcome</h1>
        <Card>
          <CardBody>
            <p className="text-[var(--color-muted-foreground)]">
              Your student profile is being set up. Please check back later.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const [activeRegistrations, unpaidInvoices, recentResults, attendanceSessions] = await Promise.all([
    prisma.unitRegistration.count({
      where: { studentId: student.id, status: 'CONFIRMED' },
    }),
    prisma.invoice.count({
      where: { studentId: student.id, balance: { gt: 0 }, deletedAt: null },
    }),
    prisma.result.findMany({
      where: { studentId: student.id, status: 'PUBLISHED' },
      select: { grade: true, percentage: true, unit: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
    prisma.attendanceRecord.count({
      where: { studentId: student.id, status: 'PRESENT' },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome, {student.firstName}
        </h1>
        <p className="text-[var(--color-muted-foreground)]">
          {student.programme?.code} — {student.programme?.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Status</p>
            <Badge tone={student.status === 'ACTIVE' ? 'success' : 'warning'}>
              {student.status.toLowerCase()}
            </Badge>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Enrolled units</p>
            <p className="text-2xl font-semibold">{activeRegistrations}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Outstanding invoices</p>
            <p className="text-2xl font-semibold">{unpaidInvoices}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Attendance sessions</p>
            <p className="text-2xl font-semibold">{attendanceSessions}</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Recent results */}
        <Card>
          <CardHeader title="Recent Results" />
          <CardBody>
            {recentResults.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">No results published yet.</p>
            ) : (
              <div className="space-y-3">
                {recentResults.map((result, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{result.unit.code}</div>
                      <div className="text-xs text-[var(--color-muted-foreground)]">{result.unit.name}</div>
                    </div>
                    <div className="text-right">
                      <Badge tone={result.grade && result.grade >= 'C' ? 'success' : 'warning'}>
                        {result.grade}
                      </Badge>
                      <div className="text-xs text-[var(--color-muted-foreground)]">
                        {result.percentage?.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Quick links */}
        <Card>
          <CardHeader title="Quick Links" />
          <CardBody>
            <nav className="space-y-2">
              <a href="/student/results" className="block text-sm text-[var(--color-accent)] hover:underline">View all results →</a>
              <a href="/student/attendance" className="block text-sm text-[var(--color-accent)] hover:underline">Check attendance →</a>
              <a href="/student/finance" className="block text-sm text-[var(--color-accent)] hover:underline">View invoices →</a>
              <a href="/student/timetable" className="block text-sm text-[var(--color-accent)] hover:underline">View timetable →</a>
            </nav>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
