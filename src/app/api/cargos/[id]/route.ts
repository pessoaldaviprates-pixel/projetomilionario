import { z } from 'zod';
import { noContent, ok, route } from '@/lib/http/api';
import { updateRoleSchema } from '@/lib/validation/schemas';
import { deleteRole, updateRole } from '@/server/services/roles.service';

export const PATCH = route({ body: updateRoleSchema }, async ({ auth, body, params }) => {
  return ok(await updateRole(auth, params.id!, body));
});

const deleteQuerySchema = z.object({ destino: z.string().optional() });

export const DELETE = route({ query: deleteQuerySchema }, async ({ auth, query, params }) => {
  await deleteRole(auth, params.id!, query.destino);
  return noContent();
});
