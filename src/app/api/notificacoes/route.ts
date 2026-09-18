import { z } from 'zod';
import { ok, route } from '@/lib/http/api';
import { listNotifications, markAllAsRead, markAsRead } from '@/server/services/notifications.service';
import type { NotificationKind } from '@/generated/prisma/enums';

const querySchema = z.object({
  cursor: z.string().optional(),
  naoLidas: z.string().optional(),
  tipo: z.string().optional(),
});

export const GET = route({ query: querySchema }, async ({ auth, query }) => {
  const page = await listNotifications(auth, {
    cursor: query.cursor,
    onlyUnread: query.naoLidas === '1',
    kind: query.tipo as NotificationKind | undefined,
  });
  return ok(page.items, { nextCursor: page.nextCursor, hasMore: page.hasMore });
});

const patchSchema = z.object({ id: z.string().optional(), todas: z.boolean().optional() });

export const PATCH = route({ body: patchSchema }, async ({ auth, body }) => {
  if (body.todas) return ok({ marcadas: await markAllAsRead(auth) });
  if (body.id) {
    await markAsRead(auth, body.id);
    return ok({ marcadas: 1 });
  }
  return ok({ marcadas: 0 });
});
