import { z } from 'zod';
import { noContent, ok, route } from '@/lib/http/api';
import { deleteTimeBlock, moveTimeBlock, toggleTimeBlock } from '@/server/services/calendar.service';

const patchSchema = z.object({
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  isDone: z.boolean().optional(),
});

export const PATCH = route({ body: patchSchema }, async ({ auth, body, params }) => {
  if (body.isDone !== undefined) {
    await toggleTimeBlock(auth, params.id!, body.isDone);
    return noContent();
  }
  if (body.startsAt && body.endsAt) {
    return ok(await moveTimeBlock(auth, params.id!, new Date(body.startsAt), new Date(body.endsAt)));
  }
  return noContent();
});

export const DELETE = route({}, async ({ auth, params }) => {
  await deleteTimeBlock(auth, params.id!);
  return noContent();
});
