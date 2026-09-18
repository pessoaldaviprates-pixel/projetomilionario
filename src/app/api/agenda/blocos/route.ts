import { created, route } from '@/lib/http/api';
import { timeBlockSchema } from '@/lib/validation/schemas';
import { createTimeBlock } from '@/server/services/calendar.service';

export const POST = route({ body: timeBlockSchema }, async ({ auth, body }) => {
  return created(
    await createTimeBlock(auth, {
      taskId: body.taskId,
      title: body.title,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
    }),
  );
});
