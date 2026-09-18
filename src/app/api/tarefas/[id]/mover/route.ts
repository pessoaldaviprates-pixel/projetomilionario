import { z } from 'zod';
import { noContent, route } from '@/lib/http/api';
import { taskStatusSchema } from '@/lib/validation/schemas';
import { moveTask } from '@/server/services/tasks.service';

const moveSchema = z.object({
  status: taskStatusSchema,
  position: z.number().int().min(0).max(100_000),
});

export const POST = route({ body: moveSchema }, async ({ auth, body, params }) => {
  await moveTask(auth, params.id!, body.status, body.position);
  return noContent();
});
