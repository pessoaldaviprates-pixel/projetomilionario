import { created, route } from '@/lib/http/api';
import { sendMessageSchema } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/http/rate-limit';
import { sendMessage } from '@/server/services/chat.service';

export const POST = route({ body: sendMessageSchema }, async ({ auth, body }) => {
  await enforceRateLimit('message', auth.membershipId);
  return created(await sendMessage(auth, body));
});
