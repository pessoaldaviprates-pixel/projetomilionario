import { ok, route } from '@/lib/http/api';
import { reactionSchema } from '@/lib/validation/schemas';
import { toggleReaction } from '@/server/services/chat.service';

export const POST = route({ body: reactionSchema }, async ({ auth, body, params }) => {
  return ok(await toggleReaction(auth, params.id!, body.emoji));
});
