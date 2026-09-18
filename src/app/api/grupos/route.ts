import { created, ok, route } from '@/lib/http/api';
import { groupSchema } from '@/lib/validation/schemas';
import { createGroup, listGroups } from '@/server/services/org.service';

export const GET = route({}, async ({ auth }) => ok(await listGroups(auth)));

export const POST = route({ body: groupSchema }, async ({ auth, body }) => {
  return created(await createGroup(auth, body));
});
