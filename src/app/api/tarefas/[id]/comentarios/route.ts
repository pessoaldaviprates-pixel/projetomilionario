import { created, route } from '@/lib/http/api';
import { taskCommentSchema } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/http/rate-limit';
import { addComment } from '@/server/services/tasks.service';

export const POST = route({ body: taskCommentSchema }, async ({ auth, body, params }) => {
  await enforceRateLimit('mutation', auth.membershipId);
  return created(await addComment(auth, params.id!, body.body));
});
