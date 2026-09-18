import { z } from 'zod';
import { noContent, ok, route } from '@/lib/http/api';
import { acceptActionItem, dismissActionItem } from '@/server/services/meetings.service';

const decisionSchema = z.object({
  decision: z.enum(['ACCEPT', 'DISMISS']),
  assigneeId: z.string().nullish(),
  dueAt: z.string().datetime({ offset: true }).nullish(),
});

export const POST = route({ body: decisionSchema }, async ({ auth, body, params }) => {
  if (body.decision === 'DISMISS') {
    await dismissActionItem(auth, params.id!, params.itemId!);
    return noContent();
  }

  const task = await acceptActionItem(auth, params.id!, params.itemId!, {
    assigneeId: body.assigneeId,
    dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
  });
  return ok(task);
});
