import { z } from 'zod';
import { noContent, route } from '@/lib/http/api';
import { respondToMeeting } from '@/server/services/meetings.service';

const responseSchema = z.object({ response: z.enum(['ACCEPTED', 'DECLINED', 'TENTATIVE']) });

export const POST = route({ body: responseSchema }, async ({ auth, body, params }) => {
  await respondToMeeting(auth, params.id!, body.response);
  return noContent();
});
