import { z } from 'zod';

// ---------------------------------------------------------------------------
// Notification schemas
// ---------------------------------------------------------------------------

export const createNotificationSchema = z.object({
  recipientId: z.string().uuid().optional(),
  recipientRole: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(2000),
  kind: z.string().max(40).default('INFO'),
  link: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------

export const notificationListQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  read: z.coerce.boolean().optional(),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
