import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default async function StaffClassesPage() {
  const user = await requireUser();

  const staff = await prisma.staff.findFirst({
    where: { userId: user.userId, deletedAt: null },
  });

  if (!staff) {
    return <div className="p-4">Staff profile not found.</div>;
  }

  const entries = await prisma.timetableEntry.findMany({
    where: { staffId: staff.id, isActive: true, deletedAt: null },
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      unit: { select: { code: true, name: true, creditHours: true } },
      room: { select: { code: true, name: true } },
      group: { select: { code: true, name: true } },
      semester: { select: { code: true, name: true } },
      _count: { select: { sessions: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });

  // Group by day
  const grouped = DAY_ORDER.map((day) => ({
    day,
    entries: entries.filter((e) => e.dayOfWeek === day),
  })).filter((g) => g.entries.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Classes"
        description={`${entries.length} class${entries.length === 1 ? '' : 'es'} across ${grouped.length} day${grouped.length === 1 ? '' : 's'}.`}
      />

      {entries.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No classes assigned"
              description="Your timetable entries will appear here."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ day, entries: dayEntries }) => (
            <Card key={day}>
              <CardHeader
                title={day.charAt(0) + day.slice(1).toLowerCase()}
                description={`${dayEntries.length} class${dayEntries.length === 1 ? '' : 'es'}`}
              />
              <CardBody className="p-0">
                <div className="divide-y divide-[var(--color-border)]">
                  {dayEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-4 p-4">
                      <div className="min-w-[100px]">
                        <div className="text-sm font-medium">
                          {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{entry.unit.code} — {entry.unit.name}</div>
                        <div className="text-sm text-[var(--color-muted-foreground)]">
                          {entry.room.code} • {entry.group.name} • {entry.semester.code}
                        </div>
                      </div>
                      <Badge tone="neutral">{entry._count.sessions} session{entry._count.sessions === 1 ? '' : 's'}</Badge>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}
