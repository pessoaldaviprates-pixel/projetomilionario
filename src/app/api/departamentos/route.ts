import { created, ok, route } from '@/lib/http/api';
import { departmentSchema } from '@/lib/validation/schemas';
import { createDepartment, listDepartments } from '@/server/services/org.service';

export const GET = route({}, async ({ auth }) => ok(await listDepartments(auth)));

export const POST = route({ body: departmentSchema }, async ({ auth, body }) => {
  return created(await createDepartment(auth, body));
});
