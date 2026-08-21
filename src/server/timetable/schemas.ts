import { z } from 'zod';

// ---------------------------------------------------------------------------
// Room schemas
// ---------------------------------------------------------------------------

export const createRoomSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  building: z.string().trim().max(120).optional(),
  floor: z.number().int().min(0).max(50).optional(),
  capacity: z.number().int().min(1).max(10000).optional(),
  roomType: z.string().trim().max(40).default('CLASSROOM'),
});

export const updateRoomSchema = createRoomSchema.extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Timetable entry schemas
// ---------------------------------------------------------------------------

export const createTimetableEntrySchema = z.object({
  semesterId: z.string().uuid(),
  unitId: z.string().uuid(),
  staffId: z.string().uuid(),
  roomId: z.string().uuid(),
  groupId: z.string().uuid(),
  dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format'),
  weekStart: z.number().int().min(1).max(52).optional(),
  weekEnd: z.number().int().min(1).max(52).optional(),
});

export const updateTimetableEntrySchema = createTimetableEntrySchema.extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// List query schemas
// ---------------------------------------------------------------------------

export const roomListQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type RoomListQuery = z.infer<typeof roomListQuerySchema>;

export const timetableEntryListQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  semesterId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).optional(),
});

export type TimetableEntryListQuery = z.infer<typeof timetableEntryListQuerySchema>;
