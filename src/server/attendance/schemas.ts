import { z } from 'zod';

// ---------------------------------------------------------------------------
// Attendance schemas
// ---------------------------------------------------------------------------

export const createAttendanceSessionSchema = z.object({
  timetableEntryId: z.string().uuid(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format'),
  topic: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

export const markAttendanceSchema = z.object({
  attendanceSessionId: z.string().uuid(),
  records: z.array(
    z.object({
      studentId: z.string().uuid(),
      status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
      notes: z.string().max(500).optional(),
    }),
  ),
});

export const cancelSessionSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

// ---------------------------------------------------------------------------
// List query schemas
// ---------------------------------------------------------------------------

export const attendanceSessionListQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  timetableEntryId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type AttendanceSessionListQuery = z.infer<typeof attendanceSessionListQuerySchema>;

export const attendanceRecordListQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  attendanceSessionId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).optional(),
});

export type AttendanceRecordListQuery = z.infer<typeof attendanceRecordListQuerySchema>;
