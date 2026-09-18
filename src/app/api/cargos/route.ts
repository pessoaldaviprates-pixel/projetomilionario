import { created, ok, route } from '@/lib/http/api';
import { roleSchema } from '@/lib/validation/schemas';
import { createRole, listRoles } from '@/server/services/roles.service';

export const GET = route({}, async ({ auth }) => ok(await listRoles(auth)));

export const POST = route({ body: roleSchema }, async ({ auth, body }) => {
  return created(await createRole(auth, body));
});
