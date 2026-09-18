import { noContent, ok, route } from '@/lib/http/api';
import { updateTaskSchema } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/http/rate-limit';
import { deleteTask, getTask, updateTask } from '@/server/services/tasks.service';

export const GET = route({}, async ({ auth, params }) => {
  return ok(await getTask(auth, params.id!));
});

export const PATCH = route({ body: updateTaskSchema }, async ({ auth, body, params }) => {
  await enforceRateLimit('mutation', auth.membershipId);
  return ok(await updateTask(auth, params.id!, body));
});

export const DELETE = route({}, async ({ auth, params }) => {
  await deleteTask(auth, params.id!);
  return noContent();
});
