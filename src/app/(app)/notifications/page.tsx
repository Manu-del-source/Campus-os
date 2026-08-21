'use client';

import { useTransition, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';

interface Notification {
  id: string;
  title: string;
  body: string;
  kind: string;
  link: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

interface NotificationsClientProps {
  initialNotifications: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
}

export function NotificationsClient({
  initialNotifications,
  total,
  unreadCount,
}: NotificationsClientProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isPending, startTransition] = useTransition();

  const markAsRead = (id: string) => {
    startTransition(async () => {
      // In a real implementation, this would call a server action
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date() } : n))
      );
    });
  };

  const markAllRead = () => {
    startTransition(async () => {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
      );
    });
  };

  const kindTone = (kind: string) => {
    switch (kind) {
      case 'SUCCESS': return 'success' as const;
      case 'WARNING': return 'warning' as const;
      case 'ERROR': return 'danger' as const;
      default: return 'accent' as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Notifications"
          description={`${total} notification${total === 1 ? '' : 's'}${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}.`}
        />
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={isPending}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      <Card>
        {notifications.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No notifications"
              description="You're all caught up!"
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-4 p-4 ${!notification.isRead ? 'bg-[var(--color-accent-subtle)]' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{notification.title}</h3>
                    <Badge tone={kindTone(notification.kind)}>{notification.kind.toLowerCase()}</Badge>
                    {!notification.isRead && (
                      <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{notification.body}</p>
                  {notification.link && (
                    <a
                      href={notification.link}
                      className="mt-1 inline-block text-sm text-[var(--color-accent)] hover:underline"
                    >
                      View details →
                    </a>
                  )}
                </div>
                {!notification.isRead && (
                  <button
                    onClick={() => markAsRead(notification.id)}
                    disabled={isPending}
                    className="shrink-0 text-xs text-[var(--color-muted-foreground)] hover:underline"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
