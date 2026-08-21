import { z } from 'zod';

// ---------------------------------------------------------------------------
// Plan schemas
// ---------------------------------------------------------------------------

export const createPlanSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.number().min(0),
  interval: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
  maxStudents: z.number().int().min(1).optional(),
  maxStaff: z.number().int().min(1).optional(),
  maxStorageMb: z.number().int().min(1).optional(),
  maxUnits: z.number().int().min(1).optional(),
  features: z.array(z.string()).default([]),
});

export const updatePlanSchema = createPlanSchema.extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Subscription schemas
// ---------------------------------------------------------------------------

export const changePlanSchema = z.object({
  institutionId: z.string().uuid(),
  planId: z.string().uuid(),
});

export const cancelSubscriptionSchema = z.object({
  institutionId: z.string().uuid(),
  cancelAtPeriodEnd: z.boolean().default(true),
  reason: z.string().max(500).optional(),
});
