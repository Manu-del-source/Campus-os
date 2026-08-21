import type { Metadata } from 'next';

import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { tenantWhere } from '@/lib/auth/authorization';
import { formatNumber } from '@/lib/utils';
import { listTimetableEntries } from '@/server/timetable/entries';
import { timetableEntryListQuerySchema } from '@/server/timetable/schemas';
import { CreateTimetableEntryForm } from './create-form';

export const metadata: Metadata = { title: 'Timetable' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default async function TimetablePage({ searchParams }: PageProps) {
  const context = await requirePermission('academics.read');
  const params = await searchParams;

  const parsed = timetableEntryListQuerySchema.safeParse({
    semesterId: typeof params.semesterId === 'string' ? params.semesterId : undefined,
    dayOfWeek: typeof params.dayOfWeek === 'string' ? params.dayOfWeek : undefined,
  });

  const query = parsed.success ? parsed.data : timetableEntryListQuerySchema.parse({});
  const result = await listTimetableEntries(context, query);

  // Group by day
  const grouped = DAY_ORDER.map((day) => ({
    day,
    entries: result.rows.filter((e) => e.dayOfWeek === day),
  })).filter((g) => g.entries.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable"
        description={`${formatNumber(result.total)} entr${result.total === 1 ? 'y' : 'ies'} across ${grouped.length} day${grouped.length === 1 ? '' : 's'}.`}
      />

      <CreateTimetableEntryWithData />

      {result.rows.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No timetable entries"
              description="Create timetable entries to schedule classes."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ day, entries }) => (
            <Card key={day}>
              <CardHeader
                title={day.charAt(0) + day.slice(1).toLowerCase()}
                description={`${entries.length} class${entries.length === 1 ? '' : 'es'}`}
              />
              <CardBody className="p-0">
                <div className="divide-y divide-[var(--color-border)]">
                  {entries.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-4 p-4">
                      <div className="min-w-[120px]">
                        <div className="text-sm font-medium">
                          {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{entry.unitCode} — {entry.unitName}</div>
                        <div className="text-sm text-[var(--color-muted-foreground)]">
                          {entry.staffName} • {entry.roomCode} • {entry.groupName}
                        </div>
                      </div>
                      <Badge tone={entry.isActive ? 'success' : 'neutral'}>
                        {entry.isActive ? 'active' : 'inactive'}
                      </Badge>
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

async function CreateTimetableEntryWithData() {
  const context = await requirePermission('academics.manage');
  const where = tenantWhere(context);

  const [semesters, units, staffList, rooms, groups] = await Promise.all([
    prisma.semester.findMany({ where, orderBy: { sequence: 'asc' }, select: { id: true, code: true, name: true } }),
    prisma.unit.findMany({ where: { ...where, deletedAt: null }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
    prisma.staff.findMany({ where: { ...where, deletedAt: null }, orderBy: { lastName: 'asc' }, select: { id: true, firstName: true, lastName: true } }),
    prisma.room.findMany({ where: { ...where, deletedAt: null }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
    prisma.group.findMany({ where: { ...where, deletedAt: null }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
  ]);

  return (
    <CreateTimetableEntryForm
      semesters={semesters}
      units={units}
      staffList={staffList}
      rooms={rooms}
      groups={groups}
    />
  );
}
