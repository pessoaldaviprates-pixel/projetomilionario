import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/context';
import { listNotifications } from '@/server/services/notifications.service';
import { NotificationsList } from './notifications-list';

export const metadata: Metadata = { title: 'Notificações' };

export default async function NotificationsPage() {
  const ctx = await requireAuth();
  const page = await listNotifications(ctx, { limit: 50 });

  return (
    <NotificationsList
      initialItems={page.items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        readAt: item.readAt ? item.readAt.toISOString() : null,
      }))}
      nextCursor={page.nextCursor}
    />
  );
}
