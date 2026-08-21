import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import {
  createAttendanceSessionSchema,
  markAttendanceSchema,
  cancelSessionSchema,
  attendanceSessionListQuerySchema,
  type AttendanceSessionListQuery,
} from '@/server/attendance/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttendanceSessionListRow {
  id: string;
  sessionDate: Date;
  startTime: Date;
  endTime: Date;
  topic: string | null;
  isCancelled: boolean;
  unitCode: string;
  groupName: string;
  staffName: string;
  recordCount: number;
}

export interface AttendanceSessionListResult {
  rows: AttendanceSessionListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AttendanceRecordListRow {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  status: string;
  notes: string | null;
  markedBy: string | null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listAttendanceSessions(
  context: AuthContext,
  raw: AttendanceSessionListQuery,
): Promise<AttendanceSessionListResult> {
  requirePermission(context, 'attendance.read');
  const query = attendanceSessionListQuerySchema.parse(raw);

  const where = {
    ...tenantWhere(context),
    ...(query.timetableEntryId ? { timetableEntryId: query.timetableEntryId } : {}),
    ...(query.startDate ? { sessionDate: { gte: new Date(query.startDate) } } : {}),
    ...(query.endDate ? { sessionDate: { lte: new Date(query.endDate) } } : {}),
  };

  const [total, sessions] = await Promise.all([
    prisma.attendanceSession.count({ where }),
    prisma.attendanceSession.findMany({
      where,
      orderBy: [{ sessionDate: 'desc' }, { startTime: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        sessionDate: true,
        startTime: true,
        endTime: true,
        topic: true,
        isCancelled: true,
        timetableEntry: {
          select: {
            unit: { select: { code: true } },
            group: { select: { name: true } },
            staff: { select: { firstName: true, lastName: true } },
          },
        },
        _count: { select: { records: true } },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: sessions.map((s) => ({
      id: s.id,
      sessionDate: s.sessionDate,
      startTime: s.startTime,
      endTime: s.endTime,
      topic: s.topic,
      isCancelled: s.isCancelled,
      unitCode: s.timetableEntry.unit.code,
      groupName: s.timetableEntry.group.name,
      staffName: `${s.timetableEntry.staff.firstName} ${s.timetableEntry.staff.lastName}`,
      recordCount: s._count.records,
    })),
  };
}

export async function getAttendanceSessionById(context: AuthContext, id: string) {
  requirePermission(context, 'attendance.read');

  const session = await prisma.attendanceSession.findFirst({
    where: { id, ...tenantWhere(context) },
    include: {
      timetableEntry: {
        select: {
          unit: { select: { code: true, name: true } },
          group: { select: { code: true, name: true } },
          staff: { select: { firstName: true, lastName: true } },
        },
      },
      records: {
        select: {
          id: true,
          student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } },
          status: true,
          notes: true,
          markedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { student: { lastName: 'asc' } },
      },
    },
  });

  if (!session) throw new TenantAccessError();
  return session;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createAttendanceSession(context: AuthContext, raw: unknown) {
  requirePermission(context, 'attendance.record');
  const input = createAttendanceSessionSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  // Verify timetable entry exists
  const entry = await prisma.timetableEntry.findFirst({
    where: { id: input.timetableEntryId, institutionId, deletedAt: null },
  });
  if (!entry) throw new DomainError('Timetable entry not found.');

  // Check for duplicate session on same date
  const existing = await prisma.attendanceSession.findFirst({
    where: {
      institutionId,
      timetableEntryId: input.timetableEntryId,
      sessionDate: new Date(input.sessionDate),
    },
  });
  if (existing) throw new DomainError('An attendance session already exists for this date and timetable entry.');

  // Auto-create records for all students in the group
  const groupStudents = await prisma.student.findMany({
    where: {
      institutionId,
      groupId: entry.groupId,
      deletedAt: null,
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  const session = await prisma.attendanceSession.create({
    data: {
      institutionId,
      timetableEntryId: input.timetableEntryId,
      sessionId: crypto.randomUUID(),
      sessionDate: new Date(input.sessionDate),
      startTime: new Date(`1970-01-01T${input.startTime}`),
      endTime: new Date(`1970-01-01T${input.endTime}`),
      topic: input.topic,
      notes: input.notes,
      records: {
        create: groupStudents.map((s) => ({
          institutionId,
          studentId: s.id,
          status: 'ABSENT', // Default to absent
        })),
      },
    },
  });

  await recordAudit(context, {
    action: 'attendance.session_created',
    entityType: 'AttendanceSession',
    entityId: session.id,
    summary: `Attendance session created for ${input.sessionDate} with ${groupStudents.length} students`,
    metadata: { timetableEntryId: input.timetableEntryId, studentCount: groupStudents.length },
  });

  return session;
}

export async function markAttendance(context: AuthContext, raw: unknown) {
  requirePermission(context, 'attendance.record');
  const input = markAttendanceSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const session = await prisma.attendanceSession.findFirst({
    where: { id: input.attendanceSessionId, institutionId },
  });
  if (!session) throw new TenantAccessError();

  if (session.isCancelled) throw new DomainError('Cannot mark attendance for a cancelled session.');

  // Update records
  for (const record of input.records) {
    await prisma.attendanceRecord.upsert({
      where: {
        institutionId_attendanceSessionId_studentId: {
          institutionId,
          attendanceSessionId: input.attendanceSessionId,
          studentId: record.studentId,
        },
      },
      update: {
        status: record.status,
        notes: record.notes,
        markedById: context.userId,
      },
      create: {
        institutionId,
        attendanceSessionId: input.attendanceSessionId,
        studentId: record.studentId,
        status: record.status,
        notes: record.notes,
        markedById: context.userId,
      },
    });
  }

  await recordAudit(context, {
    action: 'attendance.marked',
    entityType: 'AttendanceSession',
    entityId: input.attendanceSessionId,
    summary: `Attendance marked for ${input.records.length} students`,
    metadata: { recordCount: input.records.length },
  });
}

export async function cancelAttendanceSession(context: AuthContext, raw: unknown) {
  requirePermission(context, 'attendance.record');
  const input = cancelSessionSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const session = await prisma.attendanceSession.findFirst({
    where: { id: input.id, institutionId },
  });
  if (!session) throw new TenantAccessError();

  await prisma.attendanceSession.update({
    where: { id: input.id },
    data: {
      isCancelled: true,
      cancelledReason: input.reason,
    },
  });

  await recordAudit(context, {
    action: 'attendance.session_cancelled',
    entityType: 'AttendanceSession',
    entityId: input.id,
    summary: `Attendance session cancelled: ${input.reason}`,
    metadata: { reason: input.reason },
  });
}

// ---------------------------------------------------------------------------
// Attendance summary
// ---------------------------------------------------------------------------

export async function getStudentAttendanceSummary(
  context: AuthContext,
  studentId: string,
  semesterId: string,
) {
  requirePermission(context, 'attendance.read');
  const institutionId = tenantWhere(context).institutionId;

  const records = await prisma.attendanceRecord.findMany({
    where: {
      institutionId,
      studentId,
      session: {
        timetableEntry: { semesterId },
      },
    },
    select: { status: true },
  });

  const total = records.length;
  const present = records.filter((r) => r.status === 'PRESENT').length;
  const late = records.filter((r) => r.status === 'LATE').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;
  const excused = records.filter((r) => r.status === 'EXCUSED').length;
  const percentage = total > 0 ? ((present + late) / total) * 100 : 0;

  return { total, present, late, absent, excused, percentage: Math.round(percentage * 10) / 10 };
}
