import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export default async function StudentAttendancePage() {
  const user = await requireUser();

  const student = await prisma.student.findFirst({
    where: { userId: user.userId, deletedAt: null },
  });

  if (!student) {
    return <div className="p-4">Student profile not found.</div>;
  }

  const records = await prisma.attendanceRecord.findMany({
    where: { studentId: student.id },
    select: {
      id: true,
      status: true,
      notes: true,
      session: {
        select: {
          sessionDate: true,
          topic: true,
          timetableEntry: {
            select: {
              dayOfWeek: true,
              startTime: true,
              endTime: true,
              unit: { select: { code: true, name: true } },
              staff: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
    orderBy: { session: { sessionDate: 'desc' } },
    take: 50,
  });

  // Calculate statistics
  const total = records.length;
  const present = records.filter((r) => r.status === 'PRESENT').length;
  const late = records.filter((r) => r.status === 'LATE').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;
  const excused = records.filter((r) => r.status === 'EXCUSED').length;
  const percentage = total > 0 ? ((present + late) / total) * 100 : 0;

  const statusTone = (status: string) => {
    switch (status) {
      case 'PRESENT': return 'success' as const;
      case 'LATE': return 'warning' as const;
      case 'ABSENT': return 'danger' as const;
      case 'EXCUSED': return 'accent' as const;
      default: return 'neutral' as const;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        description={`${percentage.toFixed(1)}% attendance rate`}
      />

      <div className="grid gap-4 sm:grid-cols-5">
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Total</p>
            <p className="text-2xl font-semibold">{total}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Present</p>
            <p className="text-2xl font-semibold text-[var(--color-success)]">{present}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Late</p>
            <p className="text-2xl font-semibold text-[var(--color-warning)]">{late}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Absent</p>
            <p className="text-2xl font-semibold text-[var(--color-danger)]">{absent}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Excused</p>
            <p className="text-2xl font-semibold">{excused}</p>
          </CardBody>
        </Card>
      </div>

      {/* Attendance bar */}
      <div className="h-4 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className="h-full bg-[var(--color-success)] transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {records.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No attendance records"
              description="Your attendance will appear here once classes begin."
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-[var(--color-border)]">
            {records.map((record) => (
              <div key={record.id} className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <div className="font-medium">{record.session.timetableEntry.unit.code}</div>
                  <div className="text-sm text-[var(--color-muted-foreground)]">
                    {formatDate(record.session.sessionDate)} • {record.session.topic ?? record.session.timetableEntry.unit.name}
                  </div>
                </div>
                <Badge tone={statusTone(record.status)}>
                  {record.status.toLowerCase()}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium' }).format(date);
}
