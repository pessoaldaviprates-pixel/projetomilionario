import { noContent, ok, route } from '@/lib/http/api';
import { departmentSchema } from '@/lib/validation/schemas';
import { deleteDepartment, updateDepartment } from '@/server/services/org.service';

export const PATCH = route({ body: departmentSchema.partial() }, async ({ auth, body, params }) => {
  return ok(await updateDepartment(auth, params.id!, body));
});

export const DELETE = route({}, async ({ auth, params }) => {
  await deleteDepartment(auth, params.id!);
  return noContent();
});
