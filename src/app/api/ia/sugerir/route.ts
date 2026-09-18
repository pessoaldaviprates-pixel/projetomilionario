import { created, route } from '@/lib/http/api';
import { aiSuggestSchema } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/http/rate-limit';
import { suggestFromText } from '@/server/services/ai.service';

export const POST = route({ body: aiSuggestSchema }, async ({ auth, body }) => {
  await enforceRateLimit('ai', auth.membershipId);
  const suggestions = await suggestFromText(auth, body.text, {
    type: body.sourceType,
    id: body.sourceId,
  });
  return created(suggestions);
});
