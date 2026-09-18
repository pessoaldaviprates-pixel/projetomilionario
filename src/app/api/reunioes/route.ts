import { z } from 'zod';
import { created, ok, route } from '@/lib/http/api';
import { meetingSchema } from '@/lib/validation/schemas';
import { createMeeting, listMeetings } from '@/server/services/meetings.service';

const querySchema = z.object({
  de: z.string().optional(),
  ate: z.string().optional(),
  projeto: z.string().optional(),
  minhas: z.string().optional(),
});

export const GET = route({ query: querySchema }, async ({ auth, query }) => {
  return ok(
    await listMeetings(auth, {
      from: query.de ? new Date(query.de) : undefined,
      to: query.ate ? new Date(query.ate) : undefined,
      projectId: query.projeto,
      onlyMine: query.minhas === '1',
    }),
  );
});

export const POST = route({ body: meetingSchema }, async ({ auth, body }) => {
  return created(
    await createMeeting(auth, {
      ...body,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
    }),
  );
});
