import { z } from 'zod';

// ---------------------------------------------------------------------------
// Registration schemas
// ---------------------------------------------------------------------------

export const createRegistrationSchema = z.object({
  studentId: z.string().uuid(),
  unitId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

export const updateRegistrationStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['PENDING', 'CONFIRMED', 'DROPPED', 'WITHDRAWN']),
  reason: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Shared list query
// ---------------------------------------------------------------------------

export const registrationListQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'CONFIRMED', 'DROPPED', 'WITHDRAWN']).optional(),
  semesterId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
});

export type RegistrationListQuery = z.infer<typeof registrationListQuerySchema>;
