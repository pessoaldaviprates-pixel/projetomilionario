import { z } from 'zod';
import { ok, route } from '@/lib/http/api';
import { listMessages } from '@/server/services/chat.service';

const querySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  thread: z.string().optional(),
});

export const GET = route({ query: querySchema }, async ({ auth, query, params }) => {
  const page = await listMessages(auth, params.id!, {
    cursor: query.cursor,
    limit: query.limit,
    parentId: query.thread,
  });
  return ok(page.items, { nextCursor: page.nextCursor, hasMore: page.hasMore });
});
