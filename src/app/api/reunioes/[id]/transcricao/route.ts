import { ok, route } from '@/lib/http/api';
import { transcriptSchema } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/http/rate-limit';
import { processTranscript } from '@/server/services/meetings.service';

export const POST = route({ body: transcriptSchema }, async ({ auth, body, params }) => {
  await enforceRateLimit('ai', auth.membershipId);
  return ok(await processTranscript(auth, params.id!, body.transcript));
});
