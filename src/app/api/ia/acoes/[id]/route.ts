import { noContent, ok, route } from '@/lib/http/api';
import { aiDecisionSchema } from '@/lib/validation/schemas';
import { acceptAction, dismissAction } from '@/server/services/ai.service';

export const POST = route({ body: aiDecisionSchema }, async ({ auth, body, params }) => {
  if (body.decision === 'DISMISS') {
    await dismissAction(auth, params.id!);
    return noContent();
  }

  const task = await acceptAction(auth, params.id!, {
    title: body.overrides?.title,
    assigneeId: body.overrides?.assigneeId,
    dueAt: body.overrides?.dueAt ? new Date(body.overrides.dueAt) : undefined,
    projectId: body.overrides?.projectId,
    priority: body.overrides?.priority,
  });

  return ok(task);
});
