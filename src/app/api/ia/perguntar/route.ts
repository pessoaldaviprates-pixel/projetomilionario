import { ok, route } from '@/lib/http/api';
import { aiAskSchema } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/http/rate-limit';
import { ask } from '@/server/services/ai.service';

export const POST = route({ body: aiAskSchema }, async ({ auth, body }) => {
  await enforceRateLimit('ai', auth.membershipId);
  return ok(await ask(auth, body.question, body.threadId));
});
