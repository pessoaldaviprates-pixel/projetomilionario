import { z } from 'zod';
import { created, noContent, route } from '@/lib/http/api';
import { addChecklistItem, toggleChecklistItem } from '@/server/services/tasks.service';

const createSchema = z.object({ title: z.string().trim().min(1).max(200) });
const toggleSchema = z.object({ itemId: z.string().min(1), isDone: z.boolean() });

export const POST = route({ body: createSchema }, async ({ auth, body, params }) => {
  return created(await addChecklistItem(auth, params.id!, body.title));
});

export const PATCH = route({ body: toggleSchema }, async ({ auth, body, params }) => {
  await toggleChecklistItem(auth, params.id!, body.itemId, body.isDone);
  return noContent();
});
