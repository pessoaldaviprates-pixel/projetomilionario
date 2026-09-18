import { z } from 'zod';
import { created, ok, route } from '@/lib/http/api';
import { calendarEventSchema } from '@/lib/validation/schemas';
import { createEvent, getAgenda } from '@/server/services/calendar.service';

const querySchema = z.object({
  de: z.string(),
  ate: z.string(),
  equipe: z.string().optional(),
});

export const GET = route({ query: querySchema }, async ({ auth, query }) => {
  return ok(
    await getAgenda(auth, {
      from: new Date(query.de),
      to: new Date(query.ate),
      includeTeam: query.equipe === '1',
    }),
  );
});

export const POST = route({ body: calendarEventSchema }, async ({ auth, body }) => {
  return created(
    await createEvent(auth, {
      ...body,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
    }),
  );
});
