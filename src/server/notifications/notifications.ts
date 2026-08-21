import 'server-only';

import { DomainError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import {
  notificationListQuerySchema,
  type NotificationListQuery,
} from '@/server/notifications/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationListRow {
  id: string;
  title: string;
  body: string;
  kind: string;
  link: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationListResult {
  rows: NotificationListRow[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listNotifications(
  context: AuthContext,
  raw: NotificationListQuery,
): Promise<NotificationListResult> {
  const query = notificationListQuerySchema.parse(raw);
  const institutionId = context.institutionId;

  const where = {
    recipientId: context.userId,
    ...(institutionId ? { institutionId } : {}),
    ...(query.read !== undefined ? { isRead: query.read } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' as const } },
            { body: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, unreadCount, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, isRead: false } }),
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    total,
    unreadCount,
    page: query.page,
    pageSize: query.pageSize,
    rows: notifications,
  };
}

export async function markAsRead(context: AuthContext, id: string) {
  const notification = await prisma.notification.findFirst({
    where: { id, recipientId: context.userId },
  });
  if (!notification) throw new DomainError('Notification not found.');

  if (!notification.isRead) {
    await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }
}

export async function markAllAsRead(context: AuthContext) {
  await prisma.notification.updateMany({
    where: { recipientId: context.userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Internal helpers (used by other server modules)
// ---------------------------------------------------------------------------

export async function sendNotification(
  recipientId: string,
  data: { title: string; body: string; kind?: string; link?: string; institutionId?: string },
) {
  await prisma.notification.create({
    data: {
      recipientId,
      institutionId: data.institutionId ?? null,
      title: data.title,
      body: data.body,
      kind: data.kind ?? 'INFO',
      link: data.link ?? null,
    },
  });
}

export async function sendBulkNotification(
  recipientIds: string[],
  data: { title: string; body: string; kind?: string; link?: string; institutionId?: string },
) {
  if (recipientIds.length === 0) return;

  await prisma.notification.createMany({
    data: recipientIds.map((recipientId) => ({
      recipientId,
      institutionId: data.institutionId ?? null,
      title: data.title,
      body: data.body,
      kind: data.kind ?? 'INFO',
      link: data.link ?? null,
    })),
  });
}
