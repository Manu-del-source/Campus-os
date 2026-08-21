import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import {
  createTimetableEntrySchema,
  updateTimetableEntrySchema,
  timetableEntryListQuerySchema,
  type TimetableEntryListQuery,
} from '@/server/timetable/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimetableEntryListRow {
  id: string;
  dayOfWeek: string;
  startTime: Date;
  endTime: Date;
  unitCode: string;
  unitName: string;
  staffName: string;
  roomCode: string;
  groupName: string;
  semesterCode: string;
  isActive: boolean;
}

export interface TimetableEntryListResult {
  rows: TimetableEntryListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Clash detection
// ---------------------------------------------------------------------------

async function checkForClashes(
  institutionId: string,
  data: {
    staffId: string;
    roomId: string;
    groupId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    semesterId: string;
    weekStart?: number;
    weekEnd?: number;
  },
  excludeEntryId?: string,
) {
  const existingEntries = await prisma.timetableEntry.findMany({
    where: {
      institutionId,
      semesterId: data.semesterId,
      dayOfWeek: data.dayOfWeek as 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY',
      isActive: true,
      ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
    },
  });

  const newStart = timeToMinutes(data.startTime);
  const newEnd = timeToMinutes(data.endTime);

  if (newStart >= newEnd) {
    throw new DomainError('Start time must be before end time.');
  }

  for (const entry of existingEntries) {
    const existStart = timeToMinutes(formatTime(entry.startTime));
    const existEnd = timeToMinutes(formatTime(entry.endTime));

    // Check time overlap
    const hasOverlap = newStart < existEnd && newEnd > existStart;
    if (!hasOverlap) continue;

    // Check week overlap
    if (data.weekStart && data.weekEnd && entry.weekStart && entry.weekEnd) {
      const weekOverlap = data.weekStart <= entry.weekEnd && (data.weekEnd ?? 52) >= entry.weekStart;
      if (!weekOverlap) continue;
    }

    if (entry.staffId === data.staffId) {
      throw new DomainError('This lecturer already has a class at this time.');
    }
    if (entry.roomId === data.roomId) {
      throw new DomainError('This room is already booked at this time.');
    }
    if (entry.groupId === data.groupId) {
      throw new DomainError('This group already has a class at this time.');
    }
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(date: Date): string {
  return date.toISOString().substring(11, 16);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listTimetableEntries(
  context: AuthContext,
  raw: TimetableEntryListQuery,
): Promise<TimetableEntryListResult> {
  requirePermission(context, 'academics.read');
  const query = timetableEntryListQuerySchema.parse(raw);

  const where = {
    ...tenantWhere(context),
    deletedAt: null,
    ...(query.semesterId ? { semesterId: query.semesterId } : {}),
    ...(query.staffId ? { staffId: query.staffId } : {}),
    ...(query.roomId ? { roomId: query.roomId } : {}),
    ...(query.groupId ? { groupId: query.groupId } : {}),
    ...(query.dayOfWeek ? { dayOfWeek: query.dayOfWeek } : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.timetableEntry.count({ where }),
    prisma.timetableEntry.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        unit: { select: { code: true, name: true } },
        staff: { select: { firstName: true, lastName: true } },
        room: { select: { code: true } },
        group: { select: { name: true } },
        semester: { select: { code: true } },
        isActive: true,
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: entries.map((e) => ({
      id: e.id,
      dayOfWeek: e.dayOfWeek,
      startTime: e.startTime,
      endTime: e.endTime,
      unitCode: e.unit.code,
      unitName: e.unit.name,
      staffName: `${e.staff.firstName} ${e.staff.lastName}`,
      roomCode: e.room.code,
      groupName: e.group.name,
      semesterCode: e.semester.code,
      isActive: e.isActive,
    })),
  };
}

export async function getTimetableEntryById(context: AuthContext, id: string) {
  requirePermission(context, 'academics.read');

  const entry = await prisma.timetableEntry.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
    include: {
      unit: { select: { id: true, code: true, name: true } },
      staff: { select: { id: true, firstName: true, lastName: true } },
      room: { select: { id: true, code: true, name: true } },
      group: { select: { id: true, code: true, name: true } },
      semester: { select: { id: true, code: true, name: true } },
    },
  });

  if (!entry) throw new TenantAccessError();
  return entry;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createTimetableEntry(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = createTimetableEntrySchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  // Verify all referenced entities exist
  const [semester, unit, staff, room, group] = await Promise.all([
    prisma.semester.findFirst({ where: { id: input.semesterId, institutionId } }),
    prisma.unit.findFirst({ where: { id: input.unitId, institutionId, deletedAt: null } }),
    prisma.staff.findFirst({ where: { id: input.staffId, institutionId, deletedAt: null } }),
    prisma.room.findFirst({ where: { id: input.roomId, institutionId, deletedAt: null } }),
    prisma.group.findFirst({ where: { id: input.groupId, institutionId, deletedAt: null } }),
  ]);

  if (!semester) throw new DomainError('Semester not found.');
  if (!unit) throw new DomainError('Unit not found.');
  if (!staff) throw new DomainError('Staff member not found.');
  if (!room) throw new DomainError('Room not found.');
  if (!group) throw new DomainError('Group not found.');

  // Check for clashes
  await checkForClashes(institutionId, {
    staffId: input.staffId,
    roomId: input.roomId,
    groupId: input.groupId,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    semesterId: input.semesterId,
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
  });

  const entry = await prisma.timetableEntry.create({
    data: {
      institutionId,
      ...input,
      startTime: new Date(`1970-01-01T${input.startTime}`),
      endTime: new Date(`1970-01-01T${input.endTime}`),
    },
  });

  await recordAudit(context, {
    action: 'timetable_entry.created',
    entityType: 'TimetableEntry',
    entityId: entry.id,
    summary: `Timetable entry created: ${unit.code} on ${input.dayOfWeek}`,
    metadata: { unitId: input.unitId, staffId: input.staffId, roomId: input.roomId, groupId: input.groupId },
  });

  return entry;
}

export async function updateTimetableEntry(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = updateTimetableEntrySchema.parse(raw);

  const existing = await prisma.timetableEntry.findFirst({
    where: { id: input.id, ...tenantWhere(context), deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  // Check for clashes (excluding this entry)
  await checkForClashes(existing.institutionId, {
    staffId: input.staffId,
    roomId: input.roomId,
    groupId: input.groupId,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    semesterId: input.semesterId,
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
  }, input.id);

  const { id, ...data } = input;
  const entry = await prisma.timetableEntry.update({
    where: { id },
    data: {
      ...data,
      startTime: new Date(`1970-01-01T${input.startTime}`),
      endTime: new Date(`1970-01-01T${input.endTime}`),
    },
  });

  await recordAudit(context, {
    action: 'timetable_entry.updated',
    entityType: 'TimetableEntry',
    entityId: entry.id,
    summary: 'Timetable entry updated',
  });

  return entry;
}

export async function archiveTimetableEntry(context: AuthContext, id: string) {
  requirePermission(context, 'academics.manage');
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.timetableEntry.findFirst({
    where: { id, institutionId, deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  await prisma.timetableEntry.update({
    where: { id },
    data: { isActive: false, deletedAt: new Date() },
  });

  await recordAudit(context, {
    action: 'timetable_entry.archived',
    entityType: 'TimetableEntry',
    entityId: id,
    summary: 'Timetable entry archived',
  });
}
