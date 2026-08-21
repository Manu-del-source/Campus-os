import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export default async function StaffDashboard() {
  const user = await requireUser();

  const staff = await prisma.staff.findFirst({
    where: { userId: user.userId, deletedAt: null },
    include: {
      department: { select: { code: true, name: true } },
      campus: { select: { name: true } },
    },
  });

  if (!staff) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Welcome</h1>
        <Card>
          <CardBody>
            <p className="text-[var(--color-muted-foreground)]">
              Your staff profile is being set up.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const today = new Date();
  const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][today.getDay()] as 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

  const [todayClasses, totalStudents, pendingMarks] = await Promise.all([
    prisma.timetableEntry.findMany({
      where: {
        staffId: staff.id,
        dayOfWeek,
        isActive: true,
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        unit: { select: { code: true, name: true } },
        room: { select: { code: true } },
        group: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
    }),
    prisma.student.count({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        cohort: { programme: { departmentId: staff.departmentId ?? '' } },
      },
    }),
    prisma.mark.count({
      where: {
        status: 'DRAFT',
        assessment: { unit: { timetableEntries: { some: { staffId: staff.id } } } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome, {staff.firstName}
        </h1>
        <p className="text-[var(--color-muted-foreground)]">
          {staff.department?.code} — {staff.department?.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Today&apos;s classes</p>
            <p className="text-2xl font-semibold">{todayClasses.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Students in department</p>
            <p className="text-2xl font-semibold">{totalStudents}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">Pending marks</p>
            <p className="text-2xl font-semibold">{pendingMarks}</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Today's Schedule" />
        <CardBody>
          {todayClasses.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">No classes scheduled for today.</p>
          ) : (
            <div className="space-y-3">
              {todayClasses.map((cls) => (
                <div key={cls.id} className="flex items-center justify-between rounded border border-[var(--color-border)] p-3">
                  <div>
                    <div className="font-medium">{cls.unit.code} — {cls.unit.name}</div>
                    <div className="text-sm text-[var(--color-muted-foreground)]">
                      {cls.room.code} • {cls.group.name}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {formatTime(cls.startTime)} – {formatTime(cls.endTime)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}
